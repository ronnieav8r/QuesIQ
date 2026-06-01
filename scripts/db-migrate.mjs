import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { readMigrationFiles } from "drizzle-orm/migrator";
import { Pool } from "pg";

const migrationsFolder = path.join(process.cwd(), "drizzle");
const journalPath = path.join(migrationsFolder, "meta", "_journal.json");

function statementPreview(statement) {
  return statement.replace(/\s+/g, " ").trim().slice(0, 500);
}

function readJournalEntries() {
  const journal = JSON.parse(fs.readFileSync(journalPath, "utf8"));

  return journal.entries;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for database migrations.");
  }

  const entries = readJournalEntries();
  const migrations = readMigrationFiles({ migrationsFolder });
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query("CREATE SCHEMA IF NOT EXISTS drizzle");
    await client.query(`
      CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )
    `);

    const latestResult = await client.query(
      "SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 1",
    );
    const latest = latestResult.rows[0];
    const latestCreatedAt = latest ? Number(latest.created_at) : 0;
    const pending = migrations
      .map((migration, index) => ({
        entry: entries[index],
        migration,
      }))
      .filter(({ migration }) => migration.folderMillis > latestCreatedAt);

    if (pending.length === 0) {
      console.log("Database migrations are already current.");
      return;
    }

    console.log(`Applying ${pending.length} pending database migration(s).`);
    await client.query("BEGIN");

    for (const { entry, migration } of pending) {
      console.log(`Applying migration ${entry.tag}.`);

      for (const [statementIndex, statement] of migration.sql.entries()) {
        const sql = statement.trim();

        if (!sql) {
          continue;
        }

        try {
          await client.query(sql);
        } catch (error) {
          console.error(
            `Migration failed in ${entry.tag}, statement ${statementIndex + 1}/${migration.sql.length}.`,
          );
          console.error(statementPreview(sql));
          throw error;
        }
      }

      await client.query(
        'INSERT INTO drizzle.__drizzle_migrations ("hash", "created_at") VALUES ($1, $2)',
        [migration.hash, migration.folderMillis],
      );
      console.log(`Applied migration ${entry.tag}.`);
    }

    await client.query("COMMIT");
    console.log("Database migrations applied successfully.");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Ignore rollback errors so the original migration error is visible.
    }

    console.error(error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

void main();
