import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import pg from "pg";

const { Client } = pg;

function parseArgs(argv) {
  const args = {
    activeOnly: false,
    csv: false,
    outDir: "artifacts/prompt-exports",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--active-only") {
      args.activeOnly = true;
      continue;
    }

    if (arg === "--csv") {
      args.csv = true;
      continue;
    }

    if (arg === "--out-dir") {
      args.outDir = argv[index + 1] || args.outDir;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function csvEscape(value) {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue =
    value instanceof Date ? value.toISOString() : String(value);

  return `"${stringValue.replaceAll('"', '""')}"`;
}

function toCsv(rows) {
  if (rows.length === 0) {
    return "";
  }

  const columns = Object.keys(rows[0]);
  const lines = [
    columns.map(csvEscape).join(","),
    ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(",")),
  ];

  return `${lines.join("\n")}\n`;
}

function timestampForFilename() {
  return new Date().toISOString().replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const databaseUrl = process.env.EXTERNAL_DATABASE_URL || process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "Set EXTERNAL_DATABASE_URL or DATABASE_URL before running this prompt export.",
    );
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    const promptConfigsSql = `
      select
        id,
        key,
        name,
        target,
        version,
        active,
        model,
        voice,
        created_at,
        updated_at,
        instructions
      from prompt_configs
      ${args.activeOnly ? "where active = true" : ""}
      order by key, version desc
    `;

    const promptComponentsSql = `
      select
        'mode' as type,
        key,
        name as display_name,
        description,
        prompt_instructions
      from practice_modes
      union all
      select
        'question_type' as type,
        key,
        label as display_name,
        null as description,
        prompt_instructions
      from question_types
      union all
      select
        'style' as type,
        key,
        label as display_name,
        description,
        prompt_instructions
      from interview_styles
      order by type, key
    `;

    const [promptConfigsResult, promptComponentsResult] = await Promise.all([
      client.query(promptConfigsSql),
      client.query(promptComponentsSql),
    ]);

    const activePromptConfigs = Object.fromEntries(
      promptConfigsResult.rows
        .filter((row) => row.active)
        .map((row) => [row.key, row]),
    );

    const exportPayload = {
      activeOnly: args.activeOnly,
      activePromptConfigs,
      exportedAt: new Date().toISOString(),
      promptComponents: promptComponentsResult.rows,
      promptConfigs: promptConfigsResult.rows,
      source: process.env.EXTERNAL_DATABASE_URL
        ? "EXTERNAL_DATABASE_URL"
        : "DATABASE_URL",
    };

    const resolvedOutDir = path.resolve(process.cwd(), args.outDir);
    await mkdir(resolvedOutDir, { recursive: true });

    const timestamp = timestampForFilename();
    const jsonPath = path.join(resolvedOutDir, `prompt-export-${timestamp}.json`);
    await writeFile(jsonPath, `${JSON.stringify(exportPayload, null, 2)}\n`, "utf8");

    console.log(`Prompt configs: ${promptConfigsResult.rowCount}`);
    console.log(`Prompt components: ${promptComponentsResult.rowCount}`);
    console.log(`JSON export: ${jsonPath}`);

    if (args.csv) {
      const configsPath = path.join(
        resolvedOutDir,
        `prompt-configs-${timestamp}.csv`,
      );
      const componentsPath = path.join(
        resolvedOutDir,
        `prompt-components-${timestamp}.csv`,
      );

      await Promise.all([
        writeFile(configsPath, toCsv(promptConfigsResult.rows), "utf8"),
        writeFile(componentsPath, toCsv(promptComponentsResult.rows), "utf8"),
      ]);

      console.log(`Prompt configs CSV: ${configsPath}`);
      console.log(`Prompt components CSV: ${componentsPath}`);
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
