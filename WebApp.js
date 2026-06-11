function doGet(e) {
  setupDayByDay();

  if (e && e.parameter && e.parameter.health === '1') {
    return ContentService.createTextOutput('ok');
  }

  return ContentService.createTextOutput(getBrandName() + ' SMS service is running.');
}

function doPost(e) {
  setupDayByDay();

  try {
    if (isTwilioWebhook_(e)) {
      handleIncomingSmsWebhook_(e);
    } else {
      logWarn('Ignored non-Twilio POST', { event: e && e.parameter ? e.parameter : {} });
    }
    return buildTwimlResponse_();
  } catch (error) {
    logError('doPost failed', error, { event: e && e.parameter ? e.parameter : {} });
    return buildTwimlResponse_();
  }
}

function buildTwimlResponse_(messageBody) {
  var message = String(messageBody || '');
  var xml = '<?xml version="1.0" encoding="UTF-8"?><Response>' +
    (message ? '<Message>' + escapeXml_(message) + '</Message>' : '') +
    '</Response>';
  return ContentService
    .createTextOutput(xml)
    .setMimeType(ContentService.MimeType.XML);
}

function escapeXml_(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
