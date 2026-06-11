function nowIsoString() {
  return new Date().toISOString();
}

function createId(prefix) {
  return prefix + '_' + Utilities.getUuid().replace(/-/g, '').slice(0, 12);
}

function normalizePhone(phone) {
  var raw = cleanText(phone);
  var digits = raw.replace(/[^\d]/g, '');

  if (!digits) {
    return '';
  }

  if (digits.length === 10) {
    return '+1' + digits;
  }

  if (digits.length === 11 && digits.charAt(0) === '1') {
    return '+' + digits;
  }

  return '';
}

function toNameCase(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/\b[a-z]/g, function(match) {
      return match.toUpperCase();
    })
    .trim();
}

function cleanText(value) {
  return String(value || '').trim();
}

function parseBoolean(value, defaultValue) {
  if (value === true || value === false) {
    return value;
  }
  var text = String(value || '').toLowerCase().trim();
  if (text === 'true' || text === 'yes' || text === '1') {
    return true;
  }
  if (text === 'false' || text === 'no' || text === '0') {
    return false;
  }
  return defaultValue === undefined ? false : defaultValue;
}

function parseJsonObject(value, fallback) {
  if (!value) {
    return fallback || {};
  }
  if (typeof value === 'object') {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback || {};
  }
}

function stringifyJson(value) {
  return JSON.stringify(value || {});
}

function getTimezoneForParent(parent) {
  return cleanText(parent && parent.timezone) || getDefaultTimezone();
}

function formatLocalDate(date, timezone) {
  return Utilities.formatDate(coerceDate(date), timezone || getDefaultTimezone(), 'yyyy-MM-dd');
}

function formatLocalDateTime(date, timezone) {
  return Utilities.formatDate(coerceDate(date), timezone || getDefaultTimezone(), 'yyyy-MM-dd HH:mm:ss');
}

function getTodayKey(timezone) {
  return formatLocalDate(new Date(), timezone || getDefaultTimezone());
}

function coerceDate(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return new Date(value.getTime());
  }

  if (typeof value === 'number') {
    return new Date(value);
  }

  var text = cleanText(value);
  if (!text) {
    throw new Error('Missing date value');
  }

  var parsed = parseDateInput(text);
  if (!parsed) {
    throw new Error('Invalid date: ' + text);
  }
  return parsed;
}

function parseDateInput(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return new Date(value.getTime());
  }

  var text = cleanText(value);
  if (!text) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    var isoParts = text.split('-');
    return new Date(Number(isoParts[0]), Number(isoParts[1]) - 1, Number(isoParts[2]));
  }

  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(text)) {
    var slashParts = text.split('/');
    return new Date(Number(slashParts[2]), Number(slashParts[0]) - 1, Number(slashParts[1]));
  }

  var parsed = new Date(text);
  if (isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function dateToStorageString(date, timezone) {
  return formatLocalDate(coerceDate(date), timezone || getDefaultTimezone());
}

function calculateAgeDays(dateOfBirth, timezone) {
  var tz = timezone || getDefaultTimezone();
  var birthKey = formatLocalDate(coerceDate(dateOfBirth), tz);
  var todayKey = getTodayKey(tz);
  var birthUtc = Date.parse(birthKey + 'T00:00:00Z');
  var todayUtc = Date.parse(todayKey + 'T00:00:00Z');
  return Math.floor((todayUtc - birthUtc) / (24 * 60 * 60 * 1000));
}

function getAgeBreakdown(dateOfBirth, timezone) {
  var tz = timezone || getDefaultTimezone();
  var birth = coerceDate(formatLocalDate(coerceDate(dateOfBirth), tz));
  var today = coerceDate(getTodayKey(tz));
  var years = today.getFullYear() - birth.getFullYear();
  var anniversary = new Date(birth.getTime());

  anniversary.setFullYear(birth.getFullYear() + years);
  if (anniversary.getTime() > today.getTime()) {
    years -= 1;
    anniversary = new Date(birth.getTime());
    anniversary.setFullYear(birth.getFullYear() + years);
  }

  var remainingDays = Math.floor((today.getTime() - anniversary.getTime()) / (24 * 60 * 60 * 1000));
  var totalDays = calculateAgeDays(dateOfBirth, tz);

  return {
    years: Math.max(years, 0),
    days: Math.max(remainingDays, 0),
    total_days: totalDays
  };
}

function formatAgeDisplay(ageBreakdown) {
  return formatChildAge(ageBreakdown.total_days);
}

function formatChildAge(ageDays) {
  var totalDays = Math.max(Number(ageDays || 0), 0);
  var years = Math.floor(totalDays / 365);
  var remainingAfterYears = totalDays % 365;
  var months = Math.floor(remainingAfterYears / 30);
  var days = remainingAfterYears % 30;
  var parts = [];

  if (totalDays < 30) {
    return totalDays + ' ' + pluralizeUnit_(totalDays, 'day') + ' old';
  }

  if (years > 0) {
    parts.push(years + ' ' + pluralizeUnit_(years, 'year'));
  }
  if (months > 0) {
    parts.push(months + ' ' + pluralizeUnit_(months, 'month'));
  }
  if (days > 0 || !parts.length) {
    parts.push(days + ' ' + pluralizeUnit_(days, 'day'));
  }

  return parts.join(', ') + ' old';
}

function formatExactAndReadableAge(ageDays) {
  var totalDays = Math.max(Number(ageDays || 0), 0);
  var readable = formatChildAge(totalDays);
  var exact = totalDays + ' ' + pluralizeUnit_(totalDays, 'day') + ' old';
  if (exact === readable) {
    return exact;
  }
  return exact + ' (' + readable + ')';
}

function pluralizeUnit_(value, singular) {
  return Number(value) === 1 ? singular : singular + 's';
}

function calculateAdjustedAgeDays(dueDate, timezone) {
  if (!cleanText(dueDate)) {
    return null;
  }
  return calculateAgeDays(dueDate, timezone);
}

function getStageForAgeDays(ageDays) {
  var totalDays = Number(ageDays || 0);
  for (var i = 0; i < APP_CONFIG.stages.length; i += 1) {
    var stage = APP_CONFIG.stages[i];
    if (totalDays >= stage.minAgeDays && totalDays <= stage.maxAgeDays) {
      return stage.label;
    }
  }
  return APP_CONFIG.stages[APP_CONFIG.stages.length - 1].label;
}

function mapDevelopmentStage(ageDays) {
  return getStageForAgeDays(ageDays);
}

function formatChildHeader(childLike) {
  var name = toNameCase(childLike.child_name || childLike.kid_name || '');
  var ageDays = childLike.age_days;
  if (ageDays === undefined || ageDays === null || ageDays === '') {
    ageDays = calculateAgeDays(childLike.birthdate || childLike.date_of_birth, childLike.timezone || getDefaultTimezone());
  }
  var ageText = formatChildAge(ageDays);
  var stage = cleanText(childLike.stage || mapDevelopmentStage(ageDays));

  if (!name) {
    return ageText + (stage ? ' - ' + stage : '');
  }

  return name + ' (' + ageText + (stage ? ' - ' + stage : '') + ')';
}

function validateRequiredFields(payload, requiredFields) {
  var missing = [];
  for (var i = 0; i < requiredFields.length; i += 1) {
    var field = requiredFields[i];
    if (cleanText(payload[field]) === '') {
      missing.push(field);
    }
  }
  return missing;
}

function normalizeKidInput(kid) {
  return {
    child_name: toNameCase(kid.child_name || kid.kid_name || kid.name || ''),
    birthdate: cleanText(kid.birthdate || kid.date_of_birth || kid.birth_date || kid.dob || ''),
    due_date: cleanText(kid.due_date || kid.estimated_due_date || ''),
    status: cleanText(kid.status || 'active') || 'active',
    enrollment_source: cleanText(kid.enrollment_source || ''),
    opt_in_timestamp: cleanText(kid.opt_in_timestamp || ''),
    gender_optional: cleanText(kid.gender_optional || kid.gender || ''),
    notes: cleanText(kid.notes || ''),
    active: kid.active === undefined ? true : parseBoolean(kid.active, true)
  };
}

function normalizeHeaderKey_(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toIsoTimestamp_(value) {
  var parsed = parseDateInput(value);
  return parsed ? parsed.toISOString() : '';
}
