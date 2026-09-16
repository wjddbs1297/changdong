import type { Booking } from '../types';

export const safeArchiveName = (name: string) => name
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').replace(/[. ]+$/g, '').slice(0, 100) || '이름없음';

export function activityArchiveName(month: string, clubName?: string) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('활동 월을 선택해주세요.');
    const [year, number] = month.split('-');
    return `${year}년_${Number(number)}월_${clubName ? safeArchiveName(clubName) : '청소년동아리'}_활동일지`;
}

export function monthlySubmittedLogs(bookings: Booking[], month: string) {
    activityArchiveName(month);
    return bookings.filter(b => b.date.startsWith(`${month}-`) && !!b.activityContent?.trim())
        .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime) || a.id.localeCompare(b.id));
}

export function activityArchiveEntry(booking: Booking, index: number) {
    // Sequence prevents collisions even for imported rows with duplicate/missing IDs.
    return `${String(index + 1).padStart(4, '0')}_${booking.date}_${safeArchiveName(booking.userName || booking.userId)}_${safeArchiveName(booking.startTime)}-${safeArchiveName(booking.endTime)}_활동일지.pdf`;
}

export function saveArchive(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Allow browsers time to consume the download before freeing the URL.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
