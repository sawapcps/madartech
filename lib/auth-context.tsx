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
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    // ✅ التحقق من المستخدم عند التحميل
    useEffect(() => {
        const checkAuth = async () => {
            try {
                console.log('🔍 التحقق من المصادقة...');
                
                // ✅ محاولة قراءة التوكن من cookies مباشرة
                const response = await fetch('/api/auth/me', {
                    credentials: 'include',
                    headers: {
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache'
                    }
                });
                
                console.log('📝 رد /api/auth/me:', response.status);
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.success && data.data?.user) {
                        setUser(data.data.user);
                        console.log('✅ تم تسجيل الدخول:', data.data.user.email);
                    }
                } else {
                    console.log('❌ لم يتم العثور على جلسة (401)');
                    setUser(null);
                }
            } catch (error) {
                console.error('❌ خطأ في التحقق:', error);
                setUser(null);
            } finally {
                setLoading(false);
            }
        };

        checkAuth();
    }, []);

    const login = async (email: string, password: string) => {
        try {
            console.log('🔍 محاولة تسجيل الدخول:', email);
            
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                },
                body: JSON.stringify({ email, password }),
                credentials: 'include'
            });

            const data = await response.json();
            console.log('📝 رد تسجيل الدخول:', data);

            if (data.success) {
                setUser(data.data.user);
                console.log('✅ تم تسجيل الدخول بنجاح');
                // ✅ استخدام window.location.assign
                window.location.assign('/dashboard');
            } else {
                alert(data.error || 'فشل تسجيل الدخول');
            }
        } catch (error) {
            console.error('❌ Login error:', error);
            alert('حدث خطأ في تسجيل الدخول');
        }
    };

    const logout = async () => {
        try {
            console.log('🔍 محاولة تسجيل الخروج...');
            await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include'
            });
            console.log('✅ تم تسجيل الخروج');
        } catch (error) {
            console.error('❌ Logout error:', error);
        } finally {
            setUser(null);
            window.location.assign('/');
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