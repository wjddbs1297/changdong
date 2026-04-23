import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import type { Booking, Room } from '../types';
import { dataService } from '../services/DataService';
import { Calendar, Clock, Edit, Trash2 } from 'lucide-react';

export function MyReservations() {
    const { user } = useAuth();
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Edit Form State
    const [editForm, setEditForm] = useState({
        date: '',
        startTime: '09:00',
        duration: '1',
        roomId: ''
    });

    useEffect(() => {
        loadData();
    }, [user]);

    const loadData = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const [b, config] = await Promise.all([
                dataService.getUserBookings(user.id),
                dataService.getConfig()
            ]);
            const now = new Date();
            const futureBookings = b.filter(booking => {
                // YYYY-MM-DD와 HH:mm을 결합하여 종료 시간 계산
                // iOS/Safari 호환성을 위해 T 대신 공백 사용이나 표준 포맷 준수
                const endDateTime = new Date(`${booking.date}T${booking.endTime}:00`);
                return endDateTime > now;
            });

            // 다가오는 예약순(오름차순)으로 정렬: 가까운 날짜가 먼저 보임
            setBookings(futureBookings.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
            setRooms(config.rooms);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const getRoomName = (id: string) => rooms.find(r => r.id === id)?.name || id;

    const handleCancel = async (bookingId: string) => {
        if (!confirm('정말로 예약을 취소하시겠습니까?')) return;
        if (!user) return;

        try {
            await dataService.cancelBooking(bookingId, user.id);
            alert('예약이 취소되었습니다.');
            loadData();
        } catch (e: any) {
            alert(e.message);
        }
    };

    const openEditModal = (booking: Booking) => {
        const startHour = parseInt(booking.startTime.split(':')[0]);
        const endHour = parseInt(booking.endTime.split(':')[0]);
        const duration = endHour - startHour;

        setEditingBooking(booking);
        setEditForm({
            date: booking.date,
            startTime: booking.startTime,
            duration: String(duration > 0 ? duration : 1),
            roomId: booking.roomId
        });
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !editingBooking) return;

        setSubmitting(true);
        try {
            await dataService.updateBooking({
                bookingId: editingBooking.id,
                userId: user.id,
                date: editForm.date,
                startTime: editForm.startTime,
                duration: editForm.duration,
                roomId: editForm.roomId
            });
            alert('예약이 수정되었습니다.');
            setEditingBooking(null);
            loadData();
        } catch (e: any) {
            alert(e.message);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="text-center py-10">Loading...</div>;

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800">내 예약 내역</h2>

            {bookings.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm p-12 text-center text-gray-500 border border-gray-100">
                    <Calendar size={48} className="mx-auto mb-4 text-gray-300" />
                    <p className="text-lg">예약된 내역이 없습니다.</p>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {bookings.map(booking => (
                        <div key={booking.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 transition-all hover:shadow-md">
                            <div className="flex justify-between items-start mb-4">
                                <div className="bg-brand-50 text-brand-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
                                    Booked
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => openEditModal(booking)}
                                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                        title="수정"
                                    >
                                        <Edit size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleCancel(booking.id)}
                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                        title="취소"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>

                            <h3 className="text-lg font-bold text-gray-800 mb-2 truncate">
                                {getRoomName(booking.roomId)}
                            </h3>

                            <div className="space-y-2 text-sm text-gray-600">
                                <div className="flex items-center space-x-2">
                                    <Calendar size={16} className="text-gray-400" />
                                    <span>{booking.date}</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Clock size={16} className="text-gray-400" />
                                    <span>{booking.startTime} - {booking.endTime}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Edit Modal */}
            {editingBooking && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl animate-fade-in">
                        <h3 className="text-xl font-bold mb-4 text-gray-900">예약 수정</h3>
                        <form onSubmit={handleUpdate} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">날짜</label>
                                <input
                                    type="date"
                                    required
                                    value={editForm.date}
                                    onChange={e => setEditForm({ ...editForm, date: e.target.value })}
                                    className="w-full border rounded-lg p-2"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">시작 시간</label>
                                    <select
                                        value={editForm.startTime}
                                        onChange={e => setEditForm({ ...editForm, startTime: e.target.value })}
                                        className="w-full border rounded-lg p-2"
                                    >
                                        {Array.from({ length: 13 }, (_, i) => i + 9).map(h => {
                                            const time = `${h < 10 ? '0' + h : h}:00`;
                                            return <option key={time} value={time}>{time}</option>;
                                        })}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">이용 시간</label>
                                    <select
                                        value={editForm.duration}
                                        onChange={e => setEditForm({ ...editForm, duration: e.target.value })}
                                        className="w-full border rounded-lg p-2"
                                    >
                                        {[1, 2, 3].map(h => (
                                            <option key={h} value={h}>{h}시간</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">연습실</label>
                                <select
                                    value={editForm.roomId}
                                    onChange={e => setEditForm({ ...editForm, roomId: e.target.value })}
                                    className="w-full border rounded-lg p-2"
                                >
                                    {rooms.map(r => (
                                        <option key={r.id} value={r.id}>{r.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex gap-2 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setEditingBooking(null)}
                                    className="flex-1 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition"
                                >
                                    취소
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 py-2 bg-brand-600 text-white font-bold rounded-lg hover:bg-brand-700 transition disabled:bg-gray-300"
                                >
                                    {submitting ? '수정 중...' : '수정 완료'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
