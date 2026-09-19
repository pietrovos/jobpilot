import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx scripts/seed-demo.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
