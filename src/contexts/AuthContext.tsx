import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { User } from '../types';
import { dataService } from '../services/DataService';

interface AuthContextType {
    user: User | null;
    login: (userId: string) => Promise<void>;
    logout: () => void;
    isLoading: boolean;
    error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Persist login (simple version)
    useEffect(() => {
        const storedUserId = localStorage.getItem('userId');
        if (storedUserId) {
            dataService.login(storedUserId).then(u => {
                if (u) setUser(u);
            });
        }
    }, []);

    const login = async (userId: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const u = await dataService.login(userId);
            if (u) {
                if (u.status === 'Inactive') {
                    throw new Error('비활성화된 계정입니다.');
                }
                setUser(u);
                localStorage.setItem('userId', u.id);
            } else {
                throw new Error('존재하지 않는 User ID입니다.');
            }
        } catch (err: any) {
            setError(err.message || '로그인 실패');
            throw err;
        } finally {
            setIsLoading(false);
        }
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('userId');
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, isLoading, error }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
