# Docker hardening, cryptographic signing, and trusted timestamping

This stack adds:

- Hardened Postgres (no host exposure, read-only FS, healthchecks)
- Backend behind NGINX TLS reverse proxy with security headers
- Sigstore Timestamp Authority (RFC3161) for trusted timestamps (dev default signer)
- Optional Cosign CLI container for countersigning/verification workflows

## Services

- postgres: internal only, persisted volume `pgdata`.
- backend: Node API, reads `TSA_URL` to request timestamps for sign flows.
- tsa: ghcr.io/sigstore/timestamp-server. In dev uses in-memory signer.
- nginx: TLS termination and security headers.
- cosign: optional utility container.

## Certificates for NGINX

Place a TLS cert/key in `nginx/certs`:

- `nginx/certs/server.crt`
- `nginx/certs/server.key`

For dev, you can generate a self-signed pair. Example (PowerShell, using WSL/OpenSSL or Git Bash):

- openssl req -x509 -newkey rsa:2048 -nodes -keyout nginx/certs/server.key -out nginx/certs/server.crt -days 365 -subj "/CN=localhost"

## Start

- docker compose up -d --build
- Visit https://localhost/
- TSA chain: within the network at http://tsa:3000/api/v1/timestamp/certchain

## Production TSA configuration

Mount a certificate chain and configure a signer as per sigstore/timestamp-authority docs.
Set environment and volumes for the `tsa` service accordingly.

## Backend integration

Ensure `backend/services/hsmService.js` uses `process.env.TSA_URL` to timestamp raw signature bytes (not base64), and stores the full RFC3161 response (`.tsr`) in `signature_evidences` along with chain hashes in `audit_events`.

## Cosign usage (optional)

- docker compose exec cosign cosign version
- Use for countersigning and verification flows, or leave disabled.
