/*
 * Independent JWT Authentication System
 */

import { dbQuerySingle } from '@/lib/db/driver';
import { createHash, randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';

export function hashPassword(password: string): string {
    const salt = randomBytes(16).toString('hex');
    const hash = createHash('sha256').update(salt + password).digest('hex');
    return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
    const [salt, hash] = stored.split(':');
    const computed = createHash('sha256').update(salt + password).digest('hex');
    return hash === computed;
}

export function createJWT(payload: Record<string, unknown>): string {
    const secret = process.env.JWT_SECRET || 'fallback-secret';
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify({ ...payload, iat: Date.now(), exp: Date.now() + 7 * 24 * 60 * 60 * 1000 })).toString('base64url');
    const signature = createHash('sha256').update(`${header}.${body}.${secret}`).digest('base64url');
    return `${header}.${body}.${signature}`;
}

export function verifyJWT(token: string): Record<string, unknown> | null {
    try {
        const [header, body, signature] = token.split('.');
        const secret = process.env.JWT_SECRET || 'fallback-secret';
        const expectedSig = createHash('sha256').update(`${header}.${body}.${secret}`).digest('base64url');
        if (signature !== expectedSig) return null;
        const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
        if (payload.exp && Date.now() > payload.exp) return null;
        return payload;
    } catch {
        return null;
    }
}

// ✅ authenticateUser مع bcrypt
export async function authenticateUser(email: string, password: string, env?: any) {
    try {
        console.log('🔍 authenticateUser - محاولة تسجيل الدخول:', email);

        const user = await dbQuerySingle<{
            id: string;
            email: string;
            name: string;
            role: string;
            password: string;
            status: string;
            company_id: string;
            is_active: number;
        }>(
            'SELECT id, email, name, role, password, status, company_id, is_active FROM users WHERE email = ?',
            [email],
            env
        );

        if (!user) {
            console.log('❌ المستخدم غير موجود:', email);
            return null;
        }

        console.log('✅ المستخدم موجود:', user.id);
        console.log('🔑 كلمة المرور المخزنة (جزئياً):', user.password ? user.password.substring(0, 20) + '...' : 'undefined');

        // ✅ استخدام bcrypt لمقارنة كلمة المرور
        let passwordMatch = false;
        try {
            passwordMatch = await bcrypt.compare(password, user.password);
            console.log('📊 نتيجة مقارنة bcrypt:', passwordMatch);
        } catch (bcryptError) {
            console.error('❌ خطأ في bcrypt.compare:', bcryptError);
            // ✅ إذا فشل bcrypt، جرب المقارنة المباشرة (للتوافق مع الإصدارات القديمة)
            if (user.password === password) {
                passwordMatch = true;
                console.log('📊 نتيجة المقارنة المباشرة (قديم): true');
            }
        }

        if (!passwordMatch) {
            console.log('❌ كلمة المرور غير صحيحة');
            return null;
        }

        // ✅ التحقق من is_active
        if (user.is_active !== 1) {
            console.log('❌ المستخدم غير نشط:', user.id);
            return null;
        }

        // ✅ التحقق من status
        if (user.status !== 'active') {
            console.log('❌ المستخدم غير مفعل:', user.id);
            return null;
        }

        console.log('🎉 تم التحقق من كلمة المرور بنجاح!');

        const token = createJWT({ 
            userId: user.id, 
            email: user.email, 
            role: user.role,
            company_id: user.company_id
        });

        return {
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                company_id: user.company_id
            }
        };
    } catch (error) {
        console.error('❌ خطأ في authenticateUser:', error);
        return null;
    }
}

// ✅ Aliases للتوافق مع الكود الموجود
export const verifyToken = verifyJWT;
export const createToken = createJWT;