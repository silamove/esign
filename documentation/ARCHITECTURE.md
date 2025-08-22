# OnDottedLine Architecture Overview

This document describes the high-level architecture with emphasis on the envelope-centric, multi-tenant, PostgreSQL-backed design.

- Backend: Node.js/Express, envelope-first domain model.
- Database: PostgreSQL with unified recipients and fields, audit_events, signature_evidences.
- Crypto: HSM/TSP abstraction, TSA (RFC3161) integration, optional cosign countersigning.
- Frontend: SPA (not covered here).
- Docker: NGINX reverse proxy, backend, optional TSA, optional Postgres.

See SCHEMA.md and CRYPTO.md for details.
