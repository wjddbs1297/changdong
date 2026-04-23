import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ArrowRight, Loader2 } from 'lucide-react';

export function Login() {
    const [userId, setUserId] = useState('');
    const { login, isLoading, error } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userId.trim()) return;

        try {
            await login(userId.trim());
            navigate('/');
        } catch (err) {
            // Error handled in context/state, but logged here
            console.error(err);
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden animate-slide-up">
                <div className="bg-white p-8 text-center border-b border-gray-100">
                    <div className="mx-auto flex items-center justify-center mb-4">
                        <img
                            src="/logo.jpg"
                            alt="시립창동청소년센터"
                            className="h-24 object-contain cursor-help"
                            onClick={async () => {
                                try {
                                    alert('서버 연결 확인 중...');
                                    const { dataService } = await import('../services/DataService');
                                    const config = await dataService.getConfig();
                                    const userList = config.users.map(u => `${u.id}(${u.name})`).join(', ');
                                    alert(`[서버 응답 성공]\n등록된 사용자 목록:\n${userList || '없음'}`);
                                } catch (e) {
                                    alert(`[서버 연결 실패] 에러: ${e}`);
                                }
                            }}
                        />
                    </div>
                </div>

                <div className="p-8">
                    <div className="text-center mb-8">
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">시립창동청소년센터</h1>
                        <p className="text-gray-500">동아리 연습실 대관 시스템</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label htmlFor="userId" className="block text-sm font-medium text-gray-700 mb-2">
                                동아리 고유코드 (User ID)
                            </label>
                            <input
                                type="text"
                                id="userId"
                                value={userId}
                                onChange={(e) => setUserId(e.target.value)}
                                placeholder="고유코드를 입력하세요"
                                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all outline-none"
                                disabled={isLoading}
                            />
                        </div>

                        {error && (
                            <div className="p-4 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 flex items-center">
                                <span className="font-semibold mr-1">Error:</span> {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 px-4 rounded-lg transition-all flex items-center justify-center shadow-md hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <Loader2 className="animate-spin" size={20} />
                            ) : (
                                <>
                                    <span>로그인</span>
                                    <ArrowRight size={20} className="ml-2" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-6 text-center text-sm text-gray-500 bg-gray-50 p-4 rounded-lg">
                        <p className="font-semibold mb-1">📢 안내</p>
                        User01 ~ User30 등 부여받은<br />
                        <span className="text-brand-600 font-bold">동아리 고유코드</span>를 입력해주세요.
                    </div>
                </div>
            </div>
        </div>
    );
}
