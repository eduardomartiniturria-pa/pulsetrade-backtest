// BARRIDO POR ACTIVO con validación honesta: se elige el mejor ajuste en la primera parte
// de la historia (entrenamiento) y se lo mide en la parte que NO vio (prueba).
const { runBacktest, summarize } = require('./backtest');

function combos(grid) {
  let out = [{}];
  for (const [k, vals] of Object.entries(grid || {})) out = out.flatMap((o) => vals.map((v) => ({ ...o, [k]: v })));
  return out;
}

function sweep(data, strategies, o = {}) {
  const { split = 0.7, minTrain = 15, minTest = 8, spreadMult = 1 } = o;
  const rows = [];
  for (const [name, def] of Object.entries(strategies)) {
    for (const [symbol, c5] of Object.entries(data)) {
      if (def.symbols && !def.symbols.includes(symbol)) continue;
      const run = (p, range) => summarize(runBacktest({ [symbol]: c5 }, { [name]: { create: () => def.create(p), symbols: [symbol] } }, { range, spreadMult }));
      const list = combos(def.grid).map((p) => ({ p, train: run(p, [0, split]) }));
      const ok = list.filter((x) => x.train.n >= minTrain && x.train.avgR > 0).sort((a, b) => b.train.avgR - a.train.avgR);
      if (!ok.length) {
        const mejor = [...list].sort((a, b) => b.train.n - a.train.n || b.train.avgR - a.train.avgR)[0];
        rows.push({ strategy: name, symbol, params: mejor.p, combosProbados: list.length, train: mejor.train, verdict: 'NO PASA (sin ventaja ni en entrenamiento)' });
        continue;
      }
      const best = ok[0], test = run(best.p, [split, 1]);
      const pasa = test.n >= minTest && test.avgR > 0.05 && test.profitFactor >= 1.15;
      rows.push({
        strategy: name, symbol, params: best.p, combosProbados: list.length, train: best.train, test,
        verdict: pasa ? 'PASA' : test.avgR > 0 ? 'DEBIL (positiva pero sin evidencia suficiente)' : 'NO PASA (falla en datos nuevos)',
      });
    }
  }
  return rows;
}

function line(r) {
  const f = (s) => (s ? `n=${s.n} win=${s.winrate}% R/op=${s.avgR} PF=${s.profitFactor}` : '-');
  return `${r.strategy} | ${r.symbol} | ${JSON.stringify(r.params || {})} | ENTR ${f(r.train)} | PRUEBA ${f(r.test)} | ${r.verdict}`;
}
module.exports = { sweep, line };
