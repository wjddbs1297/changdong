import type { Booking, HistoricalPerformance } from '../types';
import { rankingClubId } from './clubRanking';

export function historicalInPeriod(rows: HistoricalPerformance[], mode: string, year: number, month: number, quarter: number) {
    if (mode === 'week') return [];
    return rows.filter(row => row.year === year && (mode === 'year' || (mode === 'month' ? row.month === month : Math.ceil(row.month / 3) === quarter)));
}

export function coveredByHistorical(booking: Booking, rows: HistoricalPerformance[]) {
    return rows.some(row => row.year === Number(booking.date.slice(0, 4)) && row.month === Number(booking.date.slice(5, 7)) && rankingClubId(row.userId) === rankingClubId(booking.userId));
}
