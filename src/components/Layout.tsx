import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, User, Music, Bell, MessageCircle, FileText, BarChart3 } from 'lucide-react';
import { PendingActivityReports } from './PendingActivityReports';
import { ChangePinModal } from './ChangePinModal';

interface LayoutProps {
    children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
    const { user, logout, mustChangePin } = useAuth();
    const [pinModalOpen, setPinModalOpen] = useState(false);
    const navigate = useNavigate();
    const isDailyUser = !!user && ['daily', '데일리'].includes(user.id.trim().toLowerCase());

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-50 w-full">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
                    <Link to="/" className="flex items-center space-x-2">
                        <div className="bg-brand-600 p-2 rounded-lg text-white">
                            <Music size={24} />
                        </div>
                        <span className="text-xl font-bold bg-gradient-to-r from-brand-600 to-brand-400 bg-clip-text text-transparent hidden sm:block">
                            시립창동청소년센터
                        </span>
                    </Link>

                    <nav aria-label="주 메뉴" className="flex w-full flex-wrap items-center gap-x-2 gap-y-3 text-sm xl:w-auto [&_a]:min-h-10 [&_a]:inline-flex [&_a]:items-center [&_button]:min-h-10">
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
                                    <>
                                        <Link to="/admin-logs" className="text-brand-600 hover:text-brand-700 font-semibold transition-colors flex items-center space-x-1 px-2"><FileText size={20} /><span className="hidden sm:inline">전체 대장</span></Link>
                                        <Link to="/admin-stats" className="text-brand-600 hover:text-brand-700 font-semibold transition-colors flex items-center space-x-1 px-2"><BarChart3 size={20} /><span className="hidden sm:inline">이용 실적</span></Link>
                                        <Link to="/admin-ranking" className="text-brand-600 hover:text-brand-700 font-semibold transition-colors px-2">활동 랭킹</Link>
                                        <Link to="/admin-accounts" className="text-brand-600 hover:text-brand-700 font-semibold transition-colors px-2">계정 관리</Link>
                                    </>
                                )}
                                <div className="h-6 w-px bg-gray-200" />
                                {!isDailyUser && <button onClick={() => setPinModalOpen(true)} className="text-sm font-semibold text-gray-600 hover:text-brand-600">PIN 변경</button>}
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
            <main className="w-full min-w-0 max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 animate-fade-in">
                {children}
            </main>
            <PendingActivityReports />
            {!isDailyUser && <ChangePinModal open={pinModalOpen || mustChangePin} required={mustChangePin} onClose={() => setPinModalOpen(false)} />}
        </div>
    );
}
