// Checks that every local link, script, stylesheet and image in the built site points at a file that exists.
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
const root = "dist"; let bad = 0, checked = 0;
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
for (const file of walk(root).filter((f) => f.endsWith(".html"))) {
  const html = readFileSync(file, "utf8");
  for (const m of html.matchAll(/(?:href|src)="([^"#?]+)(?:[#?][^"]*)?"/g)) {
    const u = m[1]; if (/^(https?:|mailto:|data:|tel:)/.test(u)) continue; checked++;
    const target = u.startsWith("/") ? join(root, u) : join(dirname(file), u);
    if (!(existsSync(target) || existsSync(join(target, "index.html")))) { console.log(`BROKEN  ${file} -> ${u}`); bad++; }
  }
}
console.log(`${checked} local links checked, ${bad} broken.`); process.exit(bad ? 1 : 0);
