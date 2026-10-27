/** Shrinks an uploaded picture to a small PNG data URL so it can be kept on the school record (no file storage is needed). */
export async function pictureToDataUrl(file, maxW, maxH, maxChars = 110000) {
  if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) throw new Error("Choose a PNG, JPG or WebP picture.");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("Could not read that picture.")); i.src = url; });
    for (const scale of [1, 0.8, 0.6, 0.45]) {
      const k = Math.min(1, (maxW * scale) / img.width, (maxH * scale) / img.height); const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); const out = c.toDataURL("image/png"); if (out.length <= maxChars) return out;
    }
    throw new Error("That picture is too detailed. Use a smaller or simpler one.");
  } finally { URL.revokeObjectURL(url); }
}
