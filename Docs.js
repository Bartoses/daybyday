function setupDocTemplate() {
  var doc = DocumentApp.create(getBrandName() + ' Daily Guide Template');
  var body = doc.getBody();

  body.clear();
  body.appendParagraph(getBrandName() + ' Daily Guide').setHeading(DocumentApp.ParagraphHeading.TITLE);
  body.appendParagraph('Parent: ' + APP_CONFIG.docPlaceholders.parentName);
  body.appendParagraph('Date: ' + APP_CONFIG.docPlaceholders.date);
  body.appendParagraph('');
  body.appendParagraph(APP_CONFIG.docPlaceholders.kidSections);

  doc.saveAndClose();
  setConfigValue(APP_CONFIG.properties.docTemplateId, doc.getId());
  logInfo('Created doc template', { document_id: doc.getId(), url: doc.getUrl() });

  return {
    document_id: doc.getId(),
    url: doc.getUrl()
  };
}

function validateDocTemplate(docId) {
  var templateId = cleanText(docId) || getConfigValue(APP_CONFIG.properties.docTemplateId, '');
  if (!templateId) {
    throw new Error('DOC_TEMPLATE_ID is not set');
  }

  var doc = DocumentApp.openById(templateId);
  var text = doc.getBody().getText();
  var placeholders = APP_CONFIG.docPlaceholders;
  var missing = [];
  var keys = Object.keys(placeholders);

  for (var i = 0; i < keys.length; i += 1) {
    var placeholder = placeholders[keys[i]];
    if (text.indexOf(placeholder) === -1) {
      missing.push(placeholder);
    }
  }

  return {
    ok: missing.length === 0,
    document_id: templateId,
    url: doc.getUrl(),
    missing_placeholders: missing
  };
}

function generateDailyGuideDoc(parentId) {
  var parent = getParentById(parentId);
  if (!parent) {
    throw new Error('Parent not found: ' + parentId);
  }

  var kids = getKidsByParentId(parentId, false);
  if (!kids.length) {
    throw new Error('No active kids found for parent: ' + parentId);
  }

  var docTemplateId = getConfigValue(APP_CONFIG.properties.docTemplateId, '');
  var sections = buildKidSections_(parent, kids);

  if (docTemplateId) {
    var validation = validateDocTemplate(docTemplateId);
    if (!validation.ok) {
      throw new Error('Doc template is missing placeholders: ' + validation.missing_placeholders.join(', '));
    }

    var copy = DriveApp.getFileById(docTemplateId).makeCopy('DaybyDay - ' + parent.parent_name + ' - ' + getTodayKey(getTimezoneForParent(parent)));
    var doc = DocumentApp.openById(copy.getId());
    var body = doc.getBody();
    body.replaceText(escapePlaceholder_(APP_CONFIG.docPlaceholders.parentName), parent.parent_name || '');
    body.replaceText(escapePlaceholder_(APP_CONFIG.docPlaceholders.date), getTodayKey(getTimezoneForParent(parent)));
    body.replaceText(escapePlaceholder_(APP_CONFIG.docPlaceholders.kidSections), sections.join('\n\n'));
    doc.saveAndClose();
    return { document_id: doc.getId(), url: doc.getUrl() };
  }

  var newDoc = DocumentApp.create('DaybyDay - ' + parent.parent_name + ' - ' + getTodayKey(getTimezoneForParent(parent)));
  newDoc.getBody()
    .appendParagraph('Parent: ' + (parent.parent_name || ''))
    .appendText('\nDate: ' + getTodayKey(getTimezoneForParent(parent)) + '\n\n' + sections.join('\n\n'));
  newDoc.saveAndClose();
  return { document_id: newDoc.getId(), url: newDoc.getUrl() };
}

function buildKidSections_(parent, kids) {
  var sections = [];
  for (var i = 0; i < kids.length; i += 1) {
    var guide = buildKidGuide(parent, kids[i]);
    sections.push(
      guide.kid_name + '\n' +
      'Age: ' + guide.age_display + '\n' +
      'Summary: ' + guide.summary + '\n' +
      'Tip: ' + guide.tip + '\n' +
      'Reassurance: ' + guide.reassurance
    );
  }
  return sections;
}

function escapePlaceholder_(placeholder) {
  return placeholder.replace(/[{}]/g, '\\$&');
}

function setConfigValue(key, value) {
  var sheet = getSheetByKey('config');
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i += 1) {
    if (String(values[i][0]).trim() === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  sheet.appendRow([key, value]);
}
