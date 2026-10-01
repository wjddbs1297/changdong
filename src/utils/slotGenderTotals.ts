import type { Booking, HistoricalPerformance } from '../types';
import type { AdditionalPerformance } from '../services/DataService';

export const GENDER_SLOTS = ['weekdayMorning', 'weekdayAfternoon', 'saturdayMorning', 'saturdayAfternoon', 'holidayMorning', 'holidayAfternoon', 'holidayUnclassified', 'weekdayUnclassified', 'saturdayUnclassified'] as const;
export type GenderSlot = typeof GENDER_SLOTS[number];
export type GenderCounts = { male: number; female: number };

export function bookingGenderCounts(booking: Booking): GenderCounts {
    if ((booking.reportStatus !== 'Completed' && !booking.activityContent?.trim()) || !booking.headcount) return { male: 0, female: 0 };
    const count = (value: unknown) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
    const h = booking.headcount;
    return {
        male: [h.elemM, h.midM, h.highM, h.u24M].reduce((sum, value) => sum + count(value), 0),
        female: [h.elemF, h.midF, h.highF, h.u24F].reduce((sum, value) => sum + count(value), 0),
    };
}

// Input cells already obey the selected period, account, completion and duplicate filters.
export function slotGenderTotals(cells: Partial<Record<GenderSlot, { visits: Booking[] }>>[], history: HistoricalPerformance[], additional: AdditionalPerformance[] = [], holidays: Set<string> = new Set()) {
    const totals = Object.fromEntries(GENDER_SLOTS.map(key => [key, { male: 0, female: 0 }])) as Record<GenderSlot, GenderCounts>;
    for (const row of cells) for (const key of GENDER_SLOTS) for (const booking of row[key]?.visits || []) {
        const counts = bookingGenderCounts(booking);
        totals[key].male += counts.male;
        totals[key].female += counts.female;
    }
    const historicalKeys: GenderSlot[] = ['weekdayMorning', 'weekdayAfternoon', 'holidayUnclassified', 'saturdayMorning', 'saturdayAfternoon'];
    for (const row of history) historicalKeys.forEach((key, i) => {
        totals[key].male += row.slots[i * 2] || 0;
        totals[key].female += row.slots[i * 2 + 1] || 0;
    });
    for (const item of additional) {
        const day = new Date(`${item.date}T12:00:00+09:00`).getUTCDay();
        const prefix = day === 0 || holidays.has(item.date) ? 'holiday' : day === 6 ? 'saturday' : 'weekday';
        const suffix = prefix === 'holiday' || item.time === '미구분' ? 'Unclassified' : item.time === '오전' ? 'Morning' : 'Afternoon';
        const target = totals[`${prefix}${suffix}` as GenderSlot];
        target.male += item.male;
        target.female += item.female;
    }
    return totals;
}
