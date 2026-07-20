'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type PlatformUser = {
    id: string;
    email: string;
    name: string;
    role: string;
    tenant_id?: string;
    phone?: string;
    company?: string;
};

type AuthContextType = {
    user: PlatformUser | null;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<{ error: string | null }>;
    signOut: () => Promise<void>;
    updateUser: (user: PlatformUser) => void; // ? ‰≈÷«·… «‰ ÕœÍÀ «‰·Ë—Í
};

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    signIn: async () => ({ error: 'Not initialized' }),
    signOut: async () => {},
    updateUser: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<PlatformUser | null>(null);
    const [loading, setLoading] = useState(true);

    // ?  ÕÂÍ‰ «‰Â” ŒœÂ ÂÊ localStorage √Ë‰«Î
    useEffect(() => {
        try {
            const savedUser = localStorage.getItem('user');
            if (savedUser) {
                setUser(JSON.parse(savedUser));
            }
        } catch {
            //  Ã«Á‰
        }
    }, []);

    // ? Ã‰» »Í«Ê«  «‰Â” ŒœÂ ÂÊ «‰Œ«œÂ
    useEffect(() => {
        fetch('/api/auth/me')
            .then(res => res.ok ? res.json() : null)
            .then(data => {
                if (data?.success && data.user) {
                    setUser(data.user);
                    localStorage.setItem('user', JSON.stringify(data.user));
                } else {
                    // ≈–« ‰Â Í„Ê ÁÊ«„ Â” ŒœÂ¨ «Â”Õ localStorage
                    localStorage.removeItem('user');
                }
                setLoading(false);
            })
            .catch(() => {
                setLoading(false);
            });
    }, []);

    const signIn = async (email: string, password: string) => {
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            const data = await res.json();
            if (data.success) {
                setUser(data.user);
                localStorage.setItem('user', JSON.stringify(data.user));
                return { error: null };
            }
            return { error: data.error || 'Login failed' };
        } catch (error) {
            return { error: 'Network error' };
        }
    };

    const signOut = async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
        } catch {
            //  Ã«Á‰
        }
        setUser(null);
        localStorage.removeItem('user');
    };

    // ? œ«‰…  ÕœÍÀ «‰Â” ŒœÂ (‰‰ ÕœÍÀ «‰·Ë—Í)
    const updateUser = (updatedUser: PlatformUser) => {
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
    };

    return (
        <AuthContext.Provider value={{ user, loading, signIn, signOut, updateUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}