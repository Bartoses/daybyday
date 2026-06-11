function getKnowledgeRows() {
  var sheet = getSheetByKey('knowledge');
  var values = sheet.getDataRange().getValues();
  if (values.length <= 1) {
    return [];
  }

  var headers = values[0].map(function(header) {
    return cleanText(header).toLowerCase();
  });
  var rows = [];

  for (var i = 1; i < values.length; i += 1) {
    var row = values[i];
    var normalized = normalizeKnowledgeRow_(headers, row, i);
    if (normalized) {
      rows.push(normalized);
    }
  }

  return rows;
}

function getKnowledgeHeaderIndex_(headers, candidates) {
  for (var i = 0; i < candidates.length; i += 1) {
    var index = headers.indexOf(candidates[i]);
    if (index !== -1) {
      return index;
    }
  }
  return -1;
}

function getKnowledgeCell_(headers, row, candidates) {
  var index = getKnowledgeHeaderIndex_(headers, candidates);
  return index === -1 ? '' : row[index];
}

function normalizeKnowledgeRow_(headers, row, rowIndex) {
  var ageMin = Number(getKnowledgeCell_(headers, row, ['child_age_days_min', 'age_min_days', 'min_age_days']) || 0);
  var ageMax = Number(getKnowledgeCell_(headers, row, ['child_age_days_max', 'age_max_days', 'max_age_days']) || 99999);
  var rawCategory = getKnowledgeCell_(headers, row, ['category', 'topic']);
  var category = canonicalizeTopic_(rawCategory);
  var insightExplanation = cleanText(getKnowledgeCell_(headers, row, ['insight_explanation', 'insight', 'summary']));
  var actionTip = cleanText(getKnowledgeCell_(headers, row, ['action_tip', 'action', 'tip', 'sms_tip']));
  var reassurance = cleanText(getKnowledgeCell_(headers, row, ['parent_reassurance', 'encouragement', 'reassurance']));
  var tipId = cleanText(getKnowledgeCell_(headers, row, ['tip_id'])) || buildFallbackTipId_(ageMin, ageMax, rawCategory, rowIndex);
  var activeValue = getKnowledgeCell_(headers, row, ['active']);

  if (!tipId) {
    return null;
  }

  return {
    tip_id: tipId,
    child_age_days_min: ageMin,
    child_age_days_max: ageMax,
    child_age_months: Number(getKnowledgeCell_(headers, row, ['child_age_months']) || Math.floor(ageMin / 30)),
    child_age_stage: cleanText(getKnowledgeCell_(headers, row, ['child_age_stage', 'stage'])) || getStageForAgeDays(ageMin),
    developmental_leap_phase: cleanText(getKnowledgeCell_(headers, row, ['developmental_leap_phase'])),
    category: category,
    subcategory: cleanText(getKnowledgeCell_(headers, row, ['subcategory'])),
    development_focus: cleanText(getKnowledgeCell_(headers, row, ['development_focus', 'keywords'])),
    insight_title: cleanText(getKnowledgeCell_(headers, row, ['insight_title'])),
    insight_explanation: insightExplanation,
    action_tip: actionTip,
    parent_reassurance: reassurance,
    common_parent_misunderstanding: cleanText(getKnowledgeCell_(headers, row, ['common_parent_misunderstanding'])),
    signs_of_healthy_development: cleanText(getKnowledgeCell_(headers, row, ['signs_of_healthy_development'])),
    when_to_consult_doctor: cleanText(getKnowledgeCell_(headers, row, ['when_to_consult_doctor'])),
    sms_tip: cleanText(getKnowledgeCell_(headers, row, ['sms_tip'])) || actionTip,
    follow_up_prompt: cleanText(getKnowledgeCell_(headers, row, ['follow_up_prompt', 'parent_question'])),
    youtube_resource_title: cleanText(getKnowledgeCell_(headers, row, ['youtube_resource_title'])),
    youtube_resource_link: cleanText(getKnowledgeCell_(headers, row, ['youtube_resource_link'])),
    book_resource: cleanText(getKnowledgeCell_(headers, row, ['book_resource'])),
    research_reference: cleanText(getKnowledgeCell_(headers, row, ['research_reference'])),
    difficulty_level: cleanText(getKnowledgeCell_(headers, row, ['difficulty_level'])) || 'easy',
    rotation_group: cleanText(getKnowledgeCell_(headers, row, ['rotation_group'])) || category,
    priority_weight: Number(getKnowledgeCell_(headers, row, ['priority_weight']) || 1),
    cooldown_days: Number(getKnowledgeCell_(headers, row, ['cooldown_days']) || APP_CONFIG.knowledge.defaultCooldownDays),
    active: activeValue === '' ? true : parseBoolean(activeValue, true),
    stage: cleanText(getKnowledgeCell_(headers, row, ['stage', 'child_age_stage'])) || getStageForAgeDays(ageMin),
    topic: category,
    message_type: cleanText(getKnowledgeCell_(headers, row, ['message_type'])) || 'daily',
    insight: insightExplanation,
    action: actionTip,
    encouragement: reassurance,
    checkin_question: cleanText(getKnowledgeCell_(headers, row, ['checkin_question'])),
    reply_options: cleanText(getKnowledgeCell_(headers, row, ['reply_options'])),
    milestone_key: cleanText(getKnowledgeCell_(headers, row, ['milestone_key'])),
    age_min_days: ageMin,
    age_max_days: ageMax,
    min_age_days: ageMin,
    max_age_days: ageMax,
    summary: insightExplanation,
    tip: actionTip,
    reassurance: reassurance,
    keywords: cleanText(getKnowledgeCell_(headers, row, ['keywords', 'development_focus'])),
    parent_question: cleanText(getKnowledgeCell_(headers, row, ['parent_question', 'follow_up_prompt']))
  };
}

function getKnowledgeForAge(ageDays) {
  var rows = typeof getKnowledgeRowsForAge === 'function' ? getKnowledgeRowsForAge(ageDays) : getKnowledgeRows();
  if (rows.length) {
    return rows[0];
  }

  return getKnowledgeFallbackRow_(ageDays, 'today\'s next step');
}

function findKnowledgeByQuestion(questionText, ageDays) {
  var question = cleanText(questionText).toLowerCase();
  if (!question) {
    return null;
  }

  var rows = getKnowledgeRowsForAge(ageDays);
  for (var i = 0; i < rows.length; i += 1) {
    var item = rows[i];
    var searchable = [
      item.topic,
      item.insight,
      item.action,
      item.encouragement,
      item.keywords,
      item.parent_question
    ].join(' ').toLowerCase();
    if (searchable && questionMatches_(question, searchable)) {
      return item;
    }
  }

  return null;
}

function questionMatches_(question, searchable) {
  var words = question.split(/\s+/);
  for (var i = 0; i < words.length; i += 1) {
    var word = words[i];
    if (word.length >= 4 && searchable.indexOf(word) !== -1) {
      return true;
    }
  }
  return false;
}

function canonicalizeTopic_(topic) {
  var normalized = cleanText(topic).toLowerCase();
  if (!normalized) {
    return 'development';
  }
  if (normalized === 'sleep' || normalized === 'sleep tip') {
    return 'sleep';
  }
  if (normalized === 'feeding' || normalized === 'feeding tip') {
    return 'feeding';
  }
  if (normalized === 'development' || normalized === 'development tip' || normalized === 'motor development' || normalized === 'motor' || normalized === 'language development' || normalized === 'speech development' || normalized === 'cognitive development') {
    return 'development';
  }
  if (normalized === 'learning/play' || normalized === 'learning' || normalized === 'language' || normalized === 'play' || normalized === 'learning and play' || normalized === 'montessori activities' || normalized === 'sensory play') {
    return 'learning/play';
  }
  if (normalized === 'emotional development' || normalized === 'behavior' || normalized === 'parent emotional support' || normalized === 'attachment and bonding' || normalized === 'social development') {
    if (normalized === 'behavior') {
      return 'behavior';
    }
    return 'emotional development';
  }
  if (normalized === 'today\'s next step' || normalized === 'general') {
    return 'development';
  }
  if (normalized === 'safety') {
    return 'safety';
  }
  return normalized;
}

function buildFallbackTipId_(ageMin, ageMax, topic, rowIndex) {
  return 'knowledge_' + ageMin + '_' + ageMax + '_' + canonicalizeTopic_(topic) + '_' + rowIndex;
}
