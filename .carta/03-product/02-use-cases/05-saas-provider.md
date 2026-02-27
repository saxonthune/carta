---
title: SaaS Provider
status: archived
---

# SaaS Provider (Archived)

This use case described a hosted multi-tenant Carta service with user accounts, document management, billing, and metered AI access. It assumed server-managed documents (MongoDB/DynamoDB) and a platform business model.

**Superseded by ADR 009** (filesystem-first workspace). The workspace model replaces server-managed documents with git-backed files. Non-developer access is handled by the workspace server's git integration (see doc03.02.03, Team Workspace) rather than a SaaS platform.

If a hosted offering is revisited in the future, it would likely follow the Vercel/Netlify pattern: users connect their GitHub repo, the hosted server wraps a git clone, and the web client provides editing. This is architecturally the same as the Team Workspace use case with managed infrastructure.
