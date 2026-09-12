import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { Pool } from "pg";

// One-time bootstrap for the explicitly selected, new QuesIQ project.
// Never load .env.local, export credentials, copy local rows, or run test seeds.
const projectRef = "analiejpwazwbeabpayp";
const root = fileURLToPath(new URL("../../", import.meta.url));
const output = path.join(root, "artifacts/supabase-setup-2026-09-12");
const apply = process.argv.includes("--apply");

async function inspect(client) {
  const { rows: [identity] } = await client.query("SELECT current_database() AS database, current_user AS role");
  const { rows: tables } = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name");
  const { rows: [journal] } = await client.query("SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS present");
  const migrations = journal.present
    ? (await client.query("SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at")).rows
    : [];
  return { identity, tables: tables.map(row => row.table_name), migrations };
}

async function main() {
  if (process.argv.slice(2).some(arg => !["--check", "--apply"].includes(arg))) throw new Error("Use --check or --apply only.");
  process.loadEnvFile(path.join(root, ".env.supabase.local"));
  if (process.env.SUPABASE_PROJECT_REF !== projectRef ||
      process.env.SUPABASE_DB_HOST !== "aws-0-us-east-1.pooler.supabase.com" ||
      process.env.SUPABASE_DB_USER !== `postgres.${projectRef}` ||
      process.env.SUPABASE_DB_PORT !== "5432" || process.env.SUPABASE_DB_NAME !== "postgres") {
    throw new Error("Target does not match the reviewed QuesIQ Supabase session-pooler endpoint.");
  }
  if (!process.env.SUPABASE_DB_PASSWORD) throw new Error("Save the QuesIQ database password in the ignored .env.supabase.local file first.");
  const url = new URL(`postgresql://${process.env.SUPABASE_DB_HOST}:5432/postgres`);
  url.username = process.env.SUPABASE_DB_USER;
  url.password = process.env.SUPABASE_DB_PASSWORD;
  url.searchParams.set("sslmode", "verify-full");
  const pool = new Pool({ connectionString: url.toString(), max: 1, connectionTimeoutMillis: 15000, statement_timeout: 30000 });
  let client;
  fs.mkdirSync(output, { recursive: true });
  try {
    client = await pool.connect();
    const before = await inspect(client);
    if (before.identity.database !== "postgres" || before.identity.role !== "postgres") throw new Error("Unexpected database identity; no changes made.");
    fs.writeFileSync(path.join(output, "hosted-preflight.json"), JSON.stringify({ projectRef, tls: "verify-full", ...before }, null, 2));
    console.log(JSON.stringify({ projectRef, tls: "verify-full", tables: before.tables.length, migrations: before.migrations.length, action: apply ? "bootstrap" : "read-only" }));
    if (!apply) return;
    if (before.tables.length || before.migrations.length) throw new Error("Bootstrap requires an empty public schema and migration journal. Review existing data before any further migration.");
    client.release(); client = undefined;
    const result = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
      cwd: root,
      env: { ...process.env, DATABASE_URL: url.toString() },
      encoding: "utf8",
      timeout: 300000,
      maxBuffer: 2 * 1024 * 1024,
    });
    const redact = value => String(value ?? "").replaceAll(url.toString(), "[database URL redacted]").replaceAll(process.env.SUPABASE_DB_PASSWORD, "[password redacted]");
    fs.writeFileSync(path.join(output, "hosted-migrate.log"), redact(result.stdout) + redact(result.stderr));
    if (result.status !== 0) throw new Error("Migration did not report success; inspect the redacted migration log before retrying.");
    client = await pool.connect();
    const after = await inspect(client);
    const expected = readMigrationFiles({ migrationsFolder: path.join(root, "drizzle") });
    if (after.migrations.length !== expected.length || expected.some((entry, index) => entry.hash !== after.migrations[index].hash || entry.folderMillis !== Number(after.migrations[index].created_at))) throw new Error("Migration journal does not exactly match the reviewed files.");
    const counts = {};
    for (const table of ["user", "sessions", "ai_runs"]) {
      if (!after.tables.includes(table)) throw new Error(`Expected application table missing: ${table}`);
      counts[table] = Number((await client.query(`SELECT count(*) AS count FROM public."${table}"`)).rows[0].count);
      if (counts[table] !== 0) throw new Error(`Unexpected application data in ${table}; inspect before continuing.`);
    }
    // QuesIQ uses server-side Auth.js/Drizzle, not the Supabase browser Data API.
    // Restrict only the project's public application schema, not Supabase internals.
    await client.query("BEGIN");
    try {
      await client.query("REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated");
      await client.query("REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated");
      await client.query("ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated");
      await client.query("ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated");
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
    const apiGrants = (await client.query("SELECT grantee,table_name,privilege_type FROM information_schema.role_table_grants WHERE table_schema='public' AND grantee IN ('anon','authenticated')")).rows;
    if (apiGrants.length) throw new Error("Unexpected public Data API table grants remain.");
    fs.writeFileSync(path.join(output, "hosted-verified.json"), JSON.stringify({ projectRef, tls: "verify-full", ...after, counts }, null, 2));
    console.log(JSON.stringify({ verified: true, migrations: after.migrations.length, tables: after.tables.length, counts }));
  } finally {
    client?.release();
    await pool.end();
  }
}

main().catch(error => {
  // Do not echo driver connection details or credentials into the task transcript.
  console.error(error.code ? `Database setup failed (${error.code}). No credentials printed.` : error.message);
  process.exitCode = 1;
});
