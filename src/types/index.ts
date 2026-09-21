
export interface User {
    id: string; // e.g. User01
    name?: string;
    status: 'Active' | 'Inactive';
    role: 'user' | 'admin';
}

export interface Room {
    id: string;
    name: string;
    order?: number;
}

export interface Booking {
    id: string;
    userId: string;
    userName?: string;
    roomId: Room['id'];
    date: string; // YYYY-MM-DD
    startTime: string; // HH:00
    endTime: string; // HH:00
    createdAt: string;
    phoneNumber?: string;
    reserverName?: string;
    activityContent?: string;
    suggestion?: string;
    headcount?: {
        elemM: number; elemF: number;
        midM: number;  midF: number;
        highM: number; highF: number;
        u24M: number;  u24F: number;
    };
    participants?: string;
    signature?: string;
    expectedHeadcount?: number;
    reportStatus?: 'Pending' | 'Completed' | '';
    reportCompletedAt?: string;
    reportUpdatedBy?: string;
}

export interface BookingRequest {
    userId: string;
    roomId: Room['id'];
    date: string;
    startTime: string; // HH:00
    duration: number; // in hours, max 3
    phoneNumber?: string; // Optional: Only for 'Daily' users
    expectedHeadcount: number;
}

export interface ClubMember {
    clubUserId: string;
    memberId: string;
    name: string;
    schoolLevel: '초등' | '중등' | '고등' | '24세 이하';
    gender: '남' | '여';
    status: 'Active' | 'Inactive';
}

export interface HolidayInfo {
    date: string;
    name: string;
}

// Monthly source totals, not reservations: no invented dates, hours or school levels.
export interface HistoricalPerformance {
    year: number;
    month: number;
    userId: string;
    sourceName: string;
    visits: number | null;
    male: number;
    female: number;
    slots: number[]; // weekday AM M/F, weekday PM M/F, holiday M/F, Saturday AM M/F, Saturday PM M/F
    source: string;
}

export interface Notice {
    id: string;
    title: string;
    content: string;
    author: string;
    date: string;
    imageUrl?: string;
}
