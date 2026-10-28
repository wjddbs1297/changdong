import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Booking, ClubMember } from '../types';
import { dataService } from '../services/DataService';
import { useAuth } from '../contexts/AuthContext';

const EMPTY_HEADCOUNT = { elemM: 0, elemF: 0, midM: 0, midF: 0, highM: 0, highF: 0, u24M: 0, u24F: 0 };

function reportHeadcount(members: ClubMember[]) {
    const result = { ...EMPTY_HEADCOUNT };
    members.forEach(member => {
        const level = member.schoolLevel;
        const sex = member.gender === '남' ? 'M' : 'F';
        const prefix = level === '초등' ? 'elem' : level === '중등' ? 'mid' : level === '고등' ? 'high' : 'u24';
        const key = `${prefix}${sex}` as keyof typeof result;
        result[key] += 1;
    });
    return result;
}

export function PendingActivityReports() {
    const { user } = useAuth();
    const [reports, setReports] = useState<Booking[]>([]);
    const [members, setMembers] = useState<ClubMember[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [activityContent, setActivityContent] = useState('');
    const [suggestion, setSuggestion] = useState('');
    const [manualNames, setManualNames] = useState('');
    const [manualHeadcount, setManualHeadcount] = useState({ ...EMPTY_HEADCOUNT });
    const [loading, setLoading] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);

    const load = useCallback(async () => {
        const isDailyUser = !!user && ['daily', '데일리'].includes(user.id.trim().toLowerCase());
        if (!user || user.role === 'admin' || isDailyUser) return;
        try {
            const [pending, roster] = await Promise.all([
                dataService.getPendingActivityReports(user.id),
                dataService.getMembers(user.id),
            ]);
            setReports(pending);
            setMembers(roster);
            setDismissed(false);
        } catch (error) {
            console.error(error);
        }
    }, [user]);

    useEffect(() => { load(); }, [load]);

    const current = reports[0];
    const selectedMembers = useMemo(
        () => members.filter(member => selectedIds.includes(member.memberId)),
        [members, selectedIds],
    );

    if (!user || !current || dismissed) return null;

    const pointerPosition = (event: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current!;
        const rect = canvas.getBoundingClientRect();
        return { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height };
    };
    const startDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
        drawing.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        const ctx = event.currentTarget.getContext('2d');
        const point = pointerPosition(event);
        ctx?.beginPath(); ctx?.moveTo(point.x, point.y);
    };
    const draw = (event: React.PointerEvent<HTMLCanvasElement>) => {
        if (!drawing.current) return;
        const ctx = event.currentTarget.getContext('2d');
        const point = pointerPosition(event);
        if (ctx) { ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.strokeStyle = '#111827'; ctx.lineTo(point.x, point.y); ctx.stroke(); }
    };
    const clearSignature = () => canvasRef.current?.getContext('2d')?.clearRect(0, 0, 600, 180);

    const submit = async () => {
        if (activityContent.trim().length < 15) {
            alert('주요 활동 내용을 15자 이상 입력해주세요.');
            return;
        }
        const fallbackNames = manualNames.split(',').map(name => name.trim()).filter(Boolean);
        const participantNames = members.length > 0 ? selectedMembers.map(member => member.name) : fallbackNames;
        if (participantNames.length === 0) {
            alert('실제 참여자를 1명 이상 선택하거나 입력해주세요.');
            return;
        }
        if (selectedMembers.some(member => !['초등','중등','고등','24세 이하'].includes(member.schoolLevel) || !['남','여'].includes(member.gender))) {
            alert('참여자의 학교급·성별을 관리자에게 확인해주세요.'); return;
        }
        const headcount = members.length ? reportHeadcount(selectedMembers) : manualHeadcount;
        if (Object.values(headcount).some(n => !Number.isInteger(n) || n < 0) || Object.values(headcount).reduce((a,b) => a+b,0) !== participantNames.length) {
            alert('학교급·성별 인원 합계가 참여자 수와 같아야 합니다.'); return;
        }
        const canvas = canvasRef.current;
        let signature = '';
        if (canvas) {
            const pixels = canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height).data;
            if (pixels && Array.from(pixels).some((value, index) => index % 4 === 3 && value > 0)) signature = canvas.toDataURL('image/png');
        }
        setLoading(true);
        try {
            await dataService.submitActivityReport({
                bookingId: current.id,
                userId: user.id,
                activityContent: activityContent.trim(),
                suggestion: suggestion.trim(),
                headcount,
                participants: participantNames,
                signature,
            });
            setReports(previous => previous.slice(1));
            setSelectedIds([]); setActivityContent(''); setSuggestion(''); setManualNames(''); clearSignature();
            setManualHeadcount({ ...EMPTY_HEADCOUNT });
            alert('활동일지가 저장되었습니다.');
        } catch (error) {
            alert(error instanceof Error ? error.message : '활동일지 저장에 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
            <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
                <div className="sticky top-0 z-10 border-b bg-white p-5">
                    <h2 className="text-xl font-bold text-gray-900">활동일지 작성</h2>
                    <p className="mt-1 text-sm text-gray-500">
                        {current.date} · {current.startTime}~{current.endTime} · 예정 {current.expectedHeadcount || 0}명
                    </p>
                    {reports.length > 1 && <p className="mt-1 text-xs font-semibold text-brand-600">미작성 활동일지 {reports.length}건</p>}
                </div>
                <div className="space-y-6 p-5">
                    <div>
                        <label className="mb-2 block text-sm font-bold">주요 활동 내용 <span className="text-red-500">(필수, 15자 이상)</span></label>
                        <textarea rows={4} value={activityContent} onChange={e => setActivityContent(e.target.value)} className="w-full rounded-xl border p-3 focus:outline-none focus:ring-2 focus:ring-brand-200" />
                    </div>
                    <div>
                        <label className="mb-2 block text-sm font-bold">실제 참여자 <span className="text-red-500">(필수)</span></label>
                        {members.length > 0 ? (
                            <div className="grid max-h-56 grid-cols-1 gap-2 overflow-y-auto rounded-xl border p-3 sm:grid-cols-2">
                                {members.map(member => (
                                    <label key={member.memberId} className="flex cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-gray-50">
                                        <input type="checkbox" checked={selectedIds.includes(member.memberId)} onChange={() => setSelectedIds(ids => ids.includes(member.memberId) ? ids.filter(id => id !== member.memberId) : [...ids, member.memberId])} />
                                        <span className="text-sm"><strong>{member.name}</strong> <span className="text-gray-400">· {member.schoolLevel} · {member.gender}</span></span>
                                    </label>
                                ))}
                            </div>
                        ) : (
                            <div>
                                <p className="mb-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">Members 시트에 이 동아리의 명단이 아직 없어 이름을 직접 입력합니다.</p>
                                <textarea rows={2} value={manualNames} onChange={e => setManualNames(e.target.value)} placeholder="홍길동, 김민지 (쉼표로 구분)" className="w-full rounded-xl border p-3" />
                                <div className="mt-3 grid grid-cols-2 gap-3">
                                    {(Object.keys(EMPTY_HEADCOUNT) as (keyof typeof EMPTY_HEADCOUNT)[]).map((key, index) => <label key={key} className="text-sm">{['초등 남','초등 여','중등 남','중등 여','고등 남','고등 여','24세 이하 남','24세 이하 여'][index]}<input type="number" min="0" step="1" value={manualHeadcount[key]} onChange={e => setManualHeadcount(v => ({...v, [key]: Number(e.target.value)}))} className="mt-1 w-full rounded border p-2" /></label>)}
                                </div>
                            </div>
                        )}
                        <p className="mt-2 text-sm font-semibold text-brand-600">선택 {members.length > 0 ? selectedMembers.length : manualNames.split(',').filter(name => name.trim()).length}명</p>
                    </div>
                    <div>
                        <label className="mb-2 block text-sm font-bold">건의사항 <span className="font-normal text-gray-400">(선택)</span></label>
                        <textarea rows={2} value={suggestion} onChange={e => setSuggestion(e.target.value)} className="w-full rounded-xl border p-3" />
                    </div>
                    <div>
                        <div className="mb-2 flex items-center justify-between"><label className="text-sm font-bold">대표자 서명</label><button type="button" onClick={clearSignature} className="text-xs text-gray-500">지우기</button></div>
                        <canvas ref={canvasRef} width={600} height={180} onPointerDown={startDrawing} onPointerMove={draw} onPointerUp={() => { drawing.current = false; }} onPointerCancel={() => { drawing.current = false; }} className="h-36 w-full touch-none rounded-xl border bg-white" />
                    </div>
                </div>
                <div className="sticky bottom-0 flex gap-3 border-t bg-gray-50 p-5">
                    <button onClick={() => setDismissed(true)} disabled={loading} className="flex-1 rounded-xl border bg-white py-3 font-bold text-gray-600">나중에 작성</button>
                    <button onClick={submit} disabled={loading} className="flex-1 rounded-xl bg-brand-600 py-3 font-bold text-white disabled:bg-gray-300">{loading ? '저장중...' : '활동일지 제출'}</button>
                </div>
            </div>
        </div>
    );
}
