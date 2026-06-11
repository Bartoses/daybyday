function sendDailyMessages() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    var parents = getActiveParentsForDailySend();
    logInfo('Starting daily send', { parent_count: parents.length });

    for (var i = 0; i < parents.length; i += 1) {
      processDailyMessageForParent_(parents[i]);
    }
  } catch (error) {
    logError('Daily send failed', error);
    throw error;
  } finally {
    lock.releaseLock();
  }
}

function processDailyMessageForParent_(parent) {
  return handleDailySend(parent);
}

function handleDailySend(parent) {
  var timezone = getTimezoneForParent(parent);
  var children = getRenderableActiveChildrenForParent(parent.parent_phone, parent.parent_id);
  var today = new Date();

  if (!children.length) {
    logWarn('Skipping daily send, no active kids', { parent_id: parent.parent_id });
    return;
  }

  if (wasDailyMessageSentToday(parent.parent_id, timezone)) {
    logInfo('Skipping duplicate daily send', { parent_id: parent.parent_id, date: getTodayKey(timezone) });
    return;
  }

  logInfo('Preparing daily send for family', {
    parent_id: parent.parent_id,
    child_count: children.length,
    child_names: children.map(function(child) {
      return child.child_name;
    })
  });

  var selection = selectNextChildForDaily_(parent, children);
  var requestedCategory = resolveFamilyRequestedCategory_(parent, children, '', today, true);
  var payloads = buildChildPayloadsForParent_(parent, children, today, 'daily', requestedCategory, {
    responseType: 'daily',
    requestedCategory: requestedCategory
  });
  var guides = payloads.map(function(payload) { return payload.selectedTip; });
  var extras = chooseDailyExtras_(parent, selection.child, guides[0], today);
  var parts = buildFamilyMessagePartsFromPayloads_(parent, payloads, {
    mode: 'daily',
    responseType: 'daily',
    requestType: 'daily',
    includeGreeting: true,
    includeOptOut: true,
    includeMenu: true,
    opener: extras && extras.opener
  });
  var lastResponse = null;

  for (var i = 0; i < parts.length; i += 1) {
    lastResponse = sendSmsMessage(parent.parent_id, parent.parent_phone, parts[i], APP_CONFIG.messageKinds.daily);
  }

  updateParent(parent.parent_id, {
    last_child_index: selection.index,
    last_checkin_topic: ''
  });
  updateParentPreferences(parent.parent_id, {
    last_daily_child_id: selection.child.child_id,
    last_daily_topic: requestedCategory,
    last_requested_category: requestedCategory,
    last_outbound_message_type: 'daily',
    pending_checkin: null,
    pending_milestone: null,
    pending_milestone_date: null
  });

  for (var j = 0; j < payloads.length; j += 1) {
    createTipHistoryLogFromPayload(parent.parent_id, payloads[j], timezone, lastResponse && lastResponse.sid ? lastResponse.sid : '', {
      message_type: 'daily',
      inbound_trigger: 'daily_trigger',
      topic: requestedCategory
    });
  }
}

function buildGuidesForParent_(parent, children, date, requestType, categoryFamily) {
  var guides = [];
  for (var i = 0; i < children.length; i += 1) {
    guides.push(selectTipForChild(children[i], requestType, null, parent, date, {
      lookbackDays: APP_CONFIG.knowledge.recentTipLookbackDays,
      categoryFamily: categoryFamily
    }));
  }
  return guides;
}

function buildChildPayloadsForParent_(parent, children, date, requestType, categoryFamily, options) {
  var payloads = [];
  var historyByChild = {};
  for (var i = 0; i < children.length; i += 1) {
    var child = children[i];
    historyByChild[child.child_id] = getRecentMessageHistoryForKid(child.child_id, APP_CONFIG.knowledge.recentTipLookbackDays, date);
  }

  for (var j = 0; j < children.length; j += 1) {
    var currentChild = children[j];
    var selectedTip = selectTipForChild(currentChild, requestType, historyByChild[currentChild.child_id], parent, date, {
      lookbackDays: APP_CONFIG.knowledge.recentTipLookbackDays,
      categoryFamily: categoryFamily
    });
    var payload = createChildPayload_(currentChild, selectedTip, requestType);
    payload.message_text = buildChildSectionFromPayload(payload, {
      mode: requestType === 'daily' ? 'daily' : 'followup'
    });
    payloads.push(payload);
  }
  return selectOnePayloadPerChild_(payloads, {
    parentId: parent.parent_id,
    responseType: options && options.responseType ? options.responseType : requestType,
    requestType: requestType,
    requestedCategory: categoryFamily
  });
}

function findGuideForChild_(guides, childId) {
  for (var i = 0; i < guides.length; i += 1) {
    if (String(guides[i].kid_id) === String(childId)) {
      return guides[i];
    }
  }
  return null;
}

function selectNextChildForDaily_(parent, children) {
  var lastIndex = parent.last_child_index === '' ? -1 : Number(parent.last_child_index || -1);
  var nextIndex = (lastIndex + 1) % children.length;
  return {
    index: nextIndex,
    child: children[nextIndex]
  };
}

function chooseDailyExtras_(parent, child, guide, today) {
  return {
    includeOptOutReminder: true
  };
}

function selectTipForChild(child, requestType, history, parent, date, options) {
  options = options || {};
  history = history || getRecentMessageHistoryForKid(child.child_id || child.kid_id, options.lookbackDays || APP_CONFIG.knowledge.recentTipLookbackDays, date);
  var request_type = normalizeRequestType_(requestType);
  var categoryFamily = options.categoryFamily || getCategoryFamilyForRequest_(request_type, parent, date);
  var guide = buildKidGuide(parent, child, date, {
    lookbackDays: options.lookbackDays,
    topic: categoryFamily || ''
  });
  var guideCategory = canonicalizeTopic_(guide.category || guide.topic);
  var allowedCategories = getAllowedCategoriesForRequest_(request_type);
  var lastHistory = history.length ? history[0] : null;
  var lastDaily = getMostRecentHistoryByMessageType_(history, 'daily');
  var lastRenderedInsight = lastDaily ? extractFirstSentence_(lastDaily.insight_rendered || '') : '';
  var lastRenderedAction = cleanText(lastDaily && lastDaily.action_rendered);
  var lastDailyFamily = canonicalizeTopic_((lastDaily && (lastDaily.rendered_category_family || lastDaily.category_family || lastDaily.topic)) || '');

  if (((request_type === 'daily' && categoryFamily && guideCategory !== canonicalizeTopic_(categoryFamily)) ||
      (allowedCategories.length &&
      allowedCategories.indexOf(guideCategory) === -1 &&
      request_type !== 'another_tip'))) {
    guide.tip_id = 'fallback_' + request_type + '_' + child.child_id + '_' + calculateAgeDays(child.birthdate, getDefaultTimezone(), date);
    guide.category = categoryFamily;
    guide.topic = categoryFamily;
    guide.insight = '';
    guide.summary = '';
    guide.action = '';
    guide.tip = '';
    guide.encouragement = '';
    guide.reassurance = '';
  }

  if (lastHistory && String(lastHistory.tip_id) === String(guide.tip_id)) {
    guide.tip_id = guide.tip_id + '_fresh';
    guide.insight = '';
    guide.summary = '';
    guide.action = '';
    guide.tip = '';
    guide.encouragement = '';
    guide.reassurance = '';
  }

  if (request_type === 'another_tip') {
    guide.category = 'development';
    guide.topic = 'development';
    guide.category_family = 'development';
    if ((lastDaily && String(lastDaily.tip_id) === String(guide.tip_id)) ||
        (lastRenderedInsight && extractFirstSentence_(guide.insight || guide.summary || '').toLowerCase() === lastRenderedInsight.toLowerCase()) ||
        (lastRenderedAction && cleanText(guide.action || guide.tip || '').toLowerCase() === lastRenderedAction.toLowerCase()) ||
        (lastDailyFamily && lastDailyFamily === canonicalizeTopic_(categoryFamily))) {
      guide.tip_id = 'fallback_another_tip_' + child.child_id + '_' + calculateAgeDays(child.birthdate, getDefaultTimezone(), date);
      guide.insight = '';
      guide.summary = '';
      guide.action = '';
      guide.tip = '';
      guide.encouragement = '';
      guide.reassurance = '';
    }
  }

  guide.request_type = request_type;
  guide.category_family = categoryFamily || canonicalizeTopic_(guide.category || guide.topic);
  guide.original_category = guide.category || guide.topic;
  return guide;
}

function getMostRecentHistoryByMessageType_(history, messageType) {
  for (var i = 0; i < (history || []).length; i += 1) {
    if (cleanText(history[i].message_type) === cleanText(messageType)) {
      return history[i];
    }
  }
  return null;
}

function resolveFamilyRequestedCategory_(parent, children, requestedCategory, referenceDate, isDaily) {
  var normalized = canonicalizeTopic_(requestedCategory);
  if (normalized && requestedCategory) {
    return normalized;
  }

  var prefs = getParentPreferences(parent);
  var recent = getRecentCategoriesForParent(parent.parent_id, 4);
  var categories = (APP_CONFIG.knowledge.familyCategories || APP_CONFIG.knowledge.rotatingCategories || []).map(function(item) {
    return canonicalizeTopic_(item);
  }).filter(function(item, index, array) {
    return item && array.indexOf(item) === index;
  });

  var lastCategory = canonicalizeTopic_(prefs.last_requested_category || prefs.last_daily_topic || '');
  var available = categories.filter(function(item) {
    return item !== lastCategory && recent.indexOf(item) === -1;
  });

  if (!available.length) {
    available = categories.filter(function(item) {
      return item !== lastCategory;
    });
  }
  if (!available.length) {
    available = categories.slice();
  }

  if (!available.length) {
    return 'development';
  }

  var dateKey = formatLocalDate(referenceDate || new Date(), getTimezoneForParent(parent));
  var seed = Math.abs(hashString_(parent.parent_id + ':' + dateKey + ':' + (isDaily ? 'daily' : 'followup')));
  return available[seed % available.length];
}

function shouldIncludeCheckin_(parent, child, today) {
  var seed = hashString_(parent.parent_id + ':' + child.child_id + ':' + formatLocalDate(today, getTimezoneForParent(parent)));
  return Math.abs(seed) % 3 === 0;
}

function shouldIncludeMilestone_(parent, child, today) {
  var seed = hashString_('milestone:' + parent.parent_id + ':' + child.child_id + ':' + formatLocalDate(today, getTimezoneForParent(parent)));
  return Math.abs(seed) % 4 === 0;
}

function shouldIncludeSharePrompt_(parent, today) {
  var seed = hashString_('share:' + parent.parent_id + ':' + formatLocalDate(today, getTimezoneForParent(parent)));
  return Math.abs(seed) % 10 === 0;
}

function getNextMilestonePrompt_(child) {
  var ageDays = calculateAgeDays(child.birthdate, getDefaultTimezone());
  for (var i = 0; i < APP_CONFIG.milestonePrompts.length; i += 1) {
    var item = APP_CONFIG.milestonePrompts[i];
    if (ageDays < item.minAgeDays || ageDays > item.maxAgeDays) {
      continue;
    }
    if (!hasMilestone(child.child_id, item.key)) {
      return item;
    }
  }
  return null;
}
