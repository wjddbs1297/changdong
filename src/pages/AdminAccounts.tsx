import { useEffect, useState } from 'react';
import { dataService } from '../services/DataService';
import { useAuth } from '../contexts/AuthContext';
import type { User } from '../types';

export function AdminAccounts() {
    const { user } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [resettingId, setResettingId] = useState<string | null>(null);
    useEffect(() => {
        if (user?.role !== 'admin') return;
        dataService.getConfig().then(config => setUsers(config.users)).finally(() => setLoading(false));
    }, [user]);

    const resetPin = async (target: User) => {
        if (resettingId) return;
        if (!confirm(`${target.name || target.id} (${target.id})의 PIN을 0000으로 초기화할까요?\n이 동아리만 변경되며, 다음 로그인 시 새 PIN을 설정해야 합니다.`)) return;
        setResettingId(target.id);
        try { await dataService.adminResetPin(target.id, '0000'); alert(`${target.name || target.id}의 PIN을 0000으로 초기화했습니다.\n다음 로그인에서 새 PIN으로 변경해주세요.`); }
        catch (error) { alert(error instanceof Error ? error.message : 'PIN 초기화에 실패했습니다.'); }
        finally { setResettingId(null); }
    };

    if (user?.role !== 'admin') return <div className="p-8 text-center text-red-500">관리자 전용 페이지입니다.</div>;
    const clubAccounts = users.filter(item => item.role !== 'admin' && !['daily', '데일리'].includes(item.id.trim().toLowerCase()));
    return <div className="min-w-0 rounded-2xl border bg-white p-4 sm:p-6 shadow-sm">
        <div className="mb-5"><h1 className="text-2xl font-bold">동아리 계정 관리</h1><p className="mt-1 text-sm text-gray-500">현재 PIN은 조회할 수 없습니다. PIN 초기화를 누르면 해당 동아리만 0000으로 변경되며, 다음 로그인 시 새 PIN을 설정해야 합니다.</p></div>
        {!loading && <div className="space-y-3 sm:hidden">{clubAccounts.map(item => <article key={item.id} className="rounded-xl border p-3"><div className="break-words font-bold">{item.name || item.id}</div><div className="mt-1 break-all text-sm text-gray-500">아이디: {item.id}</div><div className="mt-3 flex flex-wrap items-center justify-between gap-2"><span className="text-sm text-gray-500">{item.status === 'Active' ? '활성' : item.status}</span><button onClick={() => resetPin(item)} className="min-h-11 whitespace-nowrap rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white">PIN 초기화</button></div></article>)}</div>}
        {loading ? <p>불러오는 중...</p> : <div className="hidden overflow-x-auto sm:block"><table className="w-full text-sm"><thead><tr className="border-b bg-gray-50"><th className="p-3 text-left">아이디</th><th className="p-3 text-left">동아리명</th><th className="p-3">상태</th><th className="p-3"></th></tr></thead><tbody>
            {users.filter(item => item.role !== 'admin' && !['daily', '데일리'].includes(item.id.trim().toLowerCase())).map(item => <tr key={item.id} className="border-b"><td className="p-3 font-mono">{item.id}</td><td className="p-3">{item.name}</td><td className="p-3 text-center">{item.status}</td><td className="p-3 text-right"><button onClick={() => resetPin(item)} className="rounded-lg bg-brand-600 px-4 py-2 font-bold text-white">PIN 초기화</button></td></tr>)}
        </tbody></table></div>}
    </div>;
}
