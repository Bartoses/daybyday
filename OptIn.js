function syncOptInSheetStructure_() {
  var sheet = getOptInSheet_();
  if (!sheet) {
    return;
  }
  setMissingHeaders_(sheet, APP_CONFIG.optIn.metadataHeaders);
  formatHeaderRow_(sheet);
}

function getOptInSheet_() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  return spreadsheet ? spreadsheet.getSheetByName(APP_CONFIG.optIn.responseSheetName) : null;
}

function getOptInSheetHeaders_() {
  var sheet = getOptInSheet_();
  if (!sheet) {
    return { ok: false, sheet_name: APP_CONFIG.optIn.responseSheetName, headers: [] };
  }

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  return {
    ok: true,
    sheet_name: sheet.getName(),
    headers: headers,
    normalized_headers: headers.map(function(header) {
      return normalizeHeaderKey_(header);
    })
  };
}

function installOptInTrigger() {
  removeOptInTriggers();
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  ScriptApp.newTrigger('handleOptInFormSubmit')
    .forSpreadsheet(spreadsheet)
    .onFormSubmit()
    .create();
  logInfo('Installed opt-in form trigger', {
    handler: 'handleOptInFormSubmit',
    sheet_name: APP_CONFIG.optIn.responseSheetName
  });
}

function removeOptInTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i += 1) {
    var trigger = triggers[i];
    if (trigger.getHandlerFunction() === 'handleOptInFormSubmit') {
      ScriptApp.deleteTrigger(trigger);
    }
  }
  logInfo('Removed existing opt-in triggers');
}

function handleOptInFormSubmit(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    setupDayByDay();
    var rowData = buildOptInRowDataFromEvent_(e);
    var result = processOptInRow(rowData);
    logInfo('Opt-in form submission processed', result);
    return result;
  } catch (error) {
    logError('Opt-in form submission failed', error, {
      row_number: e && e.range ? e.range.getRow() : ''
    });

    try {
      var failedRowData = buildOptInRowDataFromEvent_(e);
      markOptInRowResult_(failedRowData, {
        processing_status: 'failed',
        processed_at: nowIsoString(),
        processing_notes: error.message || String(error),
        welcome_sms_status: 'failed'
      });
    } catch (secondaryError) {
      logError('Failed to persist opt-in failure state', secondaryError);
    }

    throw error;
  } finally {
    lock.releaseLock();
  }
}

function processPendingOptInRows(limit) {
  setupDayByDay();
  var sheet = getOptInSheet_();
  if (!sheet) {
    throw new Error('Opt In sheet not found: ' + APP_CONFIG.optIn.responseSheetName);
  }

  var values = sheet.getDataRange().getValues();
  if (values.length <= 1) {
    return [];
  }

  var results = [];
  var max = Number(limit || 0);
  for (var rowNumber = 2; rowNumber <= values.length; rowNumber += 1) {
    var rowData = buildOptInRowDataFromSheetRow_(sheet, rowNumber);
    if (cleanText(rowData.processing_status) === 'processed') {
      continue;
    }
    results.push(processOptInRow(rowData));
    if (max > 0 && results.length >= max) {
      break;
    }
  }

  return results;
}

function processOptInRow(rowData) {
  if (!rowData) {
    throw new Error('Missing opt-in row data');
  }

  logInfo('Opt-in row received', {
    row_number: rowData._rowNumber || '',
    sheet_name: rowData._sheetName || '',
    raw_headers: Object.keys(rowData.values || {})
  });
  logInfo('Opt-in headers mapped', { mapped_headers: rowData._normalizedHeaders || {} });

  if (cleanText(rowData.processing_status) === 'processed') {
    logInfo('Opt-in row already processed', { row_number: rowData._rowNumber || '' });
    return {
      ok: true,
      status: 'already_processed',
      row_number: rowData._rowNumber || '',
      parent_id: cleanText(rowData.parent_id)
    };
  }

  var normalizedPhone = extractParentPhoneFromOptIn_(rowData);
  if (!normalizedPhone) {
    logWarn('Opt-in phone rejected', { row_number: rowData._rowNumber || '' });
    markOptInRowResult_(rowData, {
      normalized_phone: '',
      processing_status: 'rejected',
      processed_at: nowIsoString(),
      processing_notes: 'Invalid phone number',
      welcome_sms_status: 'skipped_invalid_phone'
    });
    return { ok: false, status: 'invalid_phone', row_number: rowData._rowNumber || '' };
  }
  logInfo('Opt-in phone normalized', {
    row_number: rowData._rowNumber || '',
    normalized_phone: normalizedPhone
  });

  if (!hasValidOptInConsent_(rowData)) {
    logWarn('Opt-in consent missing', {
      row_number: rowData._rowNumber || '',
      normalized_phone: normalizedPhone
    });
    markOptInRowResult_(rowData, {
      normalized_phone: normalizedPhone,
      processing_status: 'rejected',
      processed_at: nowIsoString(),
      processing_notes: 'Missing SMS consent',
      welcome_sms_status: 'skipped_missing_consent'
    });
    return { ok: false, status: 'missing_consent', row_number: rowData._rowNumber || '' };
  }

  var children = extractChildrenFromOptIn(rowData);
  if (!children.length) {
    logWarn('Opt-in has no valid children', {
      row_number: rowData._rowNumber || '',
      normalized_phone: normalizedPhone
    });
    markOptInRowResult_(rowData, {
      normalized_phone: normalizedPhone,
      processing_status: 'rejected',
      processed_at: nowIsoString(),
      processing_notes: 'No valid child name + birthdate pairs',
      welcome_sms_status: 'skipped_no_valid_children'
    });
    return { ok: false, status: 'no_valid_children', row_number: rowData._rowNumber || '' };
  }

  var parent = upsertParentFromOptIn(rowData);
  var childResults = [];
  for (var i = 0; i < children.length; i += 1) {
    childResults.push(upsertChildForParent(parent, children[i]));
  }

  logInfo('Parent included in daily send eligibility', {
    parent_id: parent.parent_id,
    eligible: !!getActiveChildrenForParent(parent.parent_phone, parent.parent_id).length
  });

  var welcomeStatus = maybeSendOptInWelcomeSms_(parent);
  var refreshedParent = getParentById(parent.parent_id);
  markOptInRowResult_(rowData, {
    normalized_phone: normalizedPhone,
    processing_status: 'processed',
    processed_at: nowIsoString(),
    processing_notes: 'Processed successfully',
    parent_id: refreshedParent.parent_id,
    child_ids: childResults.map(function(item) { return item.child_id; }).join(','),
    welcome_sms_status: welcomeStatus.status
  });

  return {
    ok: true,
    status: 'processed',
    row_number: rowData._rowNumber || '',
    normalized_phone: normalizedPhone,
    parent_id: refreshedParent.parent_id,
    child_ids: childResults.map(function(item) { return item.child_id; }),
    child_count: childResults.length,
    welcome_sms_status: welcomeStatus.status
  };
}

function upsertParentFromOptIn(rowData) {
  var normalizedPhone = extractParentPhoneFromOptIn_(rowData);
  var parentName = extractParentNameFromOptIn_(rowData);
  var optInTimestamp = extractOptInTimestamp_(rowData);
  var existing = getParentByPhone(normalizedPhone);
  var payload = {
    parent_name: parentName,
    parent_phone: normalizedPhone,
    phone: normalizedPhone,
    timezone: getDefaultTimezone(),
    sms_opt_in: true,
    active: true,
    status: APP_CONFIG.deliveryStatuses.ACTIVE,
    onboarding_step: APP_CONFIG.onboardingSteps.ONBOARDED,
    opt_in_source: 'google_form',
    opt_in_method: 'website_form',
    opt_in_form_url: APP_CONFIG.optIn.formUrl,
    opt_in_response_sheet: rowData._sheetName || APP_CONFIG.optIn.responseSheetName,
    opt_in_timestamp: optInTimestamp,
    form_submission_timestamp: optInTimestamp,
    sms_consent_text: extractConsentTextFromOptIn_(rowData),
    last_opt_in_processed_at: nowIsoString(),
    last_opt_in_row: rowData._rowNumber || '',
    last_opt_in_status: 'processed'
  };

  if (existing) {
    logInfo('Updated existing parent from opt-in', {
      parent_id: existing.parent_id,
      normalized_phone: normalizedPhone
    });
    return updateParent(existing.parent_id, payload);
  }

  logInfo('Created parent from opt-in', { normalized_phone: normalizedPhone });
  return createParent(payload);
}

function extractChildrenFromOptIn(rowData) {
  var slots = {
    1: {},
    2: {},
    3: {}
  };
  var values = rowData.values || {};
  var headers = Object.keys(values);
  var fallbackNameSet = false;
  var fallbackBirthdateSet = false;

  for (var i = 0; i < headers.length; i += 1) {
    var header = headers[i];
    var normalizedHeader = normalizeHeaderKey_(header);
    var slot = extractChildSlotFromHeader_(normalizedHeader);
    if (!slot && isChildNameHeader_(normalizedHeader) && !fallbackNameSet) {
      slot = 1;
      fallbackNameSet = true;
    } else if (!slot && isChildBirthdateHeader_(normalizedHeader) && !fallbackBirthdateSet) {
      slot = 1;
      fallbackBirthdateSet = true;
    }

    if (!slot || slot < 1 || slot > 3) {
      continue;
    }

    if (isChildNameHeader_(normalizedHeader)) {
      slots[slot].child_name = cleanText(values[header]);
    } else if (isChildBirthdateHeader_(normalizedHeader)) {
      slots[slot].birthdate = cleanText(values[header]);
    }
  }

  var children = [];
  for (var slotNumber = 1; slotNumber <= 3; slotNumber += 1) {
    var child = slots[slotNumber];
    var name = toNameCase(child.child_name || '');
    var birthdateText = cleanText(child.birthdate);
    if (!name && !birthdateText) {
      continue;
    }
    if (!name || !birthdateText) {
      logWarn('Partial child row skipped', {
        row_number: rowData._rowNumber || '',
        slot: slotNumber,
        child_name: name,
        birthdate: birthdateText
      });
      continue;
    }

    var parsedBirthdate = parseDateInput(birthdateText);
    if (!parsedBirthdate) {
      logWarn('Child birthdate invalid, skipped', {
        row_number: rowData._rowNumber || '',
        slot: slotNumber,
        child_name: name,
        birthdate: birthdateText
      });
      continue;
    }

    children.push({
      child_name: name,
      birthdate: dateToStorageString(parsedBirthdate),
      status: 'active',
      enrollment_source: 'google_form',
      opt_in_timestamp: extractOptInTimestamp_(rowData),
      active: true
    });
  }

  return children;
}

function upsertChildForParent(parentRecord, childData) {
  var existing = findExistingKid(parentRecord.parent_id, childData);
  if (existing) {
    var updated = updateKid(existing.child_id || existing.kid_id, {
      child_name: childData.child_name,
      birthdate: childData.birthdate,
      status: 'active',
      enrollment_source: 'google_form',
      opt_in_timestamp: childData.opt_in_timestamp,
      active: true
    });
    logInfo('Updated child from opt-in', {
      parent_id: parentRecord.parent_id,
      child_id: updated.child_id,
      child_name: updated.child_name
    });
    return updated;
  }

  var created = createKid(parentRecord.parent_id, childData);
  logInfo('Created child from opt-in', {
    parent_id: parentRecord.parent_id,
    child_id: created.child_id,
    child_name: created.child_name
  });
  return created;
}

function maybeSendOptInWelcomeSms_(parent) {
  if (!shouldSendOptInWelcomeSms_(parent)) {
    logInfo('Welcome SMS skipped', {
      parent_id: parent.parent_id,
      reason: 'cooldown_active'
    });
    return { ok: true, status: 'skipped_recent_welcome' };
  }

  try {
    sendSmsMessage(parent.parent_id, parent.parent_phone, APP_CONFIG.optIn.welcomeMessage, APP_CONFIG.messageKinds.welcome);
    updateParent(parent.parent_id, { welcome_sms_sent_at: nowIsoString() });
    logInfo('Welcome SMS sent', { parent_id: parent.parent_id });
    return { ok: true, status: 'sent' };
  } catch (error) {
    logError('Welcome SMS failed', error, { parent_id: parent.parent_id });
    return { ok: false, status: 'failed', error: error.message || String(error) };
  }
}

function shouldSendOptInWelcomeSms_(parent) {
  var lastSent = cleanText(parent.welcome_sms_sent_at);
  if (!lastSent) {
    return true;
  }

  var parsed = parseDateInput(lastSent);
  if (!parsed) {
    return true;
  }

  var elapsedHours = (new Date().getTime() - parsed.getTime()) / (60 * 60 * 1000);
  return elapsedHours >= Number(APP_CONFIG.optIn.welcomeCooldownHours || 12);
}

function buildOptInRowDataFromEvent_(e) {
  if (e && e.range) {
    return buildOptInRowDataFromSheetRow_(e.range.getSheet(), e.range.getRow());
  }
  if (e && e.namedValues) {
    return buildOptInRowDataFromValues_(flattenNamedValues_(e.namedValues), null, 0);
  }
  throw new Error('Unsupported opt-in form submit event payload');
}

function buildOptInRowDataFromSheetRow_(sheet, rowNumber) {
  var headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var values = sheet.getRange(rowNumber, 1, 1, sheet.getLastColumn()).getValues()[0];
  var raw = {};

  for (var i = 0; i < headerRow.length; i += 1) {
    if (cleanText(headerRow[i])) {
      raw[String(headerRow[i])] = values[i];
    }
  }

  return buildOptInRowDataFromValues_(raw, sheet, rowNumber);
}

function buildOptInRowDataFromValues_(values, sheet, rowNumber) {
  var data = {
    values: values || {},
    _rowNumber: rowNumber || '',
    _sheetName: sheet ? sheet.getName() : APP_CONFIG.optIn.responseSheetName,
    _normalizedHeaders: {}
  };
  var headers = Object.keys(values || {});
  for (var i = 0; i < headers.length; i += 1) {
    data._normalizedHeaders[headers[i]] = normalizeHeaderKey_(headers[i]);
    data[cleanText(headers[i])] = values[headers[i]];
  }
  return data;
}

function flattenNamedValues_(namedValues) {
  var flattened = {};
  var keys = Object.keys(namedValues || {});
  for (var i = 0; i < keys.length; i += 1) {
    var value = namedValues[keys[i]];
    flattened[keys[i]] = Object.prototype.toString.call(value) === '[object Array]' ? value.join(', ') : value;
  }
  return flattened;
}

function extractParentPhoneFromOptIn_(rowData) {
  var phone = getOptInValueByAliases_(rowData, [
    'mobile phone number for sms messages',
    'mobile phone number',
    'phone number',
    'mobile phone',
    'phone'
  ]);
  return normalizePhone(phone);
}

function extractParentNameFromOptIn_(rowData) {
  return toNameCase(getOptInValueByAliases_(rowData, [
    'your first name',
    'parent first name',
    'first name'
  ]));
}

function extractConsentTextFromOptIn_(rowData) {
  var raw = extractRawConsentValueFromOptIn_(rowData);
  return cleanText(raw) || APP_CONFIG.optIn.defaultConsentText;
}

function extractRawConsentValueFromOptIn_(rowData) {
  return getOptInValueByAliases_(rowData, [
    'sms consent',
    'consent',
    'sms opt in',
    'sms consent text'
  ]);
}

function extractOptInTimestamp_(rowData) {
  var timestamp = getOptInValueByAliases_(rowData, ['timestamp', 'submission time', 'submitted at']);
  return toIsoTimestamp_(timestamp) || nowIsoString();
}

function hasValidOptInConsent_(rowData) {
  var raw = cleanText(extractRawConsentValueFromOptIn_(rowData)).toLowerCase();
  if (!raw) {
    return false;
  }
  return raw === 'true' ||
    raw === 'yes' ||
    raw === 'checked' ||
    raw.indexOf('agree') !== -1 ||
    raw.indexOf('consent') !== -1;
}

function getOptInValueByAliases_(rowData, aliases) {
  var values = rowData.values || {};
  var headers = Object.keys(values);
  var normalizedAliases = (aliases || []).map(function(alias) {
    return normalizeHeaderKey_(alias);
  });

  for (var i = 0; i < headers.length; i += 1) {
    var normalizedHeader = normalizeHeaderKey_(headers[i]);
    for (var j = 0; j < normalizedAliases.length; j += 1) {
      if (normalizedHeader === normalizedAliases[j]) {
        return values[headers[i]];
      }
    }
  }

  for (var headerIndex = 0; headerIndex < headers.length; headerIndex += 1) {
    var fuzzyHeader = normalizeHeaderKey_(headers[headerIndex]);
    for (var aliasIndex = 0; aliasIndex < normalizedAliases.length; aliasIndex += 1) {
      if (fuzzyHeader.indexOf(normalizedAliases[aliasIndex]) !== -1 ||
          normalizedAliases[aliasIndex].indexOf(fuzzyHeader) !== -1) {
        return values[headers[headerIndex]];
      }
    }
  }

  return '';
}

function extractChildSlotFromHeader_(normalizedHeader) {
  var match = normalizedHeader.match(/\bchild\s*([123])\b/) || normalizedHeader.match(/\bkid\s*([123])\b/);
  return match ? Number(match[1]) : 0;
}

function isChildNameHeader_(normalizedHeader) {
  return (normalizedHeader.indexOf('child') !== -1 || normalizedHeader.indexOf('kid') !== -1) &&
    normalizedHeader.indexOf('name') !== -1;
}

function isChildBirthdateHeader_(normalizedHeader) {
  return (normalizedHeader.indexOf('child') !== -1 || normalizedHeader.indexOf('kid') !== -1) &&
    (
      normalizedHeader.indexOf('birthdate') !== -1 ||
      normalizedHeader.indexOf('birth date') !== -1 ||
      normalizedHeader.indexOf('date of birth') !== -1 ||
      normalizedHeader.indexOf('dob') !== -1
    );
}

function markOptInRowResult_(rowData, updates) {
  if (!rowData || !rowData._rowNumber) {
    return;
  }
  var sheet = getOptInSheet_();
  if (!sheet || sheet.getName() !== rowData._sheetName) {
    sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(rowData._sheetName);
  }
  if (!sheet) {
    return;
  }

  syncOptInSheetStructure_();
  updateRowInSheet_(sheet, rowData._rowNumber, updates);
}
