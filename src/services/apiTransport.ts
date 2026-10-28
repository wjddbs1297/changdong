export class SessionExpiredError extends Error {}

// Only reads can safely be retried after losing a response.
const pendingReads = new Map<string, Promise<Response>>();
export async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
    const payload = typeof init.body === 'string' ? JSON.parse(init.body) : {};
    const read = payload.method === 'GET' || String(payload.method).startsWith('GET_') || payload.method === 'VERIFY_SESSION';
    if (!read) return request(url, init);
    const key = url + String(init.body);
    let pending = pendingReads.get(key);
    if (!pending) {
        pending = request(url, init).finally(() => pendingReads.delete(key));
        pendingReads.set(key, pending);
    }
    return (await pending).clone();
}

async function request(url: string, init: RequestInit): Promise<Response> {
    const payload = typeof init.body === 'string' ? JSON.parse(init.body) : {};
    const read = payload.method === 'GET' || String(payload.method).startsWith('GET_') || payload.method === 'VERIFY_SESSION';
    for (let attempt = 0; ; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 45000);
        try {
            const response = await fetch(url, { ...init, signal: controller.signal });
            if (!response.ok) throw new Error('서버 연결 실패');
            const json = await response.json();
            if (json.status !== 'success' && (json.code === 'SESSION_EXPIRED' || /로그인이 만료/.test(json.message || ''))) {
                window.dispatchEvent(new Event('session-expired'));
                throw new SessionExpiredError('로그인이 만료되었습니다. 다시 로그인해주세요.');
            }
            return new Response(JSON.stringify(json), { status: response.status });
        } catch (error) {
            if (error instanceof SessionExpiredError) throw error;
            if (read && attempt === 0) continue;
            throw new Error(read || payload.method === 'LOGIN'
                ? '연결이 지연되거나 끊겼습니다. 잠시 후 다시 시도해주세요.'
                : '서버 응답을 확인하지 못했습니다. 중복 제출하지 말고 내역을 먼저 확인해주세요.');
        } finally { clearTimeout(timer); }
    }
}
