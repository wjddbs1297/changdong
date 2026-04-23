
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
}

export interface BookingRequest {
    userId: string;
    roomId: Room['id'];
    date: string;
    startTime: string; // HH:00
    duration: number; // in hours, max 3
    phoneNumber?: string; // Optional: Only for 'Daily' users
}

export interface Notice {
    id: string;
    title: string;
    content: string;
    author: string;
    date: string;
    imageUrl?: string;
}
