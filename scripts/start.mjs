import "dotenv/config";
import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { spawn } from "node:child_process";

const url = process.env.DATABASE_URL;
if (!url?.startsWith("file:/")) throw new Error("Production requires an absolute SQLite DATABASE_URL. See docs/deployment.md.");
await access(url.slice(5), constants.R_OK | constants.W_OK);
await access("uploads", constants.R_OK | constants.W_OK);
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", ...process.argv.slice(2)], {
  env: { ...process.env, NODE_ENV: "production" }, stdio: "inherit",
});
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => child.kill(signal));
child.on("error", (error) => { console.error(error.message); process.exitCode = 1; });
child.on("exit", (code) => { process.exitCode = code ?? 1; });
