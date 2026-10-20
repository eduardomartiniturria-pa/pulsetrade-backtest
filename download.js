// DESCARGA de velas M5 desde Dukascopy (gratis, sin clave).
const { getHistoricalRates } = require('dukascopy-node');
const MAP = { EURUSD: 'eurusd', GBPUSD: 'gbpusd', XAUUSD: 'xauusd', US500: 'usa500idxusd' };

async function downloadSymbol(symbol, days) {
  const to = new Date(); to.setUTCHours(0, 0, 0, 0);
  const from = new Date(to.getTime() - days * 86400000);
  const rows = await getHistoricalRates({
    instrument: MAP[symbol], dates: { from, to }, timeframe: 'm5',
    format: 'json', priceType: 'bid', volumes: false, useCache: false,
    batchSize: 10, pauseBetweenBatchesMs: 1000,
  });
  return rows.map((r) => ({ t: r.timestamp, open: r.open, high: r.high, low: r.low, close: r.close }));
}

async function downloadAll(symbols, days, log = console.log) {
  const data = {};
  for (const s of symbols) {
    try {
      log(`Descargando ${s} (${days} días)...`);
      data[s] = await downloadSymbol(s, days);
      log(`  ${s}: ${data[s].length} velas M5`);
    } catch (e) {
      log(`  ${s}: ERROR ${e.message}`);
    }
  }
  return data;
}
module.exports = { downloadAll };
