/**
 * ------------------------------------------------------------------
 * [시립창동청소년센터] 동아리 연습실 예약 시스템 백엔드 스크립트 (동적 연동 버전)
 * ------------------------------------------------------------------
 * 이 스크립트는 스프레드시트의 'Users', 'Rooms', '예약내역' 시트와 직접 연동됩니다.
 * 하드코딩된 설정 대신 시트에 있는 내용을 불러옵니다.
 *
 * [필수 시트 및 컬럼 구조]
 * 1. Users 시트: A(User ID), B(Name), C(Status), D(Role)
 * 2. Rooms 시트: A(Room ID), B(Name), C(Order)
 * 3. 예약내역 시트: A(ID), B(User ID), C(Name), D(Date), E(Start), F(End), G(Room ID), H(Created At), I(Phone Number)
 *
 * ------------------------------------------------------------------
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
        var method = e.parameter.method;
        var params = e.parameter;

        if (e.postData && e.postData.contents) {
            try {
                var body = JSON.parse(e.postData.contents);
                if (body.method) method = body.method;
                if (!method && e.parameter.method) method = e.parameter.method;
                for (var key in body) {
                    params[key] = body[key];
                }
            } catch (err) { }
        }

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
            phoneNumber: row[8] || "" // I열 Phone Number
        });
    }
    return sendResponse(bookings);
}

function createBooking(params) {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName("예약내역");
    if (!sheet) {
        sheet = ss.insertSheet("예약내역");
        sheet.appendRow(["ID", "User ID", "Name", "Date", "Start Time", "End Time", "Room ID", "Created At", "Phone Number"]);
    }

    var userId = params.userId;
    var roomId = params.roomId;
    var date = params.date;
    var startTime = params.startTime;
    var duration = parseInt(params.duration);
    var phoneNumber = params.phoneNumber || "";

    // 유저 정보 조회 (Admin 체크용)
    var config = getSheetConfig();
    var user = config.users.find(function (u) { return u.id === userId; });
    var userName = user ? user.name : userId;
    var isAdmin = user && user.role === 'admin';

    // [New] 3시간 제한 체크 (Admin 제외)
    if (!isAdmin) {
        var data = sheet.getDataRange().getValues();
        var totalHours = 0;

        for (var i = 1; i < data.length; i++) {
            // UserID Check
            if (String(data[i][1]) !== userId) continue;

            // Date Check
            var rowDate = data[i][3];
            var rowDateStr = "";
            if (rowDate instanceof Date) rowDateStr = Utilities.formatDate(rowDate, TIMEZONE, "yyyy-MM-dd");
            else rowDateStr = String(rowDate);

            if (rowDateStr === date) {
                var startTimeStr = formatTimeSafe(data[i][4]);
                var endTimeStr = formatTimeSafe(data[i][5]);

                var s = parseInt(startTimeStr.split(":")[0]);
                var e = parseInt(endTimeStr.split(":")[0]);

                if (!isNaN(s) && !isNaN(e)) {
                    totalHours += (e - s);
                }
            }
        }

        if (totalHours + duration > 3) {
            return sendResponse({ message: "하루 최대 3시간까지만 이용 가능합니다." }, false);
        }
    }

    var startHour = parseInt(startTime.split(":")[0]);
    var endTime = (startHour + duration) + ":00";
    var newId = "BK_" + new Date().getTime();
    var now = new Date();
    var createdAt = Utilities.formatDate(now, TIMEZONE, "yyyy-MM-dd HH:mm:ss");

    // 순서: [ID, UserID, Name, Date, Start, End, RoomID, Created, Phone]
    sheet.appendRow([
        newId,
        userId,
        userName,
        date,
        startTime,
        endTime,
        roomId,
        createdAt,    // H열
        phoneNumber   // I열
    ]);

    return sendResponse({
        id: newId,
        userId: userId,
        roomId: roomId,
        phoneNumber: phoneNumber,
        debug_check: {
            totalHoursBefore: totalHours,
            dateTarget: date,
            userTarget: userId,
            isAdmin: isAdmin
        }
    });
}
// ...
// ...
function cancelBooking(params) {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName("예약내역");
    if (!sheet) return sendResponse({ message: "Sheet not found" }, false);

    var bookingId = params.bookingId;
    var userId = params.userId;

    var data = sheet.getDataRange().getValues();
    // i=1 header skip
    for (var i = 1; i < data.length; i++) {
        // ID: Col A (index 0), UserID: Col B (index 1)
        if (String(data[i][0]) === bookingId) {
            // 본인 확인
            if (String(data[i][1]) !== userId) {
                return sendResponse({ message: "Permission denied" }, false);
            }

            sheet.deleteRow(i + 1);
            return sendResponse({ message: "Booking cancelled" });
        }
    }
    return sendResponse({ message: "Booking not found" }, false);
}

function updateBooking(params) {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName("예약내역");
    if (!sheet) return sendResponse({ message: "Sheet not found" }, false);

    var bookingId = params.bookingId;
    var userId = params.userId;
    var newDate = params.date;
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

    // [New] 3시간 제한 체크 (Admin 제외)
    // Update의 경우, 자기 자신의 기존 시간은 결과에서 빠지므로(rowIndex 제외하고 계산하거나, 덮어쓸거니까)
    // 다른 예약들의 합 + 이번 변경 시간 > 3 이면 차단
    if (!isAdmin) {
        var totalHours = 0;
        for (var i = 1; i < data.length; i++) {
            // Skip self and other users
            if (i === rowIndex) continue;
            if (String(data[i][1]) !== userId) continue;

            // Date Check
            var rowDate = data[i][3];
            var rowDateStr = "";
            if (rowDate instanceof Date) rowDateStr = Utilities.formatDate(rowDate, TIMEZONE, "yyyy-MM-dd");
            else rowDateStr = String(rowDate);

            if (rowDateStr === newDate) {
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
            return sendResponse({ message: "하루 최대 3시간까지만 이용 가능합니다." }, false);
        }
    }

    // 2. Calculate New EndTime
    var startHour = parseInt(newStartTime.split(":")[0]);
    var newEndTime = (startHour + newDuration) + ":00";

    // 3. Check Overlap
    for (var i = 1; i < data.length; i++) {
        if (i === rowIndex) continue; // Skip self

        var rowDate = data[i][3];
        var rowDateStr = "";
        if (rowDate instanceof Date) rowDateStr = Utilities.formatDate(rowDate, TIMEZONE, "yyyy-MM-dd");
        else rowDateStr = String(rowDate);

        var rowRoomId = data[i][6];

        if (rowDateStr === newDate && String(rowRoomId) === String(newRoomId)) {
            var rowStart = parseInt(String(data[i][4]).split(":")[0]);
            var rowEnd = parseInt(String(data[i][5]).split(":")[0]);

            if (startHour < rowEnd && (startHour + newDuration) > rowStart) {
                return sendResponse({ message: "해당 시간은 이미 예약되어 있습니다." }, false);
            }
        }
    }

    // 4. Update Row
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

function formatDateSafe(val) {
    if (!val) return "";
    if (val instanceof Date) return Utilities.formatDate(val, TIMEZONE, "yyyy-MM-dd");
    return String(val);
}

function formatTimeSafe(val) {
    if (!val) return "";
    if (val instanceof Date) return Utilities.formatDate(val, TIMEZONE, "HH:mm");
    return String(val);
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
