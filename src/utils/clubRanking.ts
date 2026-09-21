import type { Booking, User, HistoricalPerformance } from '../types';

export const rankingClubId = (id: string) => {
    const value = id.trim().toLowerCase();
    return ({ ing: '-ing', able: 'able2026', '에이블': 'able2026' } as Record<string, string>)[value] || value;
};
export const rankingClub = (user: User) => user.status === 'Active' && user.role !== 'admin' &&
    !['admin', 'daily', '데일리', 'test', '방과후 초등', '방과후 중등'].includes(rankingClubId(user.id));

export function clubRankings(users: User[], bookings: Booking[], year: number, month = 0, now = Date.now(), historical: HistoricalPerformance[] = []) {
    const clubs = new Map(users.filter(rankingClub).map(user => [rankingClubId(user.id), {
        id: user.id, name: user.name || user.id, visits: 0, participants: 0,
        visitRank: 0, participantRank: 0, rankSum: 0, rank: 0, missingVisits: false,
    }]));
    const history = historical.filter(row => row.year === year && (!month || row.month === month));
    const covered = new Set(history.map(row => `${rankingClubId(row.userId)}/${row.year}-${String(row.month).padStart(2, '0')}`));
    for (const row of history) {
        const club = clubs.get(rankingClubId(row.userId));
        if (!club) continue;
        club.visits += row.visits ?? 0;
        club.participants += row.male + row.female;
        club.missingVisits ||= row.visits === null;
    }
    for (const booking of bookings) {
        if (covered.has(`${rankingClubId(booking.userId)}/${booking.date.slice(0, 7)}`)) continue;
        if (Number(booking.date.slice(0, 4)) !== year || (month && Number(booking.date.slice(5, 7)) !== month)) continue;
        if (booking.reportStatus !== 'Completed' && !booking.activityContent?.trim()) continue;
        const [hour, minute] = booking.endTime.split(':');
        const ended = Date.parse(`${booking.date}T${hour.padStart(2, '0')}:${minute || '00'}:00+09:00`);
        if (!Number.isFinite(ended) || ended > now) continue;
        const club = clubs.get(rankingClubId(booking.userId));
        if (!club) continue;
        club.visits++;
        club.participants += Object.values(booking.headcount || {}).reduce((sum, count) =>
            sum + (Number.isFinite(Number(count)) ? Math.max(0, Number(count)) : 0), 0);
    }
    const rows = [...clubs.values()];
    const active = rows.filter(row => row.visits > 0);
    for (const row of active) {
        row.visitRank = 1 + active.filter(other => other.visits > row.visits).length;
        row.participantRank = 1 + active.filter(other => other.participants > row.participants).length;
        row.rankSum = row.visitRank + row.participantRank;
    }
    for (const row of active) row.rank = 1 + active.filter(other => other.rankSum < row.rankSum).length;
    return rows.sort((a, b) => (a.rank || Infinity) - (b.rank || Infinity) || a.name.localeCompare(b.name, 'ko'));
}
