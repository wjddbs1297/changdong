import { useEffect, useState } from 'react';
import { Trophy, Sparkles } from 'lucide-react';
import { dataService, type MonthlyHighlight } from '../services/DataService';

export function MonthlyHighlightCard() {
    const [data, setData] = useState<MonthlyHighlight | null>(null);
    const [failed, setFailed] = useState(false);
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        let active = true;
        setFailed(false);
        dataService.getMonthlyHighlight().then(result => { if (active) setData(result); })
            .catch(() => { if (active) setFailed(true); });
        return () => { active = false; };
    }, [attempt]);

    return <section aria-labelledby="monthly-highlight-title" className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-5 sm:p-6">
        <div className="flex items-center gap-3">
            <div className="rounded-xl bg-amber-100 p-3 text-amber-700"><Trophy size={24} aria-hidden="true" /></div>
            <div className="min-w-0">
                <p className="text-xs font-semibold text-amber-700">{data ? `${data.month.replace('-', '년 ')}월 · 함께 만든 활동` : '함께 만든 활동'}</p>
                <h1 id="monthly-highlight-title" className="text-lg sm:text-2xl font-bold text-gray-900">이번 달 활동 우수 동아리!</h1>
            </div>
        </div>
        {failed ? <div className="mt-4 text-sm text-gray-600">우수 동아리 소식을 불러오지 못했어요. <button className="underline underline-offset-4" onClick={() => setAttempt(value => value + 1)}>다시 보기</button></div>
            : !data ? <p className="mt-4 text-sm text-gray-500" role="status">이번 달 활동을 모으고 있어요…</p>
                : data.clubs.length === 0 ? <p className="mt-4 text-sm text-gray-600">이번 달 첫 활동을 기다리고 있어요. 활동 후 일지를 제출하면 반영돼요!</p>
                    : <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {data.clubs.map((club, index) => <div key={`${club.name}-${index}`} className="min-w-0 rounded-xl border border-amber-100 bg-white/90 p-4">
                            <p className={`mb-4 inline-block rounded-full px-3 py-1 text-sm font-bold ${club.rank === 1 ? 'bg-amber-100 text-amber-800' : club.rank === 2 ? 'bg-slate-100 text-slate-700' : 'bg-orange-100 text-orange-800'}`}>
                                {data.clubs.filter(other => other.rank === club.rank).length > 1 ? '공동 ' : ''}{club.rank}위
                            </p>
                            <div className="flex items-start gap-2"><Sparkles size={18} className="mt-1 shrink-0 text-amber-600" aria-hidden="true" /><h3 className="break-words text-xl font-bold text-gray-900">{club.name}</h3></div>
                            <p className="mt-2 text-sm text-gray-700">활동 <strong>{club.visits}회</strong> · 함께한 연인원 <strong>{club.participants}명</strong></p>
                            <p className="mt-2 text-xs text-amber-800">꾸준한 활동에 박수를 보내요!</p>
                        </div>)}
                    </div>}
        <p className="mt-6 text-sm leading-relaxed text-gray-500">종료 후 제출된 활동일지 기준 · 활동횟수와 참여 연인원 순위 합산<br />공동 순위를 포함해 3위까지 소개해요. 참여 연인원은 활동마다 참여한 인원을 더한 수예요.<br />최근 5분 이내 집계 결과를 조회하며, 최신 소식은 새로고침으로 확인해요.<br />월말까지 결과가 달라질 수 있어요. 모든 동아리의 활동을 응원합니다!</p>
    </section>;
}
