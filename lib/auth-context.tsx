'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';

interface User {
    id: string;
    email: string;
    name: string;
    role: string;
    company_id?: string;
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

    // ✅ جلب المستخدم من API (يعتمد على cookies تلقائياً)
    const fetchUser = useCallback(async () => {
        try {
            const response = await fetch('/api/auth/me', {
                credentials: 'include', // ✅ يرسل cookies مع الطلب
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.data?.user) {
                    setUser(data.data.user);
                } else {
                    setUser(null);
                }
            } else {
                setUser(null);
            }
        } catch (error) {
            console.error('Error fetching user:', error);
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, []);

    // ✅ التحقق من المستخدم عند تحميل الصفحة
    useEffect(() => {
        fetchUser();
    }, [fetchUser]);

    // ✅ تسجيل الدخول
    const login = async (email: string, password: string) => {
        setLoading(true);
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
                credentials: 'include', // ✅ يسمح بتعيين cookies
            });

            const data = await response.json();

            if (data.success && data.data?.user) {
                setUser(data.data.user);
                // ✅ التوجيه إلى لوحة التحكم
                window.location.href = '/dashboard';
            } else {
                throw new Error(data.error || 'فشل تسجيل الدخول');
            }
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        } finally {
            setLoading(false);
        }
    };

    // ✅ تسجيل الخروج
    const logout = async () => {
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include',
            });
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            setUser(null);
            window.location.href = '/';
        }
    };

    // ✅ تحديث بيانات المستخدم
    const refreshUser = async () => {
        await fetchUser();
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
}