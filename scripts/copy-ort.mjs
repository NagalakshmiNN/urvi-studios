// Prepares the files the in-browser reel maker loads from our own domain:
//  * the onnxruntime-web engine (copied from node_modules into public/ort)
//  * the cutout model "silueta" (44 MB, fetched once into public/models)
// Both are kept out of git because of their size. If the model cannot be
// fetched (no network at build time) the build carries on: the reel maker
// falls back to the small model that IS committed (public/models/u2netp.onnx).
import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";

const from = "node_modules/onnxruntime-web/dist";
const to = "public/ort";
mkdirSync(to, { recursive: true });
for (const f of ["ort.wasm.min.mjs", "ort-wasm-simd-threaded.mjs", "ort-wasm-simd-threaded.wasm"]) {
  cpSync(`${from}/${f}`, `${to}/${f}`);
}
console.log("copied onnxruntime-web files to", to);

const model = "public/models/silueta.onnx";
if (!existsSync(model)) {
  try {
    const res = await fetch("https://github.com/danielgatis/rembg/releases/download/v0.0.0/silueta.onnx", { redirect: "follow" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 30_000_000) throw new Error("download looks incomplete");
    writeFileSync(model, buf);
    console.log("fetched silueta model", (buf.length / 1048576).toFixed(1), "MB");
  } catch (e) {
    console.warn("could not fetch the silueta cutout model, the small one will be used:", e instanceof Error ? e.message : e);
  }
}
