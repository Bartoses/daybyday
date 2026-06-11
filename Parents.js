function getParentById(parentId) {
  var row = findFirstRow('parents', function(item) {
    return String(item.parent_id) === String(parentId);
  });
  return row ? hydrateParentRow_(row) : null;
}

function getParentByPhone(phone) {
  var normalized = normalizePhone(phone);
  var row = findFirstRow('parents', function(item) {
    return normalizePhone(item.normalized_phone || item.parent_phone || item.phone) === normalized;
  });
  return row ? hydrateParentRow_(row) : null;
}

function getParentByEmail(email) {
  var target = cleanText(email).toLowerCase();
  if (!target) {
    return null;
  }

  var row = findFirstRow('parents', function(item) {
    return cleanText(item.email).toLowerCase() === target;
  });
  return row ? hydrateParentRow_(row) : null;
}

function findOrCreateParent(input) {
  var normalizedPhone = normalizePhone(input.parent_phone || input.phone);
  var existing = normalizedPhone ? getParentByPhone(normalizedPhone) : null;

  if (!existing && cleanText(input.email)) {
    existing = getParentByEmail(input.email);
  }

  if (existing) {
    return updateParent(existing.parent_id, {
      parent_name: input.parent_name !== undefined ? input.parent_name : existing.parent_name,
      parent_phone: normalizedPhone || existing.parent_phone,
      email: input.email !== undefined ? input.email : existing.email,
      timezone: input.timezone !== undefined ? input.timezone : existing.timezone,
      sms_opt_in: input.sms_opt_in !== undefined ? input.sms_opt_in : existing.sms_opt_in,
      active: input.active !== undefined ? input.active : existing.active,
      status: input.status !== undefined ? input.status : existing.status,
      onboarding_step: input.onboarding_step !== undefined ? input.onboarding_step : existing.onboarding_step,
      preferred_time: input.preferred_time !== undefined ? input.preferred_time : existing.preferred_time,
      referral_code: input.referral_code !== undefined ? input.referral_code : existing.referral_code,
      referred_by: input.referred_by !== undefined ? input.referred_by : existing.referred_by,
      preferences: input.preferences !== undefined ? input.preferences : getParentPreferences(existing)
    });
  }

  return createParent(input);
}

function createParent(input) {
  var now = nowIsoString();
  var onboardingStep = cleanText(input.onboarding_step || APP_CONFIG.onboardingSteps.NEW) || APP_CONFIG.onboardingSteps.NEW;
  var deliveryStatus = cleanText(input.status || APP_CONFIG.deliveryStatuses.ACTIVE) || APP_CONFIG.deliveryStatuses.ACTIVE;
  var preferences = input.preferences || {};
  var row = {
    parent_id: createId('par'),
    parent_phone: normalizePhone(input.parent_phone || input.phone),
    parent_name: toNameCase(input.parent_name || ''),
    status: deliveryStatus,
    onboarding_step: onboardingStep,
    last_checkin_topic: cleanText(input.last_checkin_topic),
    last_child_index: input.last_child_index === undefined || input.last_child_index === null ? '' : Number(input.last_child_index),
    preferred_time: cleanText(input.preferred_time),
    referral_code: cleanText(input.referral_code),
    referred_by: cleanText(input.referred_by),
    phone: normalizePhone(input.parent_phone || input.phone),
    email: cleanText(input.email),
    timezone: cleanText(input.timezone) || getDefaultTimezone(),
    sms_opt_in: input.sms_opt_in === undefined ? true : parseBoolean(input.sms_opt_in, true),
    preferences: stringifyJson(preferences),
    normalized_phone: normalizePhone(input.parent_phone || input.phone),
    opt_in_source: cleanText(input.opt_in_source),
    opt_in_method: cleanText(input.opt_in_method),
    opt_in_form_url: cleanText(input.opt_in_form_url),
    opt_in_response_sheet: cleanText(input.opt_in_response_sheet),
    opt_in_timestamp: cleanText(input.opt_in_timestamp),
    form_submission_timestamp: cleanText(input.form_submission_timestamp),
    sms_consent_text: cleanText(input.sms_consent_text),
    welcome_sms_sent_at: cleanText(input.welcome_sms_sent_at),
    last_opt_in_processed_at: cleanText(input.last_opt_in_processed_at),
    last_opt_in_row: input.last_opt_in_row === undefined || input.last_opt_in_row === null || input.last_opt_in_row === ''
      ? ''
      : Number(input.last_opt_in_row),
    last_opt_in_status: cleanText(input.last_opt_in_status),
    created_at: now,
    updated_at: now,
    active: input.active === undefined ? true : parseBoolean(input.active, true)
  };

  var rowNumber = appendRow('parents', row);
  logInfo('Created parent', { parent_id: row.parent_id, phone: row.parent_phone });
  row._rowNumber = rowNumber;
  return hydrateParentRow_(getRowByNumber_('parents', rowNumber) || row);
}

function updateParent(parentId, updates) {
  var parent = getParentById(parentId);
  if (!parent) {
    throw new Error('Parent not found: ' + parentId);
  }

  var phone = updates.parent_phone !== undefined || updates.phone !== undefined
    ? normalizePhone(updates.parent_phone || updates.phone)
    : parent.parent_phone;
  var status = updates.status !== undefined ? cleanText(updates.status) : parent.status;
  var onboardingStep = updates.onboarding_step !== undefined
    ? cleanText(updates.onboarding_step)
    : (parent.onboarding_step || APP_CONFIG.onboardingSteps.NEW);
  var preferences = updates.preferences !== undefined ? updates.preferences : getParentPreferences(parent);

  updateRow('parents', parent._rowNumber, {
    parent_phone: phone,
    parent_name: updates.parent_name !== undefined ? toNameCase(updates.parent_name) : parent.parent_name,
    status: status,
    onboarding_step: onboardingStep,
    last_checkin_topic: updates.last_checkin_topic !== undefined ? cleanText(updates.last_checkin_topic) : parent.last_checkin_topic,
    last_child_index: updates.last_child_index !== undefined && updates.last_child_index !== ''
      ? Number(updates.last_child_index)
      : (updates.last_child_index === '' ? '' : parent.last_child_index),
    preferred_time: updates.preferred_time !== undefined ? cleanText(updates.preferred_time) : parent.preferred_time,
    referral_code: updates.referral_code !== undefined ? cleanText(updates.referral_code) : parent.referral_code,
    referred_by: updates.referred_by !== undefined ? cleanText(updates.referred_by) : parent.referred_by,
    phone: phone,
    email: updates.email !== undefined ? cleanText(updates.email) : parent.email,
    timezone: updates.timezone !== undefined ? cleanText(updates.timezone) : parent.timezone,
    sms_opt_in: updates.sms_opt_in !== undefined ? parseBoolean(updates.sms_opt_in, true) : parent.sms_opt_in,
    preferences: stringifyJson(preferences),
    normalized_phone: phone,
    opt_in_source: updates.opt_in_source !== undefined ? cleanText(updates.opt_in_source) : cleanText(parent.opt_in_source),
    opt_in_method: updates.opt_in_method !== undefined ? cleanText(updates.opt_in_method) : cleanText(parent.opt_in_method),
    opt_in_form_url: updates.opt_in_form_url !== undefined ? cleanText(updates.opt_in_form_url) : cleanText(parent.opt_in_form_url),
    opt_in_response_sheet: updates.opt_in_response_sheet !== undefined ? cleanText(updates.opt_in_response_sheet) : cleanText(parent.opt_in_response_sheet),
    opt_in_timestamp: updates.opt_in_timestamp !== undefined ? cleanText(updates.opt_in_timestamp) : cleanText(parent.opt_in_timestamp),
    form_submission_timestamp: updates.form_submission_timestamp !== undefined ? cleanText(updates.form_submission_timestamp) : cleanText(parent.form_submission_timestamp),
    sms_consent_text: updates.sms_consent_text !== undefined ? cleanText(updates.sms_consent_text) : cleanText(parent.sms_consent_text),
    welcome_sms_sent_at: updates.welcome_sms_sent_at !== undefined ? cleanText(updates.welcome_sms_sent_at) : cleanText(parent.welcome_sms_sent_at),
    last_opt_in_processed_at: updates.last_opt_in_processed_at !== undefined ? cleanText(updates.last_opt_in_processed_at) : cleanText(parent.last_opt_in_processed_at),
    last_opt_in_row: updates.last_opt_in_row !== undefined && updates.last_opt_in_row !== ''
      ? Number(updates.last_opt_in_row)
      : (updates.last_opt_in_row === '' ? '' : parent.last_opt_in_row),
    last_opt_in_status: updates.last_opt_in_status !== undefined ? cleanText(updates.last_opt_in_status) : cleanText(parent.last_opt_in_status),
    updated_at: nowIsoString(),
    active: updates.active !== undefined ? parseBoolean(updates.active, true) : parent.active
  });

  return getParentById(parentId);
}

function getParentPreferences(parent) {
  return parseJsonObject(parent && parent.preferences, {});
}

function updateParentPreferences(parentId, patch) {
  var parent = getParentById(parentId);
  var preferences = getParentPreferences(parent);
  var keys = Object.keys(patch || {});

  for (var i = 0; i < keys.length; i += 1) {
    if (patch[keys[i]] === null) {
      delete preferences[keys[i]];
    } else {
      preferences[keys[i]] = patch[keys[i]];
    }
  }

  return updateParent(parentId, { preferences: preferences });
}

function getActiveParentsForDailySend() {
  return findRows('parents', function(row) {
    var parent = hydrateParentRow_(row);
    return parseBoolean(parent.active, false) &&
      parseBoolean(parent.sms_opt_in, false) &&
      normalizePhone(parent.parent_phone) &&
      cleanText(parent.status) === APP_CONFIG.deliveryStatuses.ACTIVE &&
      cleanText(parent.onboarding_step) === APP_CONFIG.onboardingSteps.ONBOARDED;
  }).map(function(row) {
    return hydrateParentRow_(row);
  });
}

function hydrateParentRow_(row) {
  var cloned = {};
  var keys = Object.keys(row || {});
  var rawStatus = cleanText(row.status);
  var rawOnboardingStep = cleanText(row.onboarding_step);
  for (var i = 0; i < keys.length; i += 1) {
    cloned[keys[i]] = row[keys[i]];
  }

  cloned.parent_phone = normalizePhone(row.parent_phone || row.phone);
  cloned.phone = cloned.parent_phone;
  cloned.normalized_phone = normalizePhone(row.normalized_phone || row.parent_phone || row.phone);
  cloned.parent_name = toNameCase(row.parent_name || '');
  if (!rawOnboardingStep && APP_CONFIG.parentStatuses[rawStatus]) {
    rawOnboardingStep = rawStatus;
  }
  if (rawStatus !== APP_CONFIG.deliveryStatuses.ACTIVE && rawStatus !== APP_CONFIG.deliveryStatuses.UNSUBSCRIBED) {
    rawStatus = APP_CONFIG.deliveryStatuses.ACTIVE;
  }
  cloned.status = rawStatus || APP_CONFIG.deliveryStatuses.ACTIVE;
  cloned.onboarding_step = rawOnboardingStep || APP_CONFIG.onboardingSteps.NEW;
  cloned.last_checkin_topic = cleanText(row.last_checkin_topic);
  cloned.last_child_index = row.last_child_index === '' || row.last_child_index === undefined ? '' : Number(row.last_child_index || 0);
  cloned.preferred_time = cleanText(row.preferred_time);
  cloned.referral_code = cleanText(row.referral_code);
  cloned.referred_by = cleanText(row.referred_by);
  cloned.timezone = cleanText(row.timezone) || getDefaultTimezone();
  cloned.preferences = row.preferences || '{}';
  cloned.sms_opt_in = parseBoolean(row.sms_opt_in, true);
  cloned.opt_in_source = cleanText(row.opt_in_source);
  cloned.opt_in_method = cleanText(row.opt_in_method);
  cloned.opt_in_form_url = cleanText(row.opt_in_form_url);
  cloned.opt_in_response_sheet = cleanText(row.opt_in_response_sheet);
  cloned.opt_in_timestamp = cleanText(row.opt_in_timestamp);
  cloned.form_submission_timestamp = cleanText(row.form_submission_timestamp);
  cloned.sms_consent_text = cleanText(row.sms_consent_text);
  cloned.welcome_sms_sent_at = cleanText(row.welcome_sms_sent_at);
  cloned.last_opt_in_processed_at = cleanText(row.last_opt_in_processed_at);
  cloned.last_opt_in_row = row.last_opt_in_row === '' || row.last_opt_in_row === undefined ? '' : Number(row.last_opt_in_row || 0);
  cloned.last_opt_in_status = cleanText(row.last_opt_in_status);
  cloned.active = parseBoolean(row.active, true);
  return cloned;
}
