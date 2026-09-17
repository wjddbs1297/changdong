
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { MyReservations } from './pages/MyReservations';
import { Notices } from './pages/Notices';
import { Suggestions } from './pages/Suggestions';
import { AdminLogs } from './pages/AdminLogs';
import { AdminAccounts } from './pages/AdminAccounts';
import { AdminStats } from './pages/AdminStats';
import { AdminRanking } from './pages/AdminRanking';

// Protected Route Component
function ProtectedRoute({ children }: { children: ReactNode }) {
    const { user, isLoading } = useAuth();

    if (isLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    return <Layout>{children}</Layout>;
}

function AppRoutes() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route
                        path="/"
                        element={
                            <ProtectedRoute>
                                <Dashboard />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/my-reservations"
                        element={
                            <ProtectedRoute>
                                <MyReservations />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/notices"
                        element={
                            <ProtectedRoute>
                                <Notices />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/suggestions"
                        element={
                            <ProtectedRoute>
                                <Suggestions />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/admin-logs"
                        element={
                            <ProtectedRoute>
                                <AdminLogs />
                            </ProtectedRoute>
                        }
                    />
                    <Route path="/admin-accounts" element={<ProtectedRoute><AdminAccounts /></ProtectedRoute>} />
                    <Route path="/admin-stats" element={<ProtectedRoute><AdminStats /></ProtectedRoute>} />
                    <Route path="/admin-ranking" element={<ProtectedRoute><AdminRanking /></ProtectedRoute>} />
                </Routes>
            </AuthProvider>
        </BrowserRouter>
    );
}

export default AppRoutes;
