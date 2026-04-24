# 구글 앱스 스크립트(GAS) 수정 및 배포 방법

공유해주신 URL(`.../exec`)은 스크립트가 실행되는 **결과물 주소**입니다. 이 주소 자체에서는 코드를 수정할 수 없습니다.
코드를 수정하려면 해당 스크립트가 연결된 **구글 스프레드시트**로 이동해야 합니다.

## 1. 스크립트 편집기 접속 방법
1. 예약 장부로 사용 중인 **구글 스프레드시트** 파일을 엽니다.
2. 상단 메뉴에서 **확장 프로그램 (Extensions)** > **Apps Script**를 클릭합니다.
   - *만약 별도의 스크립트 파일을 만드셨다면 구글 드라이브에서 해당 스크립트 파일을 찾아주세요.*

## 2. 코드 수정 (H열 전화번호 저장)
`Code.gs` (또는 `코드.gs`) 파일의 `doPost` 함수를 찾아 아래 내용을 반영해 주세요.

```javascript
function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("예약내역"); // 시트 이름 확인 필요
  // 또는: var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0]; // 첫 번째 시트 사용 시

  var params = JSON.parse(e.postData.contents);
  
  // 기존 변수들
  var userId = params.userId;
  var roomId = params.roomId;
  var date = params.date;
  var startTime = params.startTime;
  var duration = params.duration;
  
  // [추가] 전화번호 받기
  var phoneNumber = params.phoneNumber || ""; 

  // ... (유효성 검사 등 기존 로직) ...

  // [수정] appendRow 부분에 phoneNumber 추가 (H열은 8번째)
  // 순서: UserID(A), Name(B), Date(C), Start(D), End(E), Room(F), Created(G), Phone(H)
  // *사용하시는 시트의 열 순서에 맞춰야 합니다.*
  
  var userName = getUserName(userId); // 사용자 이름 찾는 함수가 있다고 가정
  var endTime = calculateEndTime(startTime, duration); // 종료 시간 계산 로직
  
  sheet.appendRow([
    userId,
    userName,
    date,
    startTime,
    endTime,
    roomId,
    new Date(),
    phoneNumber // <--- 여기에 변수 추가!
  ]);

  return ContentService.createTextOutput(JSON.stringify({ 
    status: 'success', 
    data: { id: "new", userId: userId, /*...*/ } 
  })).setMimeType(ContentService.MimeType.JSON);
}
```

## 3. **매우 중요: 새버전 배포하기** (URL 업데이트)
코드를 저장하기만 하면, 테스트 주소(`/dev`)에서는 반영되지만 **실제 사용자용 주소(`/exec`)에는 반영되지 않습니다.**
반드시 다음 절차를 따라 **새 버전을 배포**해야 공유해주신 URL에서 수정 사항이 동작합니다.

1. 화면 우측 상단 **[배포]** (파란색 버튼) > **[새 배포 관리]** 또는 **[새 배포]** 클릭.
2. 유형 선택: **웹 앱 (Web App)**.
   - *설정 아이콘(톱니바퀴)을 눌러 '웹 앱'을 선택해야 할 수도 있습니다.*
3. **설명**: "전화번호 기능 추가" 등 입력.
4. **사용자 (Execute as)**: '나 (Me)' (보통 그대로 둠).
5. **액세스 권한 (Who has access)**: '모든 사용자 (Anyone)' (기존 설정 유지).
6. **[배포 (Deploy)]** 클릭.
7. **새로운 URL**이 나오거나 기존 URL이 보여집니다. (기존 URL을 그대로 씁니다.)

이제 리액트 앱에서 예약을 시도하면 H열에 전화번호가 들어옵니다.

---
### 요약
1. **스프레드시트 > 확장 프로그램 > Apps Script** 열기.
2. `doPost` 안의 `appendRow`에 `phoneNumber` 추가.
3. **배포 > 새 배포 (New Deployment)** 필수!
