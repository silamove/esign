# Cryptographic Flow

- Sign over canonical payload (raw signature bytes) per Sigstore guidance (What to sign: countersign signatures).
- TSA (RFC3161) flow:
  1) Create TSQ over SHA-256 digest of payload
  2) POST to TSA_URL application/timestamp-query
  3) Store TSR reply (base64) in signature_evidences
  4) Include hash links in audit_events chain
- Cosign (optional): use sign-blob, capture bundle and certificate.
- Production: use KMS/Tink signer with proper certificate chain (timestamping EKU).
