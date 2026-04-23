import { useState } from 'react';
import { Send } from 'lucide-react';
import { dataService } from '../services/DataService';
import { useAuth } from '../contexts/AuthContext';

export function Suggestions() {
    const { user } = useAuth();
    const [content, setContent] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim() || !user) return;

        setSubmitting(true);
        try {
            await dataService.createSuggestion({
                userId: user.id,
                name: user.name || user.id,
                content
            });
            alert('소중한 의견 감사합니다! 성공적으로 접수되었습니다.');
            setContent('');
        } catch (error) {
            alert('접수 중 오류가 발생했습니다.');
            console.error(error);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-8">
            <div className="text-center">
                <h2 className="text-3xl font-bold text-gray-800 mb-2">건의사항</h2>
                <p className="text-gray-500">
                    센터 운영이나 시설에 대해 바라는 점을 자유롭게 적어주세요.<br />
                    여러분의 의견은 더 나은 환경을 만드는데 큰 도움이 됩니다.
                </p>
            </div>

            <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-lg border border-gray-100">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            건의 내용
                        </label>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            className="w-full h-48 p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none transition-all placeholder-gray-400"
                            placeholder="이곳에 내용을 작성해주세요..."
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full bg-brand-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-brand-700 disabled:bg-gray-300 transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                    >
                        {submitting ? (
                            '제출 중...'
                        ) : (
                            <>
                                <Send size={20} />
                                의견 보내기
                            </>
                        )}
                    </button>
                </form>
            </div>

            <div className="bg-blue-50 p-6 rounded-xl text-sm text-blue-700 leading-relaxed">
                <p className="font-bold mb-1">ℹ️ 안내사항</p>
                <ul className="list-disc pl-5 space-y-1">
                    <li>보내주신 의견은 관리자만 확인할 수 있습니다.</li>
                    <li>욕설, 비방 등 부적절한 내용은 통보 없이 삭제될 수 있습니다.</li>
                </ul>
            </div>
        </div>
    );
}
