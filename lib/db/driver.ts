/*
 * Database Driver — Supports D1 (Cloudflare) and PostgreSQL
 */

// ============================================================
// ✅ Cloudflare D1 (للإنتاج)
// ============================================================

export function getDb(env?: any) {
  // 🚀 إذا كان هناك env.DB (D1)
  if (env && env.DB) {
    console.log('✅ Using Cloudflare D1 database');
    return env.DB;
  }
  
  // 🔧 إذا كان هناك env.DATABASE_URL (PostgreSQL)
  if (env && env.DATABASE_URL) {
    console.log('✅ Using PostgreSQL database');
    return createPgPool(env.DATABASE_URL);
  }
  
  // 📦 البيئة المحلية
  if (process.env.DATABASE_URL) {
    console.log('✅ Using local PostgreSQL database');
    return createPgPool(process.env.DATABASE_URL);
  }
  
  throw new Error('No database connection found. Set DB (D1) or DATABASE_URL (PostgreSQL)');
}

// ============================================================
// ✅ PostgreSQL (للتطوير المحلي)
// ============================================================

function createPgPool(connectionString: string) {
  const { Pool } = require('pg');
  return new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });
}

// ============================================================
// ✅ دوال مساعدة
// ============================================================

function isD1(db: any): boolean {
  return db && typeof db.prepare === 'function' && typeof db.exec === 'function';
}

export async function dbQuery<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
  env?: any
): Promise<T[]> {
  const db = getDb(env);
  
  if (isD1(db)) {
    // D1
    const stmt = db.prepare(sql);
    const result = await stmt.bind(...params).all();
    return result.results as T[];
  } else {
    // PostgreSQL
    const result = await db.query(sql, params);
    return result.rows as T[];
  }
}

export async function dbExec(
  sql: string,
  params: unknown[] = [],
  env?: any
): Promise<number> {
  const db = getDb(env);
  
  if (isD1(db)) {
    const stmt = db.prepare(sql);
    const result = await stmt.bind(...params).run();
    return result.meta?.changes || 0;
  } else {
    const result = await db.query(sql, params);
    return result.rowCount || 0;
  }
}

export async function dbQuerySingle<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
  env?: any
): Promise<T | null> {
  const rows = await dbQuery<T>(sql, params, env);
  return rows.length > 0 ? rows[0] : null;
}

// ============================================================
// ✅ دوال CRUD
// ============================================================

export async function dbInsert<T = Record<string, unknown>>(
  table: string,
  data: Record<string, unknown>,
  env?: any
): Promise<T> {
  const columns = Object.keys(data);
  const values = Object.values(data);
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  const colList = columns.join(', ');

  const sql = `INSERT INTO ${table} (${colList}) VALUES (${placeholders}) RETURNING *`;
  const rows = await dbQuery<T>(sql, values, env);
  return rows[0];
}

export async function dbUpdate<T = Record<string, unknown>>(
  table: string,
  data: Record<string, unknown>,
  filter: Record<string, unknown>,
  env?: any
): Promise<T[]> {
  const setCols = Object.keys(data);
  const filterCols = Object.keys(filter);
  const allValues = [...Object.values(data), ...Object.values(filter)];

  const setClause = setCols.map((col, i) => `${col} = $${i + 1}`).join(', ');
  const whereClause = filterCols.map((col, i) => `${col} = $${setCols.length + i + 1}`).join(' AND ');

  const sql = `UPDATE ${table} SET ${setClause} WHERE ${whereClause} RETURNING *`;
  return dbQuery<T>(sql, allValues, env);
}

export async function dbSelect<T = Record<string, unknown>>(
  table: string,
  filter: Record<string, unknown> = {},
  options: { limit?: number; offset?: number; orderBy?: string; ascending?: boolean } = {},
  env?: any
): Promise<T[]> {
  const filterCols = Object.keys(filter);
  const values = Object.values(filter);

  let sql = `SELECT * FROM ${table}`;
  if (filterCols.length > 0) {
    const whereClause = filterCols.map((col, i) => `${col} = $${i + 1}`).join(' AND ');
    sql += ` WHERE ${whereClause}`;
  }
  if (options.orderBy) {
    sql += ` ORDER BY ${options.orderBy} ${options.ascending ? 'ASC' : 'DESC'}`;
  }
  if (options.limit) {
    sql += ` LIMIT ${options.limit}`;
  }
  if (options.offset) {
    sql += ` OFFSET ${options.offset}`;
  }

  return dbQuery<T>(sql, values, env);
}

export async function dbDelete(
  table: string,
  filter: Record<string, unknown>,
  env?: any
): Promise<number> {
  const filterCols = Object.keys(filter);
  const values = Object.values(filter);
  const whereClause = filterCols.map((col, i) => `${col} = $${i + 1}`).join(' AND ');
  const sql = `DELETE FROM ${table} WHERE ${whereClause}`;
  return dbExec(sql, values, env);
}

export async function dbRaw<T = Record<string, unknown>>(sql: string, env?: any): Promise<T[]> {
  const db = getDb(env);
  if (isD1(db)) {
    const result = await db.prepare(sql).all();
    return result.results as T[];
  } else {
    const result = await db.query(sql);
    return result.rows as T[];
  }
}

export async function dbRawExec(sql: string, env?: any): Promise<void> {
  const db = getDb(env);
  if (isD1(db)) {
    await db.exec(sql);
  } else {
    await db.query(sql);
  }
}

export function quoteIdent(value: string): string {
  return '"' + value.replace(/"/g, '""') + '"';
}
