// Copies the onnxruntime-web engine into public/ort so the reel maker can load
// it from our own domain. Kept out of git because the wasm file is ~14 MB.
import { cpSync, mkdirSync } from "node:fs";

const from = "node_modules/onnxruntime-web/dist";
const to = "public/ort";
mkdirSync(to, { recursive: true });
for (const f of ["ort.wasm.min.mjs", "ort-wasm-simd-threaded.mjs", "ort-wasm-simd-threaded.wasm"]) {
  cpSync(`${from}/${f}`, `${to}/${f}`);
}
console.log("copied onnxruntime-web files to", to);
