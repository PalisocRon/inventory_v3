/**
 * Inventory backend for Google Sheets.
 * Paste this into Extensions > Apps Script of your Google Sheet, then deploy as a Web app.
 */
const TOKEN = 'CHANGE_ME_TO_A_LONG_RANDOM_STRING'; // must match SHEETS_TOKEN in config.php
const SHEET_NAME = 'Products';
const HEADERS = ['id', 'sku', 'name', 'category', 'qty', 'cost', 'price', 'updated_at'];

function doPost(e) {
  const lock = LockService.getScriptLock();
  let locked = false;
  try {
    lock.waitLock(15000);
    locked = true;
    const req = JSON.parse(e.postData.contents);
    if (req.token !== TOKEN) return out({ error: 'Unauthorized' });

    const sh = getSheet();
    switch (req.action) {
      case 'list':   return out({ data: readAll(sh) });
      case 'create': return out(createRow(sh, req));
      case 'update': return out(updateRow(sh, req));
      case 'delete': return out(deleteRow(sh, req));
      default:       return out({ error: 'Unknown action' });
    }
  } catch (err) {
    return out({ error: String(err) });
  } finally {
    if (locked) lock.releaseLock();
  }
}

// Opening the URL in a browser is just a health check.
function doGet() { return out({ ok: true, message: 'Inventory API is running.' }); }

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.getRange('B:B').setNumberFormat('@'); // keep SKUs like 001 as text
  }
  return sh;
}

function readAll(sh) {
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, HEADERS.length).getValues()
    .filter(r => r[0] !== '')
    .map(r => ({
      id: String(r[0]), sku: String(r[1]), name: String(r[2]), category: String(r[3]),
      qty: Number(r[4]) || 0, cost: Number(r[5]) || 0, price: Number(r[6]) || 0
    }));
}

function findRow(sh, id) {           // returns sheet row number or -1
  const last = sh.getLastRow();
  if (last < 2) return -1;
  const ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return -1;
}

function skuTaken(sh, sku, exceptId) {
  return readAll(sh).some(p => p.sku.toLowerCase() === String(sku).toLowerCase() && p.id !== String(exceptId || ''));
}

function rowValues(id, r) {
  return [id, String(r.sku), String(r.name), String(r.category || ''), Number(r.qty), Number(r.cost), Number(r.price), new Date()];
}

function createRow(sh, r) {
  if (skuTaken(sh, r.sku)) return { error: 'DUPLICATE_SKU' };
  const id = Utilities.getUuid().slice(0, 8);
  const row = sh.getLastRow() + 1;
  sh.getRange(row, 2).setNumberFormat('@');
  sh.getRange(row, 1, 1, HEADERS.length).setValues([rowValues(id, r)]);
  return { ok: true, id: id };
}

function updateRow(sh, r) {
  const row = findRow(sh, r.id);
  if (row < 0) return { error: 'NOT_FOUND' };
  if (skuTaken(sh, r.sku, r.id)) return { error: 'DUPLICATE_SKU' };
  sh.getRange(row, 2).setNumberFormat('@');
  sh.getRange(row, 1, 1, HEADERS.length).setValues([rowValues(r.id, r)]);
  return { ok: true };
}

function deleteRow(sh, r) {
  const row = findRow(sh, r.id);
  if (row < 0) return { error: 'NOT_FOUND' };
  sh.deleteRow(row);
  return { ok: true };
}
