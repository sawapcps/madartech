/*
 * API Key Authentication & Tenant Resolution
 */

import { dbQuerySingle } from '@/lib/db/driver';
import { createHash } from 'crypto';

export type TenantContext = {
  tenantId: string;
  tenantName: string;
  schemaName: string;
  applicationId: string | null;
  applicationSlug: string | null;
  apiKeyId: string;
  permissions: {
    read: boolean;
    write: boolean;
  };
};

type ApiKeyRow = {
  api_key_id: string;
  tenant_id: string;
  tenant_name: string;
  schema_name: string;
  application_id: string | null;
  application_slug: string | null;
  permissions: { read: boolean; write: boolean };
  key_status: string;
  key_expires_at: string | null;
  tenant_status: string;
};

export async function resolveApiKey(apiKey: string): Promise<TenantContext | null> {
  if (!apiKey || !apiKey.startsWith('mt_')) {
    return null;
  }

  const keyHash = hashApiKey(apiKey);

  const row = await dbQuerySingle<ApiKeyRow>(`
    SELECT
      ak.id as api_key_id,
      ak.key_hash,
      ak.permissions,
      ak.status as key_status,
      ak.expires_at as key_expires_at,
      t.id as tenant_id,
      t.name as tenant_name,
      t.schema_name,
      t.status as tenant_status,
      a.id as application_id,
      a.slug as application_slug
    FROM api_keys ak
    JOIN tenants t ON ak.tenant_id = t.id
    LEFT JOIN applications a ON ak.application_id = a.id
    WHERE ak.key_hash = $1
      AND ak.status = 'active'
      AND t.status = 'active'
    LIMIT 1
  `, [keyHash]);

  if (!row) return null;

  if (row.key_expires_at && new Date(row.key_expires_at) < new Date()) {
    return null;
  }

  dbQuerySingle('UPDATE api_keys SET last_used_at = now() WHERE id = $1', [row.api_key_id]).catch(() => {});

  return {
    tenantId: row.tenant_id,
    tenantName: row.tenant_name,
    schemaName: row.schema_name,
    applicationId: row.application_id,
    applicationSlug: row.application_slug,
    apiKeyId: row.api_key_id,
    permissions: row.permissions,
  };
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

export function generateApiKey(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const key = Array.from({ length: 40 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `mt_live_${key}`;
}

export function getKeyPrefix(key: string): string {
  return key.slice(0, 16);
}