import { readFile } from "node:fs/promises";

const app = await readFile("apps/web/app.js", "utf8");
const html = await readFile("apps/web/index.html", "utf8");

const start = app.indexOf("const translations = ");
const end = app.indexOf("\n};\n\nfunction uid");

if (start === -1 || end === -1) {
  throw new Error("Cannot locate translations object in apps/web/app.js");
}

const literal = app.slice(start + "const translations = ".length, end + 3);
const translations = Function(`return ${literal}`)();
const htmlKeys = [
  ...html.matchAll(/data-i18n(?:-placeholder|-title)?="([^"]+)"/g)
].map((match) => match[1]);
const appKeys = [
  ...app.matchAll(/\bt\("([A-Za-z0-9_.-]+)"/g)
].map((match) => match[1]);
const keys = [...new Set([...htmlKeys, ...appKeys])].filter((key) => !key.startsWith("finding."));
const missing = keys.filter((key) => !translations.en[key] || !translations.zh[key]);

if (missing.length) {
  throw new Error(`Missing i18n keys:\n${missing.join("\n")}`);
}

console.log(`i18n keys validated: ${keys.length}`);
