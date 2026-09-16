import { useState, useEffect, useMemo, useRef } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { FileDown, Printer } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { dataService } from '../services/DataService';
import { createActivityLogPdf, downloadActivityLogPdf, printActivityLog } from '../components/ActivityModal';
import { activityArchiveName, activityArchiveEntry, monthlySubmittedLogs, saveArchive } from '../utils/activityArchive';
import type { ActivityLogData } from '../components/ActivityModal';
import type { Booking, Room, User } from '../types';

const CLUB_ID_ALIASES: Record<string, string> = {
    'ing': '-ing',
    '-ing': '-ing',
    'able': 'able2026',
    '에이블': 'able2026',
};

const normalizeClubId = (value: string) => {
    const normalized = value.trim().toLocaleLowerCase('ko-KR');
    return CLUB_ID_ALIASES[normalized] || normalized;
};

const isNonClubAccount = (account: User) => {
    const id = account.id.trim().toLocaleLowerCase('ko-KR');
    return account.role === 'admin' || ['daily', '데일리', 'test'].includes(id);
};

export function AdminLogs() {
    const { user } = useAuth();
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [clubFilter, setClubFilter] = useState('all');
    const [monthFilter, setMonthFilter] = useState('all');
    const [pdfBookingKey, setPdfBookingKey] = useState('');
    const [zipProgress, setZipProgress] = useState<{ done: number; total: number } | null>(null);
    const [zipMessage, setZipMessage] = useState('');
    const exportBusy = useRef(false);
    const cancelZip = useRef(false);
    useEffect(() => () => { cancelZip.current = true; }, []);

    useEffect(() => {
        if (user?.role !== 'admin') return;

        const loadContent = async () => {
            setLoading(true);
            try {
                const config = await dataService.getConfig();
                setRooms(config.rooms);
                setUsers(config.users);
                
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

    const clubOptions = useMemo(() => {
        return users
            .filter(account => account.status === 'Active' && !isNonClubAccount(account))
            .map(account => ({ id: normalizeClubId(account.id), name: account.name || account.id }))
            .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    }, [users]);

    const clubIdLookup = useMemo(() => {
        const lookup = new Map<string, string>();
        clubOptions.forEach(club => {
            lookup.set(normalizeClubId(club.id), club.id);
            lookup.set(normalizeClubId(club.name), club.id);
        });
        return lookup;
    }, [clubOptions]);

    const getBookingClubId = (booking: Booking) => {
        const userId = normalizeClubId(String(booking.userId || ''));
        const userName = normalizeClubId(String(booking.userName || ''));
        return clubIdLookup.get(userId) || clubIdLookup.get(userName) || userId;
    };

    const monthOptions = useMemo(() => {
        return [...new Set(bookings
            .map(booking => /^\d{4}-\d{2}/.exec(booking.date)?.[0])
            .filter((value): value is string => !!value))]
            .sort((a, b) => b.localeCompare(a));
    }, [bookings]);

    const matchesSelection = (booking: Booking) => {
            const matchesClub = clubFilter === 'all' || getBookingClubId(booking) === clubFilter;
            const matchesMonth = monthFilter === 'all' || booking.date.startsWith(monthFilter);
            return matchesClub && matchesMonth;
    };

    const matchingBookings = useMemo(() => {
        return bookings.filter(matchesSelection);
    }, [bookings, clubFilter, monthFilter]);

    const sortedBookings = useMemo(() => {
        const hasSelection = clubFilter !== 'all' || monthFilter !== 'all';
        if (!hasSelection) return bookings;
        return [...bookings].sort((a, b) => {
            const priority = Number(matchesSelection(b)) - Number(matchesSelection(a));
            if (priority !== 0) return priority;
            return b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime);
        });
    }, [bookings, clubFilter, monthFilter]);

    const getActivityLogData = (booking: Booking): ActivityLogData => {
        const today = format(new Date(), 'yyyy. MM. dd', { locale: ko });
        return {
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
        };
    };

    const monthlyLogs = monthFilter === 'all' ? [] : monthlySubmittedLogs(matchingBookings, monthFilter);

    const handleMonthlyDownload = async () => {
        if (exportBusy.current || !monthlyLogs.length) return;
        exportBusy.current = true;
        cancelZip.current = false;
        setZipMessage('');
        const logs = [...monthlyLogs];
        const folder = activityArchiveName(monthFilter, clubFilter === 'all' ? undefined :
            clubOptions.find(club => club.id === clubFilter)?.name || clubFilter);
        setZipProgress({ done: 0, total: logs.length });
        try {
            const { zipSync } = await import('fflate');
            const files: Record<string, Uint8Array> = {};
            for (let index = 0; index < logs.length; index++) {
                if (cancelZip.current) break;
                const pdf = await createActivityLogPdf(getActivityLogData(logs[index]));
                if (cancelZip.current) break;
                files[`${folder}/${activityArchiveEntry(logs[index], index)}`] = new Uint8Array(pdf.output('arraybuffer'));
                setZipProgress({ done: index + 1, total: logs.length });
                // Yield between documents so progress/cancel stay responsive on mobile.
                await new Promise(resolve => setTimeout(resolve, 0));
            }
            if (cancelZip.current) {
                setZipMessage('다운로드 생성을 취소했습니다.');
                return;
            }
            // PDFs are already compressed; storing avoids redundant compression work.
            const archive = zipSync(files, { level: 0 });
            saveArchive(new Blob([new Uint8Array(archive)], { type: 'application/zip' }), `${folder}.zip`);
            setZipMessage(`${logs.length}건을 ZIP으로 묶었습니다. 브라우저 다운로드 목록을 확인해주세요.`);
        } catch (error) {
            console.error(error);
            setZipMessage('ZIP 생성에 실패했습니다. 파일은 일부만 저장되지 않습니다. 다시 시도하거나 동아리별로 나누어 내려받아주세요.');
        } finally {
            exportBusy.current = false;
            setZipProgress(null);
        }
    };

    const handlePrint = (booking: Booking) => {
        printActivityLog(getActivityLogData(booking));
    };

    const handlePdfDownload = async (booking: Booking) => {
        if (exportBusy.current) return;
        exportBusy.current = true;
        const bookingKey = `${booking.id}-${booking.date}-${booking.startTime}`;
        setPdfBookingKey(bookingKey);
        try {
            await downloadActivityLogPdf(getActivityLogData(booking));
        } catch (error) {
            console.error(error);
            alert('PDF 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
        } finally {
            exportBusy.current = false;
            setPdfBookingKey('');
        }
    };

    if (user?.role !== 'admin') {
        return <div className="p-8 text-center text-red-500">관리자 전용 페이지입니다.</div>;
    }

    return (
        <div className="space-y-6">
            <div className="min-w-0 bg-white rounded-2xl shadow-sm border border-gray-100 p-3 sm:p-6">
                <h1 className="text-2xl font-bold text-gray-900">전체 활동일지 대장</h1>

                <div className="mt-5 mb-6 flex flex-col gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4 sm:flex-row sm:items-end">
                    <label className="flex-1 text-xs font-semibold text-gray-600">
                        동아리명
                        <select
                            value={clubFilter}
                            disabled={!!zipProgress}
                            onChange={event => setClubFilter(event.target.value)}
                            className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-normal text-gray-900"
                        >
                            <option value="all">전체 동아리</option>
                            {clubOptions.map(club => (
                                <option key={club.id} value={club.id}>{club.name}</option>
                            ))}
                        </select>
                    </label>
                    <label className="flex-1 text-xs font-semibold text-gray-600">
                        활동 월
                        <select
                            value={monthFilter}
                            disabled={!!zipProgress}
                            onChange={event => setMonthFilter(event.target.value)}
                            className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-normal text-gray-900"
                        >
                            <option value="all">전체 기간</option>
                            {monthOptions.map(month => {
                                const [year, monthNumber] = month.split('-');
                                return <option key={month} value={month}>{year}년 {Number(monthNumber)}월</option>;
                            })}
                        </select>
                    </label>
                    <div className="flex items-center justify-between gap-3 sm:min-w-44 sm:flex-col sm:items-end">
                        <span className="text-sm text-gray-500">일치 기록 <strong className="text-gray-900">{matchingBookings.length}건</strong></span>
                        <button
                            type="button"
                            onClick={() => { setClubFilter('all'); setMonthFilter('all'); }}
                            disabled={!!zipProgress || (clubFilter === 'all' && monthFilter === 'all')}
                            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            필터 초기화
                        </button>
                    </div>
                </div>
                <div className="mb-5 rounded-xl border border-brand-100 bg-brand-50 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 text-sm text-brand-800">
                            <p className="font-semibold">월별 활동일지 일괄 다운로드</p>
                            <p className="mt-1 text-xs">{monthFilter === 'all' ? '위에서 활동 월을 선택해주세요.' : `선택한 조건의 제출 일지 ${monthlyLogs.length}건 · 미제출 제외`}</p>
                            <p className="mt-1 text-xs">일지별 PDF를 ZIP 폴더로 저장합니다. 동아리를 선택하면 해당 동아리만 포함됩니다.</p>
                        </div>
                        <button type="button" onClick={handleMonthlyDownload}
                            disabled={loading || !!zipProgress || !!pdfBookingKey || !monthlyLogs.length}
                            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40">
                            <FileDown size={18} />{zipProgress ? `PDF 생성 중 ${zipProgress.done}/${zipProgress.total}` : '월별 ZIP 다운로드'}
                        </button>
                    </div>
                    {zipProgress && <div className="mt-3 flex items-center gap-3">
                        <progress className="h-2 min-w-0 flex-1" value={zipProgress.done} max={zipProgress.total} aria-label="활동일지 ZIP 생성 진행률" />
                        <button type="button" className="shrink-0 text-sm underline" onClick={() => { cancelZip.current = true; }}>취소</button>
                    </div>}
                    <p role="status" className="mt-2 text-xs text-brand-800">{zipProgress ? `이 화면을 유지해주세요. ${zipProgress.total}건 중 ${zipProgress.done}건 완료` : zipMessage}</p>
                </div>
                {(clubFilter !== 'all' || monthFilter !== 'all') && (
                    <p className="mb-4 text-sm text-brand-700">선택한 조건의 활동일지를 표 맨 위로 정렬했습니다.</p>
                )}
                
                {loading ? (
                    <div className="text-center text-gray-500 py-10">데이터를 불러오는 중...</div>
                ) : (
                    <div className="max-w-full overflow-x-auto" role="region" aria-label="활동일지 표, 좌우로 스크롤" tabIndex={0}>
                        <p className="py-2 text-xs text-brand-700 sm:hidden">표를 좌우로 밀면 인쇄·PDF 저장 버튼을 확인할 수 있습니다.</p>
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">날짜</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">시간</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">연습실</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">신청자</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">출력·저장</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {sortedBookings.length > 0 ? (
                                    sortedBookings.map((b, index) => {
                                        const hasLog = !!(b.activityContent && b.activityContent.trim());
                                        const hasSig = !!b.signature;
                                        const highlighted = (clubFilter !== 'all' || monthFilter !== 'all') && matchesSelection(b);
                                        const bookingKey = `${b.id}-${b.date}-${b.startTime}`;
                                        const isPdfSaving = pdfBookingKey === bookingKey;
                                        return (
                                            <tr key={`${b.id}-${b.date}-${b.startTime}-${b.endTime}-${b.roomId}-${b.userId}-${index}`} className={`transition-colors ${highlighted ? 'bg-brand-50 ring-1 ring-inset ring-brand-100' : 'hover:bg-gray-50'}`}>
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
                                                    <div className="inline-flex items-center gap-2">
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
                                                        <button
                                                            onClick={() => handlePdfDownload(b)}
                                                            disabled={!hasLog || !!pdfBookingKey || !!zipProgress}
                                                            className={`inline-flex items-center space-x-1 rounded-md px-3 py-1.5 text-sm ${
                                                                hasLog
                                                                    ? 'bg-red-50 text-red-700 hover:bg-red-100'
                                                                    : 'cursor-not-allowed bg-gray-50 text-gray-400 opacity-50'
                                                            }`}
                                                        >
                                                            <FileDown size={16} />
                                                            <span>{isPdfSaving ? '저장 중...' : 'PDF 저장'}</span>
                                                        </button>
                                                    </div>
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
