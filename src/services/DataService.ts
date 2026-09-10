import type { Booking, User, Room, Notice, ClubMember, HolidayInfo } from '../types';

export interface BookingRequest {
    userId: string;
    roomId: string;
    date: string;
    startTime: string;
    duration: number;
    phoneNumber?: string;
    reserverName?: string;
    expectedHeadcount: number;
}

const getApiUrl = () => {
    const url = import.meta.env.VITE_GOOGLE_SCRIPT_URL;
    if (!url) { console.warn("VITE_GOOGLE_SCRIPT_URL is not set."); return ""; }
    return url;
}

export interface DataService {
    login(userId: string, pin: string): Promise<AuthResult>;
    restoreSession(): Promise<AuthResult | null>;
    logout(): Promise<void>;
    changePin(currentPin: string, newPin: string): Promise<void>;
    adminResetPin(userId: string, newPin: string): Promise<void>;
    getBookings(date: string): Promise<Booking[]>;
    getAllBookings(): Promise<Booking[]>;
    createBooking(request: BookingRequest): Promise<Booking>;
    getUserBookings(userId: string): Promise<Booking[]>;
    getPendingActivityReports(userId: string): Promise<Booking[]>;
    getMembers(userId: string): Promise<ClubMember[]>;
    getHolidays(years: number[]): Promise<HolidayCalendarResult>;
    getPerformanceData(query: PerformanceQuery): Promise<PerformanceDataResult>;
    submitActivityReport(data: ActivityReportRequest): Promise<void>;
}

export interface Config { users: User[]; rooms: Room[]; maxClubAccounts?: number; clubAccountCount?: number; }
export interface AuthResult { user: User; mustChangePin: boolean; }

export interface ActivityReportRequest {
    bookingId: string;
    userId: string;
    activityContent: string;
    suggestion: string;
    headcount: {
        elemM: number; elemF: number;
        midM: number; midF: number;
        highM: number; highF: number;
        u24M: number; u24F: number;
    };
    participants: string[];
    signature: string;
}

export interface HolidayCalendarResult {
    holidays: HolidayInfo[];
    available: boolean;
}

export interface PerformanceQuery {
    mode: 'week' | 'month' | 'quarter' | 'year';
    year: number;
    month: number;
    quarter: number;
    weekStart?: string;
    weekEnd?: string;
    basis: 'ended' | 'completed';
}

export interface PerformanceDataResult extends HolidayCalendarResult {
    bookings: Booking[];
    availableYears: number[];
}

let configCache: Config | null = null;
let sessionToken = sessionStorage.getItem('sessionToken') || '';

const postPayload = (data: Record<string, unknown>) => JSON.stringify({ ...data, sessionToken });
const protectedPost = (url: string, data: Record<string, unknown>) => fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: postPayload(data),
});

export class ApiDataService implements DataService {
    async getConfig(): Promise<Config> {
        if (configCache) return configCache;
        const url = getApiUrl();
        if (!url) return { users: [], rooms: [] };
        try {
            const response = await protectedPost(url, { method: 'GET_CONFIG' });
            const json = await response.json();
            if (json.status === 'success') { configCache = json.data; return json.data; }
        } catch (error) { console.error("Config Fetch Error:", error); }
        return { users: [], rooms: [] };
    }

    async login(userId: string, pin: string): Promise<AuthResult> {
        const url = getApiUrl();
        if (!url) throw new Error('API configuration missing');
        const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ method: 'LOGIN', userId, pin }) });
        const json = await response.json();
        if (json.status !== 'success') throw new Error(json.message || '로그인에 실패했습니다.');
        sessionToken = json.data.sessionToken;
        sessionStorage.setItem('sessionToken', sessionToken);
        configCache = null;
        return { user: json.data.user, mustChangePin: !!json.data.mustChangePin };
    }

    async restoreSession(): Promise<AuthResult | null> {
        if (!sessionToken) return null;
        const url = getApiUrl();
        if (!url) return null;
        try {
            const response = await protectedPost(url, { method: 'VERIFY_SESSION' });
            const json = await response.json();
            if (json.status === 'success') return { user: json.data.user, mustChangePin: !!json.data.mustChangePin };
        } catch { /* require a fresh login */ }
        sessionToken = '';
        sessionStorage.removeItem('sessionToken');
        return null;
    }

    async logout(): Promise<void> {
        const url = getApiUrl();
        try { if (url && sessionToken) await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: postPayload({ method: 'LOGOUT' }) }); } catch { /* local logout still succeeds */ }
        sessionToken = '';
        sessionStorage.removeItem('sessionToken');
        configCache = null;
    }

    async changePin(currentPin: string, newPin: string): Promise<void> {
        const url = getApiUrl();
        if (!url) throw new Error('API configuration missing');
        const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: postPayload({ method: 'CHANGE_PIN', currentPin, newPin }) });
        const json = await response.json();
        if (json.status !== 'success') throw new Error(json.message || 'PIN 변경에 실패했습니다.');
    }

    async adminResetPin(userId: string, newPin: string): Promise<void> {
        const url = getApiUrl();
        if (!url) throw new Error('API configuration missing');
        const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: postPayload({ method: 'ADMIN_RESET_PIN', userId, newPin }) });
        const json = await response.json();
        if (json.status !== 'success') throw new Error(json.message || 'PIN 초기화에 실패했습니다.');
    }

    async getBookings(date: string): Promise<Booking[]> {
        const url = getApiUrl();
        if (!url) return [];
        try {
            const response = await protectedPost(url, { method: 'GET', date });
            const json = await response.json();
            if (json.status === 'success') return json.data;
            return [];
        } catch (error) { return []; }
    }

    async getAllBookings(): Promise<Booking[]> {
        const url = getApiUrl();
        if (!url) return [];
        try {
            const response = await protectedPost(url, { method: 'GET' });
            const json = await response.json();
            if (json.status === 'success') return json.data;
            return [];
        } catch (error) { return []; }
    }

    async getUserBookings(userId: string): Promise<Booking[]> {
        const url = getApiUrl();
        if (!url) return [];
        try {
            const response = await protectedPost(url, { method: 'GET', userId });
            const json = await response.json();
            return json.status === 'success' ? json.data : [];
        } catch (error) { return []; }
    }

    async createBooking(request: BookingRequest): Promise<Booking> {
        const url = getApiUrl();
        if (!url) throw new Error("API configuration missing");

        const payload: Record<string, unknown> = {
            method:          'CREATE',
            userId:          request.userId,
            roomId:          request.roomId,
            date:            request.date,
            startTime:       request.startTime,
            duration:        request.duration,
            phoneNumber:     request.phoneNumber     ?? "",
            reserverName:    request.reserverName    ?? "",
            expectedHeadcount: request.expectedHeadcount,
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: postPayload(payload)
            });
            const json = await response.json();
            if (json.status === 'success') return json.data;
            throw new Error(json.message || "Booking failed");
        } catch (error: any) {
            throw new Error(error.message || "Network error");
        }
    }

    async getPendingActivityReports(userId: string): Promise<Booking[]> {
        const url = getApiUrl();
        if (!url) return [];
        const response = await protectedPost(url, { method: 'GET_PENDING_REPORTS', userId });
        const json = await response.json();
        if (json.status !== 'success') throw new Error(json.message || '활동일지 대기 목록을 불러오지 못했습니다.');
        return json.data;
    }

    async getMembers(userId: string): Promise<ClubMember[]> {
        const url = getApiUrl();
        if (!url) return [];
        const response = await protectedPost(url, { method: 'GET_MEMBERS', userId });
        const json = await response.json();
        if (json.status !== 'success') throw new Error(json.message || '회원 명단을 불러오지 못했습니다.');
        return json.data;
    }

    async getHolidays(years: number[]): Promise<HolidayCalendarResult> {
        const url = getApiUrl();
        if (!url) return { holidays: [], available: false };
        const response = await protectedPost(url, { method: 'GET_HOLIDAYS', years });
        const json = await response.json();
        if (json.status !== 'success') throw new Error(json.message || '공휴일 정보를 불러오지 못했습니다.');
        return json.data;
    }

    async getPerformanceData(query: PerformanceQuery): Promise<PerformanceDataResult> {
        const url = getApiUrl();
        if (!url) return { bookings: [], holidays: [], available: false, availableYears: [] };
        const response = await protectedPost(url, { method: 'GET_PERFORMANCE_DATA', ...query });
        const json = await response.json();
        if (json.status !== 'success') throw new Error(json.message || '이용 실적을 불러오지 못했습니다.');
        return json.data;
    }

    async submitActivityReport(data: ActivityReportRequest): Promise<void> {
        const url = getApiUrl();
        if (!url) throw new Error('API configuration missing');
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: postPayload({
                method: 'SUBMIT_ACTIVITY_LOG',
                ...data,
                participants: data.participants.join(', '),
                ...data.headcount,
            }),
        });
        const json = await response.json();
        if (json.status !== 'success') throw new Error(json.message || '활동일지 저장에 실패했습니다.');
    }

    async getNotices(): Promise<Notice[]> {
        const url = getApiUrl();
        if (!url) return [];
        try {
            const response = await protectedPost(url, { method: 'GET_NOTICES' });
            const json = await response.json();
            return json.status === 'success' ? json.data : [];
        } catch (error) { return []; }
    }

    async createNotice(notice: { title: string; content: string; author: string; imageUrl?: string }): Promise<Notice> {
        const url = getApiUrl();
        if (!url) throw new Error("API configuration missing");
        try {
            const response = await fetch(url, {
                method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: postPayload({ method: 'CREATE_NOTICE', ...notice })
            });
            const json = await response.json();
            if (json.status === 'success') return json.data;
            throw new Error(json.message || "Notice creation failed");
        } catch (error: any) { throw new Error(error.message || "Network error"); }
    }

    async createSuggestion(data: { userId: string; name: string; content: string }): Promise<void> {
        const url = getApiUrl();
        if (!url) throw new Error("API configuration missing");
        try {
            const response = await fetch(url, {
                method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: postPayload({ method: 'CREATE_SUGGESTION', ...data })
            });
            const json = await response.json();
            if (json.status !== 'success') throw new Error(json.message || "Failed");
        } catch (error: any) { throw new Error(error.message || "Failed"); }
    }

    async cancelBooking(bookingId: string, userId: string): Promise<void> {
        const url = getApiUrl();
        if (!url) throw new Error("API configuration missing");
        try {
            const response = await fetch(url, {
                method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: postPayload({ method: 'CANCEL_BOOKING', bookingId, userId })
            });
            const json = await response.json();
            if (json.status !== 'success') throw new Error(json.message || "Cancellation failed");
        } catch (error: any) { throw new Error(error.message || "Failed to cancel"); }
    }

    async updateBooking(data: { bookingId: string; userId: string; date: string; startTime: string; duration: string; roomId: string }): Promise<void> {
        const url = getApiUrl();
        if (!url) throw new Error("API configuration missing");
        try {
            const response = await fetch(url, {
                method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: postPayload({ method: 'UPDATE_BOOKING', ...data })
            });
            const json = await response.json();
            if (json.status !== 'success') throw new Error(json.message || "Update failed");
        } catch (error: any) { throw new Error(error.message || "Failed to update"); }
    }
}

export const dataService = new ApiDataService();
