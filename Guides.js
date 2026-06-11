function buildKidGuide(parent, kid, date, options) {
  return chooseKnowledgeRowForKid(kid, date || new Date(), {
    timezone: getTimezoneForParent(parent),
    lookbackDays: options && options.lookbackDays,
    topic: options && options.topic
  });
}

function buildCombinedDailyMessage(parent, kids, date) {
  var guides = [];
  for (var i = 0; i < kids.length; i += 1) {
    guides.push(buildKidGuide(parent, kids[i], date || new Date()));
  }
  return buildCombinedDailyMessageFromGuides(parent, guides);
}

function buildCombinedDailyMessageFromGuides(parent, guides, options) {
  return buildDailyMessagePartsFromGuides(parent, guides, options).join('\n\n');
}

function buildDailyMessagePartsFromGuides(parent, guides, options) {
  return buildFamilyMessagePartsFromPayloads_(parent, buildPayloadsFromGuides_(guides, 'daily', {
    parentId: parent && parent.parent_id,
    responseType: 'daily',
    requestType: 'daily'
  }), {
    mode: 'daily',
    responseType: 'daily',
    requestType: 'daily',
    includeGreeting: true,
    includeOptOut: true,
    includeMenu: true,
    opener: options && options.opener
  });
}

function buildDailyChildSections_(guides, options) {
  var sections = [];
  for (var i = 0; i < guides.length; i += 1) {
    sections.push(buildDailyChildSection(guides[i], options));
  }
  return sections;
}

function buildDailyChildSection(guide, options) {
  return buildChildSection(guide, renderTipForChild(guide, guide, options && options.topicLabel), {
    mode: 'daily',
    concise: options && options.concise
  });
}

function buildFamilyMessage(parent, childSections, options) {
  options = options || {};
  var sections = [];
  if (options.includeGreeting !== false) {
    sections.push('Good morning' + (parent.parent_name ? ' ' + parent.parent_name : '') + ' \u2600\ufe0f');
  }
  if (cleanText(options.opener)) {
    sections.push(cleanText(options.opener));
  }
  sections.push(joinSectionsWithSpacing(childSections));
  if (options.includeMenu !== false) {
    sections.push(buildMenu());
  }
  if (options.includeOptOut) {
    sections.push(buildOptOutReminder());
  }
  return finalizeSmsFormatting(joinSectionsWithSpacing(sections));
}

function buildMultiChildMessage(parent, childSections, options) {
  return buildFamilyMessage(parent, childSections, {
    includeGreeting: true,
    includeOptOut: options && options.includeOptOutReminder,
    includeMenu: !options || options.includeMenu !== false,
    opener: options && options.opener
  });
}

function appendEncouragement(lines, encouragement) {
  var text = formatEncouragement(encouragement);
  if (!text) {
    return lines;
  }
  lines.push('');
  lines.push(text);
  return lines;
}

function splitMessageIfNeeded(parent, childSections, options) {
  options = options || {};
  var introSections = [];
  if (options.includeGreeting !== false) {
    introSections.push('Good morning' + (parent.parent_name ? ' ' + parent.parent_name : '') + ' \u2600\ufe0f');
  }
  if (cleanText(options.opener)) {
    introSections.push(cleanText(options.opener));
  }
  var intro = joinSectionsWithSpacing(introSections);
  var footerBits = [];
  if (options.includeMenu !== false) {
    footerBits.push(buildMenu());
  }
  if (options.includeOptOut) {
    footerBits.push(buildOptOutReminder());
  }

  var footerText = finalizeSmsFormatting(joinSectionsWithSpacing(footerBits));
  var maxPartLength = getMaxPartBodyLength_();
  var parts = [];
  var currentLines = [intro];

  for (var i = 0; i < childSections.length; i += 1) {
    var section = childSections[i];
    var candidateLines = currentLines.slice();
    candidateLines.push('');
    candidateLines.push(section);
    var reserve = i === childSections.length - 1 ? '\n\n' + footerText : '';

    if (candidateLines.join('\n').length + reserve.length > maxPartLength && currentLines.length > 1) {
      parts.push(finalizeSmsFormatting(currentLines.join('\n')));
      currentLines = [validateChildSection(section)];
    } else {
      currentLines = candidateLines;
    }
  }

  var finalLines = currentLines.slice();
  if (footerText) {
    finalLines.push('');
    finalLines.push(footerText);
  }
  parts.push(finalizeSmsFormatting(finalLines.join('\n')));

  if (parts.length === 1) {
    return parts;
  }

  return addPartLabels_(parts, APP_CONFIG.sms.maxMessagePartLength);
}

function addPartLabels_(parts, maxPartLength) {
  var labeled = [];
  var total = parts.length;
  for (var i = 0; i < parts.length; i += 1) {
    var label = formatSplitHeader(i + 1, total);
    var body = finalizeSmsFormatting(parts[i]);
    labeled.push(label + '\n\n' + body);
  }
  return labeled;
}

function buildExtraSection_(options) {
  return '';
}

function shortenForSms_(text, maxLength) {
  return shortenAtSentenceBoundary(text, maxLength);
}

function buildTopicChildSection(guide, topic, options) {
  return buildChildSection(guide, renderTipForChild(guide, guide, topic), {
    mode: 'followup',
    concise: options && options.concise,
    requestedCategory: topic
  });
}

function buildNextStepChildSection(guide, options) {
  return buildTopicChildSection(guide, 'development', options);
}

function buildMultiChildTopicResponse(parent, guides, topic) {
  return buildFamilyMessagePartsFromPayloads_(parent, buildPayloadsFromGuides_(guides, topic, {
    parentId: parent && parent.parent_id,
    responseType: 'followup',
    requestType: topic,
    requestedCategory: topic
  }), {
    mode: 'followup',
    responseType: 'followup',
    requestType: topic,
    requestedCategory: topic,
    includeGreeting: false,
    includeOptOut: false,
    includeMenu: true
  });
}

function buildTopicMessage_(sections, encouragement) {
  return finalizeSmsFormatting(joinSectionsWithSpacing(sections));
}

function splitSectionedMessage_(sections, options) {
  options = options || {};
  var footerBits = [];
  if (cleanText(options.encouragement)) {
    footerBits.push(shortenAtSentenceBoundary(options.encouragement, 70));
  }
  if (options.includeMenu !== false) {
    footerBits.push(formatNextMenu(true));
  }
  var footerText = finalizeSmsFormatting(joinSectionsWithSpacing(footerBits));
  var maxLength = getMaxPartBodyLength_();
  var parts = [];
  var currentLines = [];

  for (var i = 0; i < sections.length; i += 1) {
    var section = sections[i];
    var candidate = currentLines.slice();
    if (candidate.length) {
      candidate.push('');
    }
    candidate.push(section);
    var reserve = i === sections.length - 1 ? '\n\n' + footerText : '';
    if (candidate.join('\n').length + reserve.length > maxLength && currentLines.length) {
      parts.push(finalizeSmsFormatting(currentLines.join('\n')));
      currentLines = [validateChildSection(section)];
    } else {
      currentLines = candidate;
    }
  }

  var finalLines = currentLines.slice();
  if (footerText) {
    finalLines.push('');
    finalLines.push(footerText);
  }
  parts.push(finalizeSmsFormatting(finalLines.join('\n')));

  if (parts.length === 1) {
    return parts;
  }
  return addPartLabels_(parts, APP_CONFIG.sms.maxMessagePartLength);
}

function appendNextMenu(message, includeShare) {
  return finalizeSmsFormatting(joinSectionsWithSpacing([
    cleanText(message),
    buildMenu()
  ]));
}

function buildNextActionMenu(includeShare) {
  var lines = [
    'Next',
    '1 = Another tip',
    '2 = Sleep',
    '3 = Play',
    '4 = Feeding',
    '5 = Behavior'
  ];
  if (includeShare !== false) {
    lines.push('6 = Share');
  }
  return lines.join('\n');
}

function buildMenu() {
  return formatNextMenu(true);
}

function buildSharePrompt() {
  return [
    'Share',
    'Send me the first name and phone number of the parent you want to share DaybyDay with.',
    '',
    'Example:',
    'Jess, 970-555-1234'
  ].join('\n');
}

function buildOptOutReminder() {
  return 'Text STOP or OPT OUT anytime to unsubscribe.';
}

function buildTopicReplyMessage(parent, guide, topic) {
  return buildMultiChildTopicResponse(parent, [guide], topic).join('\n\n');
}

function buildFamilyMessagePartsFromGuides_(parent, guides, options) {
  var requestType = options && (options.requestType || options.requestedCategory);
  return buildFamilyMessagePartsFromPayloads_(parent, buildPayloadsFromGuides_(guides, requestType, {
    parentId: parent && parent.parent_id,
    responseType: options && options.responseType ? options.responseType : (options && options.mode) || requestType,
    requestType: requestType,
    requestedCategory: options && options.requestedCategory
  }), options);
}

function buildFamilyMessagePartsFromPayloads_(parent, payloads, options) {
  options = options || {};
  payloads = selectOnePayloadPerChild_(payloads || [], {
    parentId: parent && parent.parent_id,
    responseType: options.responseType || options.mode || options.requestType || '',
    requestType: options.requestType || '',
    requestedCategory: options.requestedCategory || ''
  });

  if (!payloads.length) {
    return [buildInvalidReplyPrompt()];
  }

  var detailedSections = buildFamilyChildSectionsFromPayloads_(payloads, options, false);
  var openerGuides = payloads.map(function(payload) {
    return payload.selectedTip;
  });
  var detailedMessage = buildFamilyMessage(parent, detailedSections, {
    includeGreeting: options.includeGreeting !== false,
    includeOptOut: options.includeOptOut === true,
    includeMenu: options.includeMenu !== false,
    opener: options.opener || (options.mode === 'daily' ? buildDailyOpener_(openerGuides) : '')
  });
  if (detailedMessage.length <= APP_CONFIG.sms.maxCombinedMessageLength) {
    logGuideSelectionSummary('Built outbound response', {
      parent_id: parent && parent.parent_id,
      response_type: options.responseType || options.mode || options.requestType || '',
      request_type: options.requestType || '',
      requested_category: options.requestedCategory || '',
      child_ids: payloads.map(function(payload) { return payload.childId; }),
      selected_tip_ids_by_child: mapSelectedTipIdsByChild_(payloads),
      final_child_count: payloads.length,
      chunk_count: 1,
      chunk_lengths: [detailedMessage.length]
    });
    return [detailedMessage];
  }

  var conciseSections = buildFamilyChildSectionsFromPayloads_(payloads, options, true);
  var conciseMessage = buildFamilyMessage(parent, conciseSections, {
    includeGreeting: options.includeGreeting !== false,
    includeOptOut: options.includeOptOut === true,
    includeMenu: options.includeMenu !== false,
    opener: options.opener || (options.mode === 'daily' ? buildDailyOpener_(openerGuides) : '')
  });
  if (conciseMessage.length <= APP_CONFIG.sms.maxCombinedMessageLength) {
    logGuideSelectionSummary('Built outbound response', {
      parent_id: parent && parent.parent_id,
      response_type: options.responseType || options.mode || options.requestType || '',
      request_type: options.requestType || '',
      requested_category: options.requestedCategory || '',
      child_ids: payloads.map(function(payload) { return payload.childId; }),
      selected_tip_ids_by_child: mapSelectedTipIdsByChild_(payloads),
      final_child_count: payloads.length,
      chunk_count: 1,
      chunk_lengths: [conciseMessage.length]
    });
    return [conciseMessage];
  }

  var noOpenerMessage = buildFamilyMessage(parent, conciseSections, {
    includeGreeting: options.includeGreeting !== false,
    includeOptOut: options.includeOptOut === true,
    includeMenu: options.includeMenu !== false,
    opener: ''
  });
  if (noOpenerMessage.length <= APP_CONFIG.sms.maxCombinedMessageLength) {
    logGuideSelectionSummary('Built outbound response', {
      parent_id: parent && parent.parent_id,
      response_type: options.responseType || options.mode || options.requestType || '',
      request_type: options.requestType || '',
      requested_category: options.requestedCategory || '',
      child_ids: payloads.map(function(payload) { return payload.childId; }),
      selected_tip_ids_by_child: mapSelectedTipIdsByChild_(payloads),
      final_child_count: payloads.length,
      chunk_count: 1,
      chunk_lengths: [noOpenerMessage.length]
    });
    return [noOpenerMessage];
  }

  var parts = splitMessageIfNeeded(parent, conciseSections, {
    includeGreeting: options.includeGreeting !== false,
    includeOptOut: options.includeOptOut === true,
    includeMenu: options.includeMenu !== false,
    opener: ''
  });
  logGuideSelectionSummary('Built outbound response', {
    parent_id: parent && parent.parent_id,
    response_type: options.responseType || options.mode || options.requestType || '',
    request_type: options.requestType || '',
    requested_category: options.requestedCategory || '',
    child_ids: payloads.map(function(payload) { return payload.childId; }),
    selected_tip_ids_by_child: mapSelectedTipIdsByChild_(payloads),
    final_child_count: payloads.length,
    chunk_count: parts.length,
    chunk_lengths: parts.map(function(part) { return part.length; })
  });
  return parts;
}

function buildFamilyChildSections_(guides, options, concise) {
  return buildFamilyChildSectionsFromPayloads_(buildPayloadsFromGuides_(guides, options && (options.requestType || options.requestedCategory)), options, concise);
}

function buildFamilyChildSectionsFromPayloads_(payloads, options, concise) {
  var sections = [];
  for (var i = 0; i < payloads.length; i += 1) {
    sections.push(buildChildSectionFromPayload(payloads[i], {
      mode: options.mode || 'daily',
      concise: concise,
      requestedCategory: options.requestedCategory
    }));
  }
  return sections;
}

function buildPayloadsFromGuides_(guides, requestType, options) {
  var payloads = [];
  for (var i = 0; i < (guides || []).length; i += 1) {
    payloads.push(createChildPayload_(guides[i], guides[i], requestType || guides[i].request_type || guides[i].category_family || guides[i].category));
  }
  return selectOnePayloadPerChild_(payloads, {
    parentId: options && options.parentId,
    responseType: options && options.responseType,
    requestType: options && options.requestType,
    requestedCategory: options && options.requestedCategory
  });
}

function selectOnePayloadPerChild_(payloads, options) {
  var items = payloads || [];
  var grouped = {};
  var order = [];
  var candidateCounts = {};
  var dropped = {};
  var selected = [];
  var i;

  for (i = 0; i < items.length; i += 1) {
    var payload = items[i];
    var childId = cleanText(payload && payload.childId);
    if (!childId) {
      continue;
    }
    if (!grouped[childId]) {
      grouped[childId] = [];
      order.push(childId);
    }
    grouped[childId].push(payload);
  }

  for (i = 0; i < order.length; i += 1) {
    var groupedChildId = order[i];
    var candidates = grouped[groupedChildId];
    candidateCounts[groupedChildId] = candidates.length;
    candidates.sort(function(a, b) {
      return scorePayloadCandidate_(b, options) - scorePayloadCandidate_(a, options);
    });
    selected.push(candidates[0]);
    if (candidates.length > 1) {
      dropped[groupedChildId] = candidates.slice(1).map(function(candidate) {
        return cleanText(candidate.selectedTip && candidate.selectedTip.tip_id) || 'unknown_tip';
      });
    }
  }

  if (Object.keys(dropped).length) {
    logGuideSelectionSummary('Dropped duplicate child payloads', {
      parent_id: options && options.parentId ? options.parentId : '',
      response_type: options && options.responseType ? options.responseType : '',
      request_type: options && options.requestType ? options.requestType : '',
      requested_category: options && options.requestedCategory ? options.requestedCategory : '',
      child_ids: order,
      candidate_counts_by_child: candidateCounts,
      selected_tip_ids_by_child: mapSelectedTipIdsByChild_(selected),
      dropped_duplicates_by_child: dropped,
      final_child_count: selected.length
    });
  }

  return selected;
}

function scorePayloadCandidate_(payload, options) {
  var score = 0;
  var selectedTip = payload && payload.selectedTip ? payload.selectedTip : {};
  var requestedCategory = canonicalizeTopic_(options && options.requestedCategory ? options.requestedCategory : '');
  var payloadCategory = canonicalizeTopic_(selectedTip.category_family || selectedTip.category || selectedTip.topic || '');
  var requestType = normalizeRequestType_(options && options.requestType ? options.requestType : (payload && payload.requestType) || '');
  var tipId = cleanText(selectedTip.tip_id);

  if (requestedCategory && payloadCategory === requestedCategory) {
    score += 100;
  }
  if (requestType && payload && normalizeRequestType_(payload.requestType) === requestType) {
    score += 50;
  }
  if (tipId && tipId.indexOf('fallback_') !== 0) {
    score += 25;
  }
  if (tipId && tipId.indexOf('fallback_') === 0) {
    score -= 25;
  }
  return score;
}

function mapSelectedTipIdsByChild_(payloads) {
  var map = {};
  for (var i = 0; i < (payloads || []).length; i += 1) {
    map[payloads[i].childId] = cleanText(payloads[i].selectedTip && payloads[i].selectedTip.tip_id);
  }
  return map;
}

function createChildPayload_(child, selectedTip, requestType) {
  var ageProfile = computeChildAgeProfile(child);
  var rendered = renderTipForChild(child, selectedTip, requestType);
  return {
    childId: cleanText(child.child_id || child.kid_id),
    childName: toNameCase(child.child_name || child.kid_name || 'Your child'),
    ageDays: ageProfile.age_days,
    readableAge: ageProfile.readable_age,
    stage: ageProfile.stage,
    ageBand: getAgeBandKey_(ageProfile.age_days),
    requestType: normalizeRequestType_(requestType || selectedTip.request_type || selectedTip.category_family || selectedTip.category),
    selectedTip: clonePayloadTip_(selectedTip),
    rendered: {
      categoryLabel: rendered.categoryLabel,
      insight: rendered.insight,
      action: rendered.action,
      reassurance: rendered.reassurance
    }
  };
}

function clonePayloadTip_(selectedTip) {
  var clone = {};
  var keys = Object.keys(selectedTip || {});
  for (var i = 0; i < keys.length; i += 1) {
    clone[keys[i]] = selectedTip[keys[i]];
  }
  return clone;
}

function computeChildAgeProfile(child, referenceDate) {
  var ageDays = Number(child.age_days);
  if (isNaN(ageDays)) {
    ageDays = calculateAgeDays(child.birthdate || child.date_of_birth, getDefaultTimezone(), referenceDate);
  }
  return {
    age_days: ageDays,
    readable_age: formatReadableAge(ageDays),
    stage: getStageForAgeDays(ageDays)
  };
}

function normalizeRequestType_(requestType) {
  var normalized = cleanText(requestType).toLowerCase();
  if (!normalized || normalized === 'development') {
    return 'another_tip';
  }
  if (normalized === 'learning/play') {
    return 'play';
  }
  return normalized;
}

function getCategoryFamilyForRequest_(requestType, parent, referenceDate) {
  var normalized = normalizeRequestType_(requestType);
  if (normalized === 'sleep') {
    return 'sleep';
  }
  if (normalized === 'play') {
    return 'learning/play';
  }
  if (normalized === 'feeding') {
    return 'feeding';
  }
  if (normalized === 'behavior') {
    return 'behavior';
  }
  if (normalized === 'another_tip') {
    if (typeof resolveFamilyRequestedCategory_ === 'function' && parent) {
      return resolveFamilyRequestedCategory_(parent, [], '', referenceDate || new Date(), false);
    }
    return 'development';
  }
  return canonicalizeTopic_(normalized || 'development');
}

function getAllowedCategoriesForRequest_(requestType) {
  var normalized = normalizeRequestType_(requestType);
  if (normalized === 'sleep') {
    return ['sleep'];
  }
  if (normalized === 'play') {
    return ['learning/play'];
  }
  if (normalized === 'feeding') {
    return ['feeding'];
  }
  if (normalized === 'behavior') {
    return ['behavior', 'emotional development', 'attachment and bonding', 'social development', 'parent emotional support'];
  }
  if (normalized === 'another_tip') {
    return APP_CONFIG.knowledge.familyCategories.slice();
  }
  if (normalized === 'daily') {
    return [];
  }
  return [canonicalizeTopic_(normalized)];
}

function getAgeBandKey_(ageDays) {
  if (ageDays <= 60) {
    return 'newborn';
  }
  if (ageDays <= 180) {
    return 'early_baby';
  }
  if (ageDays <= 365) {
    return 'older_baby';
  }
  if (ageDays <= 730) {
    return 'toddler';
  }
  return 'older_child';
}

function humanizeTip(row, child, requestedCategory) {
  return renderTipForChild(child || row, row, requestedCategory);
}

function renderTipForChild(child, selectedTip, requestType) {
  var ageProfile = computeChildAgeProfile(child || selectedTip);
  var normalizedRequestType = normalizeRequestType_(requestType || selectedTip.request_type || selectedTip.category_family || selectedTip.category || selectedTip.topic);
  var categoryFamily = getRenderedCategoryFamily_(selectedTip, normalizedRequestType);
  return validateRenderedTip_(child || selectedTip, selectedTip, {
    categoryFamily: categoryFamily,
    categoryLabel: mapRenderedCategoryLabel_(categoryFamily),
    insight: humanizeInsight(selectedTip, normalizedRequestType, ageProfile),
    action: humanizeAction(selectedTip, normalizedRequestType, ageProfile),
    reassurance: humanizeReassurance(selectedTip, normalizedRequestType, ageProfile),
    readableAge: ageProfile.readable_age
  }, normalizedRequestType, ageProfile);
}

function humanizeTipLegacy_(row, child, requestedCategory) {
  var ageProfile = computeChildAgeProfile(row);
  var requestType = normalizeRequestType_(row.request_type || requestedCategory || row.category || row.topic);
  var categoryFamily = row.category_family || getCategoryFamilyForRequest_(requestType);
  return {
    categoryLabel: mapCategoryLabel(row.original_category || row.category || row.topic, requestType === 'another_tip' || requestType === 'daily' ? categoryFamily : requestType),
    insight: humanizeInsight(row, requestType, ageProfile),
    action: humanizeAction(row, requestType, ageProfile),
    reassurance: humanizeReassurance(row, requestType, ageProfile),
    readableAge: ageProfile.readable_age
  };
}

function buildChildSection(child, tip, options) {
  options = options || {};
  var mode = options.mode === 'followup' ? 'followup' : 'daily';
  var insight = options.concise ? shortenAtSentenceBoundary(tip.insight, 135) : tip.insight;
  var reassurance = options.concise ? shortenAtSentenceBoundary(tip.reassurance, 60) : tip.reassurance;
  var actionLabel = mode === 'daily' ? 'Try this today:' : 'Try this:';
  var action = shortenActionLine(tip.action, 110);
  child.rendered_category_family = tip.categoryFamily;
  child.rendered_category_label = tip.categoryLabel;
  child.rendered_insight = insight;
  child.rendered_action = action;
  child.rendered_reassurance = reassurance;

  return validateChildSection(finalizeSmsFormatting(joinSectionsWithSpacing([
    buildChildHeaderLine_(child, mode),
    buildChildAgeStageLine_(child, tip),
    formatTopicBlock(tip.categoryLabel, insight),
    formatActionBlock(action, actionLabel),
    formatEncouragement(reassurance)
  ])));
}

function buildChildSectionFromPayload(payload, options) {
  var child = clonePayloadTip_(payload.selectedTip);
  child.kid_id = payload.childId;
  child.child_id = payload.childId;
  child.kid_name = payload.childName;
  child.child_name = payload.childName;
  child.age_days = payload.ageDays;
  child.stage = payload.stage;
  return buildChildSection(child, {
    categoryFamily: payload.rendered.categoryFamily,
    categoryLabel: payload.rendered.categoryLabel,
    insight: payload.rendered.insight,
    action: payload.rendered.action,
    reassurance: payload.rendered.reassurance,
    readableAge: payload.readableAge
  }, options || {});
}

function buildInteractiveReplyPrompt(longFormat) {
  var menu = buildNextActionMenu(true);
  return menu.replace(/^Next\n/, '');
}

function buildInvalidReplyPrompt() {
  return finalizeSmsFormatting(joinSectionsWithSpacing([
    'I can help with another family tip.',
    buildMenu()
  ]));
}

function getTopicFromReply(messageBody) {
  var topic = APP_CONFIG.topicReplyMap[cleanText(messageBody)] || '';
  return topic === 'share' ? '' : topic;
}

function isShareReply(messageBody) {
  return APP_CONFIG.topicReplyMap[cleanText(messageBody)] === 'share';
}

function topicHeaderLabel_(topic) {
  return mapCategoryLabel(topic) + ':';
}

function normalizeInsightCopy_(text) {
  var value = cleanText(text);
  if (!value) {
    return 'Small moments of practice can go a long way.';
  }
  return value;
}

function normalizeActionCopy_(text) {
  var value = cleanText(text);
  if (!value) {
    return 'Keep one interaction simple and repeatable.';
  }
  return value.replace(/^try this today:\s*/i, '').replace(/^try this:\s*/i, '');
}

function normalizeTopicTipCopy_(guide, topic, concise) {
  if (topic === 'today\'s next step') {
    return normalizeActionCopy_(guide.action || guide.tip);
  }

  var insight = normalizeInsightCopy_(guide.insight || guide.summary);
  var action = normalizeActionCopy_(guide.action || guide.tip);
  if (concise) {
    return action;
  }
  return insight + '\n\nTry this: ' + action;
}

function formatSplitHeader(partNumber, totalParts) {
  return 'DaybyDay message ' + partNumber + ' of ' + totalParts;
}

function formatChildHeaderBlock(child, mode) {
  return buildChildHeaderLine_(child, mode === 'for' ? 'followup' : 'daily');
}

function formatPresentationChildHeader_(child) {
  return buildChildHeaderLine_(child, 'daily');
}

function formatTopicBlock(topicLabel, insightText) {
  var label = normalizeTopicLabel_(topicLabel);
  return finalizeSmsFormatting(label + '\n' + ensureCompleteSentence(normalizeTopicBody_(label, insightText)));
}

function formatSection(title, body) {
  if (!cleanText(title)) {
    return ensureCompleteSentence(body);
  }
  return finalizeSmsFormatting(title + '\n' + ensureCompleteSentence(body));
}

function formatReadableAge(ageDays) {
  var totalDays = Math.max(Number(ageDays || 0), 0);
  if (totalDays < 60) {
    return totalDays + ' ' + pluralizeUnit_(totalDays, 'day') + ' old';
  }
  return buildCalendarAgeText_(totalDays) + ' old';
}

function buildCalendarAgeText_(ageDays) {
  var totalDays = Math.max(Number(ageDays || 0), 0);
  var years = Math.floor(totalDays / 365);
  var remainingAfterYears = totalDays % 365;
  var months = Math.floor(remainingAfterYears / 30);
  var parts = [];
  if (years > 0) {
    parts.push(years + ' ' + pluralizeUnit_(years, 'year'));
  }
  if (months > 0 || !parts.length) {
    parts.push(months + ' ' + pluralizeUnit_(months, 'month'));
  }
  return parts.join(', ');
}

function mapCategoryLabel(category, menuContext) {
  var normalized = canonicalizeTopic_(menuContext || category);
  var raw = String(category || '');
  if (normalized === 'sleep') {
    return 'Sleep tip';
  }
  if (normalized === 'feeding') {
    return 'Feeding tip';
  }
  if (normalized === 'behavior' || normalized === 'emotional development') {
    return 'Behavior tip';
  }
  if (normalized === 'learning/play') {
    return 'Play idea';
  }
  if (normalized === 'development') {
    if (/language/i.test(raw) || /speech/i.test(raw)) {
      return 'Language tip';
    }
    return 'Development tip';
  }
  if (/attachment/i.test(raw) || /bonding/i.test(raw)) {
      return 'Connection tip';
  }
  if (/parent emotional support/i.test(raw)) {
      return 'Parent note';
  }
  if (normalized === 'safety') {
    return 'Safety tip';
  }
  return 'Development tip';
}

function mapRenderedCategoryLabel_(renderedFamily) {
  if (renderedFamily === 'sleep') {
    return 'Sleep tip';
  }
  if (renderedFamily === 'play') {
    return 'Play idea';
  }
  if (renderedFamily === 'feeding') {
    return 'Feeding tip';
  }
  if (renderedFamily === 'behavior') {
    return 'Behavior tip';
  }
  if (renderedFamily === 'safety') {
    return 'Safety tip';
  }
  return 'Development tip';
}

function getRenderedCategoryFamily_(selectedTip, requestType) {
  var normalized = normalizeRequestType_(requestType);
  if (normalized === 'another_tip') {
    return 'development';
  }
  if (normalized === 'sleep' || normalized === 'play' || normalized === 'feeding' || normalized === 'behavior') {
    return normalized;
  }
  if (normalized === 'daily') {
    var candidate = canonicalizeTopic_(selectedTip.category_family || selectedTip.category || selectedTip.topic);
    if (candidate === 'sleep') {
      return 'sleep';
    }
    if (candidate === 'feeding') {
      return 'feeding';
    }
    if (candidate === 'learning/play') {
      return 'play';
    }
    if (candidate === 'behavior' || candidate === 'emotional development') {
      return 'behavior';
    }
    if (candidate === 'safety') {
      return 'safety';
    }
    return 'development';
  }
  return 'development';
}

function buildAgeContextLine_(guide) {
  var name = guide.kid_name || guide.child_name || 'Your child';
  return toNameCase(name) + ' is ' + formatExactAndReadableAge(guide.age_days) + '.';
}

function buildChildHeaderLine_(guide, mode) {
  var name = toNameCase(guide.kid_name || guide.child_name || 'Your child');
  return mode === 'followup' ? 'For ' + name : 'Today with ' + name;
}

function buildChildAgeStageLine_(guide, tip) {
  var ageText = cleanText((tip && tip.readableAge) || '');
  var stageText = cleanText(guide.stage || '');

  if (ageText && stageText) {
    return 'Age/Stage: ' + ageText + ' | ' + stageText;
  }
  if (ageText) {
    return 'Age: ' + ageText;
  }
  if (stageText) {
    return 'Stage: ' + stageText;
  }
  return '';
}

function humanizeInsight(guide, requestType, ageProfile) {
  var renderFamily = resolveRenderFamily_(guide, requestType);
  var recent = getRecentRenderedFieldValues_(guide.kid_id, 'insight_rendered');
  var raw = cleanKnowledgeText_(guide.insight || guide.summary || '');
  var templates = getTemplateLines_(renderFamily, getAgeBandKey_(ageProfile.age_days), 'insight');
  var text = shouldPreferTemplate_(raw, renderFamily, ageProfile) || isRepeatedLine_(raw, recent) || !isTextAgeBandSafe_(raw, getAgeBandKey_(ageProfile.age_days))
    ? chooseFreshVariant_(templates, recent, guide.kid_id + ':insight:' + guide.tip_id)
    : raw;
  text = shortenAtSentenceBoundary(text, 180);
  if (countSentences_(text) > 2) {
    text = keepFirstSentences_(text, 2);
  }
  return ensureCompleteSentence(text);
}

function humanizeAction(guide, requestType, ageProfile) {
  var renderFamily = resolveRenderFamily_(guide, requestType);
  var recent = getRecentRenderedFieldValues_(guide.kid_id, 'action_rendered');
  var raw = cleanKnowledgeText_(guide.action || guide.tip || guide.sms_tip || '')
    .replace(/^try this today[:\s-]*/i, '')
    .replace(/^try this[:\s-]*/i, '');
  var templates = getTemplateLines_(renderFamily, getAgeBandKey_(ageProfile.age_days), 'action');
  var text = shouldPreferTemplate_(raw, renderFamily, ageProfile) || isRepeatedLine_(raw, recent) || !isTextAgeBandSafe_(raw, getAgeBandKey_(ageProfile.age_days))
    ? chooseFreshVariant_(templates, recent, guide.kid_id + ':action:' + guide.tip_id)
    : raw;
  if (!isFamilyActionText_(text, renderFamily)) {
    text = chooseFreshVariant_(templates, recent, guide.kid_id + ':action-fallback:' + guide.tip_id);
  }
  text = shortenActionLine(text || 'Offer one simple moment of connection today.', 110);
  return ensureSentenceCompletion(ensureCompleteSentence(text));
}

function humanizeReassurance(guide, requestType, ageProfile) {
  var renderFamily = resolveRenderFamily_(guide, requestType);
  var recent = getRecentRenderedFieldValues_(guide.kid_id, 'reassurance_rendered');
  var raw = cleanKnowledgeText_(guide.encouragement || guide.reassurance || guide.parent_reassurance || '');
  var templates = getTemplateLines_(renderFamily, getAgeBandKey_(ageProfile.age_days), 'reassurance');
  var text = shouldPreferTemplate_(raw, renderFamily, ageProfile) || isRepeatedLine_(raw, recent) || !isTextAgeBandSafe_(raw, getAgeBandKey_(ageProfile.age_days))
    ? chooseFreshVariant_(templates, recent, guide.kid_id + ':reassurance:' + guide.tip_id)
    : raw;
  text = text.replace(/\bconsider talking with your pediatrician\b/ig, '');
  text = shortenAtSentenceBoundary(text, 85);
  if (countSentences_(text) > 1) {
    text = keepFirstSentences_(text, 1);
  }
  return ensureSentenceCompletion(ensureCompleteSentence(text));
}

function humanizeLeapLine_(text) {
  return shortenAtSentenceBoundary(text, 120);
}

function buildDailyOpener_(guides) {
  if (!guides || !guides.length) {
    return '';
  }
  var openers = APP_CONFIG.messaging.dailyOpeners || [];
  if (!openers.length) {
    return '';
  }
  var seed = Math.abs(hashString_(String(guides[0].tip_id || '') + ':' + String(guides.length)));
  if (seed % 4 === 0) {
    return '';
  }
  return openers[seed % openers.length];
}

function resolveRenderFamily_(guide, requestType) {
  var renderedFamily = getRenderedCategoryFamily_(guide, requestType);
  if (renderedFamily === 'play') {
    return 'learning/play';
  }
  if (renderedFamily === 'development') {
    return 'another_tip';
  }
  return renderedFamily;
}

function cleanKnowledgeText_(text) {
  return cleanDisplayText_(String(text || '')
    .replace(/\bchildren in this stage are developing\b/ig, '')
    .replace(/\bchildren in this stage are\b/ig, '')
    .replace(/\bchildren in the [^.,;:]+ stage are\b/ig, '')
    .replace(/\bat this age children are rapidly developing skills related to\b/ig, '')
    .replace(/\brapidly developing skills related to\b/ig, '')
    .replace(/\bsupports development\b/ig, '')
    .replace(/\bsuch as talking, playing\b/ig, '')
    .replace(/\bsmall daily interactions have a big impact\b/ig, '')
    .replace(/\bbrain connections\b/ig, 'learning')
    .replace(/\bconsisten(t|cy) interaction\b/ig, ''));
}

function shouldPreferTemplate_(text, renderFamily, ageProfile) {
  var value = cleanText(text).toLowerCase();
  if (!value) {
    return true;
  }
  if (isGenericKnowledgeText_(value)) {
    return true;
  }
  if (containsBannedOutputPhrase_(value)) {
    return true;
  }
  if (renderFamily === 'sleep') {
    return !/(sleep|nap|bedtime|night|wake|settle|routine|dim)/i.test(value);
  }
  if (renderFamily === 'feeding') {
    return !/(feed|feeding|eat|meal|bottle|nurs|solid|snack|hunger|appetite|ounce)/i.test(value);
  }
  if (renderFamily === 'learning/play') {
    return !/(play|game|toy|peekaboo|touch|voice|eye contact|blanket|stack|hide|explore|reach)/i.test(value);
  }
  if (renderFamily === 'behavior' || renderFamily === 'emotional development') {
    return !/(feeling|fussy|cue|boundary|tantrum|transition|sooth|connection|co-regulat|frustrat|misbehavior)/i.test(value);
  }
  if (renderFamily === 'safety') {
    return !/(safe|safety|climb|grab|roll|surface|supervis|hazard)/i.test(value);
  }
  if (ageProfile && !isTextAgeBandSafe_(value, getAgeBandKey_(ageProfile.age_days))) {
    return true;
  }
  return false;
}

function isGenericKnowledgeText_(text) {
  return /rapidly developing skills related to|small daily moments add up|keep one interaction simple|simple routines, connection|at this age children often learn through|steady everyday moments|supports development|such as talking, playing/i.test(text);
}

function getRecentRenderedFieldValues_(kidId, field) {
  var rows = getRecentRenderedHistoryForKid(kidId, 5);
  var values = [];
  for (var i = 0; i < rows.length; i += 1) {
    if (cleanText(rows[i][field])) {
      values.push(cleanText(rows[i][field]));
    }
  }
  return values;
}

function isRepeatedLine_(text, recentValues) {
  var firstSentence = extractFirstSentence_(text);
  if (!firstSentence) {
    return false;
  }
  for (var i = 0; i < recentValues.length; i += 1) {
    if (extractFirstSentence_(recentValues[i]).toLowerCase() === firstSentence.toLowerCase()) {
      return true;
    }
  }
  return false;
}

function chooseFreshVariant_(variants, recentValues, seedSource) {
  if (!variants || !variants.length) {
    return '';
  }
  var available = variants.filter(function(item) {
    return !isRepeatedLine_(item, recentValues);
  });
  if (!available.length) {
    available = variants.slice();
  }
  var seed = Math.abs(hashString_(String(seedSource || '') + ':' + available.length));
  return available[seed % available.length];
}

function validateRenderedTip_(child, selectedTip, rendered, requestType, ageProfile) {
  var ageBand = getAgeBandKey_(ageProfile.age_days);
  var renderFamily = resolveRenderFamily_(selectedTip, requestType);
  var normalizedRequestType = normalizeRequestType_(requestType);
  var expectedCategoryLabel = mapCategoryLabel(
    selectedTip.original_category || selectedTip.category || selectedTip.topic,
    normalizedRequestType === 'daily' || normalizedRequestType === 'another_tip' ? renderFamily : normalizedRequestType
  );
  var validated = {
    categoryLabel: cleanText(rendered.categoryLabel) || expectedCategoryLabel,
    categoryFamily: cleanText(rendered.categoryFamily) || getRenderedCategoryFamily_(selectedTip, normalizedRequestType),
    insight: ensureSentenceCompletion(ensureCompleteSentence(cleanDisplayText_(rendered.insight))),
    action: ensureSentenceCompletion(ensureCompleteSentence(cleanDisplayText_(rendered.action))),
    reassurance: ensureSentenceCompletion(ensureCompleteSentence(cleanDisplayText_(rendered.reassurance))),
    readableAge: rendered.readableAge || ageProfile.readable_age
  };

  if (!isCategoryLabelValidForFamily_(validated.categoryLabel, normalizedRequestType, validated.categoryFamily)) {
    validated.categoryLabel = expectedCategoryLabel;
    validated.categoryFamily = getRenderedCategoryFamily_(selectedTip, normalizedRequestType);
  }

  var fallbackSet = getHardFallbackRenderSet_(normalizedRequestType, ageBand, validated.categoryFamily);
  var shouldFallbackAll = false;
  if (!isRenderedFieldValid_(validated.insight) || !isTextAgeBandSafe_(validated.insight, ageBand) || !isFamilyConsistentText_(validated.insight, validated.categoryFamily, 'insight')) {
    shouldFallbackAll = true;
  }
  if (!isRenderedFieldValid_(validated.action) || !isTextAgeBandSafe_(validated.action, ageBand) || !isFamilyConsistentText_(validated.action, validated.categoryFamily, 'action') || !isFamilyActionText_(validated.action, validated.categoryFamily)) {
    shouldFallbackAll = true;
  }
  if (!isRenderedFieldValid_(validated.reassurance, 6) || !isTextAgeBandSafe_(validated.reassurance, ageBand) || containsBannedOutputPhrase_(validated.reassurance)) {
    shouldFallbackAll = true;
  }

  if (shouldFallbackAll) {
    validated.categoryLabel = fallbackSet.categoryLabel || expectedCategoryLabel;
    validated.categoryFamily = fallbackSet.categoryFamily || validated.categoryFamily;
    validated.insight = fallbackSet.insight;
    validated.action = fallbackSet.action;
    validated.reassurance = fallbackSet.reassurance;
  }

  return validated;
}

function isRenderedFieldValid_(text, minLength) {
  var value = cleanText(text);
  if (!value || value.length < (minLength || 8)) {
    return false;
  }
  if (/^(sleep|feeding|behavior|play|development|safety|connection)\.?$/i.test(value)) {
    return false;
  }
  if (containsBannedOutputPhrase_(value)) {
    return false;
  }
  return !/\b([A-Za-z]+)\s+\1\b/i.test(value);
}

function isTextAgeBandSafe_(text, ageBand) {
  var value = cleanText(text).toLowerCase();
  if (!value) {
    return false;
  }
  if (ageBand === 'newborn') {
    return !/(toddler|preschool|tantrum|friendship|turn-taking|discipline|pretend play|carry socks|two small choices)/i.test(value);
  }
  if (ageBand === 'toddler') {
    return !/(newborn|swaddle|diaper change|startle reflex|day-night rhythm|quiet nighttime feeds)/i.test(value);
  }
  if (ageBand === 'older_child') {
    return !/(newborn|swaddle|bottle|tummy time|peekaboo)/i.test(value);
  }
  return true;
}

function containsBannedOutputPhrase_(text) {
  var value = cleanText(text).toLowerCase();
  if (!value) {
    return false;
  }
  return /steady everyday moments|safe exploration help strengthen learning|supports development|such as talking,\s*playing|small daily interactions have a big impact|children in this stage|rapidly developing skills related to|^sleep\.\b|^safety\.\b|^behavior\.\b|^feeding\.\b|^development\.\b|^play\.\b/i.test(value);
}

function isCategoryLabelValidForFamily_(categoryLabel, requestType, renderFamily) {
  var expected = mapRenderedCategoryLabel_(renderFamily);
  return cleanText(categoryLabel).toLowerCase() === cleanText(expected).toLowerCase();
}

function isFamilyConsistentText_(text, renderFamily, field) {
  var value = cleanText(text).toLowerCase();
  if (!value || containsBannedOutputPhrase_(value)) {
    return false;
  }
  if (renderFamily === 'sleep') {
    return /(sleep|nap|bedtime|night|wake|settle|routine|dim)/i.test(value);
  }
  if (renderFamily === 'feeding') {
    return /(feed|feeding|eat|meal|bottle|nurs|solid|food|hunger|appetite|ounce)/i.test(value);
  }
  if (renderFamily === 'learning/play') {
    return /(play|game|toy|peekaboo|touch|voice|eye contact|blanket|stack|hide|explore|texture|pretend|object)/i.test(value);
  }
  if (renderFamily === 'behavior' || renderFamily === 'emotional development') {
    return /(feeling|fussy|cue|boundary|tantrum|transition|sooth|connection|frustrat|misbehavior|closeness|environment|regulation)/i.test(value);
  }
  if (renderFamily === 'safety') {
    return /(safe|safety|climb|grab|roll|surface|supervis|hazard|sleep space|out of reach)/i.test(value);
  }
  if (field === 'action') {
    return value.length >= 12;
  }
  return true;
}

function isFamilyActionText_(text, renderedFamily) {
  var value = cleanText(text).toLowerCase();
  if (!value || containsBannedOutputPhrase_(value)) {
    return false;
  }
  if (renderedFamily === 'sleep') {
    return /(quiet|dim|bedtime|routine|calming|nap|settle|nighttime|sleep)/i.test(value);
  }
  if (renderedFamily === 'play') {
    return /(toy|object|game|sensory|stack|blanket|explore|pretend|texture|container|play)/i.test(value);
  }
  if (renderedFamily === 'feeding') {
    return /(feeding|bottle|breast|meal|portion|food|hunger|cue|eat)/i.test(value);
  }
  if (renderedFamily === 'behavior') {
    return /(stay close|feeling|choice|calmer environment|cue|one direction|connection|lowering noise|name the feeling)/i.test(value);
  }
  if (renderedFamily === 'development') {
    return /(movement|sound|repeating|container|simple task|body|stretch|copy one sound|stacking|filling)/i.test(value);
  }
  return true;
}

function ensureSentenceCompletion(text) {
  var value = cleanText(text);
  if (!value) {
    return '';
  }
  value = value
    .replace(/difference between day\.$/i, 'difference between day and night.')
    .replace(/supports sleep development[,.]?$/i, 'supports sleep.')
    .replace(/or exploring objects together\.$/i, 'or exploring objects together safely.')
    .replace(/or calming transition\.$/i, 'or a calming transition.')
    .replace(/or a calmer environment\.$/i, 'or a calmer environment.')
    .replace(/and dim whenever you can\.$/i, 'and dim whenever you can.');
  return ensureCompleteSentence(value);
}

function getHardFallbackRenderSet_(requestType, ageBand, renderFamily) {
  var effectiveFamily = renderFamily;
  if (requestType === 'daily' && (!effectiveFamily || effectiveFamily === 'development')) {
    effectiveFamily = 'another_tip';
  }
  if (requestType === 'another_tip') {
    effectiveFamily = 'another_tip';
  }

  var categoryLabel = mapCategoryLabel(effectiveFamily, requestType === 'daily' || requestType === 'another_tip' ? effectiveFamily : requestType);
  var fallbackMap = {
    'sleep:newborn': {
      insight: 'Newborn sleep is still driven mostly by feeding and comfort, not by a true day-night rhythm yet.',
      action: 'Keep nighttime feeds quiet and dim whenever you can.',
      reassurance: 'This stage is tiring, but it is very normal.'
    },
    'sleep:early_baby': {
      insight: 'Sleep can still be uneven at this age because naps and night sleep are both still developing.',
      action: 'Try giving your baby a few quiet minutes before sleep instead of stretching wake time too long.',
      reassurance: 'Short stretches and changing naps are common right now.'
    },
    'sleep:older_baby': {
      insight: 'Older babies often sleep better with predictable transitions into naps and bedtime.',
      action: 'Use the same short calming routine before one sleep today.',
      reassurance: 'Simple routines often help more than longer ones.'
    },
    'sleep:toddler': {
      insight: 'Bedtime resistance often increases when toddlers are growing in independence.',
      action: 'Keep bedtime steps in the same order tonight.',
      reassurance: 'Predictable routines help toddlers settle more easily.'
    },
    'sleep:older_child': {
      insight: 'Preschoolers often sleep better when bedtime feels calm and consistent rather than rushed.',
      action: 'Try starting bedtime 10 minutes earlier with one predictable quiet activity.',
      reassurance: 'A calm rhythm matters more than a perfect bedtime.'
    },
    'learning/play:newborn': {
      insight: 'Newborns learn through simple things like touch, voice, and eye contact.',
      action: 'During one diaper change, pause and talk softly while your baby watches your face.',
      reassurance: 'Tiny moments like this matter more than they seem.'
    },
    'learning/play:early_baby': {
      insight: 'Babies this age learn through reaching, looking, and exploring simple textures.',
      action: 'Offer one safe object with a different texture during awake time.',
      reassurance: 'Simple sensory play goes a long way.'
    },
    'learning/play:older_baby': {
      insight: 'Older babies love games that build curiosity and memory.',
      action: 'Hide a toy partly under a blanket and let your baby find it.',
      reassurance: 'Little discoveries like this build confidence.'
    },
    'learning/play:toddler': {
      insight: 'Toddlers love simple games where they can predict what happens next.',
      action: 'Hide a toy under a blanket and let your toddler find it.',
      reassurance: 'That kind of repetition builds confidence and memory.'
    },
    'learning/play:older_child': {
      insight: 'Preschoolers learn well through pretend play, matching, and simple problem solving.',
      action: 'Set up a tiny pretend game with two or three household objects.',
      reassurance: 'Open-ended play builds flexible thinking.'
    },
    'feeding:newborn': {
      insight: 'Newborn feeding is also about comfort, rhythm, and regulation, not just ounces.',
      action: 'Pause once during a feeding if your baby seems frantic and help them reset.',
      reassurance: 'Feeding can be as much about calm as it is about volume.'
    },
    'feeding:early_baby': {
      insight: 'Babies often feed a little differently from one part of the day to another.',
      action: 'Watch for early hunger cues today like rooting or hand-to-mouth movements.',
      reassurance: 'Responsive feeding helps both of you settle in.'
    },
    'feeding:older_baby': {
      insight: 'As babies get older, feeding becomes more sensory and exploratory too.',
      action: 'Let your baby touch and explore one food safely during a meal.',
      reassurance: 'Messy exploration is often part of learning.'
    },
    'feeding:toddler': {
      insight: 'Toddlers often eat unevenly from meal to meal, and that can be completely normal.',
      action: 'Offer small portions and let your toddler ask for more.',
      reassurance: 'A little pressure-free structure goes a long way.'
    },
    'feeding:older_child': {
      insight: 'Preschoolers usually do best with calm meal structure and low pressure.',
      action: 'Serve one familiar food alongside something less familiar today.',
      reassurance: 'Comfort with food often builds slowly.'
    },
    'behavior:newborn': {
      insight: 'Newborn fussiness is usually a cue, not misbehavior.',
      action: 'Notice whether your baby seems to need feeding, closeness, or a calmer environment.',
      reassurance: 'You’re learning each other right now.'
    },
    'behavior:early_baby': {
      insight: 'Babies often get fussy when they are overstimulated, tired, or ready for a reset.',
      action: 'Try lowering noise and light for a few minutes when fussiness builds.',
      reassurance: 'Small changes in the environment can help a lot.'
    },
    'behavior:older_baby': {
      insight: 'Older babies often show frustration before they have the words or motor skills to do what they want.',
      action: 'Pause and help with the next small step instead of rushing in fully.',
      reassurance: 'Frustration is often part of learning.'
    },
    'behavior:toddler': {
      insight: 'Big feelings can come fast at this age because self-control is still very new.',
      action: 'Stay close and name the feeling before giving a direction.',
      reassurance: 'Connection first often lowers the intensity.'
    },
    'behavior:older_child': {
      insight: 'Preschool behavior often improves when expectations are simple and predictable.',
      action: 'Give one clear instruction at a time today instead of stacking multiple directions.',
      reassurance: 'Clarity usually works better than repetition.'
    },
    'another_tip:newborn': {
      insight: 'Newborn movements can look jerky at first because the nervous system is still organizing.',
      action: 'Give your baby a few quiet minutes on a flat safe surface to stretch and move.',
      reassurance: 'Small moments like this help your baby learn their body.'
    },
    'another_tip:early_baby': {
      insight: 'Babies this age learn a lot through movement, sounds, and back-and-forth interaction.',
      action: 'Copy one sound your baby makes and pause to see if they answer back.',
      reassurance: 'Little exchanges like this help build connection and communication.'
    },
    'another_tip:older_baby': {
      insight: 'Older babies learn by repeating the same actions again and again.',
      action: 'Let your baby practice putting something into and out of a container.',
      reassurance: 'Repetition like this is often how learning sticks.'
    },
    'another_tip:toddler': {
      insight: 'Toddlers often learn best by doing the same action many times in a row.',
      action: 'Set up one simple activity they can repeat, like stacking or filling a container.',
      reassurance: 'Repetition helps toddlers build skill and confidence.'
    },
    'another_tip:older_child': {
      insight: 'Preschoolers often grow through simple routines that let them practice independence.',
      action: 'Let your child handle one small task start to finish today.',
      reassurance: 'Independence grows through practice, not perfection.'
    },
    'safety:newborn': {
      insight: 'Newborns do best with calm handling, safe sleep habits, and a low-stimulation environment.',
      action: 'Keep the sleep space clear and place your baby down on their back.',
      reassurance: 'Simple routines make safe care easier to repeat.'
    },
    'safety:early_baby': {
      insight: 'As babies get more active, safety starts to mean watching for rolling, grabbing, and quick changes in position.',
      action: 'Keep one common changing or play surface clear and within arm’s reach today.',
      reassurance: 'A little setup goes a long way.'
    },
    'safety:older_baby': {
      insight: 'Older babies move fast into climbing, pulling, and grabbing before they understand risk.',
      action: 'Move one tempting unsafe object out of reach before play starts.',
      reassurance: 'Preparing the space is often easier than correcting in the moment.'
    },
    'safety:toddler': {
      insight: 'Toddlers move fast at this age, so safety often means preparing the space before curiosity takes over.',
      action: 'Walk one room today and move one tempting unsafe item out of reach.',
      reassurance: 'Environmental changes usually work better than repeated warnings.'
    },
    'safety:older_child': {
      insight: 'Preschoolers still need simple consistent reminders when excitement outruns caution.',
      action: 'Pick one recurring safety rule today and practice it before the busy moment happens.',
      reassurance: 'Simple practice usually works better than bigger lectures.'
    }
  };

  var key = effectiveFamily + ':' + ageBand;
  var fallback = fallbackMap[key] || fallbackMap['another_tip:' + ageBand] || fallbackMap['another_tip:newborn'];
  return {
    categoryFamily: effectiveFamily,
    categoryLabel: categoryLabel,
    insight: fallback.insight,
    action: fallback.action,
    reassurance: fallback.reassurance
  };
}

function extractFirstSentence_(text) {
  var value = cleanText(text);
  if (!value) {
    return '';
  }
  var parts = extractSegments_(value, /(?<=[.!?])\s+/);
  return cleanText(parts[0] || value);
}

function getTemplateLines_(renderFamily, ageBand, field) {
  var key = renderFamily + ':' + ageBand + ':' + field;
  var templates = {
    'another_tip:newborn:insight': [
      'Newborn movements can look jerky at first because the nervous system is still getting organized.',
      'Many newborns are still learning how to move, settle, and take in the world outside the womb.'
    ],
    'another_tip:newborn:action': [
      'Give your baby a few quiet minutes on a flat safe surface to stretch and move.',
      'Pause during one calm moment and let your baby move arms and legs freely.'
    ],
    'another_tip:newborn:reassurance': [
      'Small moments like this help your baby learn their body.',
      'Early movement can look uneven, and that is very normal.'
    ],
    'another_tip:early_baby:insight': [
      'Babies this age are often busy reaching, kicking, and practicing more purposeful movement.',
      'Around this age you may notice your baby getting more interested in what their body can do.'
    ],
    'another_tip:early_baby:action': [
      'Place one interesting object nearby during floor time so your baby can reach toward it.',
      'Give your baby a few minutes on the floor today to practice reaching and kicking.'
    ],
    'another_tip:early_baby:reassurance': [
      'Little bits of floor practice add up quickly at this age.',
      'A few calm minutes of practice can go a long way.'
    ],
    'another_tip:older_baby:insight': [
      'Older babies learn a lot by dropping, banging, and repeating simple actions.',
      'At this age repetition often looks messy, but it is part of real learning.'
    ],
    'another_tip:older_baby:action': [
      'Offer one object your baby can safely pick up, drop, and explore again.',
      'Let your baby repeat one simple cause-and-effect action a few times today.'
    ],
    'another_tip:older_baby:reassurance': [
      'Repetition like this often means your baby is figuring something out.',
      'What looks simple to you can feel like a big experiment to your baby.'
    ],
    'another_tip:toddler:insight': [
      'Toddlers often repeat the same actions again and again because repetition helps them learn.',
      'At this age toddlers learn a lot by doing the same thing over and over on purpose.'
    ],
    'another_tip:toddler:action': [
      'Let your toddler practice putting objects into and out of a container.',
      'Offer one simple task your toddler can repeat a few times, like stacking or pouring.'
    ],
    'another_tip:toddler:reassurance': [
      'Repetition like this is often how toddlers learn.',
      'The urge to repeat is usually a sign that learning is happening.'
    ],
    'sleep:newborn:insight': [
      'Newborn sleep is still driven mostly by feeding, not by a true day-night rhythm yet.',
      'At this age sleep is still tied closely to feeding, comfort, and regulation.'
    ],
    'sleep:newborn:action': [
      'Keep nighttime feeds quiet and dim.',
      'Use a lower voice and softer light during overnight feeds.'
    ],
    'sleep:newborn:reassurance': [
      'That helps your baby slowly learn the difference between day and night.',
      'A gentle day-night rhythm builds slowly from these small cues.'
    ],
    'sleep:early_baby:insight': [
      'Baby sleep can still shift a lot right now as naps and nighttime start sorting themselves out.',
      'At this age sleep is often still uneven, even when a pattern seems to be forming.'
    ],
    'sleep:early_baby:action': [
      'Use the same short wind-down before one nap today.',
      'Try one simple nap cue today like dimming the room or soft talking.'
    ],
    'sleep:early_baby:reassurance': [
      'A little predictability helps, even before sleep becomes truly predictable.',
      'Rhythm usually builds gradually, not all at once.'
    ],
    'sleep:older_baby:insight': [
      'Sleep can wobble when babies are working on new skills like standing, cruising, or babbling.',
      'It is common for sleep to feel less steady when your baby is learning something big.'
    ],
    'sleep:older_baby:action': [
      'Keep the bedtime routine calm and short tonight.',
      'Offer a few minutes of quiet wind-down before bed instead of stretching bedtime later.'
    ],
    'sleep:older_baby:reassurance': [
      'A few wobbly nights do not mean the whole routine is off track.',
      'Skill bursts can temporarily shake up otherwise steady sleep.'
    ],
    'sleep:toddler:insight': [
      'Bedtime pushback often increases when toddlers are growing in independence.',
      'Toddlers often resist bedtime more when they are practicing independence all day.'
    ],
    'sleep:toddler:action': [
      'Keep bedtime steps in the same order each night.',
      'Use the same simple bedtime sequence tonight so your toddler knows what comes next.'
    ],
    'sleep:toddler:reassurance': [
      'Predictable routines help toddlers settle more easily.',
      'Consistency helps bedtime feel less like a negotiation.'
    ],
    'learning/play:newborn:insight': [
      'Newborns learn through simple things like touch, voice, and eye contact.',
      'For a newborn, play is often as simple as watching your face and hearing your voice.'
    ],
    'learning/play:newborn:action': [
      'During one diaper change, pause and talk softly while your baby watches your face.',
      'Pick one calm moment today and let your baby study your face while you talk softly.'
    ],
    'learning/play:newborn:reassurance': [
      'Tiny moments like this matter more than they seem.',
      'Simple sensory moments are plenty at this age.'
    ],
    'learning/play:early_baby:insight': [
      'Babies this age often love play that lets them watch, reach, and hear a familiar voice.',
      'Simple play works best right now when your baby can see, hear, and reach toward you.'
    ],
    'learning/play:early_baby:action': [
      'Hold a simple object nearby and let your baby bat or reach toward it.',
      'Try one short reaching game today with a soft toy or cloth.'
    ],
    'learning/play:early_baby:reassurance': [
      'Short playful moments are plenty at this age.',
      'Your baby does not need a big activity to learn something new.'
    ],
    'learning/play:older_baby:insight': [
      'Older babies love simple games where something appears, disappears, or makes a sound.',
      'At this age play often becomes more about repeating a pattern to see what happens.'
    ],
    'learning/play:older_baby:action': [
      'Play a short peekaboo game or let your baby drop an object and watch you bring it back.',
      'Use one simple cause-and-effect game today like hide-and-find or drop-and-return.'
    ],
    'learning/play:older_baby:reassurance': [
      'Simple repetition helps babies make sense of what comes next.',
      'The best games right now are usually the simplest ones.'
    ],
    'learning/play:toddler:insight': [
      'Toddlers love simple games where they can predict what happens next.',
      'At this age toddlers are drawn to games with a clear repeatable pattern.'
    ],
    'learning/play:toddler:action': [
      'Hide a toy under a blanket and let your child find it.',
      'Play a simple turn-taking game with a hidden toy or cup.'
    ],
    'learning/play:toddler:reassurance': [
      'That kind of repetition builds confidence and memory.',
      'Predictable play often helps toddlers feel capable and engaged.'
    ],
    'feeding:newborn:insight': [
      'Newborn feeding is also about comfort and regulation, not just ounces.',
      'At this age feeding can be as much about settling and rhythm as it is about volume.'
    ],
    'feeding:newborn:action': [
      'Pause once during a feeding to let your baby reset if they seem frantic.',
      'If feeding gets rushed, slow down for a brief reset before continuing.'
    ],
    'feeding:newborn:reassurance': [
      'Feeding can be as much about calm as it is about ounces.',
      'A calmer feeding often helps both of you settle.'
    ],
    'feeding:early_baby:insight': [
      'Feeding rhythm can still shift a lot right now, even when your baby starts acting more alert.',
      'At this age hunger cues can come fast when your baby is growing quickly.'
    ],
    'feeding:early_baby:action': [
      'Notice the first small hunger cue today instead of waiting for full frustration.',
      'See if catching one feeding a little earlier changes the tone of the whole feed.'
    ],
    'feeding:early_baby:reassurance': [
      'Earlier cues often make feeding feel easier for both of you.',
      'A small timing change can make a feeding feel much calmer.'
    ],
    'feeding:older_baby:insight': [
      'Babies learning solids often need many calm exposures before a food feels familiar.',
      'Interest in solids can be uneven at first, even when curiosity is growing.'
    ],
    'feeding:older_baby:action': [
      'Offer one small taste without pressure and let your baby explore it at their own pace.',
      'Keep one food exposure low-pressure today and let your baby decide how much to engage.'
    ],
    'feeding:older_baby:reassurance': [
      'Practice around food often matters more than one perfect bite.',
      'Calm repeated exposure usually works better than pressure.'
    ],
    'feeding:toddler:insight': [
      'Toddlers often eat unevenly from meal to meal, and that can be completely normal.',
      'At this age appetite can swing a lot from one meal to the next.'
    ],
    'feeding:toddler:action': [
      'Offer small portions and let your child ask for more.',
      'Keep portions small at first so your toddler can come back for more.'
    ],
    'feeding:toddler:reassurance': [
      'A little pressure-free structure goes a long way.',
      'Less pressure at meals often leads to steadier eating over time.'
    ],
    'behavior:newborn:insight': [
      'Newborn fussiness is usually a cue, not misbehavior.',
      'At this age fussiness usually means your baby needs help with comfort, feeding, or calm.'
    ],
    'behavior:newborn:action': [
      'Notice whether your baby seems to need feeding, closeness, or a calmer environment.',
      'Pause and check whether your baby seems to want feeding, contact, or less stimulation.'
    ],
    'behavior:newborn:reassurance': [
      'You’re learning each other right now.',
      'Reading cues takes time, and you are already learning a lot.'
    ],
    'behavior:early_baby:insight': [
      'Babies this age can get overwhelmed quickly when they are tired, hungry, or overstimulated.',
      'A fussy stretch often means your baby needs help settling, not more input.'
    ],
    'behavior:early_baby:action': [
      'Lower the stimulation for a minute and see if your baby settles with your voice or touch.',
      'If your baby gets wound up today, try reducing noise and movement before adding something new.'
    ],
    'behavior:early_baby:reassurance': [
      'A calmer environment can change the whole moment.',
      'This kind of fussiness is usually communication, not a bad habit.'
    ],
    'behavior:older_baby:insight': [
      'Older babies often protest hard during transitions because they are just starting to know what they want.',
      'At this age frustration can show up fast when something interesting stops.'
    ],
    'behavior:older_baby:action': [
      'Before ending an activity, give one calm warning and then help your baby through the transition.',
      'Try one slow transition today instead of switching activities abruptly.'
    ],
    'behavior:older_baby:reassurance': [
      'Transitions are hard when babies are getting more opinionated.',
      'A little predictability usually softens the shift.'
    ],
    'behavior:toddler:insight': [
      'Big feelings can come fast at this age because self-control is still very new.',
      'Toddlers can flip from calm to overwhelmed quickly because self-control is still developing.'
    ],
    'behavior:toddler:action': [
      'Stay close and name the feeling before giving a direction.',
      'Try naming the feeling first, then offer one simple limit.'
    ],
    'behavior:toddler:reassurance': [
      'Connection first often lowers the intensity.',
      'Staying close usually helps more than adding more words.'
    ],
    'behavior:older_child:insight': [
      'Older children still need help with big feelings, even when they look more capable on the outside.',
      'Strong reactions at this age often mean your child needs help slowing down, not just more correction.'
    ],
    'behavior:older_child:action': [
      'Pause first, name what is happening, and then keep the next direction simple.',
      'Try one calm reset today before talking through the problem.'
    ],
    'behavior:older_child:reassurance': [
      'Calm connection still matters a lot at this age.',
      'Even older kids borrow calm from us first.'
    ],
    'safety:newborn:insight': [
      'Newborns do best with a calm safe environment that is simple and easy to read.',
      'For newborns, safety is often about steady handling and a calm sleep space.'
    ],
    'safety:newborn:action': [
      'Keep the sleep space clear and place your baby down on their back.',
      'Use one calm consistent sleep setup today with a clear flat surface.'
    ],
    'safety:newborn:reassurance': [
      'Simple routines make safe care easier to repeat.',
      'The safest setup is usually the simplest one.'
    ],
    'safety:toddler:insight': [
      'Toddlers move faster than their judgment, especially when something looks interesting.',
      'At this age curiosity often outruns caution.'
    ],
    'safety:toddler:action': [
      'Walk the room once today and move one tempting unsafe item out of reach.',
      'Choose one common grab point today and make it off-limits before it becomes a battle.'
    ],
    'safety:toddler:reassurance': [
      'A little setup now can prevent a lot of conflict later.',
      'Environmental changes usually work better than repeated warnings at this age.'
    ],
    'development:newborn:insight': [
      'Newborns feel safest with familiar voices, steady touch, and calm routines.',
      'At this age your baby is still learning how to settle outside the womb.'
    ],
    'development:newborn:action': [
      'Pause for a few seconds of eye contact during one feeding.',
      'Use one calm pause today to let your baby hear your voice and see your face.'
    ],
    'development:newborn:reassurance': [
      'Your presence is already deeply comforting.',
      'Calm familiar moments go a long way right now.'
    ],
    'development:early_baby:insight': [
      'Babies this age often want to watch closely, reach more, and spend a little longer taking things in.',
      'You may notice your baby getting more alert to faces, voices, and nearby objects.'
    ],
    'development:early_baby:action': [
      'Give your baby one calm face-to-face moment today with time to watch and respond.',
      'Pause during one awake window so your baby can watch your face and voice closely.'
    ],
    'development:early_baby:reassurance': [
      'These small back-and-forth moments teach a lot.',
      'Simple responsive moments are doing real work right now.'
    ],
    'development:older_baby:insight': [
      'Older babies often learn by dropping, banging, and exploring how objects move.',
      'At this age your baby may seem determined to repeat the same action many times.'
    ],
    'development:older_baby:action': [
      'Offer one safe object today that your baby can pick up, drop, and explore again.',
      'Let your baby repeat one simple movement game a few times without rushing them along.'
    ],
    'development:older_baby:reassurance': [
      'That repetition is often how babies learn what their actions can do.',
      'Messy repetitive play usually means real learning is happening.'
    ],
    'development:toddler:insight': [
      'Toddlers often push back more at this age because they’re learning they can have their own ideas.',
      'A lot of toddler resistance is really practice with independence.'
    ],
    'development:toddler:action': [
      'Offer two small choices instead of asking open-ended questions.',
      'Turn one hard moment today into a simple either-or choice.'
    ],
    'development:toddler:reassurance': [
      'This is a healthy part of growing independence.',
      'More opinions often show up right alongside more learning.'
    ],
    'learning/play:older_child:insight': [
      'Older children often learn best through playful problem solving and turn-taking.',
      'At this age play still does a lot of heavy lifting for learning and confidence.'
    ],
    'learning/play:older_child:action': [
      'Try one simple challenge today like a scavenger hunt or a turn-taking game.',
      'Offer one playful problem to solve together, then let your child take the lead.'
    ],
    'learning/play:older_child:reassurance': [
      'Play is still real learning at this age.',
      'A little playful challenge can build a lot of confidence.'
    ],
    'sleep:older_child:insight': [
      'Sleep can still wobble when days are busy, stimulating, or emotionally full.',
      'Older children often settle better when bedtime stays predictable, even after a big day.'
    ],
    'sleep:older_child:action': [
      'Keep tonight’s bedtime routine steady and a little quieter than usual.',
      'Choose one calming step tonight that happens the same way every night.'
    ],
    'sleep:older_child:reassurance': [
      'Predictability still helps sleep feel easier.',
      'A steady routine can do a lot of the work here.'
    ],
    'feeding:older_child:insight': [
      'Older children often eat better when meals feel structured but not pressured.',
      'Appetite can still swing a lot when your child is busy, growing, or distracted.'
    ],
    'feeding:older_child:action': [
      'Offer the meal, keep pressure low, and let your child decide how much to eat.',
      'Serve a small amount first and make seconds easy if your child wants more.'
    ],
    'feeding:older_child:reassurance': [
      'Less pressure usually supports steadier eating.',
      'A calm meal rhythm often matters more than one perfect meal.'
    ],
    'development:older_child:insight': [
      'Older children learn a lot right now through conversation, repetition, and trying things themselves.',
      'At this age independence grows fast, but so does the need for steady support.'
    ],
    'development:older_child:action': [
      'Invite your child to do one small task independently today and stay nearby if needed.',
      'Try one simple back-and-forth conversation today about what your child notices or remembers.'
    ],
    'development:older_child:reassurance': [
      'Small chances to try things alone can build real confidence.',
      'Support and independence usually grow together.'
    ]
  };

  return templates[key] || templates[renderFamily + ':older_child:' + field] || templates['development:toddler:' + field] || templates['development:newborn:' + field] || [''];
}

function countSentences_(text) {
  var matches = cleanText(text).match(/[.!?]+/g);
  return matches ? matches.length : (cleanText(text) ? 1 : 0);
}

function keepFirstSentences_(text, count) {
  var parts = extractSegments_(text, /(?<=[.!?])\s+/);
  return parts.slice(0, count).join(' ');
}

function formatActionBlock(actionText, label) {
  return finalizeSmsFormatting((label || 'Try this today:') + ' ' + shortenActionLine(actionText, 110));
}

function formatEncouragement(text) {
  var value = shortenAtSentenceBoundary(text, 70);
  return value ? finalizeSmsFormatting(value) : '';
}

function formatNextMenu(includeShare) {
  return finalizeSmsFormatting(buildNextActionMenu(includeShare));
}

function joinSectionsWithSpacing(sections) {
  var filtered = [];
  for (var i = 0; i < sections.length; i += 1) {
    if (cleanText(sections[i])) {
      filtered.push(cleanText(sections[i]));
    }
  }
  return filtered.join('\n\n');
}

function finalizeSmsFormatting(message) {
  return normalizeSmsNewlines(finalizeSmsCopy(message))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/([^\n])\n(Next)/g, '$1\n\n$2')
    .replace(/([^\n])\n(Try this today:)/g, '$1\n\n$2')
    .replace(/([^\n])\n(Try this:)/g, '$1\n\n$2')
    .trim();
}

function normalizeSmsNewlines(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeTopicLabel_(topicLabel) {
  var label = cleanText(topicLabel).replace(/:+$/, '');
  if (/^development(?: tip)?$/i.test(label) || /^motor development$/i.test(label)) {
    return 'Development';
  }
  if (/^sleep(?: tip)?$/i.test(label)) {
    return 'Sleep tip';
  }
  if (/^feeding(?: tip)?$/i.test(label)) {
    return 'Feeding tip';
  }
  if (/^learning\s*\/\s*play(?: tip)?$/i.test(label) || /^learning and play$/i.test(label) || /^play idea$/i.test(label)) {
    return 'Play idea';
  }
  if (/^behavior(?: tip)?$/i.test(label)) {
    return 'Behavior tip';
  }
  if (/^emotional(?: development)?(?: tip)?$/i.test(label)) {
    return 'Emotional development';
  }
  if (/^today'?s next step$/i.test(label)) {
    return 'Today\'s next step';
  }
  return label;
}

function normalizeTopicBody_(label, bodyText) {
  var body = cleanDisplayText_(bodyText);
  if (!body) {
    return body;
  }

  var normalizedLabel = normalizeTopicLabel_(label).toLowerCase();
  var duplicatePrefixes = [
    /^development:\s*/i,
    /^development tip:\s*/i,
    /^motor development:\s*/i,
    /^sleep tip:\s*/i,
    /^feeding tip:\s*/i,
    /^behavior tip:\s*/i,
    /^play idea:\s*/i,
    /^learning\s*\/\s*play:\s*/i,
    /^learning\/play tip:\s*/i,
    /^emotional development:\s*/i,
    /^emotional tip:\s*/i,
    /^today'?s next step:\s*/i
  ];

  for (var i = 0; i < duplicatePrefixes.length; i += 1) {
    body = body.replace(duplicatePrefixes[i], '');
  }

  if (normalizedLabel === 'development' && /^at this stage,/i.test(body)) {
    return 'Development at this stage ' + body.replace(/^at this stage,\s*/i, '').replace(/^at this stage\s*/i, '');
  }

  return body;
}

function cleanDisplayText_(text) {
  var value = cleanText(text);
  if (!value) {
    return '';
  }

  value = value
    .replace(/between children\./ig, '')
    .replace(/\b\d+\s*[-–]\s*\d+\s*months?\s+stage\b/ig, '')
    .replace(/\b\d+\s*[-–]\s*\d+\s*years?\s+stage\b/ig, '')
    .replace(/\bdevelopment varies widely\b/ig, '')
    .replace(/\bit is developmentally appropriate for\b/ig, '')
    .replace(/\bplease be advised\b/ig, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  value = dedupeConsecutiveWords_(value);
  return value;
}

function dedupeConsecutiveWords_(text) {
  return cleanText(text).replace(/\b([A-Za-z]+)\s+\1\b/ig, '$1');
}

function splitTopicTipText_(text) {
  var value = cleanText(text);
  var marker = '\n\nTry this: ';
  var index = value.indexOf(marker);
  if (index === -1) {
    return {
      insight: value,
      action: ''
    };
  }
  return {
    insight: cleanText(value.slice(0, index)),
    action: normalizeActionCopy_(value.slice(index + marker.length))
  };
}

function shortenAtSentenceBoundary(text, maxLen) {
  var value = cleanText(text);
  if (!value || value.length <= maxLen) {
    return ensureCompleteSentence(value);
  }

  var sentences = extractSegments_(value, /(?<=[.!?])\s+/);
  var built = '';
  for (var i = 0; i < sentences.length; i += 1) {
    var candidate = built ? built + ' ' + sentences[i] : sentences[i];
    if (candidate.length <= maxLen) {
      built = candidate;
    } else {
      break;
    }
  }
  if (built) {
    return ensureCompleteSentence(built);
  }

  return ensureCompleteSentence(shortenAtClauseBoundary(value, maxLen));
}

function shortenAtClauseBoundary(text, maxLen) {
  var value = cleanText(text);
  if (!value || value.length <= maxLen) {
    return cleanTrailingFragment(value);
  }

  var clauses = extractSegments_(value, /,\s+|;\s+|:\s+/);
  var built = '';
  for (var i = 0; i < clauses.length; i += 1) {
    var separator = built ? ', ' : '';
    var candidate = built + separator + clauses[i];
    if (candidate.length <= maxLen) {
      built = candidate;
    } else {
      break;
    }
  }
  if (built) {
    return cleanTrailingFragment(built);
  }

  return shortenAtWordBoundary(value, maxLen);
}

function shortenAtWordBoundary(text, maxLen) {
  var value = cleanText(text);
  if (!value || value.length <= maxLen) {
    return cleanTrailingFragment(value);
  }

  var words = value.split(/\s+/);
  var built = '';
  for (var i = 0; i < words.length; i += 1) {
    var candidate = built ? built + ' ' + words[i] : words[i];
    if (candidate.length <= maxLen) {
      built = candidate;
    } else {
      break;
    }
  }

  if (built) {
    return cleanTrailingFragment(built);
  }

  return cleanTrailingFragment(value.slice(0, maxLen));
}

function shortenActionLine(text, maxLen) {
  var value = normalizeActionCopy_(text);
  if (!value) {
    return 'Keep one interaction simple and repeatable.';
  }

  var shortened = shortenAtSentenceBoundary(value, maxLen);
  if (!shortened) {
    shortened = shortenAtWordBoundary(value, maxLen);
  }
  return ensureCompleteSentence(shortened);
}

function cleanTrailingFragment(text) {
  var normalized = normalizeSmsNewlines(text);
  if (!normalized) {
    return '';
  }

  var lines = normalized.split('\n');
  for (var i = 0; i < lines.length; i += 1) {
    lines[i] = cleanLineFragment_(lines[i]);
  }

  return normalizeSmsNewlines(lines.join('\n'));
}

function ensureCompleteSentence(text) {
  var value = cleanTrailingFragment(text);
  if (!value) {
    return '';
  }
  if (!/[.!?]$/.test(value)) {
    value += '.';
  }
  return value;
}

function finalizeSmsCopy(text) {
  return normalizeSmsNewlines(cleanTrailingFragment(text))
    .replace(/ {2,}/g, ' ')
    .replace(/([.!?]){2,}/g, '$1')
    .replace(/:\s*(\n|$)/g, '$1')
    .trim();
}

function cleanLineFragment_(text) {
  return cleanText(text)
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([,;:.!?])/g, '$1')
    .replace(/[,:;\-]+$/, '')
    .replace(/\b(like|because|when|and|or|but|so|to|with|for|if|then)\.?$/i, '')
    .trim();
}

function validateChildSection(section) {
  var value = finalizeSmsFormatting(section);
  if (!value) {
    return '';
  }

  var blocks = value.split(/\n\n+/);
  if (blocks.length < 2) {
    return value;
  }

  var normalizedBlocks = [];
  for (var i = 0; i < blocks.length; i += 1) {
    var lines = blocks[i].split('\n');
    if (lines.length >= 2 && /:$/.test(lines[0])) {
      if (/^Try this today:?$/i.test(lines[0]) || /^Try this:?$/i.test(lines[0]) || /^Today's next step:?$/i.test(lines[0])) {
        normalizedBlocks.push(formatActionBlock(lines.slice(1).join(' '), lines[0]));
      } else {
        normalizedBlocks.push(formatTopicBlock(lines[0], lines.slice(1).join(' ')));
      }
    } else {
      normalizedBlocks.push(finalizeSmsFormatting(blocks[i]));
    }
  }

  return finalizeSmsFormatting(joinSectionsWithSpacing(normalizedBlocks));
}

function extractSegments_(text, splitter) {
  return cleanText(text).split(splitter).filter(function(part) {
    return cleanText(part);
  });
}

function getMaxPartBodyLength_() {
  return APP_CONFIG.sms.maxMessagePartLength - 28;
}

function capitalizeTopicLabel_(topic) {
  if (topic === 'learning/play') {
    return 'Play idea';
  }
  if (topic === 'emotional development') {
    return 'Emotional development';
  }
  if (topic === 'behavior') {
    return 'Behavior';
  }
  if (topic === 'today\'s next step') {
    return 'Today\'s next step';
  }
  return String(topic || '').charAt(0).toUpperCase() + String(topic || '').slice(1);
}

function buildQuestionReply(parent, kid, questionText) {
  var ageBreakdown = getAgeBreakdown(kid.date_of_birth, getTimezoneForParent(parent));
  var knowledge = findKnowledgeByQuestion(questionText, ageBreakdown.total_days);
  if (!knowledge) {
    return null;
  }

  var childHeader = formatChildHeader({
    kid_name: kid.kid_name,
    age_days: ageBreakdown.total_days,
    stage: knowledge.stage || getStageForAgeDays(ageBreakdown.total_days)
  });

  return appendNextMenu(joinSectionsWithSpacing([
    'For ' + childHeader.replace(/\s-\s/g, ' \u2014 '),
    formatTopicBlock(topicHeaderLabel_(knowledge.topic || 'development'), knowledge.insight || knowledge.summary),
    formatActionBlock(knowledge.action || knowledge.tip, 'Try this today:'),
    formatEncouragement(knowledge.encouragement || knowledge.reassurance)
  ]), true);
}
