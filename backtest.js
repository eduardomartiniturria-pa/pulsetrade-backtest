// MOTOR DE BACKTEST: recorre velas M5 y simula cada señal hasta SL, TP1 o fin de plazo.
const fmt = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', hour12: false,
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
});
function nyParts(ts) {
  const p = {};
  for (const x of fmt.formatToParts(new Date(ts))) p[x.type] = x.value;
  return { h: Number(p.hour) % 24, m: Number(p.minute), key: `${p.year}-${p.month}-${p.day}` };
}
const nyCache = new WeakMap();
function nyArr(c5) {
  let a = nyCache.get(c5);
  if (!a) { a = c5.map((k) => nyParts(k.t)); nyCache.set(c5, a); }
  return a;
}

// Spread típico en unidades de precio (editable con SPREAD_MULT)
const SPREAD = { EURUSD: 0.0001, GBPUSD: 0.00012, XAUUSD: 0.30, US500: 0.5 };

function simulate(c5, i, sig, spread, maxHold) {
  const risk = Math.abs(sig.entry - sig.sl), long = sig.dir === 'LONG';
  const costR = spread / risk, rr = Math.abs(sig.tp1 - sig.entry) / risk;
  const end = Math.min(c5.length - 1, i + maxHold);
  for (let j = i + 1; j <= end; j++) {
    const k = c5[j];
    if (long ? k.low <= sig.sl : k.high >= sig.sl) return { R: -1 - costR, end: j, how: 'SL' }; // ambos en la misma vela: cuenta SL
    if (long ? k.high >= sig.tp1 : k.low <= sig.tp1) return { R: rr - costR, end: j, how: 'TP1' };
  }
  const R = (long ? c5[end].close - sig.entry : sig.entry - c5[end].close) / risk;
  return { R: R - costR, end, how: 'TIEMPO' };
}

// opts: maxHold (velas M5, 96 = 8h), spreadMult, range [desde, hasta] como fracción de la historia
function runBacktest(data, strategies, opts = {}) {
  const maxHold = opts.maxHold || 96, mult = opts.spreadMult || 1, [ra, rb] = opts.range || [0, 1];
  const trades = [];
  for (const [symbol, c5] of Object.entries(data)) {
    const nyA = nyArr(c5), lo = Math.max(30, Math.floor(c5.length * ra)), hi = Math.floor(c5.length * rb);
    for (const [name, def] of Object.entries(strategies)) {
      if (def.symbols && !def.symbols.includes(symbol)) continue;
      const evaluate = def.create();
      let busyUntil = -1;
      for (let i = 30; i < c5.length - 1; i++) {
        const sig = evaluate({ symbol, c5, i, ny: nyA[i] }); // se evalúa siempre para mantener los indicadores al día
        if (!sig || i < lo || i >= hi || i <= busyUntil) continue;
        const r = simulate(c5, i, sig, (SPREAD[symbol] || 0) * mult, maxHold);
        busyUntil = r.end;
        trades.push({ symbol, strategy: name, dir: sig.dir, t: new Date(c5[i].t).toISOString(), R: r.R, how: r.how });
      }
    }
  }
  return trades;
}

function summarize(trades) {
  const n = trades.length;
  if (!n) return { n: 0, winrate: 0, avgR: 0, totalR: 0, profitFactor: null, maxRachaPerdidas: 0, maxCaidaR: 0 };
  let pos = 0, neg = 0, w = 0, tot = 0, streak = 0, maxStreak = 0, eq = 0, peak = 0, dd = 0;
  for (const t of trades) {
    tot += t.R;
    if (t.R > 0) { w++; pos += t.R; streak = 0; } else { neg += -t.R; streak++; maxStreak = Math.max(maxStreak, streak); }
    eq += t.R; peak = Math.max(peak, eq); dd = Math.max(dd, peak - eq);
  }
  return {
    n, winrate: +(100 * w / n).toFixed(1), avgR: +(tot / n).toFixed(3), totalR: +tot.toFixed(2),
    profitFactor: neg ? +(pos / neg).toFixed(2) : null, maxRachaPerdidas: maxStreak, maxCaidaR: +dd.toFixed(2),
  };
}
module.exports = { runBacktest, summarize, nyParts, SPREAD };
