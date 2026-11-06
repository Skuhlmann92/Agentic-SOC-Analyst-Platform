-- Ingest authentication is deliberately disabled for SaaS organizations until
-- SOC_MULTI_TENANT_INGEST_ENABLED is explicitly enabled after RLS cutover.
-- Only SHA-256 token hashes are stored; plaintext tokens never enter Neon.
CREATE TABLE IF NOT EXISTS public.soc_ingest_credentials (
 id uuid PRIMARY KEY,
 org_id uuid NOT NULL REFERENCES public.soc_organizations(id),
 connector_id uuid NOT NULL,
 token_sha256 text NOT NULL UNIQUE CHECK(token_sha256 ~ '^[0-9a-f]{64}$'),
 status text NOT NULL DEFAULT 'inactive' CHECK(status IN ('inactive','active','revoked')),
 expires_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 last_used_at timestamptz,
 FOREIGN KEY(connector_id,org_id) REFERENCES public.soc_org_connectors(id,org_id)
);
CREATE INDEX IF NOT EXISTS soc_ingest_credentials_org_idx
 ON public.soc_ingest_credentials(org_id,status);
ALTER TABLE public.soc_ingest_credentials ENABLE ROW LEVEL SECURITY;
-- No RLS policy grants customer access to hashed credentials.
-- Only a trusted server-side credential-resolution identity can read hashes.
-- No customer tokens are created or activated by this migration.
