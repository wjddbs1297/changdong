import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, User, Music, Bell, MessageCircle, FileText } from 'lucide-react';

interface LayoutProps {
    children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-50 w-full">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <Link to="/" className="flex items-center space-x-2">
                        <div className="bg-brand-600 p-2 rounded-lg text-white">
                            <Music size={24} />
                        </div>
                        <span className="text-xl font-bold bg-gradient-to-r from-brand-600 to-brand-400 bg-clip-text text-transparent hidden sm:block">
                            시립창동청소년센터
                        </span>
                    </Link>

                    <nav className="flex items-center space-x-2 sm:space-x-6">
                        {user ? (
                            <>
                                <Link
                                    to="/notices"
                                    className="text-gray-600 hover:text-brand-600 font-medium transition-colors flex items-center space-x-1 px-2"
                                >
                                    <Bell size={20} />
                                    <span className="hidden sm:inline">공지사항</span>
                                </Link>
                                <Link
                                    to="/suggestions"
                                    className="text-gray-600 hover:text-brand-600 font-medium transition-colors flex items-center space-x-1 px-2"
                                >
                                    <MessageCircle size={20} />
                                    <span className="hidden sm:inline">건의사항</span>
                                </Link>
                                <Link
                                    to="/my-reservations"
                                    className="text-gray-600 hover:text-brand-600 font-medium transition-colors flex items-center space-x-1 px-2"
                                >
                                    <User size={20} />
                                    <span className="hidden sm:inline">내 예약</span>
                                </Link>
                                {user.role === 'admin' && (
                                    <Link
                                        to="/admin-logs"
                                        className="text-brand-600 hover:text-brand-700 font-semibold transition-colors flex items-center space-x-1 px-2"
                                    >
                                        <FileText size={20} />
                                        <span className="hidden sm:inline">전체 대장</span>
                                    </Link>
                                )}
                                <div className="h-6 w-px bg-gray-200" />
                                <div className="flex items-center space-x-2">
                                    <span className="text-sm font-semibold text-gray-700 hidden sm:block">
                                        {user.id} <span className="text-gray-400 font-normal">| {user.name}</span>
                                    </span>
                                    <button
                                        onClick={handleLogout}
                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                                        title="로그아웃"
                                    >
                                        <LogOut size={20} />
                                    </button>
                                </div>
                            </>
                        ) : (
                            <Link
                                to="/login"
                                className="text-brand-600 font-semibold hover:text-brand-700"
                            >
                                Sign In
                            </Link>
                        )}
                    </nav>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
                {children}
            </main>
        </div>
    );
}
