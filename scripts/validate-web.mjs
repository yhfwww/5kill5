import { readFile } from "node:fs/promises";

const requiredFiles = [
  "apps/web/index.html",
  "apps/web/styles.css",
  "apps/web/app.js",
  "services/api/src/index.ts",
  "migrations/0001_initial.sql",
  "crates/5kill5-core/src/quality.rs",
  "crates/5kill5-core/src/distribution.rs",
  "crates/5kill5-cli/src/main.rs"
];

const requiredSelectors = [
  "skills-view",
  "packs-view",
  "profiles-view",
  "devices-view",
  "quality-view",
  "privacy-view",
  "skill-file",
  "publish-skill",
  "language-select"
];

for (const file of requiredFiles) {
  const body = await readFile(file, "utf8");
  if (!body.trim()) {
    throw new Error(`${file} is empty`);
  }
}

const html = await readFile("apps/web/index.html", "utf8");
for (const selector of requiredSelectors) {
  if (!html.includes(`id="${selector}"`)) {
    throw new Error(`missing #${selector}`);
  }
}

const app = await readFile("apps/web/app.js", "utf8");
for (const token of ["runQualityGate", "resolveManifest", "createSkillFromContent", "localStorage", "translations", "language-select"]) {
  if (!app.includes(token)) {
    throw new Error(`missing ${token} in web app`);
  }
}

console.log("5KILL5 MVP structure validated");
