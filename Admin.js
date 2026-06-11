function setupAll() {
  setupDayByDay();

  if (!getKnowledgeRows().length) {
    generateKnowledgeDataset();
  }

  var docTemplateId = getConfigValue(APP_CONFIG.properties.docTemplateId, '');
  var docResult;
  if (docTemplateId) {
    docResult = validateDocTemplate(docTemplateId);
    if (!docResult.ok) {
      throw new Error('Existing doc template is missing placeholders: ' + docResult.missing_placeholders.join(', '));
    }
  } else {
    docResult = setupDocTemplate();
  }

  installDailyTrigger();
  installOptInTrigger();

  var result = {
    ok: true,
    spreadsheet_ready: true,
    doc_template: docResult,
    daily_trigger_hour: getDailySendHour(),
    opt_in_trigger_handler: 'handleOptInFormSubmit'
  };

  logInfo('Completed setupAll', result);
  return result;
}

function validateSetup() {
  var docTemplateId = getConfigValue(APP_CONFIG.properties.docTemplateId, '');
  var docValidation = docTemplateId
    ? validateDocTemplate(docTemplateId)
    : { ok: false, document_id: '', url: '', missing_placeholders: ['DOC_TEMPLATE_ID not set'] };

  var triggers = ScriptApp.getProjectTriggers();
  var hasDailyTrigger = false;
  var hasOptInTrigger = false;
  for (var i = 0; i < triggers.length; i += 1) {
    if (triggers[i].getHandlerFunction() === 'sendDailyMessages') {
      hasDailyTrigger = true;
    }
    if (triggers[i].getHandlerFunction() === 'handleOptInFormSubmit') {
      hasOptInTrigger = true;
    }
  }

  return {
    ok: docValidation.ok && hasDailyTrigger && hasOptInTrigger && getKnowledgeRows().length > 0,
    sheets_checked: true,
    knowledge_rows: getKnowledgeRows().length,
    doc_template: docValidation,
    has_daily_trigger: hasDailyTrigger,
    has_opt_in_trigger: hasOptInTrigger
  };
}

function testStartOnboarding(phoneNumber) {
  var phone = normalizePhone(phoneNumber);
  if (!phone) {
    throw new Error('A valid phone number is required');
  }
  handleStart(phone);
  return getParentByPhone(phone);
}

function testStartOnboardingMe() {
  return testStartOnboarding('+18777804236');
}

function testIncomingSms(phoneNumber, messageBody) {
  var phone = normalizePhone(phoneNumber);
  if (!phone) {
    throw new Error('A valid phone number is required');
  }
  handleUserReply(phone, cleanText(messageBody));
  return getParentByPhone(phone);
}

function testIncomingWebhookSms(phoneNumber, messageBody) {
  var phone = normalizePhone(phoneNumber);
  if (!phone) {
    throw new Error('A valid phone number is required');
  }
  handleIncomingSmsWebhook_({
    parameter: {
      From: phone,
      Body: cleanText(messageBody)
    }
  });
  return getParentByPhone(phone);
}

function testIncomingWebhookStartMe() {
  return testIncomingWebhookSms('+18777804236', 'START');
}

function testDailyMessageForParent(parentId) {
  var parent = getParentById(parentId);
  if (!parent) {
    throw new Error('Parent not found: ' + parentId);
  }
  processDailyMessageForParent_(parent);
  return {
    ok: true,
    parent_id: parent.parent_id
  };
}

function testBuildDailyPreview(parentId) {
  var parent = getParentById(parentId);
  if (!parent) {
    throw new Error('Parent not found: ' + parentId);
  }

  var children = getRenderableActiveChildrenForParent(parent.parent_phone, parent.parent_id);
  if (!children.length) {
    throw new Error('No active children found for parent: ' + parent.parent_id);
  }

  var selection = selectNextChildForDaily_(parent, children);
  var guides = buildGuidesForParent_(parent, children, new Date());
  var featuredGuide = findGuideForChild_(guides, selection.child.child_id) || guides[0];
  var extras = chooseDailyExtras_(parent, selection.child, featuredGuide, new Date());
  var parts = buildDailyMessagePartsFromGuides(parent, guides, extras);

  return {
    parent_id: parent.parent_id,
    child_count: children.length,
    featured_child_id: selection.child.child_id,
    featured_child_name: selection.child.child_name,
    guides: guides,
    extras: extras,
    preview_message: parts.join('\n\n---\n\n'),
    message_parts: parts
  };
}

function logPreviewSummary_(label, summary) {
  Logger.log('[TEST] ' + label + ' summary: ' + JSON.stringify(summary, null, 2));
  Logger.log('[TEST] ' + label + ' message:\n' + (summary && summary.preview_message ? summary.preview_message : ''));
}

function logValidationSummary_(label, result) {
  Logger.log('[TEST] ' + label + ' validation: ' + JSON.stringify(result, null, 2));
}

function logParentState_(label, parent) {
  Logger.log('[TEST] ' + label + ' parent state: ' + JSON.stringify(parent || {}, null, 2));
}

function testLogDailyPreview(parentId) {
  var preview = testBuildDailyPreview(parentId);
  for (var i = 0; i < preview.message_parts.length; i += 1) {
    Logger.log(JSON.stringify(preview.message_parts[i]));
    Logger.log(preview.message_parts[i]);
  }
  return preview;
}

function summarizeOutboundPreview(parentId, requestType, requestedCategory) {
  var parent = getParentById(parentId);
  if (!parent) {
    throw new Error('Parent not found: ' + parentId);
  }

  var children = getRenderableActiveChildrenForParent(parent.parent_phone, parent.parent_id);
  if (!children.length) {
    throw new Error('No active children found for parent: ' + parent.parent_id);
  }

  var today = new Date();
  var resolvedRequestType = requestType || 'daily';
  var resolvedCategory = requestedCategory || getCategoryFamilyForRequest_(resolvedRequestType, parent, today);
  var payloads = buildChildPayloadsForParent_(parent, children, today, resolvedRequestType, resolvedCategory, {
    responseType: resolvedRequestType === 'daily' ? 'daily' : 'followup',
    requestedCategory: resolvedCategory
  });
  var parts = buildFamilyMessagePartsFromPayloads_(parent, payloads, {
    mode: resolvedRequestType === 'daily' ? 'daily' : 'followup',
    responseType: resolvedRequestType === 'daily' ? 'daily' : 'followup',
    requestType: resolvedRequestType,
    requestedCategory: resolvedCategory,
    includeGreeting: resolvedRequestType === 'daily',
    includeOptOut: resolvedRequestType === 'daily',
    includeMenu: true
  });

  return {
    parent_id: parent.parent_id,
    request_type: resolvedRequestType,
    requested_category: resolvedCategory,
    child_count: payloads.length,
    child_ids: payloads.map(function(payload) { return payload.childId; }),
    child_names: payloads.map(function(payload) { return payload.childName; }),
    tip_ids: payloads.map(function(payload) { return payload.selectedTip.tip_id; }),
    part_count: parts.length,
    message_parts: parts,
    preview_message: parts.join('\n\n---\n\n')
  };
}

function validateOutboundStructure(parentId, requestType, requestedCategory) {
  var summary = summarizeOutboundPreview(parentId, requestType, requestedCategory);
  var fullText = summary.message_parts.join('\n\n');
  var childCounts = {};

  for (var i = 0; i < summary.child_names.length; i += 1) {
    var name = summary.child_names[i];
    childCounts[name] = countSubstring_(fullText, 'Today with ' + name);
  }

  return {
    parent_id: summary.parent_id,
    request_type: summary.request_type,
    requested_category: summary.requested_category,
    child_count: summary.child_count,
    child_block_counts: childCounts,
    menu_count: countSubstring_(fullText, 'Next\n1 = Another tip'),
    opt_out_count: countSubstring_(fullText, 'Text STOP or OPT OUT anytime to unsubscribe.'),
    part_count: summary.part_count,
    ok: Object.keys(childCounts).every(function(name) {
      return childCounts[name] === 1;
    }) &&
      countSubstring_(fullText, 'Next\n1 = Another tip') === 1 &&
      (summary.request_type === 'daily'
        ? countSubstring_(fullText, 'Text STOP or OPT OUT anytime to unsubscribe.') === 1
        : countSubstring_(fullText, 'Text STOP or OPT OUT anytime to unsubscribe.') === 0)
  };
}

function testPreviewSeanArabellaMiles() {
  var summary = summarizeOutboundPreview('par_6c00148cefbe', 'daily');
  logPreviewSummary_('Daily preview', summary);
  return summary;
}

function validateSeanArabellaMilesDaily() {
  var result = validateOutboundStructure('par_6c00148cefbe', 'daily');
  logValidationSummary_('Daily structure', result);
  return result;
}

function validateSeanArabellaMilesAnotherTip() {
  var summary = summarizeOutboundPreview('par_6c00148cefbe', 'another_tip');
  var result = validateOutboundStructure('par_6c00148cefbe', 'another_tip');
  logPreviewSummary_('Another tip preview', summary);
  logValidationSummary_('Another tip structure', result);
  return result;
}

function validateSeanArabellaMilesFeeding() {
  var summary = summarizeOutboundPreview('par_6c00148cefbe', 'feeding', 'feeding');
  var result = validateOutboundStructure('par_6c00148cefbe', 'feeding', 'feeding');
  logPreviewSummary_('Feeding preview', summary);
  logValidationSummary_('Feeding structure', result);
  return result;
}

function sendSeanArabellaMilesDailyTest() {
  var parentId = 'par_6c00148cefbe';
  var preview = summarizeOutboundPreview(parentId, 'daily');
  Logger.log('[TEST] About to send daily test message for parent ' + parentId);
  logPreviewSummary_('Daily send preview before send', preview);
  return testDailyMessageForParent(parentId);
}

function runAllSeanArabellaMilesChecks() {
  var parentId = 'par_6c00148cefbe';
  var results = {
    daily: validateOutboundStructure(parentId, 'daily'),
    another_tip: validateOutboundStructure(parentId, 'another_tip'),
    feeding: validateOutboundStructure(parentId, 'feeding', 'feeding')
  };

  Logger.log('[TEST] Combined outbound validation results: ' + JSON.stringify(results, null, 2));

  return {
    parent_id: parentId,
    ok: results.daily.ok && results.another_tip.ok && results.feeding.ok,
    daily: results.daily,
    another_tip: results.another_tip,
    feeding: results.feeding
  };
}

function previewAllSeanArabellaMilesMessages() {
  var parentId = 'par_6c00148cefbe';
  var previews = {
    daily: summarizeOutboundPreview(parentId, 'daily'),
    another_tip: summarizeOutboundPreview(parentId, 'another_tip'),
    feeding: summarizeOutboundPreview(parentId, 'feeding', 'feeding')
  };

  logPreviewSummary_('Daily preview', previews.daily);
  logPreviewSummary_('Another tip preview', previews.another_tip);
  logPreviewSummary_('Feeding preview', previews.feeding);

  return previews;
}

function testGoogleFormOptInSeanArabellaMiles() {
  var result = testProcessOptInRow({
    'Your First Name': 'Sean',
    'Mobile Phone Number (for SMS messages)': '(877) 780-4236',
    'SMS Consent': APP_CONFIG.optIn.defaultConsentText,
    'Child 1 Name': 'Arabella',
    'Child 1 Birthdate': '05/20/2024',
    'Child 2 Name': 'Miles',
    'Child 2 Birthdate': '02/26/2026'
  });
  var parent = getParentById(result.parent_id);
  logParentState_('Google Form opt-in', parent);
  Logger.log('[TEST] Expected opt-in confirmation message:\n' + APP_CONFIG.optIn.welcomeMessage);
  Logger.log('[TEST] Opt-in welcome status: ' + JSON.stringify({
    parent_id: result.parent_id || '',
    welcome_sms_status: result.welcome_sms_status || ''
  }, null, 2));
  return result;
}

function testTextStartSeanArabellaMiles() {
  var parent = testIncomingWebhookSms('+18777804236', 'START');
  logParentState_('START flow', parent);
  return parent;
}

function testMenuReplySeanArabellaMiles(replyText) {
  var reply = cleanText(replyText || '1');
  var parent = getParentByPhone('+18777804236');
  if (!parent) {
    throw new Error('Parent not found for Sean/Arabella/Miles test phone');
  }

  var requestType = resolveReplyRequestType_(reply);
  var requestedCategory = getCategoryFamilyForRequest_(requestType, parent, new Date());
  var preview = summarizeOutboundPreview(parent.parent_id, requestType, requestedCategory);
  Logger.log('[TEST] Reply text: ' + reply);
  logPreviewSummary_('Reply preview', preview);

  var result = testIncomingWebhookSms(parent.parent_phone, reply);
  logParentState_('Reply result', result);
  return {
    reply: reply,
    preview: preview,
    parent: result
  };
}

function testAllSeanArabellaMilesFlows() {
  var formResult = testGoogleFormOptInSeanArabellaMiles();
  var dailyValidation = validateSeanArabellaMilesDaily();
  var anotherTipValidation = validateSeanArabellaMilesAnotherTip();
  var feedingValidation = validateSeanArabellaMilesFeeding();
  var previews = previewAllSeanArabellaMilesMessages();

  Logger.log('[TEST] End-to-end flow summary: ' + JSON.stringify({
    form_result: formResult,
    daily_validation: dailyValidation,
    another_tip_validation: anotherTipValidation,
    feeding_validation: feedingValidation
  }, null, 2));

  return {
    form_result: formResult,
    previews: previews,
    daily_validation: dailyValidation,
    another_tip_validation: anotherTipValidation,
    feeding_validation: feedingValidation
  };
}

function countSubstring_(text, needle) {
  if (!needle) {
    return 0;
  }
  var matches = String(text || '').match(new RegExp(escapeRegExp_(needle), 'g'));
  return matches ? matches.length : 0;
}

function escapeRegExp_(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function inspectOptInHeaders() {
  return getOptInSheetHeaders_();
}

function processPendingOptIns(limit) {
  return processPendingOptInRows(limit);
}

function testProcessOptInRow(sampleOverrides) {
  var sample = {
    'Timestamp': '2026-03-20 09:15:00',
    'Your First Name': 'Taylor',
    'Mobile Phone Number (for SMS messages)': '(555) 123-4567',
    'SMS Consent': APP_CONFIG.optIn.defaultConsentText,
    'Child 1 Name': 'Avery',
    'Child 1 Birthdate': '01/15/2024',
    'Child 2 Name': '',
    'Child 2 Birthdate': '',
    'Child 3 Name': '',
    'Child 3 Birthdate': ''
  };
  var keys = Object.keys(sampleOverrides || {});
  for (var i = 0; i < keys.length; i += 1) {
    sample[keys[i]] = sampleOverrides[keys[i]];
  }
  return processOptInRow(buildOptInRowDataFromValues_(sample, null, 0));
}

function previewKnowledgeHeaderMigration() {
  var sheet = getSheetByKey('knowledge');
  var values = sheet.getDataRange().getValues();
  var headers = values.length ? values[0].map(function(header) {
    return cleanText(header);
  }) : [];
  var canonicalHeaders = getCanonicalKnowledgeMigrationHeaders_();
  var orderedHeaders = buildOrderedKnowledgeHeaders_(headers, canonicalHeaders);
  var missing = [];

  for (var i = 0; i < canonicalHeaders.length; i += 1) {
    if (headers.indexOf(canonicalHeaders[i]) === -1) {
      missing.push(canonicalHeaders[i]);
    }
  }

  return {
    ok: true,
    existing_headers: headers,
    canonical_headers: canonicalHeaders,
    ordered_headers: orderedHeaders,
    canonical_header_csv: canonicalHeaders.join(','),
    missing_headers: missing,
    needs_migration: missing.length > 0 || headersDiffer_(headers, orderedHeaders)
  };
}

function migrateKnowledgeSheetToCanonicalHeaders() {
  var sheet = getSheetByKey('knowledge');
  var values = sheet.getDataRange().getValues();
  var canonicalHeaders = getCanonicalKnowledgeMigrationHeaders_();
  var existingHeaders = values.length ? values[0].map(function(header) {
    return cleanText(header);
  }) : [];
  var finalHeaders = buildOrderedKnowledgeHeaders_(existingHeaders, canonicalHeaders);
  var i;

  if (!finalHeaders.length) {
    finalHeaders = canonicalHeaders.slice();
  }

  if (!values.length) {
    sheet.getRange(1, 1, 1, finalHeaders.length).setValues([finalHeaders]);
    formatHeaderRow_(sheet);
    return {
      ok: true,
      rows_updated: 0,
      headers_added: finalHeaders,
      final_headers: finalHeaders
    };
  }

  if (finalHeaders.length !== existingHeaders.length || headersDiffer_(existingHeaders, finalHeaders)) {
    sheet.getRange(1, 1, 1, finalHeaders.length).setValues([finalHeaders]);
  }

  var headerMap = {};
  for (i = 0; i < finalHeaders.length; i += 1) {
    headerMap[finalHeaders[i]] = i;
  }

  var migratedValues = [];
  var rowsUpdated = 0;
  for (var rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
    var row = padRowToLength_(values[rowIndex], finalHeaders.length);
    var rowObject = {};
    for (i = 0; i < existingHeaders.length; i += 1) {
      rowObject[existingHeaders[i]] = values[rowIndex][i];
    }

    var canonicalData = buildCanonicalKnowledgeMigrationRow_(rowObject, rowIndex);
    var changed = false;
    var keys = Object.keys(canonicalData);
    for (i = 0; i < keys.length; i += 1) {
      var key = keys[i];
      var targetIndex = headerMap[key];
      if (targetIndex === undefined) {
        continue;
      }
      if (row[targetIndex] === '' || row[targetIndex] === null || row[targetIndex] === undefined) {
        row[targetIndex] = canonicalData[key];
        changed = true;
      }
    }

    if (changed) {
      rowsUpdated += 1;
    }
    migratedValues.push(row);
  }

  if (migratedValues.length) {
    sheet.getRange(2, 1, migratedValues.length, finalHeaders.length).setValues(migratedValues);
  }

  formatHeaderRow_(sheet);
  logInfo('Knowledge sheet migrated to canonical headers', {
    rows_updated: rowsUpdated,
    headers_count: finalHeaders.length
  });

  return {
    ok: true,
    rows_updated: rowsUpdated,
    headers_added: canonicalHeaders.filter(function(header) {
      return existingHeaders.indexOf(header) === -1;
    }),
    final_headers: finalHeaders
  };
}

function getCanonicalKnowledgeMigrationHeaders_() {
  return [
    'tip_id',
    'child_age_days_min',
    'child_age_days_max',
    'child_age_stage',
    'developmental_leap_phase',
    'category',
    'subcategory',
    'development_focus',
    'insight_title',
    'insight_explanation',
    'action_tip',
    'parent_reassurance',
    'common_parent_misunderstanding',
    'signs_of_healthy_development',
    'when_to_consult_doctor',
    'sms_tip',
    'follow_up_prompt',
    'rotation_group',
    'priority_weight',
    'active'
  ];
}

function buildOrderedKnowledgeHeaders_(existingHeaders, canonicalHeaders) {
  var finalHeaders = canonicalHeaders.slice();
  var existing = existingHeaders || [];
  for (var i = 0; i < existing.length; i += 1) {
    var header = cleanText(existing[i]);
    if (!header) {
      continue;
    }
    if (finalHeaders.indexOf(header) === -1) {
      finalHeaders.push(header);
    }
  }
  return finalHeaders;
}

function buildCanonicalKnowledgeMigrationRow_(rowObject, rowIndex) {
  var normalizedHeaders = {};
  var keys = Object.keys(rowObject || {});
  for (var i = 0; i < keys.length; i += 1) {
    normalizedHeaders[String(keys[i]).toLowerCase()] = rowObject[keys[i]];
  }

  var ageMin = Number(firstDefinedValue_(normalizedHeaders, ['child_age_days_min', 'age_min_days', 'min_age_days']) || 0);
  var ageMax = Number(firstDefinedValue_(normalizedHeaders, ['child_age_days_max', 'age_max_days', 'max_age_days']) || 99999);
  var rawCategory = firstDefinedValue_(normalizedHeaders, ['category', 'topic']) || '';
  var category = canonicalizeTopic_(rawCategory);
  var insight = cleanText(firstDefinedValue_(normalizedHeaders, ['insight_explanation', 'insight', 'summary']));
  var action = cleanText(firstDefinedValue_(normalizedHeaders, ['action_tip', 'action', 'tip', 'sms_tip']));
  var reassurance = cleanText(firstDefinedValue_(normalizedHeaders, ['parent_reassurance', 'encouragement', 'reassurance']));
  var tipId = cleanText(firstDefinedValue_(normalizedHeaders, ['tip_id'])) || buildFallbackTipId_(ageMin, ageMax, rawCategory, rowIndex);
  var activeValue = firstDefinedValue_(normalizedHeaders, ['active']);

  return {
    tip_id: tipId,
    child_age_days_min: ageMin,
    child_age_days_max: ageMax,
    child_age_stage: cleanText(firstDefinedValue_(normalizedHeaders, ['child_age_stage', 'stage'])) || getStageForAgeDays(ageMin),
    developmental_leap_phase: cleanText(firstDefinedValue_(normalizedHeaders, ['developmental_leap_phase'])),
    category: category,
    subcategory: cleanText(firstDefinedValue_(normalizedHeaders, ['subcategory'])),
    development_focus: cleanText(firstDefinedValue_(normalizedHeaders, ['development_focus', 'keywords'])),
    insight_title: cleanText(firstDefinedValue_(normalizedHeaders, ['insight_title'])),
    insight_explanation: insight,
    action_tip: action,
    parent_reassurance: reassurance,
    common_parent_misunderstanding: cleanText(firstDefinedValue_(normalizedHeaders, ['common_parent_misunderstanding'])),
    signs_of_healthy_development: cleanText(firstDefinedValue_(normalizedHeaders, ['signs_of_healthy_development'])),
    when_to_consult_doctor: cleanText(firstDefinedValue_(normalizedHeaders, ['when_to_consult_doctor'])),
    sms_tip: cleanText(firstDefinedValue_(normalizedHeaders, ['sms_tip'])) || action,
    follow_up_prompt: cleanText(firstDefinedValue_(normalizedHeaders, ['follow_up_prompt', 'parent_question'])),
    rotation_group: cleanText(firstDefinedValue_(normalizedHeaders, ['rotation_group'])) || category,
    priority_weight: Number(firstDefinedValue_(normalizedHeaders, ['priority_weight']) || 1),
    active: activeValue === '' || activeValue === undefined ? true : parseBoolean(activeValue, true)
  };
}

function firstDefinedValue_(rowObject, keys) {
  for (var i = 0; i < keys.length; i += 1) {
    if (rowObject[keys[i]] !== undefined && rowObject[keys[i]] !== '') {
      return rowObject[keys[i]];
    }
  }
  return '';
}

function padRowToLength_(row, targetLength) {
  var padded = row.slice();
  while (padded.length < targetLength) {
    padded.push('');
  }
  return padded;
}

function headersDiffer_(a, b) {
  if (a.length !== b.length) {
    return true;
  }
  for (var i = 0; i < a.length; i += 1) {
    if (String(a[i]) !== String(b[i])) {
      return true;
    }
  }
  return false;
}
