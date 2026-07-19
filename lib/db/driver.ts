/*
 * Database Driver — Supports D1 (Cloudflare)
 */

// ============================================================
// ✅ Cloudflare D1 (للإنتاج)
// ============================================================

export async function getDb(env?: any) {
    console.error('🔍 getDb called');

    // 🚀 إذا تم تمرير env مباشرة (من API Route)
    if (env && env.DB) {
        console.error('✅ Using D1 from passed env');
        return env.DB;
    }

    // 🌐 الحصول على env من getCloudflareContext
    try {
        console.error('🔍 Trying getCloudflareContext...');
        const { getCloudflareContext } = await import('@opennextjs/cloudflare');
        const ctx: any = await getCloudflareContext();
        console.error('🔍 Context received:', ctx ? 'Yes' : 'No');

        if (ctx?.env?.DB) {
            console.error('✅ Using D1 from getCloudflareContext');
            return ctx.env.DB;
        }
        console.error('⚠️ ctx.env.DB not found');
    } catch (e) {
        console.error('⚠️ getCloudflareContext error:', e);
    }

    console.error('❌ No database connection found');
    throw new Error('No database connection found. Set DB (D1) or DATABASE_URL (PostgreSQL)');
}

// ============================================================
// ✅ دوال الاستعلام
// ============================================================

export async function dbQuery<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
    env?: any
): Promise<T[]> {
    const db = await getDb(env);
    const stmt = db.prepare(sql);
    const result = params.length > 0 ? await stmt.bind(...params).all() : await stmt.all();
    return result.results as T[];
}

export async function dbExec(
    sql: string,
    params: unknown[] = [],
    env?: any
): Promise<number> {
    const db = await getDb(env);
    const stmt = db.prepare(sql);
    const result = params.length > 0 ? await stmt.bind(...params).run() : await stmt.run();
    return result.meta?.changes || 0;
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
    const placeholders = columns.map(() => '?').join(', ');
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

    const setClause = setCols.map((col) => `${col} = ?`).join(', ');
    const whereClause = filterCols.map((col) => `${col} = ?`).join(' AND ');

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
        const whereClause = filterCols.map((col) => `${col} = ?`).join(' AND ');
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
    const whereClause = filterCols.map((col) => `${col} = ?`).join(' AND ');
    const sql = `DELETE FROM ${table} WHERE ${whereClause}`;
    return dbExec(sql, values, env);
}

export async function dbRaw<T = Record<string, unknown>>(sql: string, env?: any): Promise<T[]> {
    const db = await getDb(env);
    const result = await db.prepare(sql).all();
    return result.results as T[];
}

export async function dbRawExec(sql: string, env?: any): Promise<void> {
    const db = await getDb(env);
    await db.exec(sql);
}

export function quoteIdent(value: string): string {
    return '"' + value.replace(/"/g, '""') + '"';
}