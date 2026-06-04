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
  const targetHeaders = ['id', 'type', 'isMedicated', 'hasSymptoms', 'memo', 'imageUrl', 'timestamp'];
  
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(targetHeaders);
    sheet.setFrozenRows(1);
  } else {
    // 헤더 검증 및 보정
    const currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (JSON.stringify(currentHeaders) !== JSON.stringify(targetHeaders)) {
      if (sheet.getLastColumn() < targetHeaders.length) {
        sheet.insertColumnsAfter(sheet.getLastColumn(), targetHeaders.length - sheet.getLastColumn());
      }
      sheet.getRange(1, 1, 1, targetHeaders.length).setValues([targetHeaders]);
    }
  }
  return sheet;
}

// 헬퍼 함수: 입력값을 분석하여 투약 여부 boolean값 반환
function parseIsMedicatedValue(val) {
  return val === true || val === 'true' || val === 1 || String(val).toUpperCase() === 'TRUE';
}

// 헬퍼 함수: 입력값을 분석하여 증상 여부/목록 데이터 반환 (Boolean 또는 String)
function parseHasSymptomsValue(val) {
  if (val === true || val === 'true' || val === 1 || String(val).toUpperCase() === 'TRUE') {
    return true;
  }
  if (val === false || val === 'false' || val === 0 || String(val).toUpperCase() === 'FALSE' || !val || String(val).trim() === '') {
    return false;
  }
  // 그 외의 문자열(복수 증상 텍스트: 예: "압력감, 웅웅" 등)은 그대로 반환
  return String(val);
}

function doGet(e) {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return ContentService.createTextOutput(JSON.stringify([])).setMimeType(ContentService.MimeType.JSON);
  
  const headers = data.shift();
  const json = data.map(row => {
    const obj = {};
    const fieldMapping = {
      'id': 0,
      'type': 1,
      'isMedicated': 2,
      'hasSymptoms': 3,
      'memo': 4,
      'imageUrl': 5,
      'timestamp': 6
    };
    
    Object.keys(fieldMapping).forEach(key => {
      const idx = fieldMapping[key];
      let val = row[idx] || '';
      if (key === 'isMedicated') {
        val = parseIsMedicatedValue(val);
      }
      if (key === 'hasSymptoms') {
        val = parseHasSymptomsValue(val);
      }
      if (key === 'timestamp' && val instanceof Date) {
        val = val.toISOString();
      }
      obj[key] = val;
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
          record.type || 'status',
          parseIsMedicatedValue(record.isMedicated), 
          parseHasSymptomsValue(record.hasSymptoms), 
          String(record.memo || ''), 
          record.imageUrl || '',
          record.timestamp
        ];
        const foundRow = existingIds[record.id];
        if (foundRow) {
          sheet.getRange(foundRow, 1, 1, 7).setValues([rowData]);
        } else {
          sheet.appendRow(rowData);
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
    record.type || 'status',
    parseIsMedicatedValue(record.isMedicated), 
    parseHasSymptomsValue(record.hasSymptoms), 
    String(record.memo || ''), 
    record.imageUrl || '',
    record.timestamp
  ];
  if (foundRow > -1) {
    sheet.getRange(foundRow, 1, 1, 7).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }
}
