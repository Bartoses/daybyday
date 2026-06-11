function setupDayByDay() {
  syncSpreadsheetStructure();
  logInfo('DaybyDay sheets initialized');
}

function syncSpreadsheetStructure() {
  repairSheet_('parents', APP_CONFIG.headers.parents);
  repairSheet_('kids', APP_CONFIG.headers.kids);
  repairSheet_('milestones', APP_CONFIG.headers.milestones);
  repairSheet_('questions', APP_CONFIG.headers.questions);
  repairSheet_('messages', APP_CONFIG.headers.messages);
  repairSheet_('knowledge', APP_CONFIG.headers.knowledge);
  repairConfigSheet_();
  if (typeof syncOptInSheetStructure_ === 'function') {
    syncOptInSheetStructure_();
  }
  logInfo('DaybyDay spreadsheet structure synced');
}

function getSheetByKey(sheetKey) {
  var definition = APP_CONFIG.sheets[sheetKey];
  if (!definition) {
    throw new Error('Unknown sheet key: ' + sheetKey);
  }

  var sheet = findSheetByConfig_(definition);
  if (!sheet) {
    sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(definition.primary);
  } else if (sheet.getName() !== definition.primary) {
    var primarySheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(definition.primary);
    if (!primarySheet) {
      sheet.setName(definition.primary);
    }
  }

  return sheet;
}

function findSheetByConfig_(definition) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var names = [definition.primary].concat(definition.aliases || []);
  for (var i = 0; i < names.length; i += 1) {
    var sheet = spreadsheet.getSheetByName(names[i]);
    if (sheet) {
      return sheet;
    }
  }
  return null;
}

function ensureSheetHeaders_(sheetKey, requiredHeaders) {
  var sheet = getSheetByKey(sheetKey);
  normalizeSheetHeaders_(sheetKey, sheet);
  setMissingHeaders_(sheet, requiredHeaders || []);
}

function getHeaderMap(sheet) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var map = {};
  for (var i = 0; i < headers.length; i += 1) {
    var header = cleanText(headers[i]);
    if (header && header.indexOf('__unused__') !== 0 && map[header] === undefined) {
      map[header] = i;
    }
  }
  return map;
}

function getRows(sheetKey) {
  var sheet = getSheetByKey(sheetKey);
  var data = sheet.getDataRange().getValues();
  var headers = data.length ? data[0] : [];
  var rows = [];

  for (var rowIndex = 1; rowIndex < data.length; rowIndex += 1) {
    var rowObject = {};
    for (var colIndex = 0; colIndex < headers.length; colIndex += 1) {
      var header = cleanText(headers[colIndex]);
      if (header && header.indexOf('__unused__') !== 0 && rowObject[header] === undefined) {
        rowObject[header] = data[rowIndex][colIndex];
      }
    }
    rowObject._rowNumber = rowIndex + 1;
    rows.push(rowObject);
  }

  return rows;
}

function appendRow(sheetKey, rowData) {
  var sheet = getSheetByKey(sheetKey);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var row = [];

  for (var i = 0; i < headers.length; i += 1) {
    var header = cleanText(headers[i]);
    if (!header || header.indexOf('__unused__') === 0) {
      row.push('');
      continue;
    }
    row.push(rowData[header] !== undefined ? rowData[header] : '');
  }

  sheet.appendRow(row);
  return sheet.getLastRow();
}

function updateRow(sheetKey, rowNumber, rowData) {
  var sheet = getSheetByKey(sheetKey);
  var headerMap = getHeaderMap(sheet);
  var headers = Object.keys(rowData);

  for (var i = 0; i < headers.length; i += 1) {
    var header = headers[i];
    if (headerMap[header] === undefined) {
      continue;
    }
    sheet.getRange(rowNumber, headerMap[header] + 1).setValue(rowData[header]);
  }
}

function updateRowInSheet_(sheet, rowNumber, rowData) {
  var headerMap = getHeaderMap(sheet);
  var headers = Object.keys(rowData || {});

  for (var i = 0; i < headers.length; i += 1) {
    var header = headers[i];
    if (headerMap[header] === undefined) {
      continue;
    }
    sheet.getRange(rowNumber, headerMap[header] + 1).setValue(rowData[header]);
  }
}

function findRows(sheetKey, predicate) {
  var rows = getRows(sheetKey);
  var matches = [];
  for (var i = 0; i < rows.length; i += 1) {
    if (predicate(rows[i])) {
      matches.push(rows[i]);
    }
  }
  return matches;
}

function findFirstRow(sheetKey, predicate) {
  var rows = getRows(sheetKey);
  for (var i = 0; i < rows.length; i += 1) {
    if (predicate(rows[i])) {
      return rows[i];
    }
  }
  return null;
}

function repairSheet_(sheetKey, requiredHeaders) {
  var sheet = getSheetByKey(sheetKey);
  normalizeSheetHeaders_(sheetKey, sheet);
  setMissingHeaders_(sheet, requiredHeaders || []);
  formatHeaderRow_(sheet);
}

function normalizeSheetHeaders_(sheetKey, sheet) {
  var lastColumn = Math.max(sheet.getLastColumn(), 1);
  var headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  var aliases = APP_CONFIG.headerAliases[sheetKey] || {};
  var normalized = [];
  var changed = false;
  var seen = {};

  for (var i = 0; i < headers.length; i += 1) {
    var header = cleanText(headers[i]);
    var mapped = aliases[header] || header;
    if (mapped) {
      if (seen[mapped]) {
        mapped = '__unused__' + i;
        changed = true;
      } else {
        seen[mapped] = true;
      }
    }
    if (mapped !== header) {
      changed = true;
    }
    normalized.push(mapped);
  }

  if (sheet.getLastRow() === 0) {
    changed = true;
  }

  if (changed) {
    sheet.getRange(1, 1, 1, Math.max(normalized.length, 1)).setValues([normalized.length ? normalized : ['']]);
  }
}

function setMissingHeaders_(sheet, requiredHeaders) {
  var lastColumn = Math.max(sheet.getLastColumn(), 1);
  var currentHeaders = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  var normalized = currentHeaders.map(function(header) {
    return cleanText(header);
  });
  var changed = false;

  for (var i = 0; i < requiredHeaders.length; i += 1) {
    if (normalized.indexOf(requiredHeaders[i]) === -1) {
      normalized.push(requiredHeaders[i]);
      changed = true;
    }
  }

  if (changed || sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, normalized.length).setValues([normalized]);
  }
}

function repairConfigSheet_() {
  var sheet = getSheetByKey('config');
  var lastColumn = Math.max(sheet.getLastColumn(), 2);
  var headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  var normalized = [cleanText(headers[0]) || 'Key', cleanText(headers[1]) || 'Value'];
  sheet.getRange(1, 1, 1, 2).setValues([normalized]);
  formatHeaderRow_(sheet);
}

function formatHeaderRow_(sheet) {
  var lastColumn = Math.max(sheet.getLastColumn(), 1);
  var range = sheet.getRange(1, 1, 1, lastColumn);
  range.setFontWeight('bold');
  range.setBackground('#d9e2f3');
  sheet.setFrozenRows(1);
}

function getRowByNumber_(sheetKey, rowNumber) {
  var sheet = getSheetByKey(sheetKey);
  if (!rowNumber || rowNumber < 2 || rowNumber > sheet.getLastRow()) {
    return null;
  }

  var values = sheet.getRange(rowNumber, 1, 1, sheet.getLastColumn()).getValues()[0];
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var row = {};

  for (var i = 0; i < headers.length; i += 1) {
    var header = cleanText(headers[i]);
    if (header && header.indexOf('__unused__') !== 0 && row[header] === undefined) {
      row[header] = values[i];
    }
  }

  row._rowNumber = rowNumber;
  return row;
}
