function createMilestone(data) {
  var row = {
    parent_phone: normalizePhone(data.parent_phone),
    child_id: cleanText(data.child_id),
    child_name: toNameCase(data.child_name),
    milestone: cleanText(data.milestone),
    date: cleanText(data.date),
    created_at: nowIsoString()
  };

  appendRow('milestones', row);
  return row;
}

function getMilestonesForChild(childId) {
  return findRows('milestones', function(row) {
    return String(row.child_id) === String(childId);
  });
}

function hasMilestone(childId, milestoneKey) {
  return findRows('milestones', function(row) {
    return String(row.child_id) === String(childId) &&
      cleanText(row.milestone) === cleanText(milestoneKey);
  }).length > 0;
}
