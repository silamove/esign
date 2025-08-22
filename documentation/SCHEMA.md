# Database Schema (PostgreSQL)

Key entities:
- envelopes (uuid, tenant_id, status, timestamps)
- documents (id, uuid, user_id, filename, total_pages, metadata jsonb)
- envelope_documents (envelope->document mapping)
- recipients (unified across envelopes/templates)
- fields (unified across envelopes/templates)
- signature_evidences (RFC3161 replies, cosign bundles, hashes)
- audit_events (tamper-evident chain)

Compatibility views exist for legacy code. Triggers ensure column sync (e.g., filename/user_id).
