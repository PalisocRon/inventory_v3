# Inventory Pricing System (Node.js + Google Sheets)

Add, view, modify and delete products. Your Google Sheet is the database.
No npm packages needed, just Node.js 18 or newer.

## How it works
Browser (HTML/CSS/JS) -> `server.js` (Node) -> Google Apps Script web app -> your Google Sheet.
The secret token stays on the server (config.js and Code.gs), never in the browser.

## Setup
### 1. Google Sheet + Apps Script
1. Create a new Google Sheet.
2. Extensions > Apps Script. Paste in `google-apps-script/Code.gs` and change `TOKEN` to a long random string. Save.
3. Deploy > New deployment > Web app. Execute as: **Me**. Who has access: **Anyone**.
   Deploy, approve permissions, copy the **Web app URL** (ends with `/exec`).
4. The first request creates a `Products` tab with the headers automatically.

### 2. Run the Node app
1. Install Node.js 18+ from nodejs.org.
2. Open `config.js` and set `SHEETS_URL` and `SHEETS_TOKEN` (same value as TOKEN).
   You can also set them as environment variables.
3. In this folder run: `npm start` (or `node server.js`), then open http://localhost:3000

## Files
- `server.js`  web server + API (list, create, update, delete) + validation
- `config.js`  settings (Sheets URL, token, currency, low-stock level, port)
- `public/`    `index.html`, `assets/style.css`, `assets/app.js`
- `google-apps-script/Code.gs`  backend that reads/writes the Sheet

## Hosting
Needs a Node host (Render, Railway, Fly.io, a VPS...). Set SHEETS_URL and SHEETS_TOKEN as environment variables there.

## Troubleshooting
- "Google did not return JSON": deployment access must be "Anyone"; SHEETS_URL must end in /exec.
- "Token mismatch": TOKEN in Code.gs differs from SHEETS_TOKEN.
- After editing Code.gs: Deploy > Manage deployments > edit > New version > Deploy (the URL stays the same).
- Keep the header row and the `id` column untouched when editing the Sheet by hand.

## Notes
- Google Sheets takes about 1-2 seconds per request and suits a few thousand rows.
- There is no login. Add authentication before using this publicly.
