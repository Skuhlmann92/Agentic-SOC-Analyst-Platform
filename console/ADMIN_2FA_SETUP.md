# Administrator 2FA (proposed rollout)

This change requires a six-digit TOTP authenticator code in addition to the existing administrator password. It invalidates existing production administrator cookies. Public demo access remains unchanged. There is one shared administrator identity, not per-user enrollment.

Before deploying:

1. Apply migration `db/migrations/008_admin_totp_replay.sql` using the existing migration process. The application database identity selected by `POSTGRES_DATABASE_URL` or `POSTGRES_URL` needs SELECT, INSERT and UPDATE on this table. Test using a staging database first.
2. On a trusted local machine run `node console/scripts/generate-admin-totp.mjs`. Add the displayed setup key manually to an authenticator application as a time-based six-digit SHA-1 code with a 30-second period. Securely store the hex secret and provision it as the sensitive Vercel environment variable `SOC_ADMIN_TOTP_SECRET_HEX`. Never commit, share in chat, or log the value. Back up the authenticator securely before enforcing it.
3. Deploy to an isolated preview, configure the same secret and an isolated test database, and verify successful and failed logins, rejection of a reused code, expired codes, and inaccessible old admin sessions. Test database failure and a restore procedure. Only promote after these checks succeed.
4. Apply the migration and configure the environment variable in production before deploying. The login fails closed when the secret, database, permission or migration is missing. Existing administrator sessions are invalidated, so have a recovery path for access to Vercel and the database before deploying.

Recovery requires a trusted administrator to provision a new random secret through Vercel and enroll a new authenticator, followed by a deployment if needed for environment changes. Preserve access to the Vercel account and database. This first implementation does not provide backup codes, per-user enrollment, passkeys, or self-service recovery.
