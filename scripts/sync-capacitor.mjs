import { promises as fs } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const projectRoot = process.cwd();
const publicDir = path.join(
  projectRoot,
  "android",
  "app",
  "src",
  "main",
  "assets",
  "public"
);

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

await fs.rm(publicDir, { recursive: true, force: true });
await run("npx", ["cap", "sync", "android"]);
