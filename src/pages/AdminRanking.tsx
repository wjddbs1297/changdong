import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { dataService } from '../services/DataService';
import { clubRankings } from '../utils/clubRanking';
import type { Booking, User, HistoricalPerformance } from '../types';

export function AdminRanking() {
    const { user } = useAuth();
    const currentYear = Number(new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 4));
    const [year, setYear] = useState(currentYear);
    const [month, setMonth] = useState(0);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [historical, setHistorical] = useState<HistoricalPerformance[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [reload, setReload] = useState(0);
    useEffect(() => {
        if (user?.role !== 'admin') return;
        let cancelled = false;
        setLoading(true);
        setError('');
        Promise.all([dataService.getConfig(), dataService.getAllBookings(), dataService.getHistoricalPerformance()]).then(([config, records, history]) => {
            if (cancelled) return;
            setUsers(config.users);
            setBookings(records);
            setHistorical(history);
        }).catch(() => { if (!cancelled) setError('랭킹 데이터를 불러오지 못했습니다. 다시 불러오기를 눌러주세요.'); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [user, reload]);
    const rows = useMemo(() => clubRankings(users, bookings, year, month, Date.now(), historical), [users, bookings, year, month, historical]);
    const years = [...new Set([currentYear, ...bookings.map(b => Number(b.date.slice(0, 4))).filter(Number.isFinite)])].sort((a,b) => b-a);
    const winners = rows.filter(row => row.rank === 1);
    if (user?.role !== 'admin') return <p className="p-8 text-center">관리자 전용 페이지입니다.</p>;
    return <section className="min-w-0 space-y-5 rounded-2xl border bg-white p-4 sm:p-6">
        <h1 className="text-2xl font-bold">동아리 활동 랭킹</h1>
        <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">연도<select className="ml-2 rounded border p-2" value={year} onChange={e => setYear(Number(e.target.value))}>{years.map(y => <option key={y} value={y}>{y}년</option>)}</select></label>
            <label className="text-sm">기간<select className="ml-2 rounded border p-2" value={month} onChange={e => setMonth(Number(e.target.value))}><option value={0}>연간 전체</option>{Array.from({length:12},(_,i) => <option key={i+1} value={i+1}>{i+1}월</option>)}</select></label>
            <button className="rounded border px-3 py-2 text-sm" disabled={loading} onClick={() => setReload(n => n+1)}>다시 불러오기</button>
        </div>
        <p className="text-sm leading-6 text-gray-600">활동 종료 후 제출된 일지 기준입니다. 예약 1건 = 활동 1회(시간 무관), 참여인원은 매회 인원을 더한 연인원입니다. 횟수 순위 + 인원 순위가 낮을수록 종합순위가 높으며, 동점은 공동순위입니다. 활동 0회는 순위에서 제외합니다.</p>
        <p className="text-xs text-gray-500">관리자·데일리·TEST·방과후 계정 제외. 프로그램 참여 점수는 기준 확정 전이므로 종합순위에 포함하지 않습니다.</p>
        <p className="text-sm text-gray-600">2026년 1~6월은 담당자가 확인한 엑셀 본표 실적을 합산합니다. 청온화·자운고·베리어스의 이관 실적은 제외했습니다.</p>
        {rows.some(row => row.missingVisits) && <p className="rounded bg-amber-50 p-3 text-sm text-amber-900">일부 월의 활동횟수가 원본에 없어, 확인된 횟수만 반영한 잠정 순위입니다. 해당 동아리: {rows.filter(row => row.missingVisits).map(row => row.name).join(', ')}. 인원은 모두 포함됩니다.</p>}
        {loading ? <p role="status">랭킹을 불러오는 중...</p> : error ? <p role="alert" className="text-red-600">{error}</p> : <>
            <div className="rounded-xl bg-amber-50 p-4 text-amber-900"><p className="font-bold">{winners.length ? '🏆 가장 활발하게 활동한 동아리' : '아직 집계된 활동이 없습니다.'}</p><p className="mt-2 break-words text-lg">{winners.map(row => row.name).join(' · ')}{winners.length > 1 && ' (공동 1위)'}</p></div>
            <div className="max-w-full overflow-x-auto" role="region" aria-label="동아리 랭킹 표" tabIndex={0}><table className="w-full min-w-[660px] text-sm"><thead className="bg-gray-100"><tr>{['종합순위','동아리명','활동횟수','횟수 순위','참여인원','인원 순위','순위 합계'].map(label=><th key={label} className="whitespace-nowrap p-3 text-left">{label}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.id} className={`border-b ${row.rank===1?'bg-amber-50':''}`}><td className="p-3 font-bold">{row.rank ? `${row.rank}위` : '-'}</td><td className="p-3">{row.name}</td><td className="p-3">{row.visits}회</td><td className="p-3">{row.visitRank || '-'}</td><td className="p-3">{row.participants}명</td><td className="p-3">{row.participantRank || '-'}</td><td className="p-3">{row.rankSum || '-'}</td></tr>)}</tbody></table></div>
        </>}
        <a className="inline-block text-sm text-brand-700 underline" href="https://docs.google.com/spreadsheets/d/1PBbGtI-TM10OpWijNd4u3Hbfll97dFPqwwof3VVkSjs/edit#gid=944991703" target="_blank" rel="noreferrer">2026년 프로그램 참여 현황 스프레드시트 열기</a>
    </section>;
}
