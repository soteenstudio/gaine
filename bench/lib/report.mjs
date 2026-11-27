import { fmt } from "./util.mjs";

const ICON = { gaine: "▲ Gaine", baseline: "▼ Plain", tie: "≈ tie" };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export function toConsole(rows, verdict, meta) {
  const groups = [...new Set(rows.map((r) => r.group))];
  const w = (s, n) => String(s).padEnd(n);
  const r = (s, n) => String(s).padStart(n);
  const out = [];
  out.push("");
  out.push(`  ${meta.profile} · ${meta.runs} runs × ${meta.paths.length} page(s) · ${meta.date}`);
  for (const g of groups) {
    out.push("");
    out.push(`  ${g}`);
    out.push(`  ${w("metric", 30)}${r("plain", 12)}${r("gaine", 12)}${r("Δ", 10)}  winner`);
    out.push(`  ${"-".repeat(72)}`);
    for (const row of rows.filter((x) => x.group === g)) {
      const mark = row.winner === "gaine" ? "\x1b[32m" : row.winner === "baseline" ? "\x1b[31m" : "\x1b[90m";
      out.push(
        `  ${w(row.label, 30)}${r(fmt.value(row, row.baseline.median), 12)}${r(fmt.value(row, row.gaine.median), 12)}${r(fmt.pct(row.pct), 10)}  ${mark}${ICON[row.winner]}\x1b[0m`,
      );
    }
  }
  out.push("");
  out.push(`  ${verdict.headline}`);
  out.push(
    `  wins: gaine ${verdict.gaineWins} · plain ${verdict.baselineWins} · tie ${verdict.ties}   (key metrics: gaine ${verdict.keyGaineWins} · plain ${verdict.keyBaselineWins})`,
  );
  out.push("");
  return out.join("\n");
}

export function toMarkdown(rows, verdict, meta) {
  const groups = [...new Set(rows.map((r) => r.group))];
  const l = [`# Next.js vs Next.js + Gaine`, "", `**${verdict.headline}**`, ""];
  l.push(
    `Profile \`${meta.profile}\` · ${meta.runs} runs × ${meta.paths.length} page(s) · ${meta.date}  `,
    `Gaine wins ${verdict.gaineWins} · Plain wins ${verdict.baselineWins} · ties ${verdict.ties}`,
    "",
  );
  for (const g of groups) {
    l.push(`### ${g}`, "", "| Metric | Plain | Gaine | Δ | Winner |", "|---|---:|---:|---:|---|");
    for (const row of rows.filter((x) => x.group === g))
      l.push(
        `| ${row.label} | ${fmt.value(row, row.baseline.median)} | ${fmt.value(row, row.gaine.median)} | ${fmt.pct(row.pct)} | ${ICON[row.winner]} |`,
      );
    l.push("");
  }
  l.push(
    "_Medians. Lab metrics are significant at p<0.05 (Mann-Whitney) and ≥3% change; byte/count metrics are deterministic._",
  );
  return l.join("\n");
}

export function toHtml(rows, verdict, meta) {
  const groups = [...new Set(rows.map((r) => r.group))];
  const tone = verdict.keyGaineWins > verdict.keyBaselineWins ? "good" : verdict.keyBaselineWins > verdict.keyGaineWins ? "bad" : "flat";
  const section = (g) => {
    const body = rows
      .filter((x) => x.group === g)
      .map((row) => {
        const max = Math.max(row.baseline.median, row.gaine.median, 1e-9);
        const bw = (row.baseline.median / max) * 100;
        const gw = (row.gaine.median / max) * 100;
        const cls = row.winner === "tie" ? "tie" : row.winner === "gaine" ? "good" : "bad";
        return `<tr>
<td class="m">${esc(row.label)}${row.key ? ' <span class="k">key</span>' : ""}</td>
<td class="bars"><div class="bar plain" style="width:${bw.toFixed(1)}%"><span>${esc(fmt.value(row, row.baseline.median))}</span></div>
<div class="bar gaine" style="width:${gw.toFixed(1)}%"><span>${esc(fmt.value(row, row.gaine.median))}</span></div></td>
<td class="d ${cls}">${esc(fmt.pct(row.pct))}</td>
<td class="w ${cls}">${ICON[row.winner]}</td>
<td class="p">${row.p === null ? "exact" : "p=" + row.p.toFixed(3)}</td></tr>`;
      })
      .join("\n");
    return `<section><h2>${esc(g)}</h2><table><thead><tr><th>Metric</th><th>Plain vs Gaine (median)</th><th>Δ</th><th>Winner</th><th></th></tr></thead><tbody>${body}</tbody></table></section>`;
  };
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Next.js vs Gaine Speed Report</title>
<style>
:root{--bg:#fff;--fg:#0f172a;--mut:#64748b;--line:#e2e8f0;--plain:#94a3b8;--gaine:#2563eb;--good:#15803d;--bad:#b91c1c;--card:#f8fafc}
@media (prefers-color-scheme:dark){:root{--bg:#0b1020;--fg:#e5e7eb;--mut:#94a3b8;--line:#1f2a44;--plain:#64748b;--gaine:#60a5fa;--good:#4ade80;--bad:#f87171;--card:#111933}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 ui-sans-serif,system-ui,sans-serif}
main{max-width:980px;margin:0 auto;padding:32px 16px 64px}
h1{font-size:26px;margin:0 0 4px}h2{font-size:15px;text-transform:uppercase;letter-spacing:.06em;color:var(--mut);margin:36px 0 8px}
.sub{color:var(--mut);margin:0 0 20px}
.hero{border:1px solid var(--line);background:var(--card);border-radius:12px;padding:20px;display:flex;gap:24px;flex-wrap:wrap;align-items:center}
.hero b{font-size:20px}.hero .good{color:var(--good)}.hero .bad{color:var(--bad)}
.score{display:flex;gap:20px;margin-left:auto}.score div{text-align:center}.score strong{display:block;font-size:26px}
.legend{display:flex;gap:16px;margin:16px 0 0;color:var(--mut);font-size:13px}.legend i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:6px}
table{width:100%;border-collapse:collapse}th{font-size:12px;color:var(--mut);text-align:left;font-weight:500;padding:6px 8px;border-bottom:1px solid var(--line)}
td{padding:8px;border-bottom:1px solid var(--line);vertical-align:middle}
.m{width:24%}.k{font-size:10px;border:1px solid var(--line);border-radius:4px;padding:0 4px;color:var(--mut)}
.bars{width:44%}.bar{height:18px;border-radius:3px;margin:2px 0;min-width:4px;position:relative}
.bar.plain{background:var(--plain)}.bar.gaine{background:var(--gaine)}
.bar span{position:absolute;left:calc(100% + 6px);font-size:12px;white-space:nowrap;color:var(--fg)}
.bars{padding-right:90px}
.d,.w{white-space:nowrap;font-variant-numeric:tabular-nums}.good{color:var(--good)}.bad{color:var(--bad)}.tie{color:var(--mut)}
.p{color:var(--mut);font-size:12px}
footer{margin-top:32px;color:var(--mut);font-size:13px}
@media(max-width:640px){.p,th:last-child{display:none}.bars{padding-right:70px}}
</style></head><body><main>
<h1>Next.js vs Next.js + Gaine</h1>
<p class="sub">Profile <code>${esc(meta.profile)}</code> · ${meta.runs} runs × ${meta.paths.length} page(s) · ${esc(meta.date)} · Node ${esc(meta.node)}</p>
<div class="hero"><b class="${tone}">${esc(verdict.headline)}</b>
<div class="score"><div><strong>${verdict.gaineWins}</strong>Gaine wins</div><div><strong>${verdict.baselineWins}</strong>Plain wins</div><div><strong>${verdict.ties}</strong>ties</div></div></div>
<div class="legend"><span><i style="background:var(--plain)"></i>Plain Next.js</span><span><i style="background:var(--gaine)"></i>Next.js + Gaine</span></div>
${groups.map(section).join("\n")}
<footer>Medians across all runs and pages. Lab metrics count as a win only at p&lt;0.05 (Mann-Whitney U) and ≥3% change; byte/count metrics are deterministic. Lower is better except throughput.</footer>
</main></body></html>`;
}
