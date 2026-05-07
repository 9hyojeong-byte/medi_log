/**
 * [Google Apps Script 코드] 
 * 1. 스프레드시트 -> [확장 프로그램] -> [Apps Script] 창에 이 내용을 복사해 붙여넣으세요.
 * 2. 상단의 [배포] -> [새 배포] 클릭
 * 3. 유형: "웹 앱" 선택
 * 4. 설명: "쿠쿠증상기록 API"
 * 5. 다음 사용자 버전으로 실행: "나 (본인 이메일)"
 * 6. 액세스 권한이 있는 사용자: "모든 사용자 (Anyone)" -> 중요!!
 * 7. 배포 후 생성된 "웹 앱 URL"을 복사하여 .env 파일의 VITE_GAS_URL에 넣으세요.
 */

const SHEET_NAME = 'Records';

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['id', 'isMedicated', 'hasSymptoms', 'memo', 'timestamp']);
    sheet.setFrozenRows(1); // 첫 줄 고정
  }
  return sheet;
}

function doGet(e) {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data.shift(); // 헤더 제외
  
  const json = data.map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      let val = row[i];
      // 불리언 값 복구 (시트에는 문자열이나 불리언으로 저장될 수 있음)
      if (h === 'isMedicated' || h === 'hasSymptoms') {
        val = (val === true || val === 'true' || val === 1);
      }
      obj[h] = val;
    });
    return obj;
  });
  
  return ContentService.createTextOutput(JSON.stringify(json))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  let params;
  try {
    // POST body 파싱
    params = JSON.parse(e.postData.contents);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error', 
      message: 'Invalid JSON: ' + err.message 
    })).setMimeType(ContentService.MimeType.JSON);
  }

  const sheet = getSheet();
  const action = params.action;

  if (action === 'save') {
    const record = params.record;
    const data = sheet.getDataRange().getValues();
    let foundRow = -1;
    
    // 기존 건인 경우 업데이트 (ID 기준)
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === record.id) {
        foundRow = i + 1;
        break;
      }
    }

    const rowData = [
      record.id, 
      record.isMedicated, 
      record.hasSymptoms, 
      record.memo, 
      record.timestamp
    ];

    if (foundRow > -1) {
      sheet.getRange(foundRow, 1, 1, 5).setValues([rowData]);
    } else {
      sheet.appendRow(rowData);
    }
  } else if (action === 'bulk_save') {
    const records = params.records;
    const data = sheet.getDataRange().getValues();
    const existingIds = new Map();
    for (let i = 1; i < data.length; i++) {
        existingIds.set(data[i][0], i + 1);
    }

    records.forEach(record => {
        const rowData = [
            record.id, 
            record.isMedicated, 
            record.hasSymptoms, 
            record.memo, 
            record.timestamp
        ];
        const rowNum = existingIds.get(record.id);
        if (rowNum) {
            sheet.getRange(rowNum, 1, 1, 5).setValues([rowData]);
        } else {
            sheet.appendRow(rowData);
        }
    });
  } else if (action === 'delete') {
    const id = params.id;
    const data = sheet.getDataRange().getValues();
    // 데이터 탐색 및 삭제
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === id) {
        sheet.deleteRow(i + 1);
        break;
      }
    }
  }

  // 성공 응답 (no-cors 모드에서는 브라우저가 읽지는 못하지만 서버 처리는 완료됨)
  return ContentService.createTextOutput(JSON.stringify({
    status: 'success', 
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}
