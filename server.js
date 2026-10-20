// Descarga datos, barre las estrategias por activo y publica el resultado (web + logs).
const http = require('http');
const { downloadAll } = require('./download');
const { sweep, line } = require('./sweep');
const strategies = require('./strategies');

const DAYS = Number(process.env.DAYS || 180);
const SYMBOLS = (process.env.SYMBOLS || 'XAUUSD,EURUSD,GBPUSD,US500').split(',');
const SPREAD_MULT = Number(process.env.SPREAD_MULT || 1);
let state = { estado: 'corriendo...', inicio: new Date().toISOString() };

(async () => {
  try {
    const data = await downloadAll(SYMBOLS, DAYS, console.log);
    if (!Object.keys(data).length) throw new Error('No se pudo descargar ningún activo');
    const rows = sweep(data, strategies, { spreadMult: SPREAD_MULT });
    rows.forEach((r) => console.log('FILA ' + line(r)));
    const aprobadas = rows.filter((r) => r.verdict === 'PASA');
    console.log(`APROBADAS ${aprobadas.length} de ${rows.length}`);
    state = { estado: 'listo', dias: DAYS, spreadMult: SPREAD_MULT, aprobadas, todas: rows };
  } catch (e) {
    state = { estado: 'error', mensaje: e.message };
    console.log('ERROR_BACKTEST ' + e.message);
  }
})();

http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(state, null, 2));
}).listen(process.env.PORT || 3000);
