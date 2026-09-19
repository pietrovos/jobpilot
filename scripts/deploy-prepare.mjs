import "dotenv/config";
import { execFileSync } from "node:child_process";
import { accessSync, constants } from "node:fs";
import path from "node:path";

const url = process.env.DATABASE_URL;
if (!url?.startsWith("file:") || !path.isAbsolute(url.slice(5))) {
  throw new Error("Deployment requires an explicit absolute file: DATABASE_URL.");
}
accessSync(path.dirname(url.slice(5)), constants.W_OK);
accessSync(path.resolve("uploads"), constants.W_OK);
// Build before changing the database. Operators must stop writes and back up first.
execFileSync("npm", ["run", "build"], { stdio: "inherit" });
execFileSync("npm", ["run", "db:deploy"], { stdio: "inherit" });
