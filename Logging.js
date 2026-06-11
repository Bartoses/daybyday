function logInfo(message, context) {
  Logger.log('[INFO] ' + message + formatContext_(context));
}

function logWarn(message, context) {
  Logger.log('[WARN] ' + message + formatContext_(context));
}

function logError(message, error, context) {
  var payload = {
    message: message,
    error: error ? stringifyError_(error) : '',
    context: context || {}
  };
  Logger.log('[ERROR] ' + safeStringify_(payload));
}

function formatContext_(context) {
  if (!context) {
    return '';
  }
  return ' ' + safeStringify_(context);
}

function stringifyError_(error) {
  if (!error) {
    return '';
  }

  return safeStringify_({
    name: error.name || '',
    message: error.message || String(error),
    stack: error.stack || ''
  });
}

function safeStringify_(value) {
  try {
    return JSON.stringify(value);
  } catch (error) {
    return String(value);
  }
}

function summarizeGuideSelectionContext_(context) {
  var input = context || {};
  return {
    parent_id: input.parent_id || '',
    response_type: input.response_type || '',
    request_type: input.request_type || '',
    requested_category: input.requested_category || '',
    child_ids: input.child_ids || [],
    candidate_counts_by_child: input.candidate_counts_by_child || {},
    selected_tip_ids_by_child: input.selected_tip_ids_by_child || {},
    dropped_duplicates_by_child: input.dropped_duplicates_by_child || {},
    final_child_count: input.final_child_count === undefined ? '' : input.final_child_count,
    chunk_count: input.chunk_count === undefined ? '' : input.chunk_count,
    chunk_lengths: input.chunk_lengths || []
  };
}

function logGuideSelectionSummary(message, context) {
  logInfo(message, summarizeGuideSelectionContext_(context));
}
