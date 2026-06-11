function createMessageLog(data) {
  var row = {
    message_id: data.message_id || createId('msg'),
    parent_id: data.parent_id || '',
    kid_id_or_combined: data.kid_id_or_combined || '',
    kid_id: data.kid_id || '',
    topic: data.topic || '',
    message_type: data.message_type || '',
    inbound_trigger: data.inbound_trigger || '',
    request_type: data.request_type || '',
    category_family: data.category_family || '',
    original_category: data.original_category || '',
    tip_id: data.tip_id || '',
    rendered_category_family: data.rendered_category_family || '',
    rendered_category_label: data.rendered_category_label || '',
    insight_rendered: data.insight_rendered || '',
    action_rendered: data.action_rendered || '',
    reassurance_rendered: data.reassurance_rendered || '',
    date_sent: data.date_sent || '',
    message_text: data.message_text || '',
    send_status: data.send_status || 'pending',
    sent_at: data.sent_at || '',
    twilio_sid_optional: data.twilio_sid_optional || '',
    error_optional: data.error_optional || ''
  };

  var rowNumber = appendRow('messages', row);
  row._rowNumber = rowNumber;
  return row;
}

function getMessageLogById(messageId) {
  return findFirstRow('messages', function(row) {
    return String(row.message_id) === String(messageId);
  });
}

function updateMessageLog(messageId, updates) {
  var row = getMessageLogById(messageId);
  if (!row) {
    throw new Error('Message log not found: ' + messageId);
  }
  return updateMessageLogRow(row._rowNumber, updates, row);
}

function updateMessageLogRow(rowNumber, updates, existingRow) {
  var row = existingRow || findFirstRow('messages', function(item) {
    return item._rowNumber === rowNumber;
  });
  if (!row) {
    throw new Error('Message log row not found: ' + rowNumber);
  }

  updateRow('messages', rowNumber, {
    parent_id: updates.parent_id !== undefined ? updates.parent_id : row.parent_id,
    kid_id_or_combined: updates.kid_id_or_combined !== undefined ? updates.kid_id_or_combined : row.kid_id_or_combined,
    kid_id: updates.kid_id !== undefined ? updates.kid_id : row.kid_id,
    topic: updates.topic !== undefined ? updates.topic : row.topic,
    message_type: updates.message_type !== undefined ? updates.message_type : row.message_type,
    inbound_trigger: updates.inbound_trigger !== undefined ? updates.inbound_trigger : row.inbound_trigger,
    request_type: updates.request_type !== undefined ? updates.request_type : row.request_type,
    category_family: updates.category_family !== undefined ? updates.category_family : row.category_family,
    original_category: updates.original_category !== undefined ? updates.original_category : row.original_category,
    tip_id: updates.tip_id !== undefined ? updates.tip_id : row.tip_id,
    rendered_category_family: updates.rendered_category_family !== undefined ? updates.rendered_category_family : row.rendered_category_family,
    rendered_category_label: updates.rendered_category_label !== undefined ? updates.rendered_category_label : row.rendered_category_label,
    insight_rendered: updates.insight_rendered !== undefined ? updates.insight_rendered : row.insight_rendered,
    action_rendered: updates.action_rendered !== undefined ? updates.action_rendered : row.action_rendered,
    reassurance_rendered: updates.reassurance_rendered !== undefined ? updates.reassurance_rendered : row.reassurance_rendered,
    date_sent: updates.date_sent !== undefined ? updates.date_sent : row.date_sent,
    message_text: updates.message_text !== undefined ? updates.message_text : row.message_text,
    send_status: updates.send_status !== undefined ? updates.send_status : row.send_status,
    sent_at: updates.sent_at !== undefined ? updates.sent_at : row.sent_at,
    twilio_sid_optional: updates.twilio_sid_optional !== undefined ? updates.twilio_sid_optional : row.twilio_sid_optional,
    error_optional: updates.error_optional !== undefined ? updates.error_optional : row.error_optional
  });

  return findFirstRow('messages', function(item) {
    return item._rowNumber === rowNumber;
  });
}

function wasDailyMessageSentToday(parentId, timezone) {
  var todayKey = getTodayKey(timezone);
  var rows = findRows('messages', function(row) {
    return String(row.parent_id) === String(parentId) &&
      (
        String(row.kid_id_or_combined) === APP_CONFIG.messageKinds.combined ||
        String(row.kid_id_or_combined) === APP_CONFIG.messageKinds.daily
      ) &&
      String(row.send_status) === 'sent' &&
      cleanText(row.sent_at).indexOf(todayKey) === 0;
  });
  return rows.length > 0;
}

function createTipHistoryLog(parentId, kidGuide, timezone, messageId, options) {
  options = options || {};
  return createMessageLog({
    parent_id: parentId,
    kid_id_or_combined: kidGuide.kid_id,
    kid_id: kidGuide.kid_id,
    topic: kidGuide.topic,
    message_type: options.message_type || 'tip_history',
    inbound_trigger: options.inbound_trigger || '',
    request_type: options.request_type || kidGuide.request_type || '',
    category_family: options.category_family || kidGuide.category_family || '',
    original_category: options.original_category || kidGuide.original_category || kidGuide.category || kidGuide.topic,
    tip_id: kidGuide.tip_id,
    rendered_category_family: options.rendered_category_family || kidGuide.rendered_category_family || '',
    rendered_category_label: options.rendered_category_label || kidGuide.rendered_category_label || '',
    insight_rendered: options.insight_rendered || kidGuide.rendered_insight || '',
    action_rendered: options.action_rendered || kidGuide.rendered_action || '',
    reassurance_rendered: options.reassurance_rendered || kidGuide.rendered_reassurance || '',
    date_sent: getTodayKey(timezone),
    message_text: kidGuide.personalized_message || kidGuide.tip || '',
    send_status: 'tip_used',
    sent_at: nowIsoString(),
    twilio_sid_optional: messageId || ''
  });
}

function createTipHistoryLogFromPayload(parentId, payload, timezone, messageId, options) {
  options = options || {};
  return createMessageLog({
    parent_id: parentId,
    kid_id_or_combined: payload.childId,
    kid_id: payload.childId,
    topic: options.topic || payload.selectedTip.category_family || payload.selectedTip.category || payload.selectedTip.topic || '',
    message_type: options.message_type || 'tip_history',
    inbound_trigger: options.inbound_trigger || '',
    request_type: options.request_type || payload.requestType || '',
    category_family: options.category_family || payload.selectedTip.category_family || '',
    original_category: options.original_category || payload.selectedTip.original_category || payload.selectedTip.category || payload.selectedTip.topic || '',
    tip_id: payload.selectedTip.tip_id || '',
    rendered_category_family: options.rendered_category_family || payload.rendered.categoryFamily || '',
    rendered_category_label: options.rendered_category_label || payload.rendered.categoryLabel || '',
    insight_rendered: options.insight_rendered || payload.rendered.insight || '',
    action_rendered: options.action_rendered || payload.rendered.action || '',
    reassurance_rendered: options.reassurance_rendered || payload.rendered.reassurance || '',
    date_sent: getTodayKey(timezone),
    message_text: payload.message_text || '',
    send_status: 'tip_used',
    sent_at: nowIsoString(),
    twilio_sid_optional: messageId || ''
  });
}

function getRecentTipIdsForKid(kidId, lookbackDays, referenceDate, timezone) {
  var kid = String(kidId || '');
  if (!kid) {
    return [];
  }

  var tz = timezone || getDefaultTimezone();
  var baseDate = referenceDate ? coerceDate(referenceDate) : new Date();
  var startDate = new Date(baseDate.getTime() - ((lookbackDays || APP_CONFIG.knowledge.recentTipLookbackDays) * 24 * 60 * 60 * 1000));
  var rows = findRows('messages', function(row) {
    if (String(row.kid_id || row.kid_id_or_combined) !== kid) {
      return false;
    }
    if (!cleanText(row.tip_id)) {
      return false;
    }
    var sentValue = cleanText(row.date_sent) || cleanText(row.sent_at);
    if (!sentValue) {
      return false;
    }

    try {
      return coerceDate(sentValue).getTime() >= startDate.getTime();
    } catch (error) {
      return false;
    }
  });

  var ids = [];
  for (var i = 0; i < rows.length; i += 1) {
    ids.push(String(rows[i].tip_id));
  }
  return ids;
}

function getRecentMessageHistoryForKid(kidId, lookbackDays, referenceDate) {
  var kid = String(kidId || '');
  if (!kid) {
    return [];
  }

  var baseDate = referenceDate ? coerceDate(referenceDate) : new Date();
  var startDate = new Date(baseDate.getTime() - ((lookbackDays || APP_CONFIG.knowledge.recentTipLookbackDays) * 24 * 60 * 60 * 1000));
  return findRows('messages', function(row) {
    var rowKid = String(row.kid_id || row.kid_id_or_combined);
    if (rowKid !== kid) {
      return false;
    }
    var sentValue = cleanText(row.sent_at) || cleanText(row.date_sent);
    if (!sentValue) {
      return false;
    }
    try {
      return coerceDate(sentValue).getTime() >= startDate.getTime();
    } catch (error) {
      return false;
    }
  });
}

function getRecentCategoriesForKid(kidId, limit) {
  var rows = getRecentMessageHistoryForKid(kidId, 90, new Date());
  rows.sort(function(a, b) {
    return String(b.sent_at || b.date_sent).localeCompare(String(a.sent_at || a.date_sent));
  });
  var categories = [];
  for (var i = 0; i < rows.length && categories.length < (limit || 5); i += 1) {
    if (cleanText(rows[i].topic)) {
      categories.push(cleanText(rows[i].topic));
    }
  }
  return categories;
}

function getRecentMessageHistoryForParent(parentId, lookbackDays, referenceDate) {
  var parent = String(parentId || '');
  if (!parent) {
    return [];
  }

  var baseDate = referenceDate ? coerceDate(referenceDate) : new Date();
  var startDate = new Date(baseDate.getTime() - ((lookbackDays || APP_CONFIG.knowledge.recentTipLookbackDays) * 24 * 60 * 60 * 1000));
  return findRows('messages', function(row) {
    if (String(row.parent_id) !== parent) {
      return false;
    }
    var sentValue = cleanText(row.sent_at) || cleanText(row.date_sent);
    if (!sentValue) {
      return false;
    }
    try {
      return coerceDate(sentValue).getTime() >= startDate.getTime();
    } catch (error) {
      return false;
    }
  });
}

function getRecentCategoriesForParent(parentId, limit) {
  var rows = getRecentMessageHistoryForParent(parentId, 90, new Date());
  rows.sort(function(a, b) {
    return String(b.sent_at || b.date_sent).localeCompare(String(a.sent_at || a.date_sent));
  });
  var categories = [];
  for (var i = 0; i < rows.length && categories.length < (limit || 5); i += 1) {
    if (cleanText(rows[i].topic)) {
      categories.push(canonicalizeTopic_(rows[i].topic));
    }
  }
  return categories;
}

function getRecentRenderedHistoryForKid(kidId, limit) {
  var rows = getRecentMessageHistoryForKid(kidId, 7, new Date());
  rows.sort(function(a, b) {
    return String(b.sent_at || b.date_sent).localeCompare(String(a.sent_at || a.date_sent));
  });
  return rows.slice(0, limit || 5);
}
