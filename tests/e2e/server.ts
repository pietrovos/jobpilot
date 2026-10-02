import { spawn } from "node:child_process";
import { temporaryDatabase } from "../helpers/database";
import { rmSync } from "node:fs";
import { mailOutbox } from "./mail-outbox";

const db = temporaryDatabase();
rmSync(mailOutbox, { recursive: true, force: true });
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "localhost", "--port", "3100"], {
  env: { ...db.env, NODE_ENV: "production", TRUSTED_PROXY_IP_HEADER: "x-e2e-client", MAIL_OUTBOX: mailOutbox, APP_URL: "http://localhost:3100" }, stdio: "inherit",
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
