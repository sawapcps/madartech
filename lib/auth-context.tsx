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

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const response = await fetch('/api/auth/me', {
                    credentials: 'include', // ✅ مهم لإرسال الكوكيز
                    headers: {
                        'Cache-Control': 'no-cache',
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    console.log('Auth check:', data); // للتصحيح
                    if (data.success && data.data?.user) {
                        setUser(data.data.user);
                    }
                }
            } catch (error) {
                console.error('Auth error:', error);
            } finally {
                setLoading(false);
            }
        };

        checkAuth();
    }, []);

    const login = async (email: string, password: string) => {
        try {
            setLoading(true);
            
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include', // ✅ مهم لتلقي الكوكيز
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();
            console.log('Login response:', data); // للتصحيح

            if (response.ok && data.success) {
                // ✅ المستخدم مسجل الدخول
                if (data.data?.user) {
                    setUser(data.data.user);
                }
                
                // ✅ الانتقال للوحة التحكم
                window.location.href = '/dashboard';
            } else {
                alert(data.error || 'فشل تسجيل الدخول');
                setLoading(false);
            }
        } catch (error) {
            console.error('Login error:', error);
            alert('حدث خطأ في تسجيل الدخول');
            setLoading(false);
        }
    };

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