/**
 * ------------------------------------------------------------------
 * [시립창동청소년센터] 동아리 연습실 예약 시스템 백엔드 스크립트 (최종 수정 버전)
 * ------------------------------------------------------------------
 * 이 파일은 삭제 오류(ReferenceError)와 3시간 제한 오류(NaN)를 모두 수정한 최종본입니다.
 */

// 스프레드시트 ID (사용자 제공)
var SPREADSHEET_ID = "1PBbGtI-TM10OpWijNd4u3Hbfll97dFPqwwof3VVkSjs";
var TIMEZONE = "Asia/Seoul";
var MAX_CLUB_ACCOUNTS = 40;
var SESSION_SECONDS = 7200;
var MAX_LOGIN_FAILURES = 5;
var LOCK_MINUTES = 15;
var ACTIVITY_LOG_START_DATE = "2026-09-04";
var HOLIDAY_CALENDAR_ID = "ko.south_korea#holiday@group.v.calendar.google.com";
// 현재연도와 직전연도를 온전히 보관합니다. 예: 2026년에는 2025-01-01 이후 자료 유지.
var BOOKING_RETENTION_CALENDAR_YEARS = 2;
var LIVE_USER_CACHE_SECONDS = 15;
var CONFIG_CACHE_SECONDS = 60;
var NOTICE_CACHE_SECONDS = 300;
var BOOKING_DAY_CACHE_SECONDS = 10;

function putCacheSafely(cache, key, value, seconds) {
    var serialized = typeof value === "string" ? value : JSON.stringify(value);
    // Apps Script cache entries are limited in size. Large signatures/images simply bypass cache.
    if (serialized.length > 60000) return;
    try { cache.put(key, serialized, seconds); } catch (error) { console.log("Cache skipped: " + key); }
}

function doGet(e) {
    return handleRequest(e);
}

function doPost(e) {
    return handleRequest(e);
}

function isValidPin(pin) {
    return /^\d{4}$/.test(String(pin || "")) && !/^(\d)\1{3}$/.test(String(pin)) && ["1234", "4321", "0000"].indexOf(String(pin)) === -1;
}

function getPinPepper() {
    var properties = PropertiesService.getScriptProperties();
    var pepper = properties.getProperty("PIN_PEPPER");
    if (!pepper) {
        pepper = Utilities.getUuid() + Utilities.getUuid();
        properties.setProperty("PIN_PEPPER", pepper);
    }
    return pepper;
}

function hashPin(pin, salt) {
    var bytes = Utilities.computeHmacSha256Signature(String(pin) + ":" + String(salt), getPinPepper());
    return Utilities.base64EncodeWebSafe(bytes);
}

function findUserRecord(userId) {
    var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("Users");
    if (!sheet) return null;
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
        if (String(data[i][0]).trim().toLowerCase() === String(userId).trim().toLowerCase()) {
            return { sheet: sheet, rowNumber: i + 1, row: data[i] };
        }
    }
    return null;
}

function publicUser(record) {
    return { id: String(record.row[0]), name: String(record.row[1]), status: record.row[2] || "Active", role: record.row[3] || "user" };
}

function isDailyUserId(userId) {
    var id = String(userId || "").trim().toLowerCase();
    return id === "daily" || id === "데일리";
}

function isPinExemptRecord(record) {
    var id = String(record.row[0] || "").trim().toLowerCase();
    var role = String(record.row[3] || "user").trim().toLowerCase();
    return role !== "admin" && isDailyUserId(id);
}

function createSession(record) {
    var token = Utilities.getUuid() + Utilities.getUuid();
    var mustChangePin = !isPinExemptRecord(record) && (record.row[6] === true || String(record.row[6]).toUpperCase() === "TRUE");
    var session = { user: publicUser(record), mustChangePin: mustChangePin, expiresAt: new Date().getTime() + SESSION_SECONDS * 1000 };
    storeSession(token, session);
    if (Math.random() < 0.05) cleanupExpiredSessions();
    return { sessionToken: token, user: session.user, mustChangePin: session.mustChangePin };
}

function sessionPropertyKey(token) {
    return "session_v1_" + String(token || "");
}

function storeSession(token, session) {
    var serialized = JSON.stringify(session);
    CacheService.getScriptCache().put("session:" + token, serialized, SESSION_SECONDS);
    PropertiesService.getScriptProperties().setProperty(sessionPropertyKey(token), serialized);
}

function getSession(token) {
    if (!token) return null;
    var cache = CacheService.getScriptCache();
    var value = cache.get("session:" + token);
    if (!value) value = PropertiesService.getScriptProperties().getProperty(sessionPropertyKey(token));
    if (!value) return null;
    try {
        var session = JSON.parse(value);
        if (session.expiresAt && session.expiresAt < new Date().getTime()) {
            cache.remove("session:" + token);
            PropertiesService.getScriptProperties().deleteProperty(sessionPropertyKey(token));
            return null;
        }
        putCacheSafely(cache, "session:" + token, value, SESSION_SECONDS);
        return session;
    } catch (error) {
        return null;
    }
}

function removeSession(token) {
    CacheService.getScriptCache().remove("session:" + token);
    PropertiesService.getScriptProperties().deleteProperty(sessionPropertyKey(token));
}

function cleanupExpiredSessions() {
    var properties = PropertiesService.getScriptProperties();
    var all = properties.getProperties();
    var now = new Date().getTime();
    for (var key in all) {
        if (key.indexOf("session_v1_") !== 0) continue;
        try {
            var session = JSON.parse(all[key]);
            if (!session.expiresAt || session.expiresAt < now) properties.deleteProperty(key);
        } catch (error) {
            properties.deleteProperty(key);
        }
    }
}

function liveUserCacheKey(userId) {
    return "live_user_v1_" + encodeURIComponent(String(userId || "").trim().toLowerCase());
}

function clearLiveUserCache(userId) {
    CacheService.getScriptCache().remove(liveUserCacheKey(userId));
}

function getLiveUserSnapshot(userId) {
    var cache = CacheService.getScriptCache();
    var key = liveUserCacheKey(userId);
    var cached = cache.get(key);
    if (cached) return JSON.parse(cached);
    var record = findUserRecord(userId);
    if (!record) return null;
    var snapshot = {
        user: publicUser(record),
        mustChangePin: record.row[6] === true || String(record.row[6]).toUpperCase() === "TRUE"
    };
    putCacheSafely(cache, key, snapshot, LIVE_USER_CACHE_SECONDS);
    return snapshot;
}

function loginWithPin(params) {
    var userId = String(params.userId || "").trim();
    var pin = String(params.pin || "");
    if (!userId) return sendResponse({ message: "동아리 아이디를 입력해주세요." }, false);
    var record = findUserRecord(userId);
    if (!record) return sendResponse({ message: "동아리 아이디 또는 PIN이 올바르지 않습니다." }, false);
    if (String(record.row[2] || "Active") !== "Active") return sendResponse({ message: "비활성화된 계정입니다." }, false);

    if (isPinExemptRecord(record)) {
        var dailyNow = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd HH:mm:ss");
        record.sheet.getRange(record.rowNumber, 8, 1, 3).setValues([[0, "", dailyNow]]);
        return sendResponse(createSession(record));
    }

    if (!/^\d{4}$/.test(pin)) return sendResponse({ message: "동아리 아이디와 4자리 PIN을 확인해주세요." }, false);

    var lockedUntil = record.row[8] ? new Date(record.row[8]) : null;
    if (lockedUntil && lockedUntil.getTime() > new Date().getTime()) {
        return sendResponse({ message: "로그인 시도가 너무 많아 잠시 잠긴 계정입니다. 15분 후 다시 시도해주세요." }, false);
    }
    var salt = String(record.row[4] || "");
    var storedHash = String(record.row[5] || "");
    if (!salt || !storedHash) return sendResponse({ message: "PIN이 아직 설정되지 않은 계정입니다. 관리자에게 문의해주세요." }, false);

    if (hashPin(pin, salt) !== storedHash) {
        var failures = (parseInt(record.row[7]) || 0) + 1;
        var lockValue = "";
        if (failures >= MAX_LOGIN_FAILURES) {
            lockValue = new Date(new Date().getTime() + LOCK_MINUTES * 60 * 1000);
            failures = 0;
        }
        record.sheet.getRange(record.rowNumber, 8, 1, 2).setValues([[failures, lockValue]]);
        return sendResponse({ message: "동아리 아이디 또는 PIN이 올바르지 않습니다." }, false);
    }

    var now = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd HH:mm:ss");
    record.sheet.getRange(record.rowNumber, 8, 1, 3).setValues([[0, "", now]]);
    return sendResponse(createSession(record));
}

function setPinForRecord(record, pin, mustChange, allowTemporaryPin) {
    var isTemporaryPin = allowTemporaryPin === true && String(pin) === "0000";
    if (!isTemporaryPin && !isValidPin(pin)) throw new Error("PIN은 쉬운 번호를 제외한 4자리 숫자여야 합니다.");
    var salt = Utilities.getUuid();
    record.sheet.getRange(record.rowNumber, 5, 1, 5).setValues([[salt, hashPin(pin, salt), mustChange === true, 0, ""]]);
}

// 최초 배포 시 Apps Script 편집기에서만 실행하는 초기 PIN 설정 함수
function setInitialPinFromEditor(userId, pin) {
    var record = findUserRecord(userId);
    if (!record) throw new Error("계정을 찾을 수 없습니다.");
    setPinForRecord(record, String(pin), true, true);
}

// PIN이 없는 계정의 초기 PIN을 0000으로 통일합니다.
function generateInitialPinsFromEditor() {
    var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("Users");
    if (!sheet) throw new Error("Users 시트를 찾을 수 없습니다.");
    var data = sheet.getDataRange().getValues();
    var issued = [];
    for (var i = 1; i < data.length; i++) {
        if (!data[i][0] || data[i][5]) continue;
        var candidate = { sheet: sheet, rowNumber: i + 1, row: data[i] };
        if (isPinExemptRecord(candidate)) continue;
        var pin = "0000";
        var record = candidate;
        setPinForRecord(record, pin, true, true);
        issued.push({ userId: String(data[i][0]), name: String(data[i][1]), temporaryPin: pin });
    }
    console.log("초기 PIN 0000 설정 완료: " + issued.length + "개 계정");
    return issued;
}

function handleRequest(e) {
    try {
        var params = {};

        // 1. URL 파라미터 복사
        if (e.parameter) {
            for (var key in e.parameter) { params[key] = e.parameter[key]; }
        }

        // 2. POST Body(JSON) 복사
        if (e.postData && e.postData.contents) {
            try {
                var body = JSON.parse(e.postData.contents);
                for (var key in body) { params[key] = body[key]; }
            } catch (err) { console.log("JSON Parse Error"); }
        }

        var method = params.method;

        if (method === "LOGIN") return loginWithPin(params);

        var session = getSession(params.sessionToken);
        if (!session) return sendResponse({ message: "로그인이 만료되었습니다. 다시 로그인해주세요." }, false);
        var liveSnapshot = getLiveUserSnapshot(session.user.id);
        if (!liveSnapshot || String(liveSnapshot.user.status || "Active") !== "Active") return sendResponse({ message: "비활성화된 계정입니다." }, false);
        session.user = liveSnapshot.user;
        session.mustChangePin = liveSnapshot.mustChangePin;
        params.authUser = session.user;
        // 날짜별 대관 현황(GET)은 모든 동아리의 점유 시간을 보여줘야 한다.
        // 그 외 요청에서는 일반 사용자가 다른 userId를 가장하지 못하도록 본인 ID로 고정한다.
        if (session.user.role !== "admin" && method !== "GET") params.userId = session.user.id;

        if (method === "VERIFY_SESSION") {
            return sendResponse({ user: session.user, mustChangePin: session.mustChangePin });
        }
        if (method === "LOGOUT") {
            removeSession(params.sessionToken);
            return sendResponse({ message: "Logged out" });
        }
        if (method === "CHANGE_PIN") return changePin(params);
        if (method === "ADMIN_RESET_PIN") return adminResetPin(params);

        if (session.mustChangePin) {
            return sendResponse({ message: "계속하려면 임시 PIN을 먼저 변경해주세요." }, false);
        }

        // 1. 설정 불러오기 (시트에서 읽기)
        if (method === "GET_CONFIG") {
            var config = session.user.role === "admin" ? getSheetConfig() : getPublicConfig();
            return sendResponse(config);
        }

        if (method === "GET_HOLIDAYS") {
            return getKoreanHolidays(params);
        }

        if (method === "GET_PERFORMANCE_DATA") {
            if (session.user.role !== "admin") return sendResponse({ message: "관리자 권한이 필요합니다." }, false);
            return getPerformanceData(params);
        }

        // 2. 예약 조회
        if (method === "GET") {
            if (session.user.role !== "admin") {
                // 날짜 조회: 전체 예약의 공개 정보만 반환 / 내 예약 조회: 본인 ID로 강제
                params.userId = params.date ? "" : session.user.id;
            }
            return getBookings(params);
        }

        // 3. 예약 생성
        if (method === "POST" || method === "CREATE") {
            return createBooking(params);
        }

        // 4. 공지사항 조회
        if (method === "GET_NOTICES") {
            return getNotices();
        }

        // 5. 공지사항 생성
        if (method === "CREATE_NOTICE") {
            if (session.user.role !== "admin") return sendResponse({ message: "관리자 권한이 필요합니다." }, false);
            return createNotice(params);
        }

        // 6. 건의사항 생성
        if (method === "CREATE_SUGGESTION") {
            return createSuggestion(params);
        }

        // 7. 예약 취소
        if (method === "CANCEL_BOOKING") {
            return cancelBooking(params);
        }

        // 8. 예약 수정
        if (method === "UPDATE_BOOKING") {
            return updateBooking(params);
        }

        if (method === "GET_PENDING_REPORTS") {
            return getPendingActivityReports(params);
        }

        if (method === "GET_MEMBERS") {
            return getMembers(params);
        }

        if (method === "SUBMIT_ACTIVITY_LOG") {
            return submitActivityLog(params);
        }

        return sendResponse({ message: "Unknown Method" }, false);

    } catch (error) {
        return sendResponse({ message: "Server Error: " + error.toString() }, false);
    }
}

// ==========================================
// 핵심 로직
// ==========================================

function changePin(params) {
    var record = findUserRecord(params.authUser.id);
    if (!record) return sendResponse({ message: "계정을 찾을 수 없습니다." }, false);
    if (isPinExemptRecord(record)) return sendResponse({ message: "데일리 계정은 PIN을 사용하지 않습니다." }, false);
    var currentPin = String(params.currentPin || "");
    var newPin = String(params.newPin || "");
    if (hashPin(currentPin, String(record.row[4] || "")) !== String(record.row[5] || "")) {
        return sendResponse({ message: "현재 PIN이 올바르지 않습니다." }, false);
    }
    if (currentPin === newPin) return sendResponse({ message: "현재 PIN과 다른 PIN을 사용해주세요." }, false);
    try { setPinForRecord(record, newPin, false); }
    catch (error) { return sendResponse({ message: error.message }, false); }
    var session = { user: publicUser(record), mustChangePin: false };
    session.expiresAt = new Date().getTime() + SESSION_SECONDS * 1000;
    storeSession(params.sessionToken, session);
    clearLiveUserCache(record.row[0]);
    return sendResponse({ message: "PIN이 변경되었습니다." });
}

function adminResetPin(params) {
    if (params.authUser.role !== "admin") return sendResponse({ message: "관리자 권한이 필요합니다." }, false);
    var record = findUserRecord(params.userId);
    if (!record) return sendResponse({ message: "계정을 찾을 수 없습니다." }, false);
    if (isPinExemptRecord(record)) return sendResponse({ message: "데일리 계정은 PIN을 사용하지 않습니다." }, false);
    try { setPinForRecord(record, String(params.newPin || ""), true); }
    catch (error) { return sendResponse({ message: error.message }, false); }
    clearLiveUserCache(record.row[0]);
    return sendResponse({ message: "임시 PIN으로 초기화했습니다." });
}


function getSheetConfig() {
    var cache = CacheService.getScriptCache();
    var cached = cache.get("sheet_config_v1");
    if (cached) return JSON.parse(cached);
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    // 1. Users 시트 읽기
    var userSheet = ss.getSheetByName("Users");
    var users = [];
    if (userSheet) {
        var rows = userSheet.getDataRange().getValues();
        // i=1부터 (헤더 제외)
        for (var i = 1; i < rows.length; i++) {
            // A:ID, B:Name, C:Status, D:Role
            if (rows[i][0]) {
                users.push({
                    id: String(rows[i][0]),
                    name: String(rows[i][1]),
                    status: rows[i][2] || 'Active',
                    role: rows[i][3] || 'user'
                });
            }
        }
    }

    // 안전장치: 기본 유저 (Daily, Admin) 추가
    var hasDaily = users.some(function (u) { return u.id.toLowerCase() === 'daily'; });
    if (!hasDaily) users.push({ id: "Daily", name: "데일리", status: "Active", role: "user" });

    var hasAdmin = users.some(function (u) { return u.id.toLowerCase() === 'admin'; });
    if (!hasAdmin) users.push({ id: "Admin", name: "관리자", status: "Active", role: "admin" });

    // 2. Rooms 시트 읽기
    var rooms = getRoomsData();

    var clubAccountCount = users.filter(function (u) {
        return u.role !== 'admin' && u.id.toLowerCase() !== 'daily' && u.id !== '데일리';
    }).length;

    var result = {
        users: users,
        rooms: rooms,
        maxClubAccounts: MAX_CLUB_ACCOUNTS,
        clubAccountCount: clubAccountCount
    };
    putCacheSafely(cache, "sheet_config_v1", result, CONFIG_CACHE_SECONDS);
    return result;
}

function getRoomsData() {
    var cache = CacheService.getScriptCache();
    var cached = cache.get("rooms_v1");
    if (cached) return JSON.parse(cached);
    var roomSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("Rooms");
    var rooms = [];
    if (roomSheet) {
        var rows = roomSheet.getDataRange().getValues();
        for (var i = 1; i < rows.length; i++) {
            // A:ID, B:Name, C:Order
            if (rows[i][0]) {
                rooms.push({
                    id: String(rows[i][0]),
                    name: String(rows[i][1]),
                    order: rows[i][2]
                });
            }
        }
    }

    putCacheSafely(cache, "rooms_v1", rooms, NOTICE_CACHE_SECONDS);
    return rooms;
}

function getPublicConfig() {
    return {
        users: [],
        rooms: getRoomsData(),
        maxClubAccounts: MAX_CLUB_ACCOUNTS,
        clubAccountCount: 0
    };
}

function bookingDayCacheKey(date) {
    return "booking_day_v2_" + String(date || "");
}

function clearBookingDayCache(date) {
    if (date) CacheService.getScriptCache().remove(bookingDayCacheKey(date));
}

function getBookingRows(sheet, targetDate) {
    if (!targetDate) return sheet.getDataRange().getValues();
    var cache = CacheService.getScriptCache();
    var key = bookingDayCacheKey(targetDate);
    var cached = cache.get(key);
    if (cached) return JSON.parse(cached);
    var allRows = sheet.getDataRange().getValues();
    var rows = [];
    for (var i = 1; i < allRows.length; i++) {
        if (formatDateSafe(allRows[i][3]) === targetDate) {
            var normalizedRow = allRows[i].slice();
            normalizedRow[3] = targetDate;
            normalizedRow[4] = formatTimeSafe(normalizedRow[4]);
            normalizedRow[5] = formatTimeSafe(normalizedRow[5]);
            rows.push(normalizedRow);
        }
    }
    putCacheSafely(cache, key, rows, BOOKING_DAY_CACHE_SECONDS);
    return rows;
}

function getBookingsData(params) {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName("예약내역");
    if (!sheet) return [];

    var data = getBookingRows(sheet, params.date);
    var bookings = [];
    var targetDate = params.date;
    var targetUser = params.userId;

    for (var i = targetDate ? 0 : 1; i < data.length; i++) {
        var row = data[i];
        if (row.length < 7) continue;

        var rowDate = formatDateSafe(row[3]); // D열 Date

        if (targetDate && rowDate !== targetDate) continue;
        if (targetUser && String(row[1]).toLowerCase() !== targetUser.toLowerCase()) continue;
        var canSeeDetails = params.authUser.role === "admin" || String(row[1]).toLowerCase() === params.authUser.id.toLowerCase();

        bookings.push({
            id: row[0],
            // 다른 동아리에는 로그인 ID를 노출하지 않고 화면 표시용 식별자만 제공한다.
            userId: canSeeDetails ? row[1] : "occupied_" + (targetDate ? String(targetDate).replace(/-/g, "") + "_" : "") + i,
            userName: row[2],
            date: rowDate,
            startTime: formatTimeSafe(row[4]),
            endTime: formatTimeSafe(row[5]),
            roomId: row[6],
            createdAt: canSeeDetails ? row[7] : "",
            phoneNumber: canSeeDetails ? (row[8] || "") : "",
            reserverName: canSeeDetails ? (row[25] || "") : "",
            activityContent: canSeeDetails ? (row[9] || "") : "",
            suggestion: canSeeDetails ? (row[10] || "") : "",
            headcount: {
                elemM: canSeeDetails ? (parseInt(row[11]) || 0) : 0, elemF: canSeeDetails ? (parseInt(row[12]) || 0) : 0,
                midM: canSeeDetails ? (parseInt(row[13]) || 0) : 0, midF: canSeeDetails ? (parseInt(row[14]) || 0) : 0,
                highM: canSeeDetails ? (parseInt(row[15]) || 0) : 0, highF: canSeeDetails ? (parseInt(row[16]) || 0) : 0,
                u24M: canSeeDetails ? (parseInt(row[17]) || 0) : 0, u24F: canSeeDetails ? (parseInt(row[18]) || 0) : 0
            },
            participants: canSeeDetails ? (row[19] || "") : "",
            signature: canSeeDetails ? (row[20] || "") : "",
            expectedHeadcount: canSeeDetails ? (parseInt(row[21]) || 0) : 0,
            reportStatus: canSeeDetails ? (row[22] || "") : "",
            reportCompletedAt: canSeeDetails ? (row[23] || "") : "",
            reportUpdatedBy: canSeeDetails ? (row[24] || "") : ""
        });
    }
    return bookings;
}

function getBookings(params) {
    return sendResponse(getBookingsData(params));
}

function getHolidayCalendarForYear(year) {
    var cache = CacheService.getScriptCache();
    var cacheKey = "kr_holidays_v1_" + year;
    var cached = cache.get(cacheKey);
    if (cached) return JSON.parse(cached);

    var calendar = CalendarApp.getCalendarById(HOLIDAY_CALENDAR_ID);
    if (!calendar) {
        var names = ["대한민국의 휴일", "대한민국 공휴일", "Holidays in South Korea"];
        for (var i = 0; i < names.length && !calendar; i++) {
            var candidates = CalendarApp.getCalendarsByName(names[i]);
            if (candidates.length) calendar = candidates[0];
        }
    }
    if (!calendar) {
        var unavailable = { available: false, holidays: [] };
        cache.put(cacheKey, JSON.stringify(unavailable), 21600);
        return unavailable;
    }

    var events = calendar.getEvents(new Date(year, 0, 1, 0, 0, 0), new Date(year + 1, 0, 1, 0, 0, 0));
    var byDate = {};
    for (var j = 0; j < events.length; j++) {
        var date = Utilities.formatDate(events[j].getStartTime(), TIMEZONE, "yyyy-MM-dd");
        var title = String(events[j].getTitle() || "공휴일");
        byDate[date] = byDate[date] ? byDate[date] + ", " + title : title;
    }
    var holidays = Object.keys(byDate).sort().map(function (date) { return { date: date, name: byDate[date] }; });
    var result = { available: true, holidays: holidays };
    cache.put(cacheKey, JSON.stringify(result), 21600);
    return result;
}

function getKoreanHolidaysData(params) {
    var rawYears = params.years instanceof Array ? params.years : String(params.years || "").split(",");
    var years = rawYears.map(function (value) { return parseInt(value); }).filter(function (value) { return value >= 2000 && value <= 2100; });
    if (!years.length) years = [new Date().getFullYear()];
    years = years.filter(function (value, index, self) { return self.indexOf(value) === index; }).slice(0, 5);

    var holidays = [];
    var available = true;
    for (var i = 0; i < years.length; i++) {
        var yearResult = getHolidayCalendarForYear(years[i]);
        available = available && yearResult.available;
        holidays = holidays.concat(yearResult.holidays);
    }
    return { holidays: holidays, available: available };
}

function getKoreanHolidays(params) {
    return sendResponse(getKoreanHolidaysData(params));
}

function isMajorHolidayClosure(holidayName) {
    return /설날|추석|Lunar New Year|Korean New Year|Chuseok/i.test(String(holidayName || ""));
}

function getOperatingHoursForDate(dateStr) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || ""));
    if (!match) return { start: 9, end: 21, closed: false, holidayName: "" };
    var year = parseInt(match[1]);
    var holidayResult = getHolidayCalendarForYear(year);
    var holidayName = "";
    for (var i = 0; i < holidayResult.holidays.length; i++) {
        if (holidayResult.holidays[i].date === dateStr) {
            holidayName = holidayResult.holidays[i].name;
            break;
        }
    }
    var date = new Date(year, parseInt(match[2]) - 1, parseInt(match[3]), 12, 0, 0);
    var closed = !!holidayName && isMajorHolidayClosure(holidayName);
    var holidaySchedule = date.getDay() === 0 || !!holidayName;
    return { start: holidaySchedule ? 10 : 9, end: holidaySchedule ? 17 : 21, closed: closed, holidayName: holidayName };
}

function getPerformanceData(params) {
    var mode = ["week", "month", "quarter", "year"].indexOf(String(params.mode)) >= 0 ? String(params.mode) : "month";
    var basis = String(params.basis) === "completed" ? "completed" : "ended";
    var year = parseInt(params.year) || new Date().getFullYear();
    var month = Math.min(12, Math.max(1, parseInt(params.month) || 1));
    var quarter = Math.min(4, Math.max(1, parseInt(params.quarter) || 1));
    var weekStart = /^\d{4}-\d{2}-\d{2}$/.test(String(params.weekStart || "")) ? String(params.weekStart) : "";
    var weekEnd = /^\d{4}-\d{2}-\d{2}$/.test(String(params.weekEnd || "")) ? String(params.weekEnd) : "";
    if (mode === "week" && (!weekStart || !weekEnd || weekStart > weekEnd)) {
        return sendResponse({ message: "주간 조회 기간이 올바르지 않습니다." }, false);
    }
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName("예약내역");
    var config = getSheetConfig();
    var clubs = {};
    config.users.forEach(function (item) {
        if (item.role !== "admin" && item.status === "Active" && !isDailyUserId(item.id)) clubs[String(item.id).toLowerCase()] = true;
    });
    var holidayYears = [year];
    if (mode === "week") {
        holidayYears = [parseInt(weekStart.substring(0, 4))];
        var weekEndYear = parseInt(weekEnd.substring(0, 4));
        if (holidayYears.indexOf(weekEndYear) === -1) holidayYears.push(weekEndYear);
    }
    var holidayResult = { available: true, holidays: [] };
    holidayYears.forEach(function (holidayYear) {
        var result = getHolidayCalendarForYear(holidayYear);
        holidayResult.available = holidayResult.available && result.available;
        holidayResult.holidays = holidayResult.holidays.concat(result.holidays);
    });
    if (!sheet) return sendResponse({ bookings: [], holidays: holidayResult.holidays, available: holidayResult.available, availableYears: [year] });

    var data = sheet.getDataRange().getValues();
    var nowKey = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd HH:mm");
    var bookings = [];
    var yearSet = {};
    for (var i = 1; i < data.length; i++) {
        var row = data[i];
        var userId = String(row[1] || "").trim();
        if (!clubs[userId.toLowerCase()]) continue;
        var date = formatDateSafe(row[3]);
        var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
        if (!match) continue;
        var rowYear = parseInt(match[1]);
        var rowMonth = parseInt(match[2]);
        yearSet[rowYear] = true;
        if (mode === "week") {
            if (date < weekStart || date > weekEnd) continue;
        } else {
            if (rowYear !== year) continue;
            if (mode === "month" && rowMonth !== month) continue;
            if (mode === "quarter" && Math.ceil(rowMonth / 3) !== quarter) continue;
        }
        var endTime = formatTimeSafe(row[5]);
        if (!endTime || date + " " + endTime > nowKey) continue;
        var completed = String(row[22] || "") === "Completed" || !!String(row[9] || "").trim();
        if (basis === "completed" && !completed) continue;
        bookings.push({
            id: String(row[0] || "ROW_" + (i + 1)), userId: userId, userName: String(row[2] || userId),
            date: date, startTime: formatTimeSafe(row[4]), endTime: endTime, roomId: String(row[6] || ""),
            createdAt: row[7] || "", activityContent: completed ? "제출" : "", reportStatus: completed ? "Completed" : String(row[22] || ""),
            headcount: {
                elemM: parseInt(row[11]) || 0, elemF: parseInt(row[12]) || 0,
                midM: parseInt(row[13]) || 0, midF: parseInt(row[14]) || 0,
                highM: parseInt(row[15]) || 0, highF: parseInt(row[16]) || 0,
                u24M: parseInt(row[17]) || 0, u24F: parseInt(row[18]) || 0
            },
            expectedHeadcount: parseInt(row[21]) || 0
        });
    }
    yearSet[year] = true;
    var availableYears = Object.keys(yearSet).map(function (value) { return parseInt(value); }).sort(function (a, b) { return b - a; });
    return sendResponse({ bookings: bookings, holidays: holidayResult.holidays, available: holidayResult.available, availableYears: availableYears });
}

// -----------------------------------------------------------
// 예약 생성 (3시간 제한 로직 핵심 수정 + LockService)
// -----------------------------------------------------------
function createBooking(params) {
    // [중요] 락(Lock) 설정: 동시 요청 시 최대 30초간 대기 시킴
    var lock = LockService.getScriptLock();
    try {
        lock.waitLock(30000); // 다른 작업이 끝날 때까지 대기
    } catch (e) {
        return sendResponse({ message: "서버가 바쁩니다. 잠시 후 다시 시도해주세요." }, false);
    }

    try {
        var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
        var sheet = ss.getSheetByName("예약내역");
        if (!sheet) {
            sheet = ss.insertSheet("예약내역");
            sheet.appendRow([
                "ID","User ID","Name","Date","Start Time","End Time","Room ID","Created At","Phone Number",
                "활동내용","건의사항","초등남","초등여","중등남","중등여","고등남","고등여","24세이하남","24세이하여","참여자명단","대표자서명",
                "예정 활동인원","활동일지 상태","활동일지 제출일시","최종 작성자"
            ]);
        }

        // 1. 입력값 표준화
        var userId = String(params.userId || "").trim();
        var inputDate = formatDateSafe(params.date); // YYYY-MM-DD
        var duration = parseInt(params.duration || 0);
        var roomId = String(params.roomId || "").trim();
        var startTime = params.startTime;
        var expectedHeadcount = parseInt(params.expectedHeadcount || 0);
        var requestedStartHour = parseInt(String(startTime || "").split(":")[0]);
        var operating = getOperatingHoursForDate(inputDate);

        if (operating.closed) return sendResponse({ message: (operating.holidayName || "명절 연휴") + "은 센터 휴관일이라 예약할 수 없습니다." }, false);
        if (isNaN(requestedStartHour) || duration < 1 || requestedStartHour < operating.start || requestedStartHour + duration > operating.end) {
            return sendResponse({ message: "해당 날짜의 운영시간은 " + operating.start + ":00~" + operating.end + ":00입니다." }, false);
        }

        if (!expectedHeadcount || expectedHeadcount < 1 || expectedHeadcount > 99) {
            return sendResponse({ message: "예정 활동인원을 1~99명 사이로 입력해주세요." }, false);
        }

        // 유저 권한 확인
        var user = params.authUser;
        var userName = user ? user.name : userId;
        var isAdmin = user && user.role === 'admin';
        var isDaily = isDailyUserId(userId);
        var reserverName = isDaily ? String(params.reserverName || "").trim() : "";
        if (isDaily && (!reserverName || reserverName.length > 50)) return sendResponse({ message: "예약자 이름을 1~50자로 입력해주세요." }, false);
        if (isDaily && !/^010\d{8}$/.test(String(params.phoneNumber || "").replace(/-/g, ""))) return sendResponse({ message: "올바른 휴대전화 번호를 입력해주세요." }, false);

        // 2. 동아리만 하루 3시간 제한 (관리자·데일리 제외)
        var data = sheet.getDataRange().getValues();
        var totalHours = 0;

        if (!isAdmin && !isDaily) {
            if (!isDaily && collectPendingActivityReports(userId, sheet).length > 0) {
                return sendResponse({ message: "미작성 활동일지가 있습니다. 활동일지를 먼저 제출한 뒤 새 예약을 진행해주세요." }, false);
            }

            for (var i = 1; i < data.length; i++) {
                var rowUserId = String(data[i][1]).trim();
                var rowDate = formatDateSafe(data[i][3]);

                // 아이디(대소문자 무시)와 날짜가 완벽히 일치할 때만 합산
                if (rowUserId.toLowerCase() === userId.toLowerCase() && rowDate === inputDate) {
                    var sTime = formatTimeSafe(data[i][4]);
                    var eTime = formatTimeSafe(data[i][5]);
                    var s = parseInt(sTime.split(":")[0]);
                    var e = parseInt(eTime.split(":")[0]);

                    if (!isNaN(s) && !isNaN(e)) {
                        totalHours += (e - s);
                    }
                }
            }

            // 신청 시간을 더했을 때 3시간 초과 시 차단
            if (totalHours + duration > 3) {
                return sendResponse({
                    message: "제한 초과: 해당 날짜에 이미 " + totalHours + "시간 예약이 있습니다. 총 3시간까지만 가능합니다."
                }, false);
            }
        }

        // 3. 중복 예약(방/시간) 체크
        var startHour = requestedStartHour;
        for (var i = 1; i < data.length; i++) {
            if (formatDateSafe(data[i][3]) === inputDate && String(data[i][6]).trim() === roomId) {
                var rs = parseInt(formatTimeSafe(data[i][4]).split(":")[0]);
                var re = parseInt(formatTimeSafe(data[i][5]).split(":")[0]);
                if (startHour < re && (startHour + duration) > rs) {
                    return sendResponse({ message: "이미 다른 예약이 있는 시간대입니다." }, false);
                }
            }
        }

        // 4. 예약 데이터 기록
        var newId = "BK_" + new Date().getTime();
        var endTime = (startHour + duration) + ":00";
        var createdAt = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd HH:mm:ss");

        if (sheet.getMaxColumns() < 26) sheet.insertColumnsAfter(sheet.getMaxColumns(), 26 - sheet.getMaxColumns());
        if (!sheet.getRange(1, 26).getValue()) sheet.getRange(1, 26).setValue("예약자 이름");
        sheet.appendRow([
            newId,
            userId,
            userName,
            inputDate,
            startTime,
            endTime,
            roomId,
            createdAt,
            params.phoneNumber     || "",   // I
            "",                         // J 활동 후 작성
            "",                         // K 활동 후 작성
            0, 0, 0, 0, 0, 0, 0, 0,     // L~S 실제 참여자로 자동 계산
            "",                         // T 활동 후 작성
            "",                         // U 대표자 서명은 활동 후 작성
            expectedHeadcount,           // V 예정 활동인원
            isDaily ? "NotRequired" : "Pending", // W 데일리는 수기 작성, 동아리는 활동 후 작성
            "",                         // X 제출일시
            "",                         // Y 최종 작성자
            reserverName                // Z 데일리 예약자 이름
        ]);
        clearBookingDayCache(inputDate);

        return sendResponse({
            id: newId,
            userId: userId,
            totalBooked: totalHours + duration
        });

    } catch (err) {
        return sendResponse({ message: "처리 중 오류 발생: " + err.toString() }, false);
    } finally {
        // [중요] 작업 완료 후 반드시 락 해제
        lock.releaseLock();
    }
}
function cancelBooking(params) {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName("예약내역");
    if (!sheet) return sendResponse({ message: "예약 내역 시트를 찾을 수 없습니다." }, false);

    // 입력값 정규화 (공백 제거 및 문자열 변환)
    var bookingId = String(params.bookingId || params.bookingID || "").trim();
    var userId = String(params.userId || "").trim();

    if (!bookingId || !userId) {
        return sendResponse({ message: "예약 ID 또는 사용자 ID가 누락되었습니다." }, false);
    }

    // [중요] 유저 정보 다시 조회하여 관리자 여부 판별 (대소문자 무시)
    var user = params.authUser;
    var isAdmin = user && user.role === 'admin';

    var data = sheet.getDataRange().getValues();

    // i=1 (헤더 제외)부터 탐색
    for (var i = 1; i < data.length; i++) {
        var rowBookingId = String(data[i][0]).trim();
        var rowUserId = String(data[i][1]).trim();

        if (rowBookingId === bookingId) {
            // 본인 확인 OR 관리자 권한 확인 (대소문자 무시 비교)
            if (rowUserId.toLowerCase() === userId.toLowerCase() || isAdmin) {
                var cancelledDate = formatDateSafe(data[i][3]);
                sheet.deleteRow(i + 1);
                clearBookingDayCache(cancelledDate);
                console.log("취소 성공: " + bookingId + " (요청자: " + userId + ")");
                return sendResponse({ message: "예약이 정상적으로 취소되었습니다." });
            } else {
                return sendResponse({ message: "취소 권한이 없습니다. (본인 또는 관리자만 가능)" }, false);
            }
        }
    }

    // 반복문을 다 돌았는데도 못 찾은 경우
    console.log("취소 실패: ID를 찾을 수 없음 -> " + bookingId);
    return sendResponse({ message: "해당 예약 번호를 찾을 수 없습니다. (ID: " + bookingId + ")" }, false);
}

function updateBooking(params) {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName("예약내역");
    if (!sheet) return sendResponse({ message: "Sheet not found" }, false);

    var bookingId = params.bookingId;
    var userId = params.userId;
    // [중요] 날짜 포맷 통일
    var newDate = formatDateSafe(params.date);
    var newStartTime = params.startTime;
    var newDuration = parseInt(params.duration);
    var newRoomId = params.roomId;
    var startHour = parseInt(String(newStartTime || "").split(":")[0]);
    var operating = getOperatingHoursForDate(newDate);

    if (operating.closed) return sendResponse({ message: (operating.holidayName || "명절 연휴") + "은 센터 휴관일이라 예약할 수 없습니다." }, false);
    if (isNaN(startHour) || newDuration < 1 || startHour < operating.start || startHour + newDuration > operating.end) {
        return sendResponse({ message: "해당 날짜의 운영시간은 " + operating.start + ":00~" + operating.end + ":00입니다." }, false);
    }

    // 유저 정보 조회 (Admin 체크용)
    var user = params.authUser;
    var isAdmin = user && user.role === 'admin';

    // 1. Find the booking ROW
    var data = sheet.getDataRange().getValues();
    var rowIndex = -1;

    for (var i = 1; i < data.length; i++) {
        if (String(data[i][0]) === bookingId) {
            if (String(data[i][1]).toLowerCase() !== userId.toLowerCase()) return sendResponse({ message: "Permission denied" }, false);
            rowIndex = i;
            break;
        }
    }

    if (rowIndex === -1) return sendResponse({ message: "Booking not found" }, false);
    var oldDate = formatDateSafe(data[rowIndex][3]);

    // 동아리만 하루 3시간 제한 (관리자·데일리 제외)
    if (!isAdmin && !isDailyUserId(userId)) {
        var totalHours = 0;
        for (var i = 1; i < data.length; i++) {
            // Skip self and other users
            if (i === rowIndex) continue;

            var rowUserId = String(data[i][1]).trim();
            if (rowUserId.toLowerCase() !== userId.toLowerCase()) continue;

            // Date Check (formatDateSafe 사용)
            var rowDate = formatDateSafe(data[i][3]);

            if (rowDate === newDate) {
                var startTimeStr = formatTimeSafe(data[i][4]);
                var endTimeStr = formatTimeSafe(data[i][5]);

                var s = parseInt(startTimeStr.split(":")[0]);
                var e = parseInt(endTimeStr.split(":")[0]);

                if (!isNaN(s) && !isNaN(e)) {
                    totalHours += (e - s);
                }
            }
        }

        if (totalHours + newDuration > 3) {
            return sendResponse({
                message: "하루 최대 3시간까지만 이용 가능합니다.\n(현재 예약된 시간: " + totalHours + "시간 /  수정 요청: " + newDuration + "시간)"
            }, false);
        }
    }

    // 2. Calculate New EndTime
    var newEndTime = (startHour + newDuration) + ":00";

    // 3. Check Overlap using formatDateSafe
    for (var i = 1; i < data.length; i++) {
        if (i === rowIndex) continue; // Skip self

        var rowDate = formatDateSafe(data[i][3]);
        var rowRoomId = String(data[i][6]).trim();

        if (rowDate === newDate && String(rowRoomId) === String(newRoomId)) {
            var rowStart = parseInt(formatTimeSafe(data[i][4]).split(":")[0]);
            var rowEnd = parseInt(formatTimeSafe(data[i][5]).split(":")[0]);

            if (startHour < rowEnd && (startHour + newDuration) > rowStart) {
                return sendResponse({ message: "해당 시간은 이미 예약되어 있습니다." }, false);
            }
        }
    }

    // 4. Update Row
    // 날짜도 newDate(표준 포맷)로 업데이트 해야 함
    var range = sheet.getRange(rowIndex + 1, 4, 1, 4); // Columns D, E, F, G (Date, Start, End, Room)
    range.setValues([[newDate, newStartTime, newEndTime, newRoomId]]);
    clearBookingDayCache(oldDate);
    clearBookingDayCache(newDate);

    return sendResponse({ message: "Booking updated" });
}

function getMembers(params) {
    var userId = String(params.userId || "").trim();
    if (!userId) return sendResponse({ message: "동아리 계정ID가 필요합니다." }, false);

    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName("Members");
    if (!sheet) return sendResponse([]);

    var data = sheet.getDataRange().getValues();
    var members = [];
    for (var i = 1; i < data.length; i++) {
        if (String(data[i][0]).trim().toLowerCase() !== userId.toLowerCase()) continue;
        if (String(data[i][5] || "Active") !== "Active") continue;
        members.push({
            clubUserId: String(data[i][0]),
            memberId: String(data[i][1]),
            name: String(data[i][2]),
            schoolLevel: String(data[i][3]),
            gender: String(data[i][4]),
            status: String(data[i][5] || "Active")
        });
    }
    return sendResponse(members);
}

function getPendingActivityReports(params) {
    var userId = String(params.userId || "").trim();
    if (!userId) return sendResponse({ message: "사용자 ID가 필요합니다." }, false);
    if (isDailyUserId(userId)) return sendResponse([]);

    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName("예약내역");
    if (!sheet) return sendResponse([]);

    return sendResponse(collectPendingActivityReports(userId, sheet));
}

// 엑셀로 추가한 정기대관도 오늘 이후 예약이면 예약 ID와 Pending 상태를 자동 보완합니다.
function collectPendingActivityReports(userId, sheet) {
    if (isDailyUserId(userId)) return [];
    var data = sheet.getDataRange().getValues();
    var nowKey = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd HH:mm");
    var pending = [];
    for (var i = 1; i < data.length; i++) {
        var row = data[i];
        if (String(row[1]).trim().toLowerCase() !== userId.toLowerCase()) continue;

        var date = formatDateSafe(row[3]);
        var endTime = formatTimeSafe(row[5]);
        if (!date || !endTime) continue;

        var reportStatus = String(row[22] || "").trim();
        if (date >= ACTIVITY_LOG_START_DATE && !reportStatus) {
            reportStatus = "Pending";
            sheet.getRange(i + 1, 23).setValue(reportStatus);
            row[22] = reportStatus;
        }
        if (reportStatus !== "Pending") continue;

        if (!String(row[0] || "").trim()) {
            row[0] = "BK_IMPORT_" + new Date().getTime() + "_" + (i + 1);
            sheet.getRange(i + 1, 1).setValue(row[0]);
        }

        var endKey = date + " " + endTime;
        if (endKey > nowKey) continue;

        pending.push({
            id: row[0], userId: row[1], userName: row[2], date: date,
            startTime: formatTimeSafe(row[4]), endTime: endTime, roomId: row[6],
            createdAt: row[7], expectedHeadcount: parseInt(row[21]) || 0,
            reportStatus: row[22]
        });
    }
    pending.sort(function (a, b) {
        return (a.date + " " + a.endTime).localeCompare(b.date + " " + b.endTime);
    });
    return pending;
}

function submitActivityLog(params) {
    var bookingId = String(params.bookingId || "").trim();
    var userId = String(params.userId || "").trim();
    var activityContent = String(params.activityContent || "").trim();
    var participants = String(params.participants || "").trim();

    if (!bookingId || !userId) return sendResponse({ message: "예약 ID와 사용자 ID가 필요합니다." }, false);
    if (activityContent.length < 15) return sendResponse({ message: "주요 활동 내용을 15자 이상 입력해주세요." }, false);
    if (!participants) return sendResponse({ message: "실제 참여자를 1명 이상 입력해주세요." }, false);

    var lock = LockService.getScriptLock();
    try { lock.waitLock(30000); }
    catch (e) { return sendResponse({ message: "서버가 바쁩니다. 잠시 후 다시 시도해주세요." }, false); }

    try {
        var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
        var sheet = ss.getSheetByName("예약내역");
        if (!sheet) return sendResponse({ message: "예약내역 시트를 찾을 수 없습니다." }, false);

        var writer = params.authUser;
        var isAdmin = writer && writer.role === 'admin';
        var data = sheet.getDataRange().getValues();

        for (var i = 1; i < data.length; i++) {
            var row = data[i];
            if (String(row[0]).trim() !== bookingId) continue;
            if (String(row[1]).trim().toLowerCase() !== userId.toLowerCase() && !isAdmin) {
                return sendResponse({ message: "본인의 활동일지만 작성할 수 있습니다." }, false);
            }
            if (String(row[22]).trim() === "Completed" && !isAdmin) {
                return sendResponse({ message: "이미 제출된 활동일지입니다." }, false);
            }

            var endKey = formatDateSafe(row[3]) + " " + formatTimeSafe(row[5]);
            var nowKey = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd HH:mm");
            if (endKey > nowKey && !isAdmin) {
                return sendResponse({ message: "활동 종료 후에 활동일지를 작성할 수 있습니다." }, false);
            }

            sheet.getRange(i + 1, 10, 1, 12).setValues([[
                activityContent,
                String(params.suggestion || "").trim(),
                parseInt(params.elemM) || 0, parseInt(params.elemF) || 0,
                parseInt(params.midM) || 0, parseInt(params.midF) || 0,
                parseInt(params.highM) || 0, parseInt(params.highF) || 0,
                parseInt(params.u24M) || 0, parseInt(params.u24F) || 0,
                participants,
                String(params.signature || "")
            ]]);
            var completedAt = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd HH:mm:ss");
            sheet.getRange(i + 1, 23, 1, 3).setValues([["Completed", completedAt, userId]]);
            clearBookingDayCache(formatDateSafe(row[3]));
            return sendResponse({ message: "활동일지가 저장되었습니다.", completedAt: completedAt });
        }
        return sendResponse({ message: "예약을 찾을 수 없습니다." }, false);
    } finally {
        lock.releaseLock();
    }
}

function getNoticesData() {
    var cache = CacheService.getScriptCache();
    var cached = cache.get("notices_v1");
    if (cached) return JSON.parse(cached);
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName("Notices");
    if (!sheet) return [];

    var data = sheet.getDataRange().getValues();
    var notices = [];

    // i=1 (헤더 제외)
    for (var i = 1; i < data.length; i++) {
        var row = data[i];
        // [ID, Title, Content, Author, Date, ImageUrl]
        if (row[0]) {
            notices.push({
                id: row[0],
                title: row[1],
                content: row[2],
                author: row[3],
                date: row[4] instanceof Date ? Utilities.formatDate(row[4], TIMEZONE, "yyyy-MM-dd HH:mm") : String(row[4]),
                imageUrl: row[5] || ""
            });
        }
    }
    // 최신순 정렬 (역순)
    notices.reverse();
    putCacheSafely(cache, "notices_v1", notices, NOTICE_CACHE_SECONDS);
    return notices;
}

function getNotices() {
    return sendResponse(getNoticesData());
}

function createNotice(params) {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName("Notices");
    if (!sheet) {
        sheet = ss.insertSheet("Notices");
        sheet.appendRow(["ID", "Title", "Content", "Author", "Date", "ImageUrl"]);
    }

    var title = params.title;
    var content = params.content;
    var author = params.author;
    var imageUrl = params.imageUrl || "";

    var newId = "NOTI_" + new Date().getTime();
    var now = new Date();
    var dateStr = Utilities.formatDate(now, TIMEZONE, "yyyy-MM-dd HH:mm");

    sheet.appendRow([newId, title, content, author, dateStr, imageUrl]);
    CacheService.getScriptCache().remove("notices_v1");

    return sendResponse({
        id: newId,
        title: title,
        date: dateStr
    });
}

function createSuggestion(params) {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName("Suggestions");
    if (!sheet) {
        sheet = ss.insertSheet("Suggestions");
        sheet.appendRow(["ID", "User ID", "Name", "Content", "Date"]);
    }

    var userId = params.userId;
    var name = params.name;
    var content = params.content;

    var newId = "SUG_" + new Date().getTime();
    var now = new Date();
    var dateStr = Utilities.formatDate(now, TIMEZONE, "yyyy-MM-dd HH:mm:ss");

    sheet.appendRow([newId, userId, name, content, dateStr]);

    return sendResponse({
        id: newId,
        message: "Suggestion saved"
    });
}


function deleteOldBookings() {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName("예약내역");
    if (!sheet) return;

    var rows = sheet.getDataRange().getValues();
    if (rows.length <= 1) return;
    var now = new Date();
    var cutoffYear = now.getFullYear() - (BOOKING_RETENTION_CALENDAR_YEARS - 1);
    var cutoffKey = cutoffYear + "-01-01";
    var deleted = 0;

    // 아래에서 위로 지워야 행 번호가 변하지 않으며, 서식과 헤더도 보존됩니다.
    for (var i = rows.length - 1; i >= 1; i--) {
        var dateKey = formatDateSafe(rows[i][3]);
        if (dateKey && dateKey < cutoffKey) {
            sheet.deleteRow(i + 1);
            deleted++;
        }
    }
    console.log("Deleted " + deleted + " bookings before " + cutoffKey + ".");
}

// -------------------------------------------------------------

// -----------------------------------------------------------
// 유틸리티 함수 (날짜 포맷 통일의 핵심)
// -----------------------------------------------------------
function formatDateSafe(val) {
    if (!val) return "";
    var d;
    if (val instanceof Date) {
        d = val;
    } else {
        // 문자열일 경우 하이픈/점/슬래시 등을 고려하여 Date 객체로 변환 시도
        var s = String(val).replace(/[\.\/]/g, '-').trim();
        // "2024- 5- 20" 처럼 될 수 있으므로 공백 제거 등 추가 처리 필요할 수 있으나
        // new Date()는 비교적 유연함.
        d = new Date(s);
    }

    // 유효한 날짜라면 YYYY-MM-DD 문자열로 변환
    if (!isNaN(d.getTime())) {
        return Utilities.formatDate(d, TIMEZONE, "yyyy-MM-dd");
    }
    return String(val); // 변환 실패 시 원본 반환
}

function formatTimeSafe(val) {
    if (!val) return "";
    if (val instanceof Date) return Utilities.formatDate(val, TIMEZONE, "HH:mm");
    var s = String(val).trim();
    if (s.indexOf(":") === -1 && s.length > 0) s += ":00"; // "13" -> "13:00"
    return s;
}

function sendResponse(data, success) {
    if (success === undefined) success = true;
    var result = {
        status: success ? 'success' : 'error',
        data: success ? data : null,
        message: success ? null : (data.message || "Error")
    };
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}
