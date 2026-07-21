'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
    id: string;
    email: string;
    name: string;
    role: string;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;  // ✅ هذا مهم!
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('platform_token');
        console.log('🔍 التوكن من localStorage:', token ? 'موجود' : 'غير موجود');

        if (token && token !== 'undefined') {
            fetch('/api/auth/me', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            })
            .then(async res => {
                if (!res.ok) {
                    throw new Error('Unauthorized');
                }
                return res.json();
            })
            .then(data => {
                if (data.success && data.data?.user) {
                    setUser(data.data.user);
                    console.log('✅ المستخدم:', data.data.user);
                } else {
                    localStorage.removeItem('platform_token');
                }
            })
            .catch(() => {
                localStorage.removeItem('platform_token');
                setUser(null);
            })
            .finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, []);

    const login = async (email: string, password: string) => {
        try {
            setLoading(true);
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();
            console.log('📊 Login Response:', data);

            if (response.ok && data.success) {
                const token = data.data?.token || data.token;
                if (token) {
                    localStorage.setItem('platform_token', token);
                    console.log('✅ تم تخزين التوكن في localStorage');
                }
                setUser(data.data?.user);
                window.location.href = '/dashboard';
            } else {
                alert(data.error || 'فشل تسجيل الدخول');
                setLoading(false);
            }
        } catch (error) {
            console.error('❌ Login error:', error);
            alert('حدث خطأ في تسجيل الدخول');
            setLoading(false);
        }
    };

    // ✅ ✅ ✅ إضافة دالة logout
    const logout = async () => {
        try {
            // ✅ حذف التوكن من localStorage
            localStorage.removeItem('platform_token');
            setUser(null);
            console.log('✅ تم تسجيل الخروج');
            
            // ✅ الانتقال إلى صفحة تسجيل الدخول
            window.location.href = '/login';
        } catch (error) {
            console.error('❌ Logout error:', error);
        }
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout }}>
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