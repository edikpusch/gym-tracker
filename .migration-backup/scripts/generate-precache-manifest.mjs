import { promises as fs } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const staticDir = path.join(projectRoot, ".next", "static");
const outputFile = path.join(
  projectRoot,
  "public",
  "precache-assets.json"
);

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

  console.log(`Wrote ${assetUrls.length} precache assets to public/precache-assets.json`);
}

main().catch((error) => {
  console.error("Failed to generate precache manifest:", error);
  process.exitCode = 1;
});
