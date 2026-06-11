function createQuestion(parentId, kidId, questionText, status) {
  var question = {
    question_id: createId('q'),
    parent_id: parentId,
    kid_id: kidId || '',
    question: cleanText(questionText),
    status: cleanText(status) || 'new',
    created_at: nowIsoString(),
    updated_at: nowIsoString()
  };

  appendRow('questions', question);
  logInfo('Created question', { question_id: question.question_id, parent_id: parentId, kid_id: kidId || '' });
  return question;
}

function updateQuestionStatus(questionId, status) {
  var row = findFirstRow('questions', function(item) {
    return String(item.question_id) === String(questionId);
  });
  if (!row) {
    throw new Error('Question not found: ' + questionId);
  }
  updateRow('questions', row._rowNumber, {
    status: cleanText(status),
    updated_at: nowIsoString()
  });
}
