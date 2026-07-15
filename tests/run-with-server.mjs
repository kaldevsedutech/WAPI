import { spawn } from "node:child_process";

const port = process.env.TEST_PORT || "3107";
const baseUrl = `http://127.0.0.1:${port}`;

const cleanEnv = Object.fromEntries(
  Object.entries(process.env).filter(([key, value]) => key && !key.startsWith("=") && value !== undefined)
);

const server = spawn("npx tsx server.ts", {
  env: {
    ...cleanEnv,
    NODE_ENV: "test",
    PORT: port,
    ALLOWED_ORIGINS: `${baseUrl},http://localhost:${port}`,
  },
  shell: true,
  stdio: ["ignore", "pipe", "pipe"],
});

let serverOutput = "";
server.stdout.on("data", (chunk) => {
  serverOutput += chunk.toString();
});
server.stderr.on("data", (chunk) => {
  serverOutput += chunk.toString();
});

const waitForServer = async () => {
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/api/system-status`);
      if (res.ok) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Test server did not start at ${baseUrl}\n${serverOutput}`);
};

const runVitest = () =>
  new Promise((resolve) => {
    const vitest = spawn("npx vitest run tests/saas-features.test.ts", {
      env: { ...cleanEnv, TEST_BASE_URL: baseUrl },
      shell: true,
      stdio: "inherit",
    });
    vitest.on("close", resolve);
  });

let exitCode = 1;
try {
  await waitForServer();
  exitCode = await runVitest();
} finally {
  server.kill();
}

process.exit(exitCode);
