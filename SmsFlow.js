function isTwilioWebhook_(e) {
  return !!(e && e.parameter && (e.parameter.From || e.parameter.Body));
}

function handleIncomingSmsWebhook_(e) {
  var phone = normalizePhone(e.parameter.From || '');
  var messageRaw = cleanText(e.parameter.Body);
  var message = normalizeInboundKeyword_(messageRaw);

  logInfo('Inbound SMS received', { from: phone, body: messageRaw });

  if (!phone) {
    return;
  }

  if (isOptOutMessage_(message)) {
    handleStop(phone);
    return;
  }

  if (message === 'HELP') {
    handleHelp(phone);
    return;
  }

  if (message === 'START') {
    handleStart(phone);
    return;
  }

  handleUserReply(phone, messageRaw);
}

function handleStart(phone) {
  var parent = getParentByPhone(phone);
  var onboardingOptions = buildOnboardingChoiceOptions_();
  var shouldSendWelcomeIntro = false;
  if (!parent) {
    parent = createParent({
      parent_phone: phone,
      timezone: getDefaultTimezone(),
      sms_opt_in: true,
      active: true,
      status: APP_CONFIG.deliveryStatuses.ACTIVE,
      onboarding_step: APP_CONFIG.onboardingSteps.WAITING_ONBOARDING_CHOICE,
      preferences: {
        onboarding_source: 'sms',
        onboarding_state: APP_CONFIG.onboardingSteps.WAITING_ONBOARDING_CHOICE
      }
    });
    shouldSendWelcomeIntro = true;
  } else if (parent.onboarding_step === APP_CONFIG.parentStatuses.ONBOARDED && getKidsByParentId(parent.parent_id, false).length) {
    parent = updateParent(parent.parent_id, {
      sms_opt_in: true,
      active: true,
      status: APP_CONFIG.deliveryStatuses.ACTIVE,
      onboarding_step: APP_CONFIG.onboardingSteps.ONBOARDED
    });
    sendSmsMessage(parent.parent_id, phone, 'Welcome back to ' + getBrandName() + '.\n\nWe\'ll resume sending guidance for your child each day.', APP_CONFIG.messageKinds.onboarding);
    return;
  } else {
    parent = updateParent(parent.parent_id, {
      parent_phone: phone,
      sms_opt_in: true,
      active: true,
      status: APP_CONFIG.deliveryStatuses.ACTIVE,
      onboarding_step: APP_CONFIG.onboardingSteps.WAITING_ONBOARDING_CHOICE
    });
    updateParentPreferences(parent.parent_id, {
      onboarding_source: 'sms',
      onboarding_state: APP_CONFIG.onboardingSteps.WAITING_ONBOARDING_CHOICE,
      onboarding_options: onboardingOptions,
      onboarding_choice: null,
      pending_child_name: null,
      pending_checkin: null,
      pending_milestone: null,
      pending_milestone_date: null
    });
    shouldSendWelcomeIntro = true;
  }

  if (shouldSendWelcomeIntro) {
    sendSmsMessage(
      parent.parent_id,
      phone,
      buildWelcomeIntroMessage_(),
      APP_CONFIG.messageKinds.welcome
    );
  }

  sendSmsMessage(
    parent.parent_id,
    phone,
    buildOnboardingChoiceMessage_(onboardingOptions),
    APP_CONFIG.messageKinds.onboarding
  );
}

function buildWelcomeIntroMessage_() {
  return APP_CONFIG.optIn.welcomeMessage;
}

function handleHelp(phone) {
  var parent = getParentByPhone(phone);
  sendSmsMessage(
    parent ? parent.parent_id : '',
    phone,
    getBrandName() + ' sends daily parenting guidance by text. Reply STOP to unsubscribe or START to rejoin.\n\nReply 1-6 for more support and sharing.',
    'system'
  );
}

function handleStop(phone) {
  var parent = getParentByPhone(phone);
  if (parent) {
    updateParent(parent.parent_id, {
      status: APP_CONFIG.deliveryStatuses.UNSUBSCRIBED,
      sms_opt_in: false,
      active: false
    });
  }
  sendSmsMessage(
    parent ? parent.parent_id : '',
    phone,
    'You\'ve been unsubscribed from ' + getBrandName() + ' messages.\n\nWe\'re glad we could support you.\nIf you ever want to start again, just text START.',
    'system'
  );
}

function handleUserReply(phone, messageRaw) {
  var parent = getParentByPhone(phone);
  if (!parent) {
    handleStart(phone);
    return;
  }

  if (cleanText(parent.status) === APP_CONFIG.deliveryStatuses.UNSUBSCRIBED) {
    return;
  }

  var status = getParentConversationState_(parent);
  if (status !== APP_CONFIG.parentStatuses.ONBOARDED) {
    handleOnboardingReply_(parent, messageRaw, status);
    return;
  }

  if (handlePendingMilestoneDateReply_(parent, messageRaw)) {
    return;
  }

  if (handlePendingCheckinReply_(parent, messageRaw)) {
    return;
  }

  if (handlePendingMilestoneReply_(parent, messageRaw)) {
    return;
  }

  if (handlePendingShareReply_(parent, messageRaw)) {
    return;
  }

  if (isShareReply(messageRaw)) {
    handleShareReply_(parent);
    return;
  }

  var replyTopic = getTopicFromReply(messageRaw);
  if (replyTopic) {
    handleIncomingParentReply_(phone, messageRaw);
    return;
  }

  if (normalizeInboundKeyword_(messageRaw) === 'ADD CHILD') {
    updateParent(parent.parent_id, {
      status: APP_CONFIG.deliveryStatuses.ACTIVE,
      onboarding_step: APP_CONFIG.onboardingSteps.WAITING_CHILD_NAME
    });
    sendSmsMessage(parent.parent_id, phone, 'I\'d love to add another child. What is their first name?', APP_CONFIG.messageKinds.onboarding);
    return;
  }

  handleParentQuestion_(parent, messageRaw);
}

function handleOnboardingReply_(parent, messageRaw, status) {
  var text = cleanText(messageRaw);
  var upper = text.toUpperCase();
  var prefs;

  if (!text) {
    sendSmsMessage(parent.parent_id, parent.parent_phone, 'Reply with a short answer so I can keep going.', APP_CONFIG.messageKinds.onboarding);
    return;
  }

  if (status === APP_CONFIG.parentStatuses.NEW || status === APP_CONFIG.parentStatuses.WAITING_ONBOARDING_CHOICE) {
    var options = buildOnboardingChoiceOptions_();
    var selectedChoice = parseOnboardingChoiceSelection_(text, options);
    if (!selectedChoice) {
      sendSmsMessage(parent.parent_id, parent.parent_phone, buildOnboardingChoiceMessage_(options), APP_CONFIG.messageKinds.onboarding);
      return;
    }
    updateParentPreferences(parent.parent_id, {
      onboarding_choice: selectedChoice.id,
      onboarding_options: options,
      onboarding_state: APP_CONFIG.onboardingSteps.WAITING_NAME
    });
    updateParent(parent.parent_id, {
      status: APP_CONFIG.deliveryStatuses.ACTIVE,
      onboarding_step: APP_CONFIG.onboardingSteps.WAITING_NAME,
      sms_opt_in: true,
      active: true
    });
    sendSmsMessage(parent.parent_id, parent.parent_phone, 'Thanks. What should I call you?', APP_CONFIG.messageKinds.onboarding);
    return;
  }

  if (status === APP_CONFIG.parentStatuses.WAITING_NAME) {
    updateParent(parent.parent_id, {
      parent_name: text,
      status: APP_CONFIG.deliveryStatuses.ACTIVE,
      onboarding_step: APP_CONFIG.onboardingSteps.WAITING_CHILD_NAME,
      sms_opt_in: true,
      active: true
    });
    sendSmsMessage(parent.parent_id, parent.parent_phone, 'Hi ' + toNameCase(text) + '. What is your child\'s first name?', APP_CONFIG.messageKinds.onboarding);
    return;
  }

  if (status === APP_CONFIG.parentStatuses.WAITING_CHILD_NAME) {
    updateParentPreferences(parent.parent_id, {
      pending_child_name: toNameCase(text)
    });
    updateParent(parent.parent_id, {
      status: APP_CONFIG.deliveryStatuses.ACTIVE,
      onboarding_step: APP_CONFIG.onboardingSteps.WAITING_CHILD_BIRTHDATE
    });
    sendSmsMessage(parent.parent_id, parent.parent_phone, 'What is ' + toNameCase(text) + '\'s birthdate? Reply like MM/DD/YYYY.', APP_CONFIG.messageKinds.onboarding);
    return;
  }

  if (status === APP_CONFIG.parentStatuses.WAITING_CHILD_BIRTHDATE) {
    var birthDate = parseDateInput(text);
    if (!birthDate) {
      sendSmsMessage(parent.parent_id, parent.parent_phone, 'I didn\'t catch that date. Reply like MM/DD/YYYY.', APP_CONFIG.messageKinds.onboarding);
      return;
    }

    prefs = getParentPreferences(getParentById(parent.parent_id));
    createKid(parent.parent_id, {
      child_name: prefs.pending_child_name,
      birthdate: dateToStorageString(birthDate)
    });
    updateParentPreferences(parent.parent_id, {
      pending_child_name: null
    });
    updateParent(parent.parent_id, {
      status: APP_CONFIG.deliveryStatuses.ACTIVE,
      onboarding_step: APP_CONFIG.onboardingSteps.ASK_ADD_CHILD
    });
    sendSmsMessage(parent.parent_id, parent.parent_phone, 'Added ' + prefs.pending_child_name + '. Do you want to add another child? Reply YES or NO.', APP_CONFIG.messageKinds.onboarding);
    return;
  }

  if (status === APP_CONFIG.parentStatuses.ASK_ADD_CHILD) {
    if (upper === 'YES' || upper === 'Y') {
      updateParent(parent.parent_id, {
        status: APP_CONFIG.deliveryStatuses.ACTIVE,
        onboarding_step: APP_CONFIG.onboardingSteps.WAITING_CHILD_NAME
      });
      sendSmsMessage(parent.parent_id, parent.parent_phone, 'What is your next child\'s first name?', APP_CONFIG.messageKinds.onboarding);
      return;
    }

    if (upper === 'NO' || upper === 'N') {
      completeOnboarding_(parent.parent_id);
      return;
    }

    sendSmsMessage(parent.parent_id, parent.parent_phone, 'Reply YES to add another child or NO to finish.', APP_CONFIG.messageKinds.onboarding);
    return;
  }

  sendSmsMessage(parent.parent_id, parent.parent_phone, 'Reply START if you want to begin again.', APP_CONFIG.messageKinds.onboarding);
}

function completeOnboarding_(parentId) {
  var parent = updateParent(parentId, {
    status: APP_CONFIG.deliveryStatuses.ACTIVE,
    onboarding_step: APP_CONFIG.onboardingSteps.ONBOARDED,
    sms_opt_in: true,
    active: true
  });

  sendSmsMessage(
    parent.parent_id,
    parent.parent_phone,
    'You\'re all set, ' + parent.parent_name + '. Each day I\'ll text short guidance for your family.\n\nYour first daily message will arrive at the next scheduled send.\n\nReply anytime:\n' + buildInteractiveReplyPrompt(false),
    APP_CONFIG.messageKinds.onboarding
  );
}

function handleIncomingParentReply_(phoneNumber, messageBody) {
  var phone = normalizePhone(phoneNumber);
  var normalizedReply = cleanText(messageBody);
  var topic = getTopicFromReply(messageBody);
  var parent = getParentByPhone(phone);

  logInfo('Incoming parent reply', {
    phone: phone,
    raw_reply: messageBody,
    topic: topic || 'invalid'
  });

  if (!parent) {
    sendSmsMessage('', phone, buildInvalidReplyPrompt(), 'system');
    return { ok: false, reason: 'unknown_phone' };
  }

  if (!topic) {
    sendSmsMessage(parent.parent_id, phone, buildInvalidReplyPrompt(), 'system');
    return { ok: false, reason: 'invalid_topic' };
  }

  var children = getRenderableActiveChildrenForParent(parent.parent_phone, parent.parent_id);
  if (!children.length) {
    sendSmsMessage(parent.parent_id, phone, 'I could not find any active children on your account yet.', 'system');
    return { ok: false, reason: 'no_active_kids' };
  }

  var requestType = resolveReplyRequestType_(normalizedReply);
  var requestedCategory = getCategoryFamilyForRequest_(requestType, parent, new Date());
  var payloads = buildChildPayloadsForParent_(parent, children, new Date(), requestType, requestedCategory, {
    responseType: 'followup',
    requestedCategory: requestedCategory
  });
  var responseParts = buildFamilyMessagePartsFromPayloads_(parent, payloads, {
    mode: 'followup',
    responseType: 'followup',
    requestType: requestType,
    requestedCategory: requestedCategory,
    includeGreeting: false,
    includeOptOut: false,
    includeMenu: true
  });
  var response = null;
  for (var j = 0; j < responseParts.length; j += 1) {
    response = sendSmsMessage(parent.parent_id, phone, responseParts[j], APP_CONFIG.messageKinds.topicReply);
  }

  for (var i = 0; i < payloads.length; i += 1) {
    createTipHistoryLogFromPayload(parent.parent_id, payloads[i], getTimezoneForParent(parent), response && response.sid ? response.sid : '', {
      message_type: 'followup',
      inbound_trigger: normalizedReply,
      topic: requestedCategory
    });
  }
  updateParentPreferences(parent.parent_id, {
    last_daily_child_id: children[0].child_id,
    last_daily_topic: requestedCategory,
    last_requested_category: requestedCategory,
    last_outbound_message_type: 'followup'
  });

  return {
    ok: true,
    parent_id: parent.parent_id,
    topic: requestedCategory,
    child_ids: payloads.map(function(payload) { return payload.childId; }),
    tip_ids: payloads.map(function(payload) { return payload.selectedTip.tip_id; }),
    message: responseParts.join('\n\n')
  };
}

function handleInboundReply(parent, inboundText) {
  return handleIncomingParentReply_(parent.parent_phone, inboundText);
}

function testInteractiveReply(phoneNumber, messageBody) {
  var phone = normalizePhone(phoneNumber);
  var parent = getParentByPhone(phone);
  if (!parent) {
    throw new Error('Parent not found for phone: ' + phone);
  }

  if (isShareReply(messageBody)) {
    handleShareReply_(parent);
    return { ok: true, parent_id: parent.parent_id, action: 'share' };
  }

  return handleIncomingParentReply_(phoneNumber, messageBody);
}

function handleParentQuestion_(parent, questionText) {
  var kids = getKidsByParentId(parent.parent_id, false);
  var matchedKid = getFocusChildForParent_(parent);
  var matchedKidId = matchedKid ? matchedKid.child_id : '';
  var question = createQuestion(parent.parent_id, matchedKidId, questionText, 'new');

  if (matchedKid) {
    var reply = buildQuestionReply(parent, matchedKid, questionText);
    if (reply) {
      updateQuestionStatus(question.question_id, 'answered');
      sendSmsMessage(parent.parent_id, parent.parent_phone, reply, matchedKid.child_id);
      return;
    }
  }

  sendSmsMessage(
    parent.parent_id,
    parent.parent_phone,
    appendNextMenu(
      'Thanks. I saved that question' + (kids.length > 1 ? ' for your family' : '') + '. I do not have a matching DaybyDay answer yet, but I\'ll keep this in the queue.',
      true
    ),
    'question'
  );
}

function getParentConversationState_(parent) {
  var state = cleanText(parent.onboarding_step);
  if (!state) {
    return APP_CONFIG.parentStatuses.NEW;
  }
  return state;
}

function normalizeInboundKeyword_(text) {
  return cleanText(text).replace(/\s+/g, ' ').toUpperCase();
}

function buildOnboardingChoiceOptions_() {
  return [
    { id: 'daily_guidance', label: 'Daily guidance' },
    { id: 'sleep_support', label: 'Sleep support' },
    { id: 'big_feelings', label: 'Big feelings and behavior' }
  ];
}

function buildOnboardingChoiceMessage_(options) {
  var items = options || buildOnboardingChoiceOptions_();
  var lines = [
    'Welcome to ' + getBrandName() + '. What kind of support sounds most helpful right now?'
  ];
  for (var i = 0; i < items.length; i += 1) {
    lines.push((i + 1) + ' = ' + items[i].label);
  }
  lines.push('');
  lines.push('Reply with a number to start.');
  return lines.join('\n');
}

function parseOnboardingChoiceSelection_(text, options) {
  var items = options || buildOnboardingChoiceOptions_();
  var trimmed = cleanText(text);
  if (!trimmed) {
    return null;
  }
  var index = Number(trimmed);
  if (!isNaN(index) && index >= 1 && index <= items.length) {
    return items[index - 1];
  }
  return null;
}

function isOptOutMessage_(normalizedMessage) {
  return normalizedMessage === 'STOP' ||
    normalizedMessage === 'STOP ALL' ||
    normalizedMessage === 'OPT OUT' ||
    normalizedMessage === 'OPTOUT' ||
    normalizedMessage === 'UNSUBSCRIBE' ||
    normalizedMessage === 'QUIT';
}

function getFocusChildForParent_(parent) {
  var kids = getKidsByParentId(parent.parent_id, false);
  if (!kids.length) {
    return null;
  }

  var prefs = getParentPreferences(parent);
  if (prefs.last_daily_child_id) {
    for (var i = 0; i < kids.length; i += 1) {
      if (String(kids[i].child_id) === String(prefs.last_daily_child_id)) {
        return kids[i];
      }
    }
  }

  var index = parent.last_child_index === '' ? 0 : Number(parent.last_child_index || 0);
  return kids[Math.max(Math.min(index, kids.length - 1), 0)];
}

function getReplyContextChild_(parent, topic) {
  var kids = getKidsByParentId(parent.parent_id, false);
  if (!kids.length) {
    return null;
  }
  if (kids.length === 1) {
    return kids[0];
  }

  var focusChild = getFocusChildForParent_(parent);
  if (focusChild) {
    return focusChild;
  }

  if (topic === 'sleep' || topic === 'feeding') {
    return kids[0];
  }

  return kids[0];
}

function buildReplyGuideForTopic_(parent, child, topic) {
  var prefs = getParentPreferences(parent);
  var resolvedTopic = topic;
  if (topic === 'today\'s next step') {
    resolvedTopic = prefs.last_daily_topic || 'today\'s next step';
  }

  return buildKidGuide(parent, child, new Date(), {
    lookbackDays: APP_CONFIG.knowledge.recentTipLookbackDays,
    topic: resolvedTopic
  });
}

function resolveReplyRequestType_(replyText) {
  var normalizedReply = cleanText(replyText);
  if (normalizedReply === '1') {
    return 'another_tip';
  }
  if (normalizedReply === '2') {
    return 'sleep';
  }
  if (normalizedReply === '3') {
    return 'play';
  }
  if (normalizedReply === '4') {
    return 'feeding';
  }
  if (normalizedReply === '5') {
    return 'behavior';
  }
  return normalizeRequestType_(getTopicFromReply(replyText));
}

function handlePendingCheckinReply_(parent, messageRaw) {
  var prefs = getParentPreferences(parent);
  var pending = prefs.pending_checkin;
  if (!pending) {
    return false;
  }

  var reply = cleanText(messageRaw);
  if (reply !== '1' && reply !== '2' && reply !== '3') {
    return false;
  }

  var child = getKidById(pending.child_id);
  var childName = child ? child.child_name : pending.child_name;
  var body = '';

  if (reply === '1') {
    body = childName + '\'s night sounds like it went well. Keep tonight\'s routine as steady and simple as you can.';
  } else if (reply === '2') {
    body = 'An okay night still counts. If today feels wobbly, keep expectations light and lean on a familiar rhythm with ' + childName + '.';
  } else {
    body = 'Rough nights are a lot. Today, keep things simple for ' + childName + ': a calm reset, a little extra closeness, and an earlier wind-down if you can.';
  }

  sendSmsMessage(parent.parent_id, parent.parent_phone, appendNextMenu(body, true), APP_CONFIG.messageKinds.checkin);
  updateParent(parent.parent_id, { last_checkin_topic: pending.topic || 'sleep' });
  updateParentPreferences(parent.parent_id, { pending_checkin: null });
  return true;
}

function handlePendingMilestoneReply_(parent, messageRaw) {
  var prefs = getParentPreferences(parent);
  var pending = prefs.pending_milestone;
  if (!pending) {
    return false;
  }

  var reply = cleanText(messageRaw);
  if (reply !== '1' && reply !== '2') {
    return false;
  }

  if (reply === '1') {
    updateParentPreferences(parent.parent_id, {
      pending_milestone_date: pending,
      pending_milestone: null
    });
    sendSmsMessage(parent.parent_id, parent.parent_phone, appendNextMenu('Beautiful. Reply with the date in MM/DD/YYYY format, or reply TODAY.', true), APP_CONFIG.messageKinds.milestone);
    return true;
  }

  sendSmsMessage(parent.parent_id, parent.parent_phone, appendNextMenu(pending.not_yet_tip || 'That is still ahead for many children. Keep offering simple chances to practice without pressure.', true), APP_CONFIG.messageKinds.milestone);
  updateParentPreferences(parent.parent_id, { pending_milestone: null });
  return true;
}

function handlePendingMilestoneDateReply_(parent, messageRaw) {
  var prefs = getParentPreferences(parent);
  var pending = prefs.pending_milestone_date;
  if (!pending) {
    return false;
  }

  var reply = cleanText(messageRaw).toUpperCase();
  var dateValue = reply === 'TODAY' ? new Date() : parseDateInput(messageRaw);
  if (!dateValue) {
    sendSmsMessage(parent.parent_id, parent.parent_phone, appendNextMenu('Reply with the milestone date in MM/DD/YYYY format, or reply TODAY.', true), APP_CONFIG.messageKinds.milestone);
    return true;
  }

  var child = getKidById(pending.child_id);
  createMilestone({
    parent_phone: parent.parent_phone,
    child_id: pending.child_id,
    child_name: child ? child.child_name : pending.child_name,
    milestone: pending.milestone_key,
    date: dateToStorageString(dateValue)
  });

  updateParentPreferences(parent.parent_id, { pending_milestone_date: null });
  sendSmsMessage(parent.parent_id, parent.parent_phone, appendNextMenu('Saved ' + (pending.child_name || (child && child.child_name) || 'that milestone') + '\'s ' + pending.milestone_label + '. Small moments matter.', true), APP_CONFIG.messageKinds.milestone);
  return true;
}

function handleShareReply_(parent) {
  if (!APP_CONFIG.featureFlags.shareFlowEnabled) {
    sendSmsMessage(parent.parent_id, parent.parent_phone, appendNextMenu(buildSharePrompt(), true), APP_CONFIG.messageKinds.share);
    return;
  }

  updateParentPreferences(parent.parent_id, {
    pending_share: {
      step: 'collect'
    }
  });
  sendSmsMessage(
    parent.parent_id,
    parent.parent_phone,
    buildSharePrompt(),
    APP_CONFIG.messageKinds.share
  );
}

function handlePendingShareReply_(parent, messageRaw) {
  var prefs = getParentPreferences(parent);
  var pending = prefs.pending_share;
  if (!pending) {
    return false;
  }

  // Keep the first-pass share flow simple: gather enough information now and leave
  // the actual outbound invite behind a feature flag for later expansion.
  var text = cleanText(messageRaw);
  if (!text) {
    sendSmsMessage(parent.parent_id, parent.parent_phone, buildSharePrompt(), APP_CONFIG.messageKinds.share);
    return true;
  }

  if (pending.step === 'collect') {
    var parsedShare = parseShareInput_(text);
    if (!parsedShare) {
      sendSmsMessage(parent.parent_id, parent.parent_phone, buildSharePrompt(), APP_CONFIG.messageKinds.share);
      return true;
    }

    updateParentPreferences(parent.parent_id, {
      pending_share_request: {
        name: parsedShare.name,
        phone: parsedShare.phone,
        created_at: nowIsoString()
      },
      pending_share: null
    });

    var body = APP_CONFIG.featureFlags.shareAutoSendEnabled
      ? 'Thanks. I saved that share and will send it shortly.'
      : 'Thanks. I saved a share request for ' + parsedShare.name + '. I\'m not auto-sending invitations yet, but the flow is ready.';
    sendSmsMessage(parent.parent_id, parent.parent_phone, appendNextMenu(body, true), APP_CONFIG.messageKinds.share);
    return true;
  }

  updateParentPreferences(parent.parent_id, { pending_share: null });
  return false;
}

function parseShareInput_(text) {
  var parts = String(text || '').split(',');
  if (parts.length < 2) {
    return null;
  }
  var name = toNameCase(parts[0]);
  var phone = normalizePhone(parts.slice(1).join(','));
  if (!name || !phone) {
    return null;
  }
  return {
    name: name,
    phone: phone
  };
}
