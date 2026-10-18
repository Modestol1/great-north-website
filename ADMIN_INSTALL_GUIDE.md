# Great North Admin v1 — safe installation (no Codex required)

**Existing official domain:** `greatnorthcreative.com.co`  
**Existing repository:** `Modestol1/great-north-website`  
**Existing Worker:** keep its live project unchanged until testing is complete.  
**Existing D1 database:** `great-north-db` (do NOT delete or recreate).

## Contents

- `src-worker.js` — replacement Worker script; preserves pre-order/consultation POST APIs, adds authenticated owner APIs and `/admin`.
- `public/admin.html`, `public/admin.css`, `public/admin.js` — new admin files (do NOT overwrite the main public homepage, CSS or script).
- `admin-migration.sql` — additive `books` table; run once on `great-north-db`.

These are *proposed source files*, not a live deployment. Tested for JavaScript syntax only; browser/integration/security validation must be completed in a staging Worker.

## SAFETY FIRST — GITHUB

1. In GitHub `Modestol1/great-north-website`, use the branch selector `main` → `View all branches` / `New branch`; create `admin-v1-test` from `main`.
2. Select branch `admin-v1-test` before uploading/replacing files.
3. Upload the four specified application files at the same relative paths. Preserve all existing `public` assets and originals. (Do not upload the entire old starter ZIP; it includes a placeholder `wrangler.toml`.)
4. Open a pull request from `admin-v1-test` into `main`, but **do not merge yet**.

## D1 MIGRATION

In Cloudflare → Storage & databases → D1 → `great-north-db` → Console, run contents of `admin-migration.sql` one statement at a time if needed. It only creates the `books` table and index; it does not remove existing data. Consider exporting a backup first.

## OWNER LOGIN SECRETS

Configure these as **Cloudflare encrypted Worker secrets**, NEVER commit them to GitHub or share in chat:

- `ADMIN_PASSWORD_HASH` (PBKDF2-SHA256, 210000 iterations, format `pbkdf2:HEX_SALT:HEX_HASH`).
- `ADMIN_SESSION_SECRET` (a cryptographically random 32+ byte string).

Create password hash locally with Python 3, e.g. use PowerShell/terminal and execute this Python snippet (do not share output publicly):

```python
import hashlib, secrets, getpass
password = getpass.getpass('Choose a unique strong admin password: ')
salt = secrets.token_bytes(16)
digest = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 210000)
print('ADMIN_PASSWORD_HASH=pbkdf2:' + salt.hex() + ':' + digest.hex())
print('ADMIN_SESSION_SECRET=' + secrets.token_hex(32))
```

IMPORTANT: Production secrets must be configured on the **actual Worker named in `wrangler.toml`**. The GitHub deployment project name and Worker script name can differ. Check the deployment logs. Do not add a password or token as a plain environment variable in a public file.

## EXISTING D1 BINDING

Read the live `wrangler.toml` and make sure it points to **your real** Cloudflare D1 ID. The binding must be `DB`. Current public GitHub `wrangler.toml` was observed containing `database_name="great-north-orders"` and ID `18d6a795-a4f5-450e-bf89-212582b34979`; **do not assume this matches `great-north-db`**. Fix only after verifying in Cloudflare.

## STAGING, TESTS AND RELEASE

1. Deploy the `admin-v1-test` branch to a separate **test Worker** linked to a **test D1 database or copied data**, never point staging mutation tests at production orders.
2. Test `/`, `/admin`, `/admin/`, invalid login, valid login, logout, unauthorized `/api/admin/*` (expect 401), read orders/consultations, save book and update statuses, pre-order and consultation public requests.
3. Restrict login via Cloudflare WAF/Access and add a login rate-limit rule. Current prototype validates hashed passwords but does **not** provide a distributed brute-force limiter; do not treat it as production-hardened without this additional control.
4. Confirm no cards are charged and no email is sent; financial figures deliberately do not imply payments.
5. Once satisfied, merge reviewed PR. Wait for Cloudflare production deployment and verify `https://greatnorthcreative.com.co/admin` presents the login screen.
6. Keep owner secrets private. Never put database customer data into `public/` or GitHub.

## Current functional scope

- Password-protected, signed 12-hour owner session cookie, secure + HttpOnly + SameSite=Strict.
- Authenticated dashboard totals, last 250 pre-orders, last 250 bookings; per-record status edits.
- Create/edit book metadata in D1, price stored in ZMW minor units (ngwee).
- No live payment provider, inventory stock reservations, media upload service, email sender, or full CMS yet. Links to cover images can be provided; public catalogue is not automatically rendered by this v1.
- For a full private CRM, audited payments and editorial CMS, create a separate follow-up phase after this v1 is verified.

NOTE: The `/admin` HTML is accessible as a login shell. Protected business data remains behind authenticated APIs. Don't consider it ready for real customers until access controls, monitoring, backups and end-to-end tests have been verified.
