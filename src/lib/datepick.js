/**
 * Date chosen from three dropdowns (day, month, year) instead of typed. The element's .value is YYYY-MM-DD, or "" until a full valid date is chosen.
 * .partial is true when only some of the three are chosen, so forms can ask for the rest.
 */
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const opt = (v, t, sel) => { const o = document.createElement("option"); o.value = String(v); o.textContent = t; if (sel) o.selected = true; return o; };

export function dateSelect({ value = "", from, to, id = "date", label = "Date", order = "desc" } = {}) {
  const now = new Date().getFullYear(); let lo = from ?? now - 1, hi = to ?? now + 2;
  const mk = (suffix, text) => { const s = document.createElement("select"); s.id = `${id}_${suffix}`; s.setAttribute("aria-label", `${label}: ${text.toLowerCase()}`); return s; };
  const day = mk("d", "Day"), month = mk("m", "Month"), year = mk("y", "Year");
  const wrap = document.createElement("div"); wrap.className = "datesel"; wrap.id = id; wrap.setAttribute("role", "group"); wrap.setAttribute("aria-label", label); wrap.focusId = day.id;
  const fillDays = () => { const y = +year.value || 2000, m = +month.value || 1, keep = day.value; const n = new Date(y, m, 0).getDate(); day.replaceChildren(opt("", "Day")); for (let d = 1; d <= n; d++) day.append(opt(d, d, String(d) === keep)); };
  const fillYears = (extra) => { const ys = []; for (let y = lo; y <= hi; y++) ys.push(y); if (extra && !ys.includes(extra)) ys.push(extra); ys.sort((a, b) => (order === "desc" ? b - a : a - b)); const keep = year.value; year.replaceChildren(opt("", "Year")); ys.forEach((y) => year.append(opt(y, y, String(y) === keep))); };
  month.append(opt("", "Month")); MONTHS.forEach((m, i) => month.append(opt(i + 1, m)));
  fillYears(); fillDays();
  month.addEventListener("change", fillDays); year.addEventListener("change", fillDays);
  wrap.append(day, month, year);
  const iso = () => { const d = +day.value, m = +month.value, y = +year.value; return d && m && y ? `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` : ""; };
  Object.defineProperty(wrap, "value", {
    get: iso,
    set(v) { const m = String(v || "").match(/^(\d{4})-(\d{2})-(\d{2})$/); if (!m) { day.value = month.value = year.value = ""; fillDays(); return; } fillYears(+m[1]); year.value = String(+m[1]); month.value = String(+m[2]); fillDays(); day.value = String(+m[3]); },
  });
  Object.defineProperty(wrap, "partial", { get: () => [day.value, month.value, year.value].some(Boolean) && !iso() });
  Object.defineProperty(wrap, "disabled", { get: () => day.disabled, set(v) { day.disabled = month.disabled = year.disabled = Boolean(v); } });
  if (value) wrap.value = value;
  return wrap;
}
export const sessionOptions = (around = new Date().getFullYear()) => { const out = []; for (let y = around - 2; y <= around + 2; y++) out.push(`${y}/${y + 1}`); return out; };
