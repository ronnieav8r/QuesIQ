import { NextRequest, NextResponse } from "next/server";
import { Client } from "pg";

import { requireAdminSession } from "@/server/admin";

export const runtime = "nodejs";

type DatabaseColumn = {
  columnName: string;
  dataType: string;
  isNullable: boolean;
  ordinalPosition: number;
};

type DatabaseTableSummary = {
  columnCount: number;
  estimatedRowCount: number;
  schemaName: string;
  tableName: string;
};

type DatabaseTableRows = {
  columns: DatabaseColumn[];
  exactRowCount: number;
  orderBy: string;
  page: number;
  pageSize: number;
  rows: Record<string, unknown>[];
  schemaName: string;
  tableName: string;
};

function clampInteger(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

function quoteIdentifier(identifier: string) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function shouldUseSsl(connectionString: string) {
  return connectionString.includes("render.com") || connectionString.includes("sslmode=require");
}

async function createClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const client = new Client({
    connectionString,
    ssl: shouldUseSsl(connectionString) ? { rejectUnauthorized: false } : undefined,
  });

  await client.connect();
  return client;
}

async function listTables(client: Client): Promise<DatabaseTableSummary[]> {
  const result = await client.query<{
    column_count: string;
    estimated_row_count: string;
    table_schema: string;
    table_name: string;
  }>(`
    select
      tables.table_schema,
      tables.table_name,
      count(columns.column_name)::text as column_count,
      greatest(coalesce(pg_class.reltuples, 0), 0)::bigint::text as estimated_row_count
    from information_schema.tables
    join information_schema.columns
      on columns.table_schema = tables.table_schema
      and columns.table_name = tables.table_name
    left join pg_namespace
      on pg_namespace.nspname = tables.table_schema
    left join pg_class
      on pg_class.relnamespace = pg_namespace.oid
      and pg_class.relname = tables.table_name
    where tables.table_type = 'BASE TABLE'
    group by tables.table_schema, tables.table_name, pg_class.reltuples
    order by
      case when tables.table_schema = 'public' then 0 else 1 end,
      tables.table_schema asc,
      tables.table_name asc
  `);

  return result.rows.map((row) => ({
    columnCount: Number(row.column_count),
    estimatedRowCount: Number(row.estimated_row_count),
    schemaName: row.table_schema,
    tableName: row.table_name,
  }));
}

async function listColumns(
  client: Client,
  schemaName: string,
  tableName: string,
): Promise<DatabaseColumn[]> {
  const result = await client.query<{
    column_name: string;
    data_type: string;
    is_nullable: "NO" | "YES";
    ordinal_position: number;
  }>(
    `
      select column_name, data_type, is_nullable, ordinal_position
      from information_schema.columns
      where table_schema = $1
        and table_name = $2
      order by ordinal_position asc
    `,
    [schemaName, tableName],
  );

  return result.rows.map((row) => ({
    columnName: row.column_name,
    dataType: row.data_type,
    isNullable: row.is_nullable === "YES",
    ordinalPosition: row.ordinal_position,
  }));
}

function orderColumn(columns: DatabaseColumn[]) {
  const preferred = ["created_at", "updated_at", "id"];
  const match = preferred.find((name) =>
    columns.some((column) => column.columnName === name),
  );

  return match ?? columns[0]?.columnName;
}

async function loadTableRows(
  client: Client,
  schemaName: string,
  tableName: string,
  page: number,
  pageSize: number,
): Promise<DatabaseTableRows> {
  const columns = await listColumns(client, schemaName, tableName);
  const tableIdentifier = `${quoteIdentifier(schemaName)}.${quoteIdentifier(tableName)}`;
  const orderByColumn = orderColumn(columns);
  const orderBy = orderByColumn
    ? `${quoteIdentifier(orderByColumn)} ${orderByColumn.endsWith("_at") ? "desc" : "asc"}`
    : "1";
  const offset = (page - 1) * pageSize;
  const countResult = await client.query<{ count: string }>(
    `select count(*)::text as count from ${tableIdentifier}`,
  );
  const rowsResult = await client.query<Record<string, unknown>>(
    `select * from ${tableIdentifier} order by ${orderBy} limit $1 offset $2`,
    [pageSize, offset],
  );

  return {
    columns,
    exactRowCount: Number(countResult.rows[0]?.count ?? 0),
    orderBy,
    page,
    pageSize,
    rows: rowsResult.rows,
    schemaName,
    tableName,
  };
}

export async function GET(request: NextRequest) {
  const appSession = await requireAdminSession();

  if (!appSession) {
    return NextResponse.json({ error: "Admin access is required." }, { status: 403 });
  }

  let client: Client | undefined;

  try {
    client = await createClient();

    const tables = await listTables(client);
    const tableKeys = new Set(
      tables.map((table) => `${table.schemaName}.${table.tableName}`),
    );
    const requestedTableKey = request.nextUrl.searchParams.get("table");
    const selectedTableKey =
      requestedTableKey && tableKeys.has(requestedTableKey)
        ? requestedTableKey
        : tables[0]
          ? `${tables[0].schemaName}.${tables[0].tableName}`
          : undefined;
    const selectedTable = selectedTableKey
      ? tables.find(
          (table) => `${table.schemaName}.${table.tableName}` === selectedTableKey,
        )
      : undefined;
    const page = clampInteger(request.nextUrl.searchParams.get("page"), 1, 1, 100000);
    const pageSize = clampInteger(
      request.nextUrl.searchParams.get("pageSize"),
      50,
      10,
      100,
    );
    const selected = selectedTable
      ? await loadTableRows(
          client,
          selectedTable.schemaName,
          selectedTable.tableName,
          page,
          pageSize,
        )
      : undefined;

    return NextResponse.json({
      selected,
      tables,
    });
  } catch (error) {
    console.error("Database visibility load failed.", error);

    return NextResponse.json(
      {
        detail: error instanceof Error ? error.message : "Database visibility failed.",
        error: "Database visibility could not be loaded.",
      },
      { status: 503 },
    );
  } finally {
    await client?.end();
  }
}
