import type { Booking, User, Room, Notice } from '../types';

export interface BookingRequest {
    userId: string;
    roomId: string;
    date: string;
    startTime: string;
    duration: number;
    phoneNumber?: string;
    activityContent?: string;
    suggestion?: string;
    headcount?: {
        elemM: number; elemF: number;
        midM: number;  midF: number;
        highM: number; highF: number;
        u24M: number;  u24F: number;
    };
    participants?: string[]; // ✅ 참여자 이름 목록
    signature?: string;
}

const getApiUrl = () => {
    const url = import.meta.env.VITE_GOOGLE_SCRIPT_URL;
    if (!url) { console.warn("VITE_GOOGLE_SCRIPT_URL is not set."); return ""; }
    return url;
}

export interface DataService {
    login(userId: string): Promise<User | null>;
    getBookings(date: string): Promise<Booking[]>;
    getAllBookings(): Promise<Booking[]>;
    createBooking(request: BookingRequest): Promise<Booking>;
    getUserBookings(userId: string): Promise<Booking[]>;
}

export interface Config { users: User[]; rooms: Room[]; }

let configCache: Config | null = null;

export class ApiDataService implements DataService {
    async getConfig(): Promise<Config> {
        if (configCache) return configCache;
        const url = getApiUrl();
        if (!url) return { users: [], rooms: [] };
        try {
            const response = await fetch(`${url}?method=GET_CONFIG`);
            const json = await response.json();
            if (json.status === 'success') { configCache = json.data; return json.data; }
        } catch (error) { console.error("Config Fetch Error:", error); }
        return { users: [], rooms: [] };
    }

    async login(userId: string): Promise<User | null> {
        const config = await this.getConfig();
        return config.users.find(u =>
            u.id.toLowerCase() === userId.toLowerCase() || u.name === userId
        ) || null;
    }

    async getBookings(date: string): Promise<Booking[]> {
        const url = getApiUrl();
        if (!url) return [];
        try {
            const response = await fetch(`${url}?method=GET&date=${date}`);
            const json = await response.json();
            if (json.status === 'success') return json.data;
            return [];
        } catch (error) { return []; }
    }

    async getAllBookings(): Promise<Booking[]> {
        const url = getApiUrl();
        if (!url) return [];
        try {
            const response = await fetch(`${url}?method=GET`); // NO date or userId param
            const json = await response.json();
            if (json.status === 'success') return json.data;
            return [];
        } catch (error) { return []; }
    }

    async getUserBookings(userId: string): Promise<Booking[]> {
        const url = getApiUrl();
        if (!url) return [];
        try {
            const response = await fetch(`${url}?method=GET&userId=${userId}`);
            const json = await response.json();
            return json.status === 'success' ? json.data : [];
        } catch (error) { return []; }
    }

    async createBooking(request: BookingRequest): Promise<Booking> {
        const url = getApiUrl();
        if (!url) throw new Error("API configuration missing");

        const payload: Record<string, unknown> = {
            userId:          request.userId,
            roomId:          request.roomId,
            date:            request.date,
            startTime:       request.startTime,
            duration:        request.duration,
            phoneNumber:     request.phoneNumber     ?? "",
            activityContent: request.activityContent ?? "",
            suggestion:      request.suggestion      ?? "",
            elemM:  request.headcount?.elemM  ?? 0,
            elemF:  request.headcount?.elemF  ?? 0,
            midM:   request.headcount?.midM   ?? 0,
            midF:   request.headcount?.midF   ?? 0,
            highM:  request.headcount?.highM  ?? 0,
            highF:  request.headcount?.highF  ?? 0,
            u24M:   request.headcount?.u24M   ?? 0,
            u24F:   request.headcount?.u24F   ?? 0,
            // ✅ 참여자 이름을 콤마 구분 문자열로 전송
            participants: (request.participants ?? []).join(', '),
            signature: request.signature ?? "",
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(payload)
            });
            const json = await response.json();
            if (json.status === 'success') return json.data;
            throw new Error(json.message || "Booking failed");
        } catch (error: any) {
            throw new Error(error.message || "Network error");
        }
    }

    async getNotices(): Promise<Notice[]> {
        const url = getApiUrl();
        if (!url) return [];
        try {
            const response = await fetch(`${url}?method=GET_NOTICES`);
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
                body: JSON.stringify({ method: 'CREATE_NOTICE', ...notice })
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
                body: JSON.stringify({ method: 'CREATE_SUGGESTION', ...data })
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
                body: JSON.stringify({ method: 'CANCEL_BOOKING', bookingId, userId })
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
                body: JSON.stringify({ method: 'UPDATE_BOOKING', ...data })
            });
            const json = await response.json();
            if (json.status !== 'success') throw new Error(json.message || "Update failed");
        } catch (error: any) { throw new Error(error.message || "Failed to update"); }
    }
}

export const dataService = new ApiDataService();
