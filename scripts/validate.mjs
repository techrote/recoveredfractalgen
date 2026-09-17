import { readFileSync, existsSync } from "node:fs";

const requiredFiles = [
  "index.html",
  "styles.css",
  "src/app.js",
  "fractalgen-backup",
  "0Play.cmd"
];

for (const path of requiredFiles) {
  if (!existsSync(path)) throw new Error("Missing required file: " + path);
}

const html = readFileSync("index.html", "utf8");
const app = readFileSync("src/app.js", "utf8");

const htmlIds = [
  "view", "fatal", "preset", "applyPreset", "pause", "randomize", "reset",
  "shot", "fullscreen", "toggleUi", "panel", "fractalMode", "cameraMode",
  "texturePreset", "textureFile", "exportState", "importState", "copyState",
  "recenter", "fps", "resolution", "timeReadout", "status"
];

for (const id of htmlIds) {
  if (!html.includes('id="' + id + '"')) throw new Error("index.html is missing #" + id);
}

const interactiveIds = htmlIds.filter(id => id !== "panel");
for (const id of interactiveIds) {
  if (!app.includes('"' + id + '"')) throw new Error("app.js does not reference #" + id);
}

const requiredRendererSignals = [
  "#version 300 es",
  "deJulia4",
  "deMandelbulb",
  "deMandelbox",
  "deFoldedLoop",
  "uTextureFlow",
  "softShadow",
  "requestAnimationFrame"
];

for (const signal of requiredRendererSignals) {
  if (!app.includes(signal)) throw new Error("Renderer signal missing: " + signal);
}

console.log("Static reconstruction checks passed.");
