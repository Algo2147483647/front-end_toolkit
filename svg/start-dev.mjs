import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

function runNpm(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(npmCommand, args, {
      cwd: scriptDir,
      stdio: "inherit"
    });

    const forwardSignal = (signal) => {
      if (!child.killed) {
        child.kill(signal);
      }
    };

    process.once("SIGINT", forwardSignal);
    process.once("SIGTERM", forwardSignal);

    child.on("error", reject);
    child.on("exit", (code) => {
      process.removeListener("SIGINT", forwardSignal);
      process.removeListener("SIGTERM", forwardSignal);

      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Command failed: npm ${args.join(" ")}`));
    });
  });
}

function needsInstall() {
  const nodeModulesPath = join(scriptDir, "node_modules");
  const reactPath = join(nodeModulesPath, "react");
  const vitePath = join(nodeModulesPath, "vite");
  return !existsSync(nodeModulesPath) || !existsSync(reactPath) || !existsSync(vitePath);
}

async function main() {
  if (needsInstall()) {
    console.log("Dependencies missing. Running npm install...");
    await runNpm(["install"]);
  }

  console.log("Starting SVG Studio dev server...");
  await runNpm(["run", "dev"]);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
