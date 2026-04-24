import { useState, useEffect } from 'react';
import { Plus, Image as ImageIcon, X } from 'lucide-react';
import { dataService } from '../services/DataService';
import { useAuth } from '../contexts/AuthContext';
import type { Notice } from '../types';

export function Notices() {
    const { user } = useAuth();
    const [notices, setNotices] = useState<Notice[]>([]);
    const [loading, setLoading] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

    // Form States
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        loadNotices();
    }, []);

    const loadNotices = async () => {
        setLoading(true);
        try {
            const data = await dataService.getNotices();
            setNotices(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || !content) return;

        setSubmitting(true);
        try {
            await dataService.createNotice({
                title,
                content,
                author: user?.name || '관리자',
                imageUrl
            });
            alert('공지사항이 등록되었습니다.');
            setIsCreating(false);
            setTitle('');
            setContent('');
            setImageUrl('');
            loadNotices(); // Refresh
        } catch (error: any) {
            alert('등록 실패: ' + error.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800">공지사항</h2>
                {user?.role === 'admin' && (
                    <button
                        onClick={() => setIsCreating(true)}
                        className="bg-brand-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-brand-700 transition"
                    >
                        <Plus size={20} />
                        공지 작성
                    </button>
                )}
            </div>

            {/* Creation Form Modal (Simple Inline or Overlay) - Using Inline for simplicity */}
            {isCreating && (
                <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200 animate-fade-in relative">
                    <button
                        onClick={() => setIsCreating(false)}
                        className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                    >
                        <X size={24} />
                    </button>
                    <h3 className="text-lg font-bold mb-4">새 공지사항 작성</h3>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
                            <input
                                type="text"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                                placeholder="제목을 입력하세요"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">내용</label>
                            <textarea
                                value={content}
                                onChange={e => setContent(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg p-2 h-32 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                                placeholder="공지 내용을 입력하세요"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">이미지 URL (선택)</label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <ImageIcon className="absolute left-3 top-2.5 text-gray-400" size={20} />
                                    <input
                                        type="url"
                                        value={imageUrl}
                                        onChange={e => setImageUrl(e.target.value)}
                                        className="w-full border border-gray-300 rounded-lg pl-10 p-2 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                                        placeholder="https://example.com/image.jpg"
                                    />
                                </div>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">* 이미지 주소를 입력하면 게시글에 이미지가 표시됩니다.</p>
                        </div>
                        <div className="flex justify-end pt-2">
                            <button
                                type="submit"
                                disabled={submitting}
                                className="bg-brand-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-brand-700 disabled:bg-gray-400 transition"
                            >
                                {submitting ? '등록 중...' : '등록하기'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* List */}
            {loading ? (
                <div className="text-center py-12 text-gray-500">공지사항을 불러오는 중...</div>
            ) : notices.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 text-gray-500">
                    등록된 공지사항이 없습니다.
                </div>
            ) : (
                <div className="space-y-4">
                    {notices.map(notice => (
                        <div key={notice.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="text-xl font-bold text-gray-900">{notice.title}</h3>
                                <span className="text-sm text-gray-500">{notice.date}</span>
                            </div>
                            <div className="mb-4 text-sm text-gray-500 flex items-center gap-2">
                                <span className="bg-gray-100 px-2 py-0.5 rounded text-xs font-semibold">{notice.author}</span>
                            </div>

                            {notice.imageUrl && (
                                <div className="mb-4 rounded-xl overflow-hidden max-h-96 bg-gray-50">
                                    <img
                                        src={notice.imageUrl}
                                        alt={notice.title}
                                        className="w-full h-full object-contain"
                                        onError={(e) => (e.target as HTMLImageElement).style.display = 'none'}
                                    />
                                </div>
                            )}

                            <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                                {notice.content}
                            </p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
