/*
 * Database Driver — Direct PostgreSQL via pg.Pool
 * Supports Cloudflare Hyperdrive for faster connections
 */

import { Pool, QueryResult } from 'pg';

let _pool: Pool | null = null;
let _isHyperdrive = false;

// ✅ دالة للحصول على connection string من البيئة أو Hyperdrive
function getConnectionString(): string {
  // 🚀 أولاً: نتحقق من Hyperdrive (في بيئة Cloudflare)
  const hyperdriveConnection = (globalThis as any).__HYPERDRIVE?.connectionString;
  if (hyperdriveConnection) {
    _isHyperdrive = true;
    console.log('✅ Using Hyperdrive connection');
    return hyperdriveConnection;
  }

  // 🔧 ثانياً: نتحقق من المتغير البيئي العادي (للبيئة المحلية أو الخادم العادي)
  const envConnection = process.env.DATABASE_URL;
  if (envConnection) {
    return envConnection;
  }

  throw new Error('No database connection string found. Set DATABASE_URL or use Hyperdrive.');
}

// ✅ دالة موحدة لإنشاء Pool
function createPool(connectionString: string): Pool {
  return new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: process.env.NODE_ENV === 'production' && !_isHyperdrive 
      ? { rejectUnauthorized: false } 
      : false,
  });
}

// ✅ دالة مُحسّنة لضمان وجود مستخدم MadarTech (فقط في البيئة المحلية)
async function ensureMadarTechUser(pool: Pool) {
  if (_isHyperdrive) {
    console.log('ℹ️ Skipping user creation on Hyperdrive');
    return;
  }

  try {
    const result = await pool.query(`SELECT 1 FROM pg_roles WHERE rolname = 'madartech'`);
    if (result.rows.length === 0) {
      await pool.query(`CREATE USER madartech WITH PASSWORD 'MadarTech2026!';`);
      await pool.query(`GRANT ALL PRIVILEGES ON DATABASE madartech_platform TO madartech;`);
      await pool.query(`GRANT ALL PRIVILEGES ON SCHEMA public TO madartech;`);
      await pool.query(`GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO madartech;`);
      console.log('✅ MadarTech user created successfully');
    } else {
      console.log('ℹ️ MadarTech user already exists');
    }
  } catch (e) {
    console.log('⚠️ Could not ensure MadarTech user:', e);
  }
}

// ✅ دالة الحصول على Pool (مُحسّنة)
function getPool(): Pool {
  if (!_pool) {
    const connectionString = getConnectionString();
    _pool = createPool(connectionString);
    
    // فقط في البيئة المحلية نقوم بإنشاء المستخدم
    if (!_isHyperdrive) {
      ensureMadarTechUser(_pool);
    }
  }
  return _pool;
}

// ✅ دالة لإعادة تعيين الاتصال (مفيد في حالة تغيير الإعدادات)
export function resetDatabaseConnection(): void {
  if (_pool) {
    _pool.end().catch(() => {});
    _pool = null;
  }
  _isHyperdrive = false;
}

// ============================================================
// ✅ جميع دوال قاعدة البيانات تبقى كما هي ولكنها تستخدم getPool() المُحسّنة
// ============================================================

export async function dbQuery<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const pool = getPool();
  const result: QueryResult = await pool.query(sql, params);
  return result.rows as T[];
}

export async function dbExec(
  sql: string,
  params: unknown[] = []
): Promise<number> {
  const pool = getPool();
  const result = await pool.query(sql, params);
  return result.rowCount ?? 0;
}

export async function dbQuerySingle<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await dbQuery<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

export async function dbInsert<T = Record<string, unknown>>(
  table: string,
  data: Record<string, unknown>
): Promise<T> {
  const columns = Object.keys(data);
  const values = Object.values(data);
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  const colList = columns.join(', ');

  const sql = `INSERT INTO ${table} (${colList}) VALUES (${placeholders}) RETURNING *`;
  const rows = await dbQuery<T>(sql, values);
  return rows[0];
}

export async function dbUpdate<T = Record<string, unknown>>(
  table: string,
  data: Record<string, unknown>,
  filter: Record<string, unknown>
): Promise<T[]> {
  const setCols = Object.keys(data);
  const filterCols = Object.keys(filter);
  const allValues = [...Object.values(data), ...Object.values(filter)];

  const setClause = setCols.map((col, i) => `${col} = $${i + 1}`).join(', ');
  const whereClause = filterCols.map((col, i) => `${col} = $${setCols.length + i + 1}`).join(' AND ');

  const sql = `UPDATE ${table} SET ${setClause} WHERE ${whereClause} RETURNING *`;
  return dbQuery<T>(sql, allValues);
}

export async function dbSelect<T = Record<string, unknown>>(
  table: string,
  filter: Record<string, unknown> = {},
  options: { limit?: number; offset?: number; orderBy?: string; ascending?: boolean } = {}
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

  return dbQuery<T>(sql, values);
}

export async function dbDelete(
  table: string,
  filter: Record<string, unknown>
): Promise<number> {
  const filterCols = Object.keys(filter);
  const values = Object.values(filter);
  const whereClause = filterCols.map((col, i) => `${col} = $${i + 1}`).join(' AND ');
  const sql = `DELETE FROM ${table} WHERE ${whereClause}`;
  return dbExec(sql, values);
}

export async function dbRaw<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  const pool = getPool();
  const result = await pool.query(sql);
  return result.rows as T[];
}

export async function dbRawExec(sql: string): Promise<void> {
  const pool = getPool();
  await pool.query(sql);
}

export function quoteIdent(value: string): string {
  return '"' + value.replace(/"/g, '""') + '"';
}

// ✅ تصدير حالة Hyperdrive للاستخدام الخارجي (اختياري)
export function isUsingHyperdrive(): boolean {
  return _isHyperdrive;
}