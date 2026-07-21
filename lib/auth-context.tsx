'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

// ✅ تعريف أنواع المستخدم
interface User {
    id: string;
    email: string;
    name: string;
    role: string;
    company_id?: string;
}

// ✅ تعريف نوع الـ Context
interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
}

// ✅ إنشاء الـ Context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ✅ مزود المصادقة
export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    // ✅ جلب المستخدم
    useEffect(() => {
        fetch('/api/auth/me', {
            credentials: 'include'
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                setUser(data.data.user);
            }
            setLoading(false);
        })
        .catch(() => setLoading(false));
    }, []);

    // ✅ تسجيل الدخول
    const login = async (email: string, password: string) => {
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
                credentials: 'include'
            });

            const data = await response.json();
            
            if (data.success) {
                setUser(data.data.user);
                window.location.href = '/dashboard';
            } else {
                alert(data.error || 'فشل تسجيل الدخول');
            }
        } catch (error) {
            console.error('Login error:', error);
            alert('حدث خطأ في تسجيل الدخول');
        }
    };

    // ✅ تسجيل الخروج
    const logout = useCallback(async () => {
        try {
            console.log('🔍 محاولة تسجيل الخروج...');
            
            const response = await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include'
            });

            console.log('📝 رد الخروج:', response.status);
            
            setUser(null);
            window.location.href = '/';
            
        } catch (error) {
            console.error('❌ خطأ في تسجيل الخروج:', error);
            setUser(null);
            window.location.href = '/';
        }
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

// ✅ Hook لاستخدام المصادقة
export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
}