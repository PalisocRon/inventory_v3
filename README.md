# Inventory Pricing System (HTML + CSS + JavaScript + Google Sheets)

Plain static website: no PHP, no Node, no build step. Your Google Sheet is the database.

## How it works
Browser (index.html + app.js) -> Google Apps Script web app -> your Google Sheet.

## Setup
### 1. Google Sheet + Apps Script
1. Create a new Google Sheet.
2. Extensions > Apps Script. Paste in `google-apps-script/Code.gs` and change `TOKEN` to a long random string. Save.
3. Deploy > New deployment > Web app. Execute as: **Me**. Who has access: **Anyone**.
   Deploy, approve permissions, copy the **Web app URL** (ends with `/exec`).
4. The first request creates a `Products` tab with the headers automatically.

### 2. Website
1. Open `config.js` and set `SHEETS_URL` and `SHEETS_TOKEN` (same value as TOKEN in Code.gs).
2. Open the site any of these ways:
   - double-click `index.html`, or
   - copy the folder to XAMPP/WAMP `htdocs` and visit `http://localhost/<folder>/`, or
   - upload the folder to any static host (GitHub Pages, Netlify, Cloudflare Pages, shared hosting).

## Files
- `index.html`, `assets/style.css`, `assets/app.js`  the website
- `config.js`  your settings
- `google-apps-script/Code.gs`  backend that reads/writes the Sheet, with validation

## IMPORTANT: security
The token is stored in `config.js`, so anyone who can open the site can read it (View Source)
and use it to read or change your inventory. This is fine for private/internal use
(local computer, company intranet, a password-protected folder). Do not publish it
publicly with data you care about. If you need a secret token, use the Node.js or PHP version.

## Troubleshooting
- "Google did not return JSON": access must be "Anyone"; SHEETS_URL must end in /exec.
- "Token mismatch": TOKEN in Code.gs differs from SHEETS_TOKEN in config.js.
- After editing Code.gs: Deploy > Manage deployments > edit > New version > Deploy (URL stays the same).
- Keep the header row and the `id` column untouched when editing the Sheet by hand.
- Google Sheets takes about 1-2 seconds per request and suits a few thousand rows.
