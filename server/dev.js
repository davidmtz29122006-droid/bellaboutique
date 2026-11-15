import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "./index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const viteCli = path.join(root, "node_modules", "vite", "bin", "vite.js");
const vite = spawn(process.execPath, [viteCli, "--host", "0.0.0.0"], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});

vite.on("error", (error) => {
  console.error("No se pudo iniciar Vite:", error);
  process.exitCode = 1;
});

vite.on("exit", (code) => {
  process.exitCode = code ?? 0;
  process.kill(process.pid, "SIGTERM");
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    vite.kill(signal);
    process.exit();
  });
}
