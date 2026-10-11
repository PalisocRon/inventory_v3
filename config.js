// Edit these values (or set the same names as environment variables).
module.exports = {
  SHEETS_URL:   process.env.SHEETS_URL   || 'https://script.google.com/macros/s/AKfycbw5_soPdtKV7ftdtZbgA2hIX0s4RocE7qF_6oMWcXpmcxf68OtVA47NyUQGlq-UG7ILSw/exec', // ends with /exec
  SHEETS_TOKEN: process.env.SHEETS_TOKEN || '1xcyiJ8ERixWKbcAX8e1jox-DxVkHMw3u5Htyz_z29L8',        // must match TOKEN in Code.gs
  CURRENCY:     process.env.CURRENCY     || 'PHP',  // ISO code used for display, e.g. USD, PHP, EUR
  LOW_STOCK:    Number(process.env.LOW_STOCK) || 5, // quantities at or below this are highlighted
  PORT:         Number(process.env.PORT) || 3000,
};
