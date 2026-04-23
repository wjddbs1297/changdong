/**
 * ------------------------------------------------------------------
 * [시립창동청소년센터] 동아리 연습실 예약 시스템 백엔드 스크립트 (최종 수정 버전)
 * ------------------------------------------------------------------
 * 이 파일은 삭제 오류(ReferenceError)와 3시간 제한 오류(NaN)를 모두 수정한 최종본입니다.
 */

// 스프레드시트 ID (사용자 제공)
var SPREADSHEET_ID = "1PBbGtI-TM10OpWijNd4u3Hbfll97dFPqwwof3VVkSjs";
var TIMEZONE = "Asia/Seoul";

function doGet(e) {
    return handleRequest(e);
}

function doPost(e) {
    return handleRequest(e);
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

        if (!method && e.postData) {
            return createBooking(params);
        }

        // 1. 설정 불러오기 (시트에서 읽기)
        if (method === "GET_CONFIG") {
            var config = getSheetConfig();
            return sendResponse(config);
        }

        // 2. 예약 조회
        if (method === "GET") {
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

        return sendResponse({ message: "Unknown Method" }, false);

    } catch (error) {
        return sendResponse({ message: "Server Error: " + error.toString() }, false);
    }
}

// ==========================================
// 핵심 로직
// ==========================================


function getSheetConfig() {
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
    var roomSheet = ss.getSheetByName("Rooms");
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

    return { users: users, rooms: rooms };
}

function getBookings(params) {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName("예약내역");
    if (!sheet) return sendResponse([]);

    var data = sheet.getDataRange().getValues();
    var bookings = [];
    var targetDate = params.date;
    var targetUser = params.userId;

    for (var i = 1; i < data.length; i++) {
        var row = data[i];
        if (row.length < 7) continue;

        var rowDate = formatDateSafe(row[3]); // D열 Date

        if (targetDate && rowDate !== targetDate) continue;
        if (targetUser && row[1] !== targetUser) continue;

        bookings.push({
            id: row[0],
            userId: row[1],
            userName: row[2],
            date: rowDate,
            startTime: formatTimeSafe(row[4]),
            endTime: formatTimeSafe(row[5]),
            roomId: row[6],
            createdAt: row[7],
            phoneNumber: row[8] || "",
            activityContent: row[9] || "",
            suggestion: row[10] || "",
            headcount: {
                elemM: parseInt(row[11]) || 0, elemF: parseInt(row[12]) || 0,
                midM: parseInt(row[13]) || 0, midF: parseInt(row[14]) || 0,
                highM: parseInt(row[15]) || 0, highF: parseInt(row[16]) || 0,
                u24M: parseInt(row[17]) || 0, u24F: parseInt(row[18]) || 0
            },
            participants: row[19] || "",
            signature: row[20] || ""
        });
    }
    return sendResponse(bookings);
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
                "활동내용","건의사항","초등남","초등여","중등남","중등여","고등남","고등여","24세이하남","24세이하여","참여자명단","대표자서명"
            ]);
        }

        // 1. 입력값 표준화
        var userId = String(params.userId || "").trim();
        var inputDate = formatDateSafe(params.date); // YYYY-MM-DD
        var duration = parseInt(params.duration || 0);
        var roomId = String(params.roomId || "").trim();
        var startTime = params.startTime;

        // 유저 권한 확인
        var config = getSheetConfig();
        var user = config.users.find(function (u) { return u.id.toLowerCase() === userId.toLowerCase(); });
        var userName = user ? user.name : userId;
        var isAdmin = user && user.role === 'admin';

        // 2. 3시간 제한 체크 (Admin 제외)
        var data = sheet.getDataRange().getValues();
        var totalHours = 0;

        if (!isAdmin) {
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
        var startHour = parseInt(startTime.split(":")[0]);
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
            params.activityContent || "",   // J
            params.suggestion      || "",   // K
            parseInt(params.elemM  || 0),   // L
            parseInt(params.elemF  || 0),   // M
            parseInt(params.midM   || 0),   // N
            parseInt(params.midF   || 0),   // O
            parseInt(params.highM  || 0),   // P
            parseInt(params.highF  || 0),   // Q
            parseInt(params.u24M   || 0),   // R
            parseInt(params.u24F   || 0),   // S
            params.participants    || "",   // T ✅ 참여자명단
            params.signature       || ""    // U ✅ 대표자 서명 Base64
        ]);

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
    var config = getSheetConfig();
    var user = config.users.find(function (u) {
        return u.id.toLowerCase() === userId.toLowerCase();
    });
    var isAdmin = user && user.role === 'admin';

    var data = sheet.getDataRange().getValues();

    // i=1 (헤더 제외)부터 탐색
    for (var i = 1; i < data.length; i++) {
        var rowBookingId = String(data[i][0]).trim();
        var rowUserId = String(data[i][1]).trim();

        if (rowBookingId === bookingId) {
            // 본인 확인 OR 관리자 권한 확인 (대소문자 무시 비교)
            if (rowUserId.toLowerCase() === userId.toLowerCase() || isAdmin) {
                sheet.deleteRow(i + 1);
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

    // 유저 정보 조회 (Admin 체크용)
    var config = getSheetConfig();
    var user = config.users.find(function (u) { return u.id === userId; });
    var isAdmin = user && user.role === 'admin';

    // 1. Find the booking ROW
    var data = sheet.getDataRange().getValues();
    var rowIndex = -1;

    for (var i = 1; i < data.length; i++) {
        if (String(data[i][0]) === bookingId) {
            if (String(data[i][1]) !== userId) return sendResponse({ message: "Permission denied" }, false);
            rowIndex = i;
            break;
        }
    }

    if (rowIndex === -1) return sendResponse({ message: "Booking not found" }, false);

    // [New] 3시간 제한 체크 (Admin 제외) - createBooking과 동일한 로직 적용
    if (!isAdmin) {
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
    var startHour = parseInt(newStartTime.split(":")[0]);
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

    return sendResponse({ message: "Booking updated" });
}
function getNotices() {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName("Notices");
    if (!sheet) return sendResponse([]);

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
    return sendResponse(notices);
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
    if (rows.length <= 1) return; // Header only

    var header = rows[0];
    var data = rows.slice(1);
    var now = new Date();
    // 2 Months ago
    var cutoffDate = new Date();
    cutoffDate.setMonth(now.getMonth() - 2);

    // Filter data: Keep records that are NOT old
    var newData = data.filter(function (row) {
        // Date is at index 3 (Column D)
        if (!row[3]) return false;

        var dateVal = row[3];
        // Handle Date object or String
        var rowDate;
        if (dateVal instanceof Date) {
            rowDate = dateVal;
        } else {
            rowDate = new Date(dateVal);
        }

        // Keep if rowDate >= cutoffDate
        return rowDate >= cutoffDate;
    });

    // If deletions occurred
    if (newData.length < data.length) {
        sheet.clearContents();
        sheet.appendRow(header);
        if (newData.length > 0) {
            sheet.getRange(2, 1, newData.length, newData[0].length).setValues(newData);
        }
        console.log("Deleted " + (data.length - newData.length) + " old bookings.");
    }
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
