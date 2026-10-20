// ESTRATEGIAS A PROBAR. Cada una: create(params) -> evaluate(ctx); grid = valores a probar por activo.
// ctx = { symbol, c5 (velas M5), i (última vela cerrada), ny: {h, m, key} (hora de NY) }
const { atr, LIB } = require('./strategies_lib');

// APROXIMACIÓN de kill_zone_ny (NO es tu código real): rango NY 9:30-9:45, entra al romperlo
// entre 9:45 y 11:00, stop del otro lado del rango, objetivo rr x riesgo, 1 operación por día.
function killZoneNYApprox(p = {}) {
  const { rr = 1.5 } = p;
  let day = null, hi = null, lo = null, traded = false;
  return ({ c5, i, ny }) => {
    const c = c5[i];
    if (ny.key !== day) { day = ny.key; hi = null; lo = null; traded = false; }
    const mins = ny.h * 60 + ny.m;
    if (mins >= 570 && mins < 585) {
      hi = hi === null ? c.high : Math.max(hi, c.high);
      lo = lo === null ? c.low : Math.min(lo, c.low);
      return null;
    }
    if (hi === null || traded || mins < 585 || mins >= 660) return null;
    const a = atr(c5, i);
    if (!a) return null;
    const dir = c.close > hi ? 'LONG' : c.close < lo ? 'SHORT' : null;
    if (!dir) return null;
    traded = true;
    const sl = dir === 'LONG' ? lo : hi, risk = Math.abs(c.close - sl);
    if (risk < 0.3 * a || risk > 4 * a) return null;
    return { dir, entry: c.close, sl, tp1: dir === 'LONG' ? c.close + rr * risk : c.close - rr * risk };
  };
}

module.exports = {
  kill_zone_ny_aprox: { create: killZoneNYApprox, symbols: ['XAUUSD', 'EURUSD', 'GBPUSD', 'US500'], grid: { rr: [1, 1.5, 2] } },
  ...LIB,
};
