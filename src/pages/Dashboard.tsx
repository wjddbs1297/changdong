import { useState, useEffect } from 'react';
import { format, addDays, isSunday, startOfToday } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import type { Room, Booking, User, Notice } from '../types';
import { dataService } from '../services/DataService';
import { useAuth } from '../contexts/AuthContext';
import { PhoneInputModal } from '../components/PhoneInputModal';
import { ActivityModal, printActivityLog } from '../components/ActivityModal';

export function Dashboard() {
    const { user } = useAuth();
    const [selectedDate, setSelectedDate] = useState(startOfToday());
    const [rooms, setRooms] = useState<Room[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [notices, setNotices] = useState<Notice[]>([]);
    const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [selectedSlots, setSelectedSlots] = useState<number[]>([]);
    const [loading, setLoading] = useState(false);
    const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);
    const [userPhoneNumber, setUserPhoneNumber] = useState<string>('');
    const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
    const [pendingPhoneNumber, setPendingPhoneNumber] = useState<string | undefined>(undefined);

    const isSun = isSunday(selectedDate);
    const START_HOUR = isSun ? 10 : 9;
    const END_HOUR = isSun ? 17 : 21;
    const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

    useEffect(() => {
        const init = async () => {
            const config = await dataService.getConfig();
            setRooms(config.rooms);
            setUsers(config.users);
            if (config.rooms.length > 0) setSelectedRoom(config.rooms[0]);
            try {
                const noticeData = await dataService.getNotices();
                setNotices(noticeData);
            } catch (e) { console.error(e); }
        };
        init();
    }, []);

    const loadBookings = async () => {
        if (!selectedRoom) return;
        setLoading(true);
        try {
            const dateStr = format(selectedDate, 'yyyy-MM-dd');
            const data = await dataService.getBookings(dateStr);
            setBookings(data.filter(b => b.roomId === selectedRoom.id));
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    useEffect(() => {
        if (selectedRoom) { loadBookings(); setSelectedSlots([]); }
    }, [selectedDate, selectedRoom]);

    useEffect(() => {
        if (user) {
            const isDailyUser = user.id.toLowerCase() === 'daily' || user.id === '데일리' || user.name?.includes('데일리');
            if (isDailyUser && !userPhoneNumber) setIsPhoneModalOpen(true);
        }
    }, [user, userPhoneNumber]);

    const handleSlotClick = (hour: number) => {
        const booking = getSlotBooking(hour);
        if (booking) {
            if (user?.role === 'admin') {
                if (!confirm(`${getUserName(booking.userId)}님의 활동일지를 출력하시겠습니까?`)) return;
                const today = format(new Date(), 'yyyy. MM. dd', { locale: ko });
                
                printActivityLog({
                    roomName: selectedRoom?.name || '',
                    dateStr: booking.date,
                    timeStr: `${booking.startTime} ~ ${booking.endTime}`,
                    userName: getUserName(booking.userId),
                    activityContent: booking.activityContent || '',
                    suggestion: booking.suggestion || '',
                    headcount: booking.headcount || { elemM:0, elemF:0, midM:0, midF:0, highM:0, highF:0, u24M:0, u24F:0 },
                    participants: (booking.participants || '').split(',').map(p=>p.trim()).filter(Boolean),
                    signature: booking.signature || '',
                    today
                });
            } else {
                alert('이미 예약된 시간입니다.');
            }
            return;
        }

        if (selectedSlots.includes(hour)) {
            setSelectedSlots(selectedSlots.filter(h => h !== hour));
        } else {
            const newSlots = [...selectedSlots, hour].sort((a, b) => a - b);
            if (newSlots.length > 3 && user?.role !== 'admin') { alert('최대 3시간까지만 선택 가능합니다.'); return; }
            let isContiguous = true;
            for (let i = 0; i < newSlots.length - 1; i++) {
                if (newSlots[i + 1] !== newSlots[i] + 1) isContiguous = false;
            }
            if (!isContiguous && selectedSlots.length > 0) { setSelectedSlots([hour]); return; }
            setSelectedSlots(newSlots);
        }
    };

    const handleBooking = async () => {
        if (selectedSlots.length === 0 || !user || !selectedRoom) return;
        const isDailyUser = user.id.toLowerCase() === 'daily' || user.id === '데일리' || user.name?.includes('데일리');
        if (isDailyUser && !userPhoneNumber) { setIsPhoneModalOpen(true); return; }
        setPendingPhoneNumber(isDailyUser ? userPhoneNumber : undefined);
        setIsActivityModalOpen(true);
    };

    const handlePhoneSubmit = (phoneNumber: string) => {
        setUserPhoneNumber(phoneNumber);
        setIsPhoneModalOpen(false);
    };

    const handleActivitySubmit = async (activityData: {
        activityContent: string; suggestion: string;
        headcount: { elemM:number; elemF:number; midM:number; midF:number; highM:number; highF:number; u24M:number; u24F:number; };
        participants: string[]; signature: string;
    }) => {
        setIsActivityModalOpen(false);
        await processBooking(pendingPhoneNumber, activityData);
    };

    const processBooking = async (phoneNumber?: string, activityData?: {
        activityContent: string; suggestion: string;
        headcount: { elemM:number; elemF:number; midM:number; midF:number; highM:number; highF:number; u24M:number; u24F:number; };
        participants: string[]; signature: string;
    }) => {
        if (!user || !selectedRoom || selectedSlots.length === 0) return;
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        const startTime = `${Math.min(...selectedSlots)}:00`;
        const duration = selectedSlots.length;
        setLoading(true);
        try {
            await dataService.createBooking({
                userId: user.id, roomId: selectedRoom.id,
                date: dateStr, startTime, duration, phoneNumber,
                activityContent: activityData?.activityContent,
                suggestion: activityData?.suggestion,
                headcount: activityData?.headcount,
                participants: activityData?.participants,
                signature: activityData?.signature,
            });
            alert('예약이 완료되었습니다.');
            setSelectedSlots([]);
            loadBookings();
        } catch (err: any) {
            alert('예약 실패: ' + err.message);
        } finally { setLoading(false); }
    };

    const getSlotBooking = (hour: number) => bookings.find(b => {
        const start = parseInt(b.startTime.toString().split(':')[0]);
        const end = parseInt(b.endTime.toString().split(':')[0]);
        return hour >= start && hour < end;
    });
    const getUserName = (userId: string) => users.find(u => u.id === userId)?.name || userId;

    if (rooms.length === 0 || !selectedRoom) {
        return <div className="p-8 text-center text-gray-500">연습실 정보를 불러오는 중...</div>;
    }

    const timeStr = selectedSlots.length > 0
        ? `${Math.min(...selectedSlots)}:00 ~ ${Math.min(...selectedSlots) + selectedSlots.length}:00 (${selectedSlots.length}시간)`
        : '';

    return (
        <div className="space-y-6">
            {notices.length > 0 && (
                <div className="bg-brand-50 border border-brand-100 rounded-lg p-3 flex items-center overflow-hidden relative">
                    <span className="bg-brand-600 text-white text-xs font-bold px-2 py-1 rounded-md mr-3 whitespace-nowrap z-10 shadow-sm">공지</span>
                    <div className="overflow-hidden flex-1 relative h-6">
                        <div className="animate-marquee whitespace-nowrap absolute top-0 left-0 flex items-center h-full">
                            {notices.map((notice) => (
                                <span key={notice.id} className="text-gray-700 text-sm font-medium mr-12 inline-flex items-center">
                                    <span className="w-1.5 h-1.5 bg-brand-400 rounded-full mr-2"></span>{notice.title}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h2 className="text-2xl font-bold text-gray-800">예약 현황 및 신청</h2>
                <div className="flex items-center space-x-4 bg-white p-2 rounded-lg shadow-sm border border-gray-200">
                    <button onClick={() => setSelectedDate(d => addDays(d, -1))}
                        disabled={user?.role !== 'admin' && format(selectedDate, 'yyyy-MM-dd') === format(startOfToday(), 'yyyy-MM-dd')}
                        className="p-1 hover:bg-gray-100 rounded-full disabled:opacity-30 disabled:cursor-not-allowed">
                        <ChevronLeft size={20} />
                    </button>
                    <div className="flex items-center space-x-2 px-2 font-medium">
                        <CalendarIcon size={18} className="text-brand-600" />
                        <span>{format(selectedDate, 'yyyy. MM. dd (EEE)', { locale: ko })}</span>
                    </div>
                    <button onClick={() => setSelectedDate(d => addDays(d, 1))}
                        disabled={user?.role !== 'admin' && selectedDate >= addDays(startOfToday(), 13)}
                        className="p-1 hover:bg-gray-100 rounded-full disabled:opacity-30 disabled:cursor-not-allowed">
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>

            <div className="flex space-x-1 bg-gray-100 p-1 rounded-xl overflow-x-auto">
                {rooms.map(room => (
                    <button key={room.id} onClick={() => setSelectedRoom(room)}
                        className={`flex-1 min-w-[100px] py-3 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${selectedRoom.id === room.id ? 'bg-white text-brand-600 shadow-md' : 'text-gray-500 hover:text-gray-700'}`}>
                        {room.name}
                    </button>
                ))}
            </div>

            {selectedRoom && (
                <div className="rounded-2xl overflow-hidden shadow-sm border border-gray-100 bg-white">
                    {(() => {
                        const name = selectedRoom.name.replace(/\s+/g, '').toLowerCase();
                        let imgSrc = '';
                        if (name === '음악연습실') imgSrc = '/music.jpg';
                        else if (name.includes('공연연습실a')) imgSrc = '/performance_a.jpg';
                        else if (name.includes('공연연습실b')) imgSrc = '/performance_b.jpg';
                        if (name.includes('커뮤니티')) return (
                            <div className="h-48 flex flex-col items-center justify-center bg-gray-50 text-gray-500">
                                <p className="text-xl font-bold mb-2">🚧 준비중입니다</p>
                                <p className="text-sm">커뮤니티실은 아직 이용하실 수 없습니다.</p>
                            </div>
                        );
                        if (imgSrc) return (
                            <div className="relative h-48 sm:h-64 w-full">
                                <img src={imgSrc} alt={name} className="w-full h-full object-cover"
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                                    <span className="text-white text-lg font-bold shadow-sm">{name}</span>
                                </div>
                            </div>
                        );
                        return null;
                    })()}
                </div>
            )}

            <div className="bg-white rounded-2xl shadow-lg p-6 animate-fade-in border border-gray-100">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex space-x-4 text-sm">
                        {[['bg-gray-100 border border-gray-200','가능'],['bg-brand-500','선택됨'],['bg-gray-300','예약불가']].map(([cls,label]) => (
                            <div key={label} className="flex items-center space-x-1">
                                <div className={`w-4 h-4 rounded ${cls}`}></div>
                                <span className="text-gray-500">{label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 sm:gap-3">
                    {HOURS.map(hour => {
                        const booking = getSlotBooking(hour);
                        const booked = !!booking;
                        const selected = selectedSlots.includes(hour);
                        const now = new Date();
                        const isToday = format(selectedDate, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd');
                        const isPast = isToday && hour < now.getHours();
                        const isAdmin = user?.role === 'admin';
                        const isDisabled = loading || ((booked || isPast) && !isAdmin);
                        return (
                            <button key={hour} disabled={isDisabled} onClick={() => handleSlotClick(hour)}
                                className={`relative h-14 sm:h-16 rounded-lg sm:rounded-xl border-2 flex flex-col items-center justify-center transition-all p-0.5 ${isDisabled ? 'bg-gray-100 border-transparent text-gray-300 cursor-not-allowed' : selected ? 'bg-brand-50 border-brand-500 text-brand-700 shadow-md transform scale-105' : booked ? 'bg-white border-brand-200 hover:bg-brand-50 cursor-pointer' : 'bg-white border-gray-200 hover:border-brand-300 hover:bg-brand-50/50 text-gray-700'}`}>
                                <span className="text-base sm:text-lg font-bold leading-tight">{hour}:00</span>
                                <span className={`text-[9px] sm:text-[10px] uppercase tracking-wider truncate w-full text-center ${booked ? 'font-bold text-gray-500' : ''}`}>
                                    {booked ? (booking ? getUserName(booking.userId) : 'Booked') : isPast ? 'Past' : selected ? 'Selected' : 'Available'}
                                </span>
                                {selected && (
                                    <div className="absolute top-1 right-1 bg-brand-500 text-white rounded-full p-0.5">
                                        <Check size={8} className="sm:w-[10px] sm:h-[10px]" />
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>

                <div className="mt-8 flex justify-end items-center border-t pt-6">
                    <div className="mr-6 text-right">
                        <span className="block text-xs text-gray-500">선택된 시간</span>
                        <span className="text-xl font-bold text-brand-600">{selectedSlots.length > 0 ? `${selectedSlots.length}시간` : '-'}</span>
                    </div>
                    <button onClick={handleBooking} disabled={selectedSlots.length === 0 || loading}
                        className="bg-brand-600 hover:bg-brand-700 disabled:bg-gray-300 text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all disabled:shadow-none">
                        {loading ? '처리중...' : '예약 신청하기'}
                    </button>
                </div>
            </div>

            <PhoneInputModal isOpen={isPhoneModalOpen} onClose={() => setIsPhoneModalOpen(false)} onSubmit={handlePhoneSubmit} isLoading={loading} />

            <ActivityModal
                isOpen={isActivityModalOpen}
                onClose={() => setIsActivityModalOpen(false)}
                onSubmit={handleActivitySubmit}
                isLoading={loading}
                roomName={selectedRoom?.name ?? ''}
                dateStr={format(selectedDate, 'yyyy. MM. dd (EEE)', { locale: ko })}
                timeStr={timeStr}
            />
        </div>
    );
}
