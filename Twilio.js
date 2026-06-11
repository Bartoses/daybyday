function sendSmsMessage(parentId, to, body, kidIdOrCombined) {
  var normalizedTo = normalizePhone(to);
  var formattedBody = String(body || '');
  var sid = getConfigValue(APP_CONFIG.properties.twilioSid, '');
  var token = getConfigValue(APP_CONFIG.properties.twilioToken, '');
  var from = normalizePhone(getConfigValue(APP_CONFIG.properties.twilioPhone, ''));
  var messageLog = createMessageLog({
    parent_id: parentId || '',
    kid_id_or_combined: kidIdOrCombined || '',
    message_text: formattedBody,
    send_status: 'pending'
  });

  Logger.log(JSON.stringify(formattedBody));
  Logger.log(formattedBody);

  if (!sid || !token || !from) {
    var configError = 'Missing Twilio configuration';
    updateMessageLogRow(messageLog._rowNumber, {
      parent_id: parentId || '',
      kid_id_or_combined: kidIdOrCombined || '',
      message_text: formattedBody,
      send_status: 'failed',
      sent_at: nowIsoString(),
      error_optional: configError
    });
    throw new Error(configError);
  }

  try {
    var response = UrlFetchApp.fetch(
      'https://api.twilio.com/2010-04-01/Accounts/' + sid + '/Messages.json',
      {
        method: 'post',
        payload: {
          To: normalizedTo,
          From: from,
          Body: formattedBody
        },
        headers: {
          Authorization: 'Basic ' + Utilities.base64Encode(sid + ':' + token)
        },
        muteHttpExceptions: true
      }
    );

    var code = response.getResponseCode();
    var text = response.getContentText();
    var payload = parseJsonObject(text, {});

    if (code < 200 || code >= 300) {
      throw new Error('Twilio error ' + code + ': ' + text);
    }

    updateMessageLogRow(messageLog._rowNumber, {
      parent_id: parentId || '',
      kid_id_or_combined: kidIdOrCombined || '',
      message_text: formattedBody,
      send_status: 'sent',
      sent_at: nowIsoString(),
      twilio_sid_optional: payload.sid || ''
    });

    logInfo('SMS sent', { parent_id: parentId || '', to: normalizedTo, sid: payload.sid || '' });
    return payload;
  } catch (error) {
    updateMessageLogRow(messageLog._rowNumber, {
      parent_id: parentId || '',
      kid_id_or_combined: kidIdOrCombined || '',
      message_text: formattedBody,
      send_status: 'failed',
      sent_at: nowIsoString(),
      error_optional: error.message || String(error)
    });
    logError('SMS send failed', error, { parent_id: parentId || '', to: normalizedTo });
    throw error;
  }
}
