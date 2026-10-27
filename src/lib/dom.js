/** Tiny DOM helpers. All text goes through text nodes, so user data is never parsed as HTML. */
export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k === "value" || k === "checked" || k === "disabled" || k === "selected") el[k] = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids.flat(Infinity)) { if (k === null || k === undefined || k === false) continue; el.append(k.nodeType ? k : document.createTextNode(String(k))); }
  return el;
}
export const mount = (host, ...kids) => host.replaceChildren(...kids.flat(Infinity).filter(Boolean));
export function toast(msg, kind = "ok") {
  let box = document.getElementById("toasts");
  if (!box) { box = h("div", { id: "toasts", role: "status", "aria-live": "polite", class: "toasts" }); document.body.append(box); }
  const t = h("div", { class: `toast toast-${kind}` }, msg); box.append(t); setTimeout(() => t.remove(), 4000);
}
/** Accessible confirm dialog using <dialog>. Resolves true/false. */
export function confirmDialog({ title, body, confirmLabel = "Confirm", danger = false }) {
  return new Promise((res) => {
    const d = h("dialog", { class: "dlg", "aria-labelledby": "dlg-t" },
      h("h2", { id: "dlg-t" }, title), body ? h("p", {}, body) : null,
      h("div", { class: "dlg-actions" },
        h("button", { class: "btn", type: "button", onclick: () => d.close("no") }, "Cancel"),
        h("button", { class: `btn ${danger ? "btn-danger" : "btn-primary"}`, type: "button", onclick: () => d.close("yes") }, confirmLabel)));
    d.addEventListener("close", () => { res(d.returnValue === "yes"); d.remove(); });
    document.body.append(d); d.showModal();
  });
}
/** Dialog with a form body. build(close) returns the content. */
export function formDialog(title, build, wide = false) {
  const d = h("dialog", { class: wide ? "dlg dlg-wide" : "dlg", "aria-labelledby": "dlg-t" }, h("h2", { id: "dlg-t" }, title));
  d.append(build((v) => d.close(v)));
  d.addEventListener("close", () => d.remove());
  document.body.append(d); d.showModal(); return d;
}
export const field = (label, input, hint) => { const id = input.focusId || input.id || (input.id = "f" + Math.random().toString(36).slice(2, 8)); return h("div", { class: "field" }, h("label", { for: id }, label), input, hint ? h("p", { class: "hint" }, hint) : null); };
export const empty = (title, text, action) => h("div", { class: "empty" }, h("h2", {}, title), h("p", {}, text), action || null);
export const skeleton = (n = 4) => h("div", { "aria-busy": "true", "aria-label": "Loading" }, Array.from({ length: n }, () => h("div", { class: "skeleton skel-row" })));
export function downloadCsv(name, rows) {
  const esc = (v) => { let s = v == null ? "" : String(v); if (/^[=@\t\r]/.test(s) || (/^[+-]/.test(s) && !/^[+-]?[\d\s()-]+$/.test(s))) s = "'" + s; return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const blob = new Blob(["\uFEFF" + rows.map((r) => r.map(esc).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = h("a", { href: URL.createObjectURL(blob), download: name }); document.body.append(a); a.click(); a.remove();
}
export const initials = (n) => { const p = String(n).trim().split(/\s+/); return ((p[0]?.[0] || "") + (p[1]?.[0] || "")).toUpperCase(); };
