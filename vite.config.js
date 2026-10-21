import { defineConfig } from "vite";
import { resolve } from "node:path";
// The landing page, 404 page and static assets live in /public and are copied as they are.
// The app (app/index.html) is bundled, with Firebase and SheetJS split into their own files.
export default defineConfig({
  build: {
    rollupOptions: {
      input: { app: resolve(import.meta.dirname, "app/index.html") },
      output: { manualChunks: { firebase: ["firebase/app", "firebase/auth", "firebase/firestore"], sheetjs: ["xlsx"] } },
    },
  },
});
