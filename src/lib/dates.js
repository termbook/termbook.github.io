/** Dates are stored as YYYY-MM-DD and shown as DD/MM/YYYY. */
export const showDate = (ds) => (ds ? ds.split("-").reverse().join("/") : "");
export const parseShown = (v) => { const m = String(v).trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/); return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : ""; };
export const showLong = (ds) => new Date(`${ds}T00:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
/** Nigerian phone numbers: 0xxxxxxxxxx (11 digits) or +234xxxxxxxxxx (13 characters). */
export const validPhone = (v) => /^(?:0[789][01]\d{8}|\+234[789][01]\d{8})$/.test(String(v).replace(/[\s-]/g, ""));
export const sessionLabel = (startYear) => `${startYear}/${startYear + 1}`;
