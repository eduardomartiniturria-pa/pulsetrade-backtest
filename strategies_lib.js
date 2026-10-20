// BIBLIOTECA DE ESTRATEGIAS NUEVAS: solo para probar, no tocan tu app.
// Cada una trae una "grid" (valores a probar por activo). Para sumar otra, se copia el formato.
const ALL = ['XAUUSD', 'EURUSD', 'GBPUSD', 'US500'];
const hourOf = (t) => Math.floor((t % 86400000) / 3600000); // hora UTC
const dayOf = (t) => Math.floor(t / 86400000);
const ema = (prev, x, n) => (prev === null ? x : prev + (2 / (n + 1)) * (x - prev));

function atr(c5, i, n = 14) {
  if (i < n + 1) return null;
  let s = 0;
  for (let k = i - n + 1; k <= i; k++) {
    const p = c5[k - 1].close;
    s += Math.max(c5[k].high - c5[k].low, Math.abs(c5[k].high - p), Math.abs(c5[k].low - p));
  }
  return s / n;
}
function mk(dir, entry, sl, rr, a) {
  const risk = Math.abs(entry - sl);
  if (!a || risk < 0.3 * a || risk > 4 * a) return null; // stop absurdo: se descarta
  return { dir, entry, sl, tp1: dir === 'LONG' ? entry + rr * risk : entry - rr * risk };
}

// 1) Ruptura del rango asiático (00-07 UTC) durante Londres (07-11 UTC)
function asianBreakout(p = {}) {
  const { rr = 2, slMode = 'opposite' } = p;
  let day = -1, hi = null, lo = null, traded = false;
  return ({ c5, i }) => {
    const c = c5[i], d = dayOf(c.t), h = hourOf(c.t);
    if (d !== day) { day = d; hi = null; lo = null; traded = false; }
    if (h < 7) { hi = hi === null ? c.high : Math.max(hi, c.high); lo = lo === null ? c.low : Math.min(lo, c.low); return null; }
    if (traded || hi === null || h >= 11) return null;
    const dir = c.close > hi ? 'LONG' : c.close < lo ? 'SHORT' : null;
    if (!dir) return null;
    traded = true;
    const sl = slMode === 'mid' ? (hi + lo) / 2 : dir === 'LONG' ? lo : hi;
    return mk(dir, c.close, sl, rr, atr(c5, i));
  };
}

// 2) Retroceso a la EMA20 a favor de la tendencia (EMA20 > EMA50 > EMA200)
function emaPullback(p = {}) {
  const { rr = 2, atrSl = 1.5 } = p;
  let e20 = null, e50 = null, e200 = null;
  return ({ c5, i }) => {
    const c = c5[i];
    e20 = ema(e20, c.close, 20); e50 = ema(e50, c.close, 50); e200 = ema(e200, c.close, 200);
    const h = hourOf(c.t);
    if (i < 210 || h < 7 || h >= 20) return null;
    const a = atr(c5, i);
    if (e20 > e50 && e50 > e200 && c.low <= e20 && c.close > e20) return mk('LONG', c.close, c.close - atrSl * a, rr, a);
    if (e20 < e50 && e50 < e200 && c.high >= e20 && c.close < e20) return mk('SHORT', c.close, c.close + atrSl * a, rr, a);
    return null;
  };
}

// 3) Rebote por RSI extremo a favor de la EMA200
function rsiReversion(p = {}) {
  const { lo = 25, rr = 1.5 } = p;
  let n = 0, ag = 0, al = 0, prev = null, e200 = null;
  return ({ c5, i }) => {
    const c = c5[i];
    e200 = ema(e200, c.close, 200);
    if (prev !== null) {
      const d = c.close - prev, g = Math.max(d, 0), l = Math.max(-d, 0);
      if (n < 14) { ag += g / 14; al += l / 14; n++; } else { ag = (ag * 13 + g) / 14; al = (al * 13 + l) / 14; }
    }
    prev = c.close;
    const h = hourOf(c.t);
    if (n < 14 || i < 210 || h < 7 || h >= 20) return null;
    const rsi = al === 0 ? 100 : 100 - 100 / (1 + ag / al), a = atr(c5, i);
    if (rsi < lo && c.close > e200) return mk('LONG', c.close, c.close - 1.5 * a, rr, a);
    if (rsi > 100 - lo && c.close < e200) return mk('SHORT', c.close, c.close + 1.5 * a, rr, a);
    return null;
  };
}

// 4) Ruptura del máximo/mínimo de las últimas n velas (canal Donchian)
function donchian(p = {}) {
  const { n = 48, rr = 2, atrSl = 1.5 } = p;
  return ({ c5, i }) => {
    const c = c5[i], h = hourOf(c.t);
    if (i < n + 1 || h < 7 || h >= 20) return null;
    let hh = -Infinity, ll = Infinity;
    for (let k = i - n; k < i; k++) { hh = Math.max(hh, c5[k].high); ll = Math.min(ll, c5[k].low); }
    const a = atr(c5, i);
    if (c.close > hh) return mk('LONG', c.close, c.close - atrSl * a, rr, a);
    if (c.close < ll) return mk('SHORT', c.close, c.close + atrSl * a, rr, a);
    return null;
  };
}

const LIB = {
  asian_breakout: { create: asianBreakout, symbols: ALL, grid: { rr: [1.5, 2, 3], slMode: ['opposite', 'mid'] } },
  ema_pullback: { create: emaPullback, symbols: ALL, grid: { rr: [1.5, 2], atrSl: [1, 1.5, 2] } },
  rsi_reversion: { create: rsiReversion, symbols: ALL, grid: { lo: [20, 25, 30], rr: [1, 1.5] } },
  donchian_breakout: { create: donchian, symbols: ALL, grid: { n: [48, 96], rr: [1.5, 2, 3], atrSl: [1, 1.5] } },
};
module.exports = { atr, LIB };
