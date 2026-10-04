# tracked.

A mobile-first training journal with email/password accounts and shared MariaDB/MySQL workout storage. Sign in with the same account on your phone and computer to access the same submitted workouts. Use **Refresh** to fetch changes made on another device.

Choose a calendar day, select exercises, enter weight and optional sets (or cardio minutes and calories), then submit. Submitting replaces that day's workout. Remove individual entries from the workout details. Weekly progress counts submitted days in the selected Monday–Sunday week, with a goal of three days.

Submitted workouts are saved on the server. Drafts stay in the current browser, separately for each account and date. Existing `form-workouts` and `form-exercises-*` browser data is ignored; there is no import. On another device, selecting a logged day seeds a new draft from its saved workout. Failed saves keep the draft and do not report success. If another device edited the same day, a save conflict asks you to reload; use Refresh before reviewing and resubmitting your draft.

## Hostinger Cloud deployment

1. In Hostinger's website dashboard, open **Databases → Management** and create a MySQL database and user. Note the host, database name, username, and password. Use the full names displayed by Hostinger, including any account prefix.
2. Deploy this repository as a **Node.js web app**, using Node.js 22 or newer. Install dependencies with `npm ci`; there is no frontend build step. The start command is `npm start` and the entry file is `server.cjs`. The app reads the hosting runtime's `PORT`.
3. Set runtime environment variables in the hosting dashboard:

   ```text
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=your_full_database_username
   DB_PASSWORD=your_database_password
   DB_NAME=your_full_database_name
   APP_ORIGIN=https://your-domain.com
   NODE_ENV=production
   ALLOW_REGISTRATION=true
   ```

   Use Hostinger's actual database host if it differs from `localhost`. `APP_ORIGIN` must exactly match the address you visit, including `www` if applicable, with no trailing slash or path. Redirect other domain variants to that canonical address. Production requires HTTPS and uses Secure session cookies. Credentials belong in runtime settings, never browser JavaScript or committed files.

4. Start/restart the app. It creates the tables in `schema.sql` automatically using the database user's permissions. Alternatively, run that SQL in phpMyAdmin first. Missing credentials or database initialization errors prevent startup.
5. Open your HTTPS site and create an account with a password of 12–128 characters. For a personal tracker, set `ALLOW_REGISTRATION=false` after creating the accounts you need, then restart. Existing accounts can still sign in.
6. Sign in on a second device, submit a workout on the first, then click Refresh on the second. Verify the exercises and weekly progress match. Test removal and sign-out as well.

Deploy the Node.js backend with the frontend; uploading HTML/CSS/JS alone does not provide shared storage. No Hostinger credentials are included in this repository.

## Install as an app (PWA)

The HTTPS site can be installed as **tracked.** and launches in a standalone window. In supported Chrome/Edge browsers, use **Install app** when it appears, or the browser's install menu. On iPhone/iPad, open the site in Safari, choose **Share → Add to Home Screen**, and enable **Open as Web App** if offered.

This release requires an internet connection for sign-in and shared workout access. It does not register a service worker, cache the app for offline use, or queue offline saves. Drafts continue to use the existing per-account browser storage. Deploy the manifest, `pwa.js`, and `assets/icons/` with the rest of the app; no new dependency or build step is required.

For installation verification, use the HTTPS deployment (or localhost on this computer). Check the manifest in browser developer tools, install the app, and launch it from its icon to confirm standalone display. Verify sign-in, save, Refresh, and sign-out against the hosted database. An ordinary HTTP LAN address does not support PWA installation.

## Local development

Use Node.js 22+ and install dependencies with `npm ci`. For an interface preview without MySQL, run `npm start` with no `DB_*` environment variables. Open `http://localhost:5173` and create a local account. Accounts and submitted workouts are saved in `.local-data/db.json`, which is ignored by Git. This mode listens only on `127.0.0.1` and is intended for this computer; it does not share data with your hosted MySQL/MariaDB database.

To use a local or development MariaDB/MySQL database instead, copy `.env.example` to `.env`, fill in the database credentials, keep `NODE_ENV=development`, then run:

```text
node --env-file=.env server.cjs
```

Open `http://localhost:5173`. `npm start` reads environment variables supplied by the shell or hosting platform; it does not automatically load `.env`. If any database credential is set, all four required credentials must be set or startup fails. In production, MySQL/MariaDB is always required; local file storage cannot be selected. For phone testing on your LAN, use MySQL/MariaDB and set `APP_ORIGIN` to the exact LAN URL you will visit. Local HTTP cookies are allowed outside production.

## Data and accounts

- `users` stores normalized email addresses and salted scrypt password hashes.
- `sessions` stores hashes of random session tokens and 30-day expiration dates. Cookies are HttpOnly and SameSite=Lax; sign-out revokes the current session.
- `workouts` stores one row per account/calendar date with a JSON array of exercise entries. This matches whole-day replacement behavior; versions prevent stale device writes. Empty rows retain versions after the last exercise is removed.
- Every workout query is scoped to the authenticated user. Writes require the configured origin, JSON bodies, and bounded validated input. Queries use parameters. Authentication requests have an in-memory attempt limit.

Account creation does not verify email ownership. Password reset, email delivery, and account deletion screens are not implemented. Keep registration disabled for private use after creating your account. Configure database backups in Hostinger independently of application deployment.

## Verification

```text
npm test
```

Tests cover weekly progress, custom exercises, successful and failed saves/removals, password hashing, HTTP login/logout, account isolation, origin enforcement, validation, and concurrent edit conflicts. HTTP API tests use an in-memory database adapter; they do not verify a live MariaDB connection. Complete the two-device check above against your Hostinger database before relying on production storage.
