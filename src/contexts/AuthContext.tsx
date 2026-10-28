import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { User } from '../types';
import { dataService, clearLocalSession } from '../services/DataService';

interface AuthContextType {
    user: User | null;
    login: (userId: string, pin: string) => Promise<void>;
    logout: () => Promise<void>;
    changePin: (currentPin: string, newPin: string) => Promise<void>;
    mustChangePin: boolean;
    isLoading: boolean;
    error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [mustChangePin, setMustChangePin] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [restoreError, setRestoreError] = useState('');
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        let active = true;
        setIsLoading(true);
        setRestoreError('');
        dataService.restoreSession()
            .then(result => {
                if (!active) return;
                if (result) { setUser(result.user); setMustChangePin(result.mustChangePin); }
            })
            .catch(err => { if (active) setRestoreError(err instanceof Error ? err.message : '연결을 확인해주세요.'); })
            .finally(() => { if (active) setIsLoading(false); });
        return () => { active = false; };
    }, [attempt]);

    useEffect(() => {
        const expire = () => {
            clearLocalSession(); setUser(null); setMustChangePin(false);
            setError('로그인이 만료되었습니다. 다시 로그인해주세요.');
        };
        window.addEventListener('session-expired', expire);
        return () => window.removeEventListener('session-expired', expire);
    }, []);

    const login = async (userId: string, pin: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await dataService.login(userId, pin);
            setUser(result.user);
            setMustChangePin(result.mustChangePin);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : '로그인 실패');
            throw err;
        } finally {
            setIsLoading(false);
        }
    };

    const logout = async () => {
        await dataService.logout();
        setUser(null);
        setMustChangePin(false);
    };

    const changePin = async (currentPin: string, newPin: string) => {
        await dataService.changePin(currentPin, newPin);
        setMustChangePin(false);
    };

    if (restoreError) return <div role="alert" className="p-8 text-center space-y-4"><p>{restoreError}</p><button className="rounded border px-4 py-2" onClick={() => setAttempt(n => n + 1)}>다시 연결</button></div>;

    return (
        <AuthContext.Provider value={{ user, login, logout, changePin, mustChangePin, isLoading, error }}>
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
