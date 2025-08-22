param(
  [string]$Domain = "localhost",
  [string]$OutDir = "nginx/certs",
  [int]$Days = 365
)

$ErrorActionPreference = 'Stop'

if (!(Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }

$work = Resolve-Path $OutDir
$caKey = Join-Path $work 'dev-ca.key'
$caCrt = Join-Path $work 'dev-ca.crt'
$leafKey = Join-Path $work 'server.key'
$leafCrt = Join-Path $work 'server.crt'
$caExt = Join-Path $work 'ca-ext.cnf'
$leafExt = Join-Path $work 'server-ext.cnf'

# Write extension files
@"
[v3_ca]
subjectKeyIdentifier=hash
authorityKeyIdentifier=keyid:always,issuer
basicConstraints=critical,CA:TRUE,pathlen=1
keyUsage=critical,keyCertSign,cRLSign
"@ | Set-Content -Path $caExt -NoNewline

@"
[v3_req]
basicConstraints = CA:FALSE
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names
[alt_names]
DNS.1 = $Domain
IP.1 = 127.0.0.1
IP.2 = ::1
"@ | Set-Content -Path $leafExt -NoNewline

Write-Host "Generating Dev CA and $Domain certificate with Docker (bitnami/openssl)..."

# Generate CA key/cert
$cmd1 = "openssl genrsa -out dev-ca.key 2048 && openssl req -x509 -new -key dev-ca.key -sha256 -days 1095 -subj '/CN=OnDottedLine Dev CA' -out dev-ca.crt -extfile ca-ext.cnf -extensions v3_ca"
& docker run --rm -v "$($work):/work" -w /work bitnami/openssl:latest sh -c $cmd1 | Out-Null

# Generate server key/cert signed by CA
$cmd2 = "openssl genrsa -out server.key 2048 && openssl req -new -key server.key -subj '/CN=$Domain' -out server.csr && openssl x509 -req -in server.csr -CA dev-ca.crt -CAkey dev-ca.key -CAcreateserial -out server.crt -days $Days -sha256 -extfile server-ext.cnf -extensions v3_req && rm -f server.csr"
& docker run --rm -v "$($work):/work" -w /work bitnami/openssl:latest sh -c $cmd2 | Out-Null

Write-Host "Created:"
Write-Host " - $caCrt (Dev CA)"
Write-Host " - $caKey (Dev CA private key)"
Write-Host " - $leafCrt (Leaf cert)"
Write-Host " - $leafKey (Leaf key)"

Write-Host "Trust the Dev CA to avoid browser warnings (Windows user root store):"
Write-Host "  Import-Certificate -FilePath `"$caCrt`" -CertStoreLocation Cert:\\CurrentUser\\Root"
