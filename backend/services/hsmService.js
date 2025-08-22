const crypto = require('crypto');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
const fs = require('fs').promises;
const os = require('os');
const path = require('path');

/**
 * HSM/TSP abstraction
 * In production, back this with a real provider (AWS KMS, Azure Key Vault HSM, Entrust, etc.).
 * For now, provide a development signer that uses a process-wide private key.
 */
class HsmService {
  constructor() {
    this.provider = process.env.HSM_PROVIDER || 'internal_dev';
    // Optional TSA provider for dev: 'none' (default), 'internal_dev', 'clock', or 'sigstore_rfc3161'
    this.tsaProvider = process.env.TSA_PROVIDER || process.env.HSM_TSA_PROVIDER || 'none';
    this.tsaUrl = process.env.TSA_URL || 'http://localhost:3000/api/v1/timestamp';
    this.tsaUseDocker = process.env.TSA_USE_DOCKER === 'true';
    this.opensslPath = process.env.OPENSSL_PATH || 'openssl';
    this.tsaCertReq = process.env.TSA_CERT_REQ !== 'false'; // include -cert by default
    this.tsaDevFallback = process.env.TSA_DEV_FALLBACK === 'true';
    // New: configurable TSA policy OID (used in dev token and RFC3161 TSQ)
    this.tsaPolicyOid = process.env.TSA_POLICY_OID || '1.2.3.4.5.777';

    // Cosign settings (local CLI expected)
    this.cosignPath = process.env.COSIGN_PATH || 'cosign';
    this.cosignMode = process.env.COSIGN_MODE || 'keyless'; // keyless | key | kms
    this.cosignKeyPath = process.env.COSIGN_KEY_PATH; // for key mode
    this.cosignKmsUri = process.env.COSIGN_KMS_URI;   // for kms mode
    this.cosignIdentityToken = process.env.COSIGN_IDENTITY_TOKEN; // optional for keyless non-interactive
    this.cosignRekorUrl = process.env.COSIGN_REKOR_URL; // optional
    this.cosignFulcioUrl = process.env.COSIGN_FULCIO_URL; // optional
    this.cosignPassword = process.env.COSIGN_PASSWORD; // optional for password-protected keys

    // Dev-only ephemeral key for demonstration. Do NOT use in production.
    if (this.provider === 'internal_dev') {
      const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
      });
      this.devPrivateKey = privateKey;
      this.devPublicKey = publicKey;
    }
  }

  _sha256Base64(data) {
    return crypto.createHash('sha256').update(data).digest('base64');
  }

  _sha256Hex(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  _signBase64(payloadStr) {
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(payloadStr);
    return sign.sign(this.devPrivateKey, 'base64');
  }

  async _issueDevTsaToken(payloadStr) {
    // Simulated RFC3161-like token for development
    const hashedMessage = this._sha256Base64(payloadStr);
    const token = {
      version: 1,
      policy: this.tsaPolicyOid,
      genTime: new Date().toISOString(),
      nonce: crypto.randomBytes(16).toString('hex'),
      serial: crypto.randomBytes(8).toString('hex'),
      accuracyMs: 1000,
      messageImprint: {
        hashAlgorithm: 'sha256',
        hashedMessage
      },
      issuer: 'OnDottedLine Dev TSA',
      provider: 'internal_dev'
    };

    // Sign the token with the dev HSM key
    const tokenStr = JSON.stringify(token);
    const tokenSignature = this._signBase64(tokenStr);

    return {
      type: 'internal_dev_tsa',
      token,
      signature: tokenSignature,
      certChain: [{ alg: 'RSA-SHA256', publicKey: this.devPublicKey }]
    };
  }

  async _makeRfc3161Tsq(digestHex) {
    const baseArgs = ['ts', '-query', '-sha256', '-digest', digestHex];
    if (this.tsaCertReq) baseArgs.push('-cert');
    if (this.tsaPolicyOid) baseArgs.push('-policy', this.tsaPolicyOid);
    baseArgs.push('-out', '-'); // write DER to stdout

    if (!this.tsaUseDocker) {
      // Try local OpenSSL
      const { stdout } = await execFileAsync(this.opensslPath, baseArgs, {
        encoding: 'buffer',
        maxBuffer: 10 * 1024 * 1024
      });
      return Buffer.from(stdout);
    }

    // Use Dockerized OpenSSL
    const dockerArgs = ['run', '--rm', 'bitnami/openssl', ...baseArgs];
    const { stdout } = await execFileAsync('docker', dockerArgs, {
      encoding: 'buffer',
      maxBuffer: 10 * 1024 * 1024
    });
    return Buffer.from(stdout);
  }

  async _requestSigstoreTSA(tsqBuffer) {
    const fetch = (await import('node-fetch')).default;
    const res = await fetch(this.tsaUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/timestamp-query' },
      body: tsqBuffer
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`TSA request failed (${res.status}): ${text}`);
    }
    const arrayBuf = await res.arrayBuffer();
    return Buffer.from(arrayBuf);
  }

  async _issueSigstoreRfc3161Token(payloadStr) {
    const digestHex = this._sha256Hex(payloadStr);
    try {
      const tsq = await this._makeRfc3161Tsq(digestHex);
      const tsr = await this._requestSigstoreTSA(tsq);
      return {
        type: 'rfc3161',
        provider: 'sigstore',
        url: this.tsaUrl,
        request: tsq.toString('base64'),
        reply: tsr.toString('base64')
      };
    } catch (err) {
      if (this.tsaDevFallback) {
        return this._issueDevTsaToken(payloadStr);
      }
      throw err;
    }
  }

  async _signWithCosign(payloadStr) {
    // Write payload to a temp file
    const tmpDir = os.tmpdir();
    const base = `odl-${crypto.randomBytes(8).toString('hex')}`;
    const blobPath = path.join(tmpDir, `${base}.bin`);
    const bundlePath = path.join(tmpDir, `${base}.bundle.json`);
    const certPath = path.join(tmpDir, `${base}.cert.pem`);

    await fs.writeFile(blobPath, payloadStr, 'utf8');

    const args = ['sign-blob', '--yes', '--bundle', bundlePath, '--output-certificate', certPath];
    if (this.cosignRekorUrl) args.push('--rekor-url', this.cosignRekorUrl);
    if (this.cosignFulcioUrl) args.push('--fulcio-url', this.cosignFulcioUrl);

    if (this.cosignMode === 'key' && this.cosignKeyPath) {
      args.push('--key', this.cosignKeyPath);
    } else if (this.cosignMode === 'kms' && this.cosignKmsUri) {
      args.push('--key', this.cosignKmsUri);
    } else {
      // keyless; try to pass identity token if provided
      if (this.cosignIdentityToken) {
        args.push('--identity-token', this.cosignIdentityToken);
      }
      // Enable experimental for keyless in case needed
      process.env.COSIGN_EXPERIMENTAL = process.env.COSIGN_EXPERIMENTAL || 'true';
    }

    args.push(blobPath);

    const env = { ...process.env };
    if (this.cosignPassword) env.COSIGN_PASSWORD = this.cosignPassword;

    let signature = '';
    try {
      const { stdout } = await execFileAsync(this.cosignPath, args, { env, maxBuffer: 10 * 1024 * 1024 });
      signature = String(stdout).trim();
    } finally {
      // no-op
    }

    // Read bundle and certificate if available
    let bundle = null;
    let certPem = null;
    try {
      const bundleJson = await fs.readFile(bundlePath, 'utf8');
      bundle = JSON.parse(bundleJson);
    } catch (_) {}
    try {
      certPem = await fs.readFile(certPath, 'utf8');
    } catch (_) {}

    // Clean up temp files (best-effort)
    try { await fs.unlink(blobPath); } catch (_) {}
    try { await fs.unlink(bundlePath); } catch (_) {}
    try { await fs.unlink(certPath); } catch (_) {}

    return {
      signatureBlob: signature,
      tsaToken: bundle ? { type: 'sigstore_bundle', bundle } : null,
      certChain: certPem ? [{ pem: certPem }] : undefined
    };
  }

  /**
   * Sign a canonical payload object. Returns { provider, signatureBlob, tsaToken, certChain }
   */
  async signPayload(payload) {
    const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);

    if (this.provider === 'internal_dev') {
      const signature = this._signBase64(payloadStr);

      let tsaToken = null;
      if (this.tsaProvider === 'internal_dev') {
        tsaToken = await this._issueDevTsaToken(payloadStr);
      } else if (this.tsaProvider === 'clock') {
        tsaToken = { type: 'clock', genTime: new Date().toISOString() };
      } else if (this.tsaProvider === 'sigstore_rfc3161') {
        tsaToken = await this._issueSigstoreRfc3161Token(payloadStr);
      }

      return {
        provider: 'internal_dev',
        signatureBlob: signature,
        tsaToken,
        certChain: [{ alg: 'RSA-SHA256', publicKey: this.devPublicKey }]
      };
    }

    if (this.provider === 'sigstore_cosign') {
      const { signatureBlob, tsaToken, certChain } = await this._signWithCosign(payloadStr);
      return {
        provider: 'sigstore_cosign',
        signatureBlob,
        tsaToken,
        certChain
      };
    }

    // Placeholder for real providers (implement as needed)
    throw new Error(`HSM provider not configured: ${this.provider}`);
  }
}

module.exports = new HsmService();
