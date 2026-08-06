import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const projectRoot = process.cwd();
const staticDir = path.join(projectRoot, ".next", "static");
const outputFile = path.join(
  projectRoot,
  "public",
  "precache-assets.json"
);
const serviceWorkerTemplate = path.join(projectRoot, "scripts", "sw.template.js");
const serviceWorkerOutput = path.join(projectRoot, "public", "sw.js");

async function collectFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        return collectFiles(fullPath);
      }

      return [fullPath];
    })
  );

  return files.flat();
}

async function main() {
  const files = await collectFiles(staticDir);
  const assetUrls = files
    .map((file) =>
      `/_next/static/${path
        .relative(staticDir, file)
        .replaceAll(path.sep, "/")}`
    )
    .sort();

  await fs.writeFile(
    outputFile,
    JSON.stringify({ assets: assetUrls }, null, 2) + "\n",
    "utf8"
  );

  const buildId = await fs.readFile(path.join(projectRoot, ".next", "BUILD_ID"), "utf8");
  const buildVersion = createHash("sha256")
    .update(buildId.trim())
    .update("\n")
    .update(assetUrls.join("\n"))
    .digest("hex")
    .slice(0, 12);
  const template = await fs.readFile(serviceWorkerTemplate, "utf8");
  await fs.writeFile(
    serviceWorkerOutput,
    template.replaceAll("__BUILD_VERSION__", buildVersion),
    "utf8"
  );

  console.log(`Wrote ${assetUrls.length} precache assets and service worker ${buildVersion}`);
}

main().catch((error) => {
  console.error("Failed to generate precache manifest:", error);
  process.exitCode = 1;
});
