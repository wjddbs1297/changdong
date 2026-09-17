import type { Booking, User } from '../types';

export const rankingClubId = (id: string) => {
    const value = id.trim().toLowerCase();
    return ({ ing: '-ing', able: 'able2026', '에이블': 'able2026' } as Record<string, string>)[value] || value;
};
export const rankingClub = (user: User) => user.status === 'Active' && user.role !== 'admin' &&
    !['admin', 'daily', '데일리', 'test', '방과후 초등', '방과후 중등'].includes(rankingClubId(user.id));

export function clubRankings(users: User[], bookings: Booking[], year: number, month = 0, now = Date.now()) {
    const clubs = new Map(users.filter(rankingClub).map(user => [rankingClubId(user.id), {
        id: user.id, name: user.name || user.id, visits: 0, participants: 0,
        visitRank: 0, participantRank: 0, rankSum: 0, rank: 0,
    }]));
    for (const booking of bookings) {
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
