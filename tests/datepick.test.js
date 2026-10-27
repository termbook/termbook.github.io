// @vitest-environment jsdom
import { it, expect } from "vitest";
import { dateSelect, sessionOptions } from "../src/lib/datepick.js";
const pick = (el, k, v) => { const s = el.querySelector(`select[id$="_${k}"]`); s.value = String(v); s.dispatchEvent(new Event("change", { bubbles: true })); };
it("builds a date from three dropdowns and never accepts an impossible date", () => {
  const d = dateSelect({ id: "x", label: "Date of birth", from: 2000, to: 2012 }); document.body.append(d);
  expect(d.value).toBe(""); expect(d.partial).toBe(false);
  pick(d, "y", 2010); expect(d.partial).toBe(true); pick(d, "m", 2); pick(d, "d", 5);
  expect(d.value).toBe("2010-02-05"); expect(d.partial).toBe(false);
  expect(d.querySelectorAll('select[id$="_d"] option').length).toBe(29);            // February 2010 has 28 days (+ the blank option)
  pick(d, "y", 2012); expect(d.querySelectorAll('select[id$="_d"] option').length).toBe(30); // leap year
  pick(d, "d", 31); pick(d, "m", 4); expect(d.value).toBe("");                        // 31 April does not exist, so it is cleared
});
it("can be set and read as YYYY-MM-DD, including a year outside the usual range, and can be disabled", () => {
  const d = dateSelect({ id: "y", from: 2000, to: 2012, value: "1995-12-31" });
  expect(d.value).toBe("1995-12-31"); d.value = "2005-01-09"; expect(d.value).toBe("2005-01-09"); d.value = ""; expect(d.value).toBe("");
  d.disabled = true; expect([...d.querySelectorAll("select")].every((s) => s.disabled)).toBe(true);
  expect(d.getAttribute("role")).toBe("group"); expect(d.querySelector("select").getAttribute("aria-label")).toBe("Date: day");
});
it("lists school sessions around this year", () => { expect(sessionOptions(2026)).toEqual(["2024/2025", "2025/2026", "2026/2027", "2027/2028", "2028/2029"]); });
