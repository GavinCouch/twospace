import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createServer } from "node:net";

const binaries = process.env.PG_BIN || "/opt/homebrew/opt/postgresql@17/bin";
const temporary = mkdtempSync("/tmp/twospace-pg-");
const cluster = join(temporary, "cluster");
const passwordFile = join(temporary, "password");
const password = randomBytes(32).toString("base64url");
writeFileSync(passwordFile, password, { mode: 0o600 });
let started = false;
let stopped = true;
let exitCode = 1;
const command = (binary, args, options = {}) => {
  const result = spawnSync(join(binaries, binary), args, {
    encoding: "utf8",
    ...options,
  });
  if (result.error || result.status !== 0) {
    throw new Error(
      `${binary} failed. Check PostgreSQL availability and PG_BIN.`,
    );
  }
  return result;
};
try {
  const reservation = createServer();
  await new Promise((resolve, reject) => {
    reservation.once("error", reject);
    reservation.listen(0, "127.0.0.1", resolve);
  });
  const port = reservation.address().port;
  await new Promise((resolve) => reservation.close(resolve));
  command("initdb", [
    "-D",
    cluster,
    "-U",
    "twospace_test",
    "--pwfile",
    passwordFile,
    "--auth-local=trust",
    "--auth-host=scram-sha-256",
    "--encoding=UTF8",
    "--locale=C",
  ]);
  command("pg_ctl", [
    "-D",
    cluster,
    "-l",
    join(temporary, "postgres.log"),
    "-o",
    `-h 127.0.0.1 -p ${port} -k ${temporary}`,
    "-w",
    "start",
  ]);
  started = true;
  stopped = false;
  command(
    "createdb",
    [
      "-h",
      "127.0.0.1",
      "-p",
      String(port),
      "-U",
      "twospace_test",
      "twospace_test",
    ],
    { env: { ...process.env, PGPASSWORD: password } },
  );
  const result = spawnSync(
    process.execPath,
    ["node_modules/vitest/vitest.mjs", "run", "tests/server/postgres.test.ts"],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        TWOSPACE_TEST_POSTGRES_URL: `postgresql://twospace_test:${password}@127.0.0.1:${port}/twospace_test`,
      },
    },
  );
  exitCode = result.status ?? 1;
} catch (error) {
  console.error(error.message);
} finally {
  if (started) {
    try {
      command("pg_ctl", ["-D", cluster, "-m", "fast", "-w", "stop"]);
      stopped = true;
    } catch {
      console.error(
        `The isolated PostgreSQL cluster needs manual cleanup at ${temporary}.`,
      );
      exitCode = 1;
    }
  }
  if (stopped) {
    rmSync(temporary, { recursive: true, force: true });
    console.log("Stopped and removed the temporary PostgreSQL cluster.");
  }
}
process.exitCode = exitCode;
