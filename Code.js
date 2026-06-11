function doPost(e) {
  try {
    Logger.log("INBOUND HIT");
    Logger.log(JSON.stringify(e));

    const phone = normalizePhone(e.parameter.From || "");
    const messageRaw = (e.parameter.Body || "").trim();
    const message = messageRaw.toUpperCase();

    Logger.log("From: " + phone);
    Logger.log("Body: " + messageRaw);

    if (!phone) {
      return ContentService.createTextOutput("OK");
    }

    if (message === "STOP") {
      handleStop(phone);
      return ContentService.createTextOutput("OK");
    }

    if (message === "HELP") {
      handleHelp(phone);
      return ContentService.createTextOutput("OK");
    }

    if (message === "START") {
      handleStart(phone);
      return ContentService.createTextOutput("OK");
    }

    handleUserReply(phone, messageRaw);
    return ContentService.createTextOutput("OK");

  } catch (err) {
    Logger.log("doPost error: " + err);
    return ContentService.createTextOutput("OK");
  }
}
function doPost(e) {
  try {

    const phone = normalizePhone(e.parameter.From || "");
    const messageRaw = (e.parameter.Body || "").trim();
    const message = messageRaw.toUpperCase();

    if (!phone) {
      return ContentService.createTextOutput("OK");
    }

    if (message === "STOP") {
      handleStop(phone);
      return ContentService.createTextOutput("OK");
    }

    if (message === "HELP") {
      handleHelp(phone);
      return ContentService.createTextOutput("OK");
    }

    if (message === "START") {
      handleStart(phone);
      return ContentService.createTextOutput("OK");
    }

    handleUserReply(phone, messageRaw);

    return ContentService.createTextOutput("OK");

  } catch (err) {
    Logger.log(err);
    return ContentService.createTextOutput("OK");
  }
}

//////////////////////////////////////////////////////
// START / HELP / STOP
//////////////////////////////////////////////////////

function handleStart(phone) {

  let user = getUserByPhone(phone);

  if (!user) {
    const userId = createUser(phone);
    user = getUserById(userId);
  }

  updateUser(user.rowNumber, {
    status: "lead",
    current_step: "awaiting_parent_name",
    opt_in: true
  });

  sendSms(phone, "Welcome to DaybyDay 👶\n\nWhat is your first name?");
}

function handleHelp(phone) {

  sendSms(
    phone,
    "DaybyDay sends daily parenting guidance based on your baby's age.\n\nReply STOP to unsubscribe."
  );

}

function handleStop(phone) {

  const user = getUserByPhone(phone);

  if (user) {
    updateUser(user.rowNumber, {
      status: "stopped",
      opt_in: false
    });
  }

  sendSms(phone, "You have been unsubscribed from DaybyDay.");
}

//////////////////////////////////////////////////////
// USER FLOW
//////////////////////////////////////////////////////

function handleUserReply(phone, messageRaw) {

  let user = getUserByPhone(phone);

  if (!user) {
    const userId = createUser(phone);
    user = getUserById(userId);
  }

  const currentStep = String(user.current_step || "").trim();

  //////////////////////////////////////////////////////
  // PARENT NAME
  //////////////////////////////////////////////////////

  if (currentStep === "awaiting_parent_name") {

    const parentName = toNameCase(messageRaw);

    updateUser(user.rowNumber, {
      parent_name: parentName,
      current_step: "awaiting_kid_name"
    });

    sendSms(phone, "Nice to meet you " + parentName + ". What is your child's first name?");
    return;
  }

  //////////////////////////////////////////////////////
  // CHILD NAME
  //////////////////////////////////////////////////////

  if (currentStep === "awaiting_kid_name") {

    const kidName = toNameCase(messageRaw);

    updateUser(user.rowNumber, {
      notes: "pending_kid_name:" + kidName,
      current_step: "awaiting_birth_date"
    });

    sendSms(phone, "What is " + kidName + "'s birth date? Reply like MM/DD/YYYY");
    return;
  }

  //////////////////////////////////////////////////////
  // BIRTH DATE
  //////////////////////////////////////////////////////

  if (currentStep === "awaiting_birth_date") {

    const birthDate = parseBirthDate(messageRaw);

    if (!birthDate) {
      sendSms(phone, "Please reply using format MM/DD/YYYY");
      return;
    }

    const kidName = getPendingKidName(user.notes);

    createKid(user.user_id, kidName, birthDate);

    updateUser(user.rowNumber, {
      notes: "",
      current_step: "awaiting_add_another_kid"
    });

    sendSms(phone, "Added " + kidName + " 🎉\n\nDo you want to add another child? Reply YES or NO");
    return;
  }

  //////////////////////////////////////////////////////
  // ADD ANOTHER CHILD
  //////////////////////////////////////////////////////

  if (currentStep === "awaiting_add_another_kid") {

    const answer = messageRaw.toUpperCase();

    if (answer === "YES") {

      updateUser(user.rowNumber, {
        current_step: "awaiting_kid_name"
      });

      sendSms(phone, "What is your next child's name?");
      return;
    }

    if (answer === "NO") {

      const youngestKid = getYoungestKidForUser(user.user_id);

      updateUser(user.rowNumber, {
        active_kid_id: youngestKid.kid_id,
        current_step: "complete",
        status: "active"
      });

      const ageDays = getAgeDays(youngestKid.birth_date);

      sendSms(
        phone,
        "You're all set 🎉\n\n" +
        youngestKid.kid_name +
        " is now the active child for daily DaybyDay messages and is " +
        ageDays +
        " days old today.\n\nReply HELP for help or STOP to unsubscribe."
      );

      return;
    }

    sendSms(phone, "Please reply YES or NO.");
    return;
  }

  //////////////////////////////////////////////////////
  // NORMAL QUESTIONS AFTER ONBOARDING
  //////////////////////////////////////////////////////

  if (currentStep === "complete") {

    const activeKid = getActiveKidForUser(user.user_id);

    if (!activeKid) {
      sendSms(phone, "I cannot find your active child yet.");
      return;
    }

    const kidName = activeKid.kid_name;
    const ageDays = getAgeDays(activeKid.birth_date);

    const knowledgeMatch = findKnowledgeByQuestion(messageRaw, ageDays);

    if (knowledgeMatch) {

      const reply =
        kidName + " is " + ageDays + " days old.\n\n" +
        knowledgeMatch.summary + "\n\n" +
        "Tip: " + knowledgeMatch.tip + "\n\n" +
        knowledgeMatch.reassurance;

      sendSms(phone, reply);
      return;
    }

    sendSms(
      phone,
      "Thanks — I got your question about " + kidName +
      ". I do not have a DaybyDay answer for that yet."
    );

    return;
  }

}

//////////////////////////////////////////////////////
// TWILIO
//////////////////////////////////////////////////////

function sendSms(to, body) {

  const sid = getConfig("TWILIO_ACCOUNT_SID");
  const token = getConfig("TWILIO_AUTH_TOKEN");
const from = normalizePhone(getConfig("TWILIO_PHONE_NUMBER"));
  const url =
    "https://api.twilio.com/2010-04-01/Accounts/" +
    sid +
    "/Messages.json";

  const payload = {
    To: to,
    From: from,
    Body: body
  };

  const options = {
    method: "post",
    payload: payload,
    headers: {
      Authorization:
        "Basic " +
        Utilities.base64Encode(sid + ":" + token)
    }
  };

  UrlFetchApp.fetch(url, options);
}

//////////////////////////////////////////////////////
// UTILITIES
//////////////////////////////////////////////////////

function normalizePhone(phone) {
  phone = String(phone).replace(/[^\d]/g, "");
  if (phone.length === 10) return "+1" + phone;
  if (phone.length === 11) return "+" + phone;
  return phone;
}

function toNameCase(str) {
  return String(str)
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());
}

function parseBirthDate(text) {

  const parts = text.split("/");

  if (parts.length !== 3) return null;

  const month = parseInt(parts[0]) - 1;
  const day = parseInt(parts[1]);
  const year = parseInt(parts[2]);

  return new Date(year, month, day);
}

function getAgeDays(date) {

  const birth = new Date(date);
  const today = new Date();

  const diff = today - birth;

  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function getPendingKidName(notes) {

  if (!notes) return "";

  const parts = notes.split(":");

  if (parts.length === 2) return parts[1];

  return "";
}
function getSheet(name) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
}

function getHeaderMap(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const map = {};

  headers.forEach(function(header, index) {
    map[String(header).trim()] = index;
  });

  return map;
}

function getConfig(key) {
  const sheet = getSheet("Config");
  const values = sheet.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim() === key) {
      return values[i][1];
    }
  }

  return "";
}

function getKidById(kidId) {
  const sheet = getSheet("Kids");
  const values = sheet.getDataRange().getValues();
  const headerMap = getHeaderMap(sheet);

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][headerMap["kid_id"]]) === String(kidId)) {
      return {
        kid_id: values[i][headerMap["kid_id"]],
        user_id: values[i][headerMap["user_id"]],
        kid_name: values[i][headerMap["kid_name"]],
        birth_date: values[i][headerMap["birth_date"]],
        gender: headerMap["gender"] !== undefined ? values[i][headerMap["gender"]] : "",
        is_primary: headerMap["is_primary"] !== undefined ? values[i][headerMap["is_primary"]] : "",
        stage: headerMap["stage"] !== undefined ? values[i][headerMap["stage"]] : "",
        created_at: headerMap["created_at"] !== undefined ? values[i][headerMap["created_at"]] : "",
        notes: headerMap["notes"] !== undefined ? values[i][headerMap["notes"]] : ""
      };
    }
  }

  return null;
}

function getAgeDays(birthDate) {
  const today = new Date();
  const birth = new Date(birthDate);
  const msPerDay = 1000 * 60 * 60 * 24;

  return Math.floor(
    (today.setHours(0, 0, 0, 0) - birth.setHours(0, 0, 0, 0)) / msPerDay
  );
}

function sendSms(to, body) {
  const sid = getConfig("TWILIO_ACCOUNT_SID");
  const token = getConfig("TWILIO_AUTH_TOKEN");
const from = normalizePhone(getConfig("TWILIO_PHONE_NUMBER"));
  const url = "https://api.twilio.com/2010-04-01/Accounts/" + sid + "/Messages.json";

  const payload = {
    To: to,
    From: from,
    Body: body
  };

  const options = {
    method: "post",
    payload: payload,
    headers: {
      Authorization: "Basic " + Utilities.base64Encode(sid + ":" + token)
    },
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  Logger.log(response.getContentText());
}