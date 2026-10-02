import { config } from "dotenv";
import { spawn } from "node:child_process";

config({ path: ".env.e2e.local" });
if (!process.env.DATABASE_URL || !process.env.APP_ORIGIN)
  throw new Error("Set DATABASE_URL and APP_ORIGIN in .env.e2e.local");

const child = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "-p", "3001"],
  { stdio: "inherit", env: process.env },
);
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
