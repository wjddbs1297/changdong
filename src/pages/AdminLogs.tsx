import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Printer } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { dataService } from '../services/DataService';
import { printActivityLog } from '../components/ActivityModal';
import type { Booking, Room } from '../types';

export function AdminLogs() {
    const { user } = useAuth();
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user?.role !== 'admin') return;

        const loadContent = async () => {
            setLoading(true);
            try {
                const config = await dataService.getConfig();
                setRooms(config.rooms);
                
                const allData = await dataService.getAllBookings();
                // Sort by date descending (newest first)
                allData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                setBookings(allData);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };

        loadContent();
    }, [user]);

    const getRoomName = (roomId: string) => rooms.find(r => r.id === roomId)?.name || roomId;

    const handlePrint = (booking: Booking) => {
        const today = format(new Date(), 'yyyy. MM. dd', { locale: ko });
        printActivityLog({
            roomName: getRoomName(booking.roomId),
            dateStr: booking.date,
            timeStr: `${booking.startTime} ~ ${booking.endTime}`,
            userName: booking.userName || booking.userId, // use userName if available
            activityContent: booking.activityContent || '',
            suggestion: booking.suggestion || '',
            headcount: booking.headcount || { elemM:0, elemF:0, midM:0, midF:0, highM:0, highF:0, u24M:0, u24F:0 },
            participants: (booking.participants || '').split(',').map(p=>p.trim()).filter(Boolean),
            signature: booking.signature || '',
            today
        });
    };

    if (user?.role !== 'admin') {
        return <div className="p-8 text-center text-red-500">관리자 전용 페이지입니다.</div>;
    }

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h1 className="text-2xl font-bold text-gray-900 mb-6">전체 활동일지 대장</h1>
                
                {loading ? (
                    <div className="text-center text-gray-500 py-10">데이터를 불러오는 중...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">날짜</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">시간</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">연습실</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">신청자</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">출력</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {bookings.length > 0 ? (
                                    bookings.map(b => {
                                        const hasLog = !!(b.activityContent && b.activityContent.trim());
                                        const hasSig = !!b.signature;
                                        return (
                                            <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                    {b.date}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {b.startTime} - {b.endTime}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                    {getRoomName(b.roomId)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                                                    {b.userName || b.userId}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                    {hasLog ? (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                            일지 제출{!hasSig && <span className="ml-1 text-yellow-600">(서명 없음)</span>}
                                                        </span>
                                                    ) : (<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">미제출</span>)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                    <button
                                                        onClick={() => handlePrint(b)}
                                                        disabled={!hasLog}
                                                        className={`inline-flex items-center space-x-1 px-3 py-1.5 rounded-md text-sm ${
                                                            hasLog 
                                                                ? 'bg-brand-50 text-brand-700 hover:bg-brand-100' 
                                                                : 'bg-gray-50 text-gray-400 cursor-not-allowed opacity-50'
                                                        }`}
                                                    >
                                                        <Printer size={16} />
                                                        <span>인쇄</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                                            저장된 기록이 없습니다.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
