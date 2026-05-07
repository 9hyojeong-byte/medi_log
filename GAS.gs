/**
 * [Google Apps Script 업데이트 버전] 
 * 1. 이 코드를 복사하여 Apps Script 편집기(GAS.gs)의 내용을 모두 지우고 붙여넣으세요.
 * 2. 상단의 [배포] -> [배포 관리] -> [수정(연필 아이콘)] 클릭
 * 3. 버전을 "새 버전"으로 선택하고 [배포]를 다시 누르세요. (매우 중요!!)
 * 4. 권한은 "모든 사용자(Anyone)"로 유지되어야 합니다.
 */

const SHEET_NAME = 'Records';

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['id', 'isMedicated', 'hasSymptoms', 'memo', 'timestamp']);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function doGet(e) {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return ContentService.createTextOutput(JSON.stringify([])).setMimeType(ContentService.MimeType.JSON);
  
  const headers = data.shift();
  const json = data.map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      let val = row[i];
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
    params = JSON.parse(e.postData.contents);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({status: 'error', message: err.message}))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const sheet = getSheet();
  const action = params.action;

  if (action === 'save') {
    const record = params.record;
    saveRecord(sheet, record);
  } 
  else if (action === 'bulk_save') {
    const records = params.records;
    if (Array.isArray(records)) {
      const data = sheet.getDataRange().getValues();
      const existingIds = {};
      for (let i = 1; i < data.length; i++) {
        existingIds[data[i][0]] = i + 1;
      }

      records.forEach(record => {
        const rowData = [
          record.id, 
          record.isMedicated === true || record.isMedicated === 'true', 
          record.hasSymptoms === true || record.hasSymptoms === 'true', 
          record.memo || '', 
          record.timestamp
        ];
        const foundRow = existingIds[record.id];
        if (foundRow) {
          sheet.getRange(foundRow, 1, 1, 5).setValues([rowData]);
        } else {
          sheet.appendRow(rowData);
          // 새로 추가된 행도 추적 (중복 방지)
          existingIds[record.id] = sheet.getLastRow();
        }
      });
    }
  } 
  else if (action === 'delete') {
    const id = params.id;
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === id) {
        sheet.deleteRow(i + 1);
        break;
      }
    }
  }

  return ContentService.createTextOutput(JSON.stringify({status: 'success'}))
    .setMimeType(ContentService.MimeType.JSON);
}

function saveRecord(sheet, record) {
  const data = sheet.getDataRange().getValues();
  let foundRow = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === record.id) {
      foundRow = i + 1;
      break;
    }
  }
  const rowData = [
    record.id, 
    record.isMedicated === true || record.isMedicated === 'true', 
    record.hasSymptoms === true || record.hasSymptoms === 'true', 
    record.memo || '', 
    record.timestamp
  ];
  if (foundRow > -1) {
    sheet.getRange(foundRow, 1, 1, 5).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }
}
