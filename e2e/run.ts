import { mkdir, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const root = process.cwd();
const composeFile = resolve(root, "e2e", "compose.yml");
const capturePath = resolve(root, "test-results", "email-capture.jsonl");
const databaseUrl = "postgresql://postgres:postgres@127.0.0.1:54329/bahndelay_test";
const environment = {
  ...process.env,
  DATABASE_URL: databaseUrl,
  DATABASE_URL_UNPOOLED: databaseUrl,
  DATABASE_DRIVER: "postgres-js",
  BETTER_AUTH_URL: "http://localhost:3000",
  BETTER_AUTH_SECRET: "e2e-only-secret-e2e-only-secret-e2e-only-secret-0001",
  BOOTSTRAP_ADMIN_EMAIL: "e2e-admin@example.test",
  RESEND_API_KEY: "",
  EMAIL_FROM: "BahnDelay E2E <noreply@example.test>",
  APP_CONTACT_EMAIL: "help@example.test",
  TRANSITOUS_USER_AGENT: "BahnDelay-E2E/1.0 (help@example.test)",
  EMAIL_CAPTURE_PATH: capturePath,
  E2E_DATABASE_URL: databaseUrl,
  E2E_FULL_INVITE: "1",
};

async function run(command: string[], allowFailure = false) {
  const code = await new Promise<number>((resolveExit, reject) => {
    const child = spawn(command[0], command.slice(1), {
      cwd: root,
      env: environment,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (value) => resolveExit(value ?? 1));
  });
  if (code !== 0 && !allowFailure) throw new Error(`${command.join(" ")} failed with exit code ${code}`);
  return code;
}

await mkdir(resolve(root, "test-results"), { recursive: true });
await rm(capturePath, { force: true });

let exitCode = 1;
try {
  await run(["docker", "compose", "-p", "bahndelay-e2e", "-f", composeFile, "up", "-d", "--wait"]);
  await run(["bun", "run", "db:migrate"]);
  exitCode = await run(["bunx", "playwright", "test"], true);
} finally {
  await run(["docker", "compose", "-p", "bahndelay-e2e", "-f", composeFile, "down", "--volumes"], true);
  await rm(capturePath, { force: true });
}

process.exit(exitCode);
