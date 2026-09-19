import { spawn } from "node:child_process";
import { temporaryDatabase } from "../helpers/database";

const db = temporaryDatabase();
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "localhost", "--port", "3100"], {
  env: { ...db.env, NODE_ENV: "production" }, stdio: "inherit",
});
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => server.kill(signal));
}
server.on("exit", (code) => {
  db.cleanup();
  process.exitCode = code ?? 0;
});
server.on("error", (error) => {
  db.cleanup();
  throw error;
});
