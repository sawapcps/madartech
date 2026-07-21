'use client';

import { createContext, useContext, useEffect, useState } from 'react';

interface User {
    id: string;
    email: string;
    name: string;
    role: string;
    company_id: string;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    // ✅ التحقق من التوكن عند تحميل الصفحة
    useEffect(() => {
        const token = localStorage.getItem('platform_token');
        if (token) {
            fetch('/api/auth/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            .then(res => res.json())
            .then(data => {
                if (data.success && data.user) {
                    setUser(data.user);
                } else {
                    localStorage.removeItem('platform_token');
                }
            })
            .catch(() => {
                localStorage.removeItem('platform_token');
            })
            .finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, []);

    // ✅ تسجيل الدخول (بدون useRouter)
    const login = async (email: string, password: string) => {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();
        
        if (data.success) {
            localStorage.setItem('platform_token', data.data.token);
            setUser(data.data.user);
            // ✅ استخدام window.location بدلاً من useRouter
            window.location.href = '/dashboard';
        } else {
            throw new Error(data.error || 'فشل تسجيل الدخول');
        }
    };

    // ✅ تسجيل الخروج
    const logout = async () => {
        localStorage.removeItem('platform_token');
        setUser(null);
        window.location.href = '/login';
    };

    // ✅ تحديث بيانات المستخدم
    const refreshUser = async () => {
        const token = localStorage.getItem('platform_token');
        if (!token) return;
        
        const response = await fetch('/api/auth/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.success && data.user) {
            setUser(data.user);
        }
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within AuthProvider');
    return context;
}