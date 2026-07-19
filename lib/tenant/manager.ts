/*
 * Tenant Manager
 *
 * Manages the lifecycle of tenant schemas:
 * - Creating new tenant schemas
 * - Initializing application tables within a tenant schema
 * - Dropping tenant schemas on deletion
 * - Executing queries within a tenant's isolated schema (parameterized)
 */

import { dbQuery, dbQuerySingle, dbRawExec, quoteIdent } from '@/lib/db/driver';

export type Tenant = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  status: string;
  schema_name: string;
  storage_limit_mb: number;
  db_limit_mb: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Application = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  version: string;
  status: string;
  table_definitions: Array<{
    name: string;
    columns: Array<[string, string]>;
  }>;
};

/**
 * Get the schema name for a tenant UUID.
 */
export function getTenantSchemaName(tenantId: string): string {
  return 'tenant_' + tenantId.replace(/-/g, '_');
}

/**
 * Create a new tenant schema in PostgreSQL.
 */
export async function createTenantSchema(tenantId: string): Promise<string> {
  const schemaName = getTenantSchemaName(tenantId);
  await dbRawExec(`CREATE SCHEMA IF NOT EXISTS ${quoteIdent(schemaName)}`);
  await dbRawExec(`GRANT ALL PRIVILEGES ON SCHEMA ${quoteIdent(schemaName)} TO madartech`);
  await dbRawExec(`ALTER DEFAULT PRIVILEGES IN SCHEMA ${quoteIdent(schemaName)} GRANT ALL PRIVILEGES ON TABLES TO madartech`);
  await dbRawExec(`ALTER DEFAULT PRIVILEGES IN SCHEMA ${quoteIdent(schemaName)} GRANT ALL PRIVILEGES ON SEQUENCES TO madartech`);
  return schemaName;
}

/**
 * Initialize application tables in a tenant schema.
 */
export async function initAppTables(tenantId: string, applicationSlug: string): Promise<void> {
  const schemaName = getTenantSchemaName(tenantId);

  const app = await dbQuerySingle<Application>(
    `SELECT * FROM applications WHERE slug = $1 LIMIT 1`,
    [applicationSlug]
  );
  if (!app || !app.table_definitions) return;

  for (const tableDef of app.table_definitions) {
    const cols = tableDef.columns.map(([name, type]) => `${name} ${type}`).join(', ');
    await dbRawExec(
      `CREATE TABLE IF NOT EXISTS ${quoteIdent(schemaName)}.${quoteIdent(tableDef.name)} (${cols})`
    );
    await dbRawExec(
      `GRANT ALL PRIVILEGES ON ${quoteIdent(schemaName)}.${quoteIdent(tableDef.name)} TO madartech`
    );
  }
}

/**
 * Drop a tenant schema (when deleting a tenant).
 */
export async function dropTenantSchema(tenantId: string): Promise<void> {
  const schemaName = getTenantSchemaName(tenantId);
  await dbRawExec(`DROP SCHEMA IF EXISTS ${quoteIdent(schemaName)} CASCADE`);
}

/**
 * Query data from a table within a tenant's schema.
 */
export async function queryTenantData<T = Record<string, unknown>>(
  schemaName: string,
  tableName: string,
  options: { limit?: number; offset?: number; orderBy?: string } = {}
): Promise<T[]> {
  const tableRef = `${quoteIdent(schemaName)}.${quoteIdent(tableName)}`;
  let sql = `SELECT * FROM ${tableRef}`;

  if (options.orderBy) {
    // orderBy is validated against table columns by the caller
    sql += ` ORDER BY ${options.orderBy}`;
  } else {
    sql += ` ORDER BY created_at DESC`;
  }
  if (options.limit) {
    sql += ` LIMIT ${Math.min(options.limit, 1000)}`;
  }
  if (options.offset) {
    sql += ` OFFSET ${options.offset}`;
  }

  return dbQuery<T>(sql);
}

/**
 * Insert a row into a table within a tenant's schema.
 * Uses parameterized queries for safety.
 */
export async function insertTenantData<T = Record<string, unknown>>(
  schemaName: string,
  tableName: string,
  data: Record<string, unknown>
): Promise<T> {
  const tableRef = `${quoteIdent(schemaName)}.${quoteIdent(tableName)}`;
  const columns = Object.keys(data);
  const values = Object.values(data);
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  const colList = columns.join(', ');

  const sql = `INSERT INTO ${tableRef} (${colList}) VALUES (${placeholders}) RETURNING *`;
  const rows = await dbQuery<T>(sql, values);
  return rows[0];
}

/**
 * Update a row by id within a tenant's schema.
 */
export async function updateTenantData<T = Record<string, unknown>>(
  schemaName: string,
  tableName: string,
  id: string,
  data: Record<string, unknown>
): Promise<T | null> {
  const tableRef = `${quoteIdent(schemaName)}.${quoteIdent(tableName)}`;
  const setCols = Object.keys(data);
  const setValues = Object.values(data);

  const setClause = setCols.map((col, i) => `${col} = $${i + 1}`).join(', ');
  const sql = `UPDATE ${tableRef} SET ${setClause} WHERE id = $${setCols.length + 1} RETURNING *`;

  const rows = await dbQuery<T>(sql, [...setValues, id]);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Delete a row by id from a tenant's schema.
 */
export async function deleteTenantData(
  schemaName: string,
  tableName: string,
  id: string
): Promise<void> {
  const tableRef = `${quoteIdent(schemaName)}.${quoteIdent(tableName)}`;
  await dbQuery(`DELETE FROM ${tableRef} WHERE id = $1`, [id]);
}

/**
 * Count rows in a table within a tenant's schema.
 */
export async function countTenantData(schemaName: string, tableName: string): Promise<number> {
  const tableRef = `${quoteIdent(schemaName)}.${quoteIdent(tableName)}`;
  const result = await dbQuerySingle<{ count: string }>(`SELECT count(*) as count FROM ${tableRef}`);
  return parseInt(result?.count ?? '0');
}

/**
 * List all tables in a tenant schema.
 */
export async function listTenantTables(schemaName: string): Promise<string[]> {
  const rows = await dbQuery<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 ORDER BY table_name`,
    [schemaName]
  );
  return rows.map(r => r.table_name);
}
