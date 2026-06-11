function getKidById(kidId) {
  var row = findFirstRow('kids', function(item) {
    return String(item.child_id || item.kid_id) === String(kidId);
  });
  return row ? hydrateKidRow_(row) : null;
}

function getKidsByParentId(parentId, includeInactive) {
  return findRows('kids', function(row) {
    if (String(row.parent_id) !== String(parentId)) {
      return false;
    }
    return includeInactive ? true : parseBoolean(row.active, true);
  }).map(function(row) {
    return hydrateKidRow_(row);
  });
}

function getKidsByParentPhone(parentPhone, includeInactive) {
  var normalized = normalizePhone(parentPhone);
  return findRows('kids', function(row) {
    if (normalizePhone(row.parent_phone) !== normalized) {
      return false;
    }
    return includeInactive ? true : parseBoolean(row.active, true);
  }).map(function(row) {
    return hydrateKidRow_(row);
  });
}

function getChildrenForParent(parentPhone, parentId, includeInactive) {
  var children = [];
  if (parentPhone) {
    children = getKidsByParentPhone(parentPhone, includeInactive);
  }
  if (!children.length && parentId) {
    children = getKidsByParentId(parentId, includeInactive);
  }
  return children;
}

function getActiveChildrenForParent(parentPhone, parentId) {
  return getChildrenForParent(parentPhone, parentId, false);
}

function getRenderableActiveChildrenForParent(parentPhone, parentId) {
  var children = getActiveChildrenForParent(parentPhone, parentId);
  var grouped = {};
  var order = [];
  var dropped = {};

  for (var i = 0; i < children.length; i += 1) {
    var child = children[i];
    var key = buildRenderableChildKey_(child);
    if (!grouped[key]) {
      grouped[key] = [];
      order.push(key);
    }
    grouped[key].push(child);
  }

  var selected = [];
  for (var j = 0; j < order.length; j += 1) {
    var groupKey = order[j];
    var candidates = grouped[groupKey];
    candidates.sort(compareRenderableChildCandidates_);
    selected.push(candidates[0]);
    if (candidates.length > 1) {
      dropped[groupKey] = candidates.slice(1).map(function(candidate) {
        return candidate.child_id;
      });
    }
  }

  if (Object.keys(dropped).length) {
    logInfo('Collapsed duplicate active child rows for outbound', {
      parent_id: parentId || '',
      dropped_duplicates_by_key: dropped,
      final_child_ids: selected.map(function(child) {
        return child.child_id;
      })
    });
  }

  return selected;
}

function buildRenderableChildKey_(child) {
  var nameKey = normalizeHeaderKey_(child.child_name || child.kid_name || '');
  return nameKey || cleanText(child.child_id);
}

function compareRenderableChildCandidates_(a, b) {
  var updatedA = Date.parse(cleanText(a.updated_at || a.created_at || '')) || 0;
  var updatedB = Date.parse(cleanText(b.updated_at || b.created_at || '')) || 0;
  if (updatedA !== updatedB) {
    return updatedB - updatedA;
  }
  return String(b.child_id || '').localeCompare(String(a.child_id || ''));
}

function findExistingKid(parentId, kidInput) {
  var normalized = normalizeKidInput(kidInput);
  return findFirstRow('kids', function(row) {
    return String(row.parent_id) === String(parentId) &&
      toNameCase(row.child_name || row.kid_name) === normalized.child_name &&
      cleanText(row.birthdate || row.date_of_birth) === normalized.birthdate;
  });
}

function createKid(parentId, kidInput) {
  var normalized = normalizeKidInput(kidInput);
  var missing = validateRequiredFields(normalized, ['child_name', 'birthdate']);
  if (missing.length) {
    throw new Error('Missing kid fields: ' + missing.join(', '));
  }

  var parsedDob = parseDateInput(normalized.birthdate);
  if (!parsedDob) {
    throw new Error('Invalid birthdate: ' + normalized.birthdate);
  }

  var parent = getParentById(parentId);
  if (!parent) {
    throw new Error('Parent not found for child creation: ' + parentId);
  }

  var existing = findExistingKid(parentId, normalized);
  if (existing) {
    logWarn('Reused existing kid', { parent_id: parentId, kid_id: existing.child_id });
    return hydrateKidRow_(existing);
  }

  var now = nowIsoString();
  var birthdate = dateToStorageString(parsedDob);
  var dueDate = normalized.due_date ? dateToStorageString(parseDateInput(normalized.due_date)) : '';
  var childId = createId('kid');
  var row = {
    child_id: childId,
    parent_phone: parent.parent_phone,
    parent_id: parentId,
    child_name: normalized.child_name,
    birthdate: birthdate,
    due_date: dueDate,
    kid_id: childId,
    kid_name: normalized.child_name,
    date_of_birth: birthdate,
    status: cleanText(normalized.status || 'active') || 'active',
    enrollment_source: cleanText(normalized.enrollment_source),
    opt_in_timestamp: cleanText(normalized.opt_in_timestamp),
    gender_optional: normalized.gender_optional,
    notes: normalized.notes,
    created_at: now,
    updated_at: now,
    active: normalized.active
  };

  appendRow('kids', row);
  logInfo('Created kid', { parent_id: parentId, kid_id: childId, kid_name: normalized.child_name });
  return hydrateKidRow_(row);
}

function updateKid(kidId, updates) {
  var kid = getKidById(kidId);
  if (!kid) {
    throw new Error('Kid not found: ' + kidId);
  }

  var birthdate = updates.birthdate !== undefined || updates.date_of_birth !== undefined
    ? dateToStorageString(parseDateInput(updates.birthdate || updates.date_of_birth))
    : kid.birthdate;
  var dueDate = updates.due_date !== undefined
    ? (cleanText(updates.due_date) ? dateToStorageString(parseDateInput(updates.due_date)) : '')
    : kid.due_date;
  var childName = updates.child_name !== undefined || updates.kid_name !== undefined
    ? toNameCase(updates.child_name || updates.kid_name)
    : kid.child_name;

  updateRow('kids', kid._rowNumber, {
    child_name: childName,
    birthdate: birthdate,
    due_date: dueDate,
    kid_name: childName,
    date_of_birth: birthdate,
    status: updates.status !== undefined ? cleanText(updates.status) : cleanText(kid.status),
    enrollment_source: updates.enrollment_source !== undefined ? cleanText(updates.enrollment_source) : cleanText(kid.enrollment_source),
    opt_in_timestamp: updates.opt_in_timestamp !== undefined ? cleanText(updates.opt_in_timestamp) : cleanText(kid.opt_in_timestamp),
    gender_optional: updates.gender_optional !== undefined ? cleanText(updates.gender_optional) : kid.gender_optional,
    notes: updates.notes !== undefined ? cleanText(updates.notes) : kid.notes,
    updated_at: nowIsoString(),
    active: updates.active !== undefined ? parseBoolean(updates.active, true) : kid.active
  });

  return getKidById(kidId);
}

function hydrateKidRow_(row) {
  var cloned = {};
  var keys = Object.keys(row || {});
  for (var i = 0; i < keys.length; i += 1) {
    cloned[keys[i]] = row[keys[i]];
  }

  cloned.child_id = cleanText(row.child_id || row.kid_id);
  cloned.kid_id = cloned.child_id;
  cloned.child_name = toNameCase(row.child_name || row.kid_name);
  cloned.kid_name = cloned.child_name;
  cloned.birthdate = cleanText(row.birthdate || row.date_of_birth);
  cloned.date_of_birth = cloned.birthdate;
  cloned.due_date = cleanText(row.due_date || row.estimated_due_date);
  cloned.parent_phone = normalizePhone(row.parent_phone);
  cloned.status = cleanText(row.status || 'active') || 'active';
  cloned.enrollment_source = cleanText(row.enrollment_source);
  cloned.opt_in_timestamp = cleanText(row.opt_in_timestamp);
  cloned.active = parseBoolean(row.active, true);
  return cloned;
}
