function installDailyTrigger() {
  removeDailyTriggers();
  ScriptApp.newTrigger('sendDailyMessages')
    .timeBased()
    .everyDays(1)
    .atHour(getDailySendHour())
    .create();
  logInfo('Installed daily trigger', { hour: getDailySendHour() });
}

function removeDayByDayTriggers() {
  removeDailyTriggers();
  removeOptInTriggers();
  logInfo('Removed existing DaybyDay triggers');
}

function removeDailyTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i += 1) {
    var trigger = triggers[i];
    if (trigger.getHandlerFunction() === 'sendDailyMessages') {
      ScriptApp.deleteTrigger(trigger);
    }
  }
  logInfo('Removed existing daily triggers');
}
