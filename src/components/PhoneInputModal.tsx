import { useState } from 'react';
import { X } from 'lucide-react';

interface PhoneInputModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (phoneNumber: string) => void;
    isLoading: boolean;
}

export function PhoneInputModal({ isOpen, onClose, onSubmit, isLoading }: PhoneInputModalProps) {
    const [phoneNumber, setPhoneNumber] = useState('');
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Basic validation: 010-XXXX-XXXX or 010XXXXXXXX
        const cleaned = phoneNumber.replace(/-/g, '').trim();
        if (!/^010\d{8}$/.test(cleaned)) {
            setError('올바른 휴대전화 번호를 입력해주세요 (예: 010-1234-5678)');
            return;
        }

        onSubmit(cleaned);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value.replace(/[^0-9]/g, '');

        // Auto-format with hyphens
        if (value.length > 3 && value.length <= 7) {
            value = value.slice(0, 3) + '-' + value.slice(3);
        } else if (value.length > 7) {
            value = value.slice(0, 3) + '-' + value.slice(3, 7) + '-' + value.slice(7, 11);
        }

        setPhoneNumber(value);
        setError('');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-slide-up">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-gray-900">예약자 정보 입력</h3>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                            disabled={isLoading}
                        >
                            <X size={24} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div className="mb-6">
                            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                                연락처 (필수)
                            </label>
                            <input
                                type="tel"
                                id="phone"
                                value={phoneNumber}
                                onChange={handleInputChange}
                                placeholder="010-0000-0000"
                                className={`w-full px-4 py-3 rounded-xl border ${error ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:ring-brand-200'} focus:border-brand-500 focus:ring-4 transition-all outline-none text-lg tracking-wide`}
                                autoFocus
                                disabled={isLoading}
                                maxLength={13}
                            />
                            {error && (
                                <p className="mt-2 text-sm text-red-600 flex items-center">
                                    <span className="mr-1">⚠️</span> {error}
                                </p>
                            )}
                            <p className="mt-2 text-xs text-gray-500">
                                * 예약 확인 및 안내를 위해 정확한 번호를 입력해주세요.
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isLoading}
                                className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl font-semibold transition-colors disabled:opacity-50"
                            >
                                취소
                            </button>
                            <button
                                type="submit"
                                disabled={isLoading || phoneNumber.length < 12} // simple check for length (010-xxxx-xxxx is 13 chars usually, strict check in handler)
                                className="flex-1 px-4 py-3 text-white bg-brand-600 hover:bg-brand-700 rounded-xl font-semibold shadow-lg shadow-brand-200 transition-all disabled:opacity-50 disabled:shadow-none"
                            >
                                {isLoading ? '처리중...' : '확인'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
