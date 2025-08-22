param(
  [string]$Domain = "localhost",
  [string]$OutDir = "nginx/certs",
  [int]$Years = 3
)

$ErrorActionPreference = 'Stop'

if (!(Test-Path $OutDir)) {
  New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
}

$caKey = Join-Path $OutDir 'dev-ca.key'
$caCrt = Join-Path $OutDir 'dev-ca.crt'
$leafKey = Join-Path $OutDir 'server.key'
$leafCrt = Join-Path $OutDir 'server.crt'

Write-Host "Generating Dev CA and leaf cert for $Domain ..."

# Create a self-signed CA certificate
$ca = New-SelfSignedCertificate `
  -DnsName "dev-ca.$Domain" `
  -FriendlyName "OnDottedLine Dev CA" `
  -CertStoreLocation "Cert:\CurrentUser\My" `
  -KeyAlgorithm RSA `
  -KeyLength 2048 `
  -HashAlgorithm SHA256 `
  -KeyExportPolicy Exportable `
  -TextExtension @("2.5.29.19={text}CA=true&pathlength=1") `
  -NotAfter (Get-Date).AddYears($Years)

if (-not $ca) { throw "Failed to create Dev CA" }

# Export CA cert and key (PKCS#8)
$caCertBytes = $ca.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)
$caKeyBytes = $ca.GetRSAPrivateKey().ExportPkcs8PrivateKey()

$caCertPem = "-----BEGIN CERTIFICATE-----`n" + [Convert]::ToBase64String($caCertBytes, 'InsertLineBreaks') + "`n-----END CERTIFICATE-----`n"
$caKeyPem  = "-----BEGIN PRIVATE KEY-----`n" + [Convert]::ToBase64String($caKeyBytes, 'InsertLineBreaks') + "`n-----END PRIVATE KEY-----`n"

Set-Content -Path $caCrt -Value $caCertPem -NoNewline
Set-Content -Path $caKey -Value $caKeyPem -NoNewline

# Create a leaf cert signed by the Dev CA
$leaf = New-SelfSignedCertificate `
  -DnsName $Domain, "127.0.0.1", "::1" `
  -FriendlyName "OnDottedLine Dev TLS ($Domain)" `
  -CertStoreLocation "Cert:\CurrentUser\My" `
  -KeyAlgorithm RSA `
  -KeyLength 2048 `
  -HashAlgorithm SHA256 `
  -KeyExportPolicy Exportable `
  -Signer $ca `
  -TextExtension @(
    "2.5.29.19={text}CA=false",
    "2.5.29.17={text}DNS=$Domain,IP=127.0.0.1,IP=::1",
    "2.5.29.37={text}1.3.6.1.5.5.7.3.1"  # serverAuth
  ) `
  -NotAfter (Get-Date).AddYears([Math]::Min($Years,1))

if (-not $leaf) { throw "Failed to create leaf certificate" }

$leafCertBytes = $leaf.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)
$leafKeyBytes = $leaf.GetRSAPrivateKey().ExportPkcs8PrivateKey()

$leafCertPem = "-----BEGIN CERTIFICATE-----`n" + [Convert]::ToBase64String($leafCertBytes, 'InsertLineBreaks') + "`n-----END CERTIFICATE-----`n"
$leafKeyPem  = "-----BEGIN PRIVATE KEY-----`n" + [Convert]::ToBase64String($leafKeyBytes, 'InsertLineBreaks') + "`n-----END PRIVATE KEY-----`n"

Set-Content -Path $leafCrt -Value $leafCertPem -NoNewline
Set-Content -Path $leafKey -Value $leafKeyPem -NoNewline

Write-Host "Created:"
Write-Host " - $caCrt (Dev CA)"
Write-Host " - $caKey (Dev CA private key)"
Write-Host " - $leafCrt (Leaf cert)"
Write-Host " - $leafKey (Leaf key)"

Write-Host "Optional: Trust the Dev CA in Windows (User store → Trusted Root Certification Authorities)"
Write-Host "You can import $caCrt via certmgr.msc or PowerShell:"
Write-Host "  Import-Certificate -FilePath `"$caCrt`" -CertStoreLocation Cert:\\CurrentUser\\Root"
