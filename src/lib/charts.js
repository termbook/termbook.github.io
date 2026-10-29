/**
 * Small SVG charts with no library. Each chart scales to its container, uses the app's colours (so light and dark both work),
 * has a title and a short summary for screen readers, tooltips on every point, and a "Show the numbers" table.
 */
const NS = "http://www.w3.org/2000/svg";
const S = (tag, attrs = {}, ...kids) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) e.setAttribute(k, String(v)); for (const k of kids) if (k) e.append(k); return e; };
const H = (tag, cls, ...kids) => { const e = document.createElement(tag); if (cls) e.className = cls; for (const k of kids.flat()) if (k !== null && k !== undefined && k !== false) e.append(k.nodeType ? k : document.createTextNode(String(k))); return e; };
const T = (text) => { const t = document.createElementNS(NS, "title"); t.textContent = text; return t; };
const fmt = (n) => (n === null || n === undefined || Number.isNaN(n) ? "–" : Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10));

function table(headers, rows) {
  const d = H("details", "ch-data"); d.append(H("summary", "", "Show the numbers"));
  d.append(H("div", "table-wrap", H("table", "", H("thead", "", H("tr", "", headers.map((x) => H("th", "", x)))), H("tbody", "", rows.map((r) => H("tr", "", r.map((c, i) => (i === 0 ? H("th", "", fmt(c)) : H("td", "", fmt(c))))))))));
  return d;
}
function frame(title, svg, legend, dataTable, note) {
  const wrap = H("figure", "chart"); wrap.append(H("figcaption", "", title)); wrap.append(svg);
  if (legend?.length) wrap.append(H("div", "ch-legend", legend.map((l, i) => H("span", "", H("i", `ch-key s${l.cls ?? i}`), l.name))));
  if (note) wrap.append(H("p", "hint", note)); if (dataTable) wrap.append(dataTable); return wrap;
}

/**
 * labels: x categories. series: [{ name, values: [number|null], cls? }]. null leaves a gap.
 * reverse: smaller is higher up (class position, where 1 is best).
 */
export function lineChart({ title, labels, series, yMin = 0, yMax = 100, unit = "", reverse = false, summary = "" }) {
  const W = 560, Ht = 230, L = 44, R = 16, Tp = 14, B = 34; const iw = W - L - R, ih = Ht - Tp - B;
  const svg = S("svg", { viewBox: `0 0 ${W} ${Ht}`, class: "ch-svg", role: "img", "aria-label": `${title}. ${summary}` });
  const x = (i) => L + (labels.length === 1 ? iw / 2 : (iw * i) / (labels.length - 1)); const span = yMax - yMin || 1;
  const y = (v) => Tp + (reverse ? ((v - yMin) / span) * ih : ih - ((v - yMin) / span) * ih);
  for (let i = 0; i <= 4; i++) { const v = yMin + (span * i) / 4; svg.append(S("line", { x1: L, x2: W - R, y1: y(v), y2: y(v), class: "ch-grid" }), S("text", { x: L - 6, y: y(v) + 4, class: "ch-axis", "text-anchor": "end" }, document.createTextNode(`${fmt(Math.round(v * 10) / 10)}${unit}`))); }
  labels.forEach((l, i) => svg.append(S("text", { x: x(i), y: Ht - 10, class: "ch-axis", "text-anchor": "middle" }, document.createTextNode(l))));
  series.forEach((s, si) => {
    const pts = s.values.map((v, i) => (v === null || v === undefined ? null : [x(i), y(v), v, labels[i]])); const cls = `s${s.cls ?? si}`;
    let d = ""; let pen = false; pts.forEach((p) => { if (!p) { pen = false; return; } d += `${pen ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)} `; pen = true; });
    if (d) svg.append(S("path", { d: d.trim(), class: `ch-line ${cls}` }));
    pts.forEach((p) => { if (p) svg.append(S("circle", { cx: p[0], cy: p[1], r: 4, class: `ch-dot ${cls}` }, T(`${s.name}, ${p[3]}: ${fmt(p[2])}${unit}`))); });
  });
  const nothing = series.every((s) => s.values.every((v) => v === null || v === undefined));
  if (nothing) svg.append(S("text", { x: W / 2, y: Ht / 2, class: "ch-empty", "text-anchor": "middle" }, document.createTextNode("No data yet")));
  return frame(title, svg, series.length > 1 ? series.map((s, i) => ({ name: s.name, cls: s.cls ?? i })) : [], table(["", ...series.map((s) => s.name)], labels.map((l, i) => [l, ...series.map((s) => s.values[i])])));
}

/**
 * Bars. items: [{ label, value, marker? }]. marker draws a tick (for example the class average) on the same bar.
 * horizontal suits long names such as subjects.
 */
export function barChart({ title, items, max = 100, unit = "", horizontal = false, summary = "", markerName = "Class average", valueName = "Value", color = 0 }) {
  const hasMarker = items.some((i) => i.marker !== undefined && i.marker !== null);
  const tbl = table(["", valueName, ...(hasMarker ? [markerName] : [])], items.map((i) => [i.label, i.value, ...(hasMarker ? [i.marker] : [])]));
  const legend = hasMarker ? [{ name: valueName, cls: color }, { name: markerName, cls: "m" }] : [];
  if (horizontal) {
    const W = 560, row = 30, L = 150, R = 44, Tp = 8; const Ht = Tp + items.length * row + 8; const iw = W - L - R;
    const svg = S("svg", { viewBox: `0 0 ${W} ${Math.max(Ht, 60)}`, class: "ch-svg", role: "img", "aria-label": `${title}. ${summary}` });
    items.forEach((it, i) => {
      const yy = Tp + i * row, w = Math.max(0, Math.min(1, (it.value ?? 0) / max)) * iw;
      svg.append(S("text", { x: L - 8, y: yy + 17, class: "ch-axis", "text-anchor": "end" }, document.createTextNode(it.label.length > 24 ? `${it.label.slice(0, 22).trimEnd()}…` : it.label)), S("rect", { x: L, y: yy + 4, width: iw, height: 16, class: "ch-track" }), S("rect", { x: L, y: yy + 4, width: w, height: 16, class: `ch-bar s${color}`, rx: 3 }, T(`${it.label}: ${fmt(it.value)}${unit}`)), S("text", { x: L + iw + 6, y: yy + 17, class: "ch-axis" }, document.createTextNode(`${fmt(it.value)}${unit}`)));
      if (it.marker !== undefined && it.marker !== null) { const mx = L + Math.max(0, Math.min(1, it.marker / max)) * iw; svg.append(S("line", { x1: mx, x2: mx, y1: yy + 1, y2: yy + 23, class: "ch-marker" }, T(`${markerName}: ${fmt(it.marker)}${unit}`))); }
    });
    return frame(title, svg, legend, tbl);
  }
  const W = 560, Ht = 230, L = 40, R = 12, Tp = 14, B = 44; const iw = W - L - R, ih = Ht - Tp - B; const bw = Math.min(46, (iw / Math.max(items.length, 1)) * 0.62);
  const svg = S("svg", { viewBox: `0 0 ${W} ${Ht}`, class: "ch-svg", role: "img", "aria-label": `${title}. ${summary}` }); const y = (v) => Tp + ih - Math.max(0, Math.min(1, v / max)) * ih;
  for (let i = 0; i <= 4; i++) { const v = (max * i) / 4; svg.append(S("line", { x1: L, x2: W - R, y1: y(v), y2: y(v), class: "ch-grid" }), S("text", { x: L - 6, y: y(v) + 4, class: "ch-axis", "text-anchor": "end" }, document.createTextNode(`${fmt(v)}${unit}`))); }
  items.forEach((it, i) => {
    const cx = L + ((i + 0.5) * iw) / items.length; svg.append(S("rect", { x: cx - bw / 2, y: y(it.value ?? 0), width: bw, height: Tp + ih - y(it.value ?? 0), class: `ch-bar s${it.cls ?? color}`, rx: 3 }, T(`${it.label}: ${fmt(it.value)}${unit}`)), S("text", { x: cx, y: Ht - 24, class: "ch-axis", "text-anchor": "middle" }, document.createTextNode(it.label.length > 9 ? `${it.label.slice(0, 8)}…` : it.label)));
    if (it.value) svg.append(S("text", { x: cx, y: y(it.value) - 4, class: "ch-axis", "text-anchor": "middle" }, document.createTextNode(fmt(it.value))));
    if (it.marker !== undefined && it.marker !== null) svg.append(S("line", { x1: cx - bw / 2 - 3, x2: cx + bw / 2 + 3, y1: y(it.marker), y2: y(it.marker), class: "ch-marker" }, T(`${markerName}: ${fmt(it.marker)}${unit}`)));
  });
  if (!items.length || items.every((i) => !i.value)) svg.append(S("text", { x: W / 2, y: Ht / 2, class: "ch-empty", "text-anchor": "middle" }, document.createTextNode("No data yet")));
  return frame(title, svg, legend, tbl);
}
export const sparkline = (values, w = 90, h = 24) => {
  const v = values.filter((x) => x !== null && x !== undefined); const svg = S("svg", { viewBox: `0 0 ${w} ${h}`, class: "spark", role: "img", "aria-label": `Trend: ${v.map(fmt).join(", ")}` }); if (v.length < 2) return svg;
  const lo = Math.min(...v), hi = Math.max(...v), sp = hi - lo || 1; const pts = values.map((x, i) => (x === null || x === undefined ? null : [(i * (w - 6)) / (values.length - 1) + 3, h - 3 - ((x - lo) / sp) * (h - 6)])).filter(Boolean);
  svg.append(S("path", { d: pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" "), class: "ch-line s0" })); const last = pts[pts.length - 1]; svg.append(S("circle", { cx: last[0], cy: last[1], r: 2.5, class: "ch-dot s0" })); return svg;
};
