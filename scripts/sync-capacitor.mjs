import { promises as fs } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const projectRoot = process.cwd();
const supportedPlatforms = ["android", "ios"];

async function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: true,
      env: process.env,
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} failed with code ${code}`));
    });
  });
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function removeAndroidPublicDir() {
  const publicDir = path.join(
    projectRoot,
    "android",
    "app",
    "src",
    "main",
    "assets",
    "public"
  );

  await fs.rm(publicDir, { recursive: true, force: true });
}

const installedPlatforms = [];

for (const platform of supportedPlatforms) {
  const platformDir = path.join(projectRoot, platform);
  if (await pathExists(platformDir)) {
    installedPlatforms.push(platform);
  }
}

if (installedPlatforms.includes("android")) {
  await removeAndroidPublicDir();
}

if (installedPlatforms.length === 0) {
  console.warn("No native Capacitor platforms found. Skipping sync.");
  process.exit(0);
}

for (const platform of installedPlatforms) {
  await run("npx", ["cap", "sync", platform]);
}
