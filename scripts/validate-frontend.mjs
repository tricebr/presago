import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

import { resolveLocalAsset } from "./frontend-assets.mjs";

const repositoryRoot = resolve(import.meta.dirname, "..");
const frontendRoot = join(repositoryRoot, "frontend");
const supportedExtensions = new Set([".html", ".css", ".js"]);
const failures = [];

function walk(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const absolute = join(directory, entry);
    return statSync(absolute).isDirectory() ? walk(absolute) : [absolute];
  });
}

function report(file, message) {
  failures.push(`${relative(repositoryRoot, file)}: ${message}`);
}

const files = walk(frontendRoot).filter((file) => supportedExtensions.has(extname(file))).filter((file) => !file.includes("/vendor/"));
const htmlFiles = files.filter((file) => extname(file) === ".html");

for (const file of files) {
  const source = readFileSync(file, "utf8");
  if (/StellarPulse|Stellar Pulse|stellarpulse/i.test(source)) {
    report(file, "contains retired project branding");
  }
  if (/\b(S|G)[A-Z2-7]{55}\b/.test(source) && /secret|seed/i.test(source)) {
    report(file, "may contain a Stellar secret or seed value");
  }
}

for (const file of htmlFiles) {
  const source = readFileSync(file, "utf8");
  if (!/<html[^>]+lang=["'][^"']+["']/i.test(source)) report(file, "missing html lang attribute");
  if (!/<meta[^>]+charset=/i.test(source)) report(file, "missing character encoding");
  if (!/<meta[^>]+name=["']viewport["']/i.test(source)) report(file, "missing viewport metadata");
  if (!/<title>[^<]+<\/title>/i.test(source)) report(file, "missing non-empty title");

  const ids = [...source.matchAll(/\sid=["']([^"']+)["']/gi)].map((match) => match[1]);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  for (const id of new Set(duplicateIds)) report(file, `contains duplicate id '${id}'`);

  const references = [...source.matchAll(/\s(?:src|href)=["']([^"']+)["']/gi)].map((match) => match[1]);
  for (const reference of references) {
    const localPath = resolveLocalAsset(file, reference);
    if (localPath === null) continue;
    if (!existsSync(localPath)) report(file, `references missing local asset '${reference}'`);
  }
}

if (failures.length) {
  console.error("Frontend validation failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Validated ${htmlFiles.length} HTML pages and ${files.length} frontend source files.`);
