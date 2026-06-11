var APP_CONFIG = {
  sheets: {
    parents: { primary: 'Parents', aliases: ['Users'] },
    kids: { primary: 'Children', aliases: ['Kids'] },
    milestones: { primary: 'Milestones', aliases: [] },
    questions: { primary: 'Questions', aliases: ['Conversations'] },
    messages: { primary: 'Messages', aliases: ['DailyLog'] },
    knowledge: { primary: 'Knowledge', aliases: [] },
    config: { primary: 'Config', aliases: [] }
  },
  headers: {
    parents: [
      'parent_id',
      'parent_phone',
      'parent_name',
      'status',
      'onboarding_step',
      'last_checkin_topic',
      'last_child_index',
      'preferred_time',
      'referral_code',
      'referred_by',
      'phone',
      'email',
      'timezone',
      'sms_opt_in',
      'preferences',
      'normalized_phone',
      'opt_in_source',
      'opt_in_method',
      'opt_in_form_url',
      'opt_in_response_sheet',
      'opt_in_timestamp',
      'form_submission_timestamp',
      'sms_consent_text',
      'welcome_sms_sent_at',
      'last_opt_in_processed_at',
      'last_opt_in_row',
      'last_opt_in_status',
      'created_at',
      'updated_at',
      'active'
    ],
    kids: [
      'child_id',
      'parent_phone',
      'parent_id',
      'child_name',
      'birthdate',
      'due_date',
      'kid_id',
      'kid_name',
      'date_of_birth',
      'status',
      'enrollment_source',
      'opt_in_timestamp',
      'gender_optional',
      'notes',
      'created_at',
      'updated_at',
      'active'
    ],
    milestones: [
      'parent_phone',
      'child_id',
      'child_name',
      'milestone',
      'date',
      'created_at'
    ],
    questions: [
      'question_id',
      'parent_id',
      'kid_id',
      'question',
      'status',
      'created_at',
      'updated_at'
    ],
    messages: [
      'message_id',
      'parent_id',
      'kid_id_or_combined',
      'kid_id',
      'topic',
      'message_type',
      'inbound_trigger',
      'request_type',
      'category_family',
      'original_category',
      'tip_id',
      'rendered_category_family',
      'rendered_category_label',
      'insight_rendered',
      'action_rendered',
      'reassurance_rendered',
      'date_sent',
      'message_text',
      'send_status',
      'sent_at',
      'twilio_sid_optional',
      'error_optional'
    ],
    knowledge: [
      'stage',
      'topic',
      'message_type',
      'insight',
      'action',
      'encouragement',
      'checkin_question',
      'reply_options',
      'milestone_key',
      'age_min_days',
      'age_max_days',
      'summary',
      'tip',
      'reassurance',
      'parent_question',
      'keywords',
      'tip_id'
    ]
  },
  headerAliases: {
    parents: {
      user_id: 'parent_id',
      opt_in: 'sms_opt_in'
    },
    kids: {
      user_id: 'parent_id',
      birth_date: 'birthdate',
      date_of_birth: 'birthdate',
      estimated_due_date: 'due_date',
      duedate: 'due_date',
      kid_name: 'child_name',
      name: 'child_name'
    },
    milestones: {},
    questions: {
      conversation_id: 'question_id',
      user_id: 'parent_id',
      body: 'question'
    },
    messages: {
      daily_log_id: 'message_id',
      daily_id: 'message_id',
      user_id: 'parent_id',
      kid_id: 'kid_id_or_combined',
      send_date: 'date_sent',
      body: 'message_text',
      status: 'send_status',
      error: 'error_optional',
      twilio_sid: 'twilio_sid_optional'
    },
    knowledge: {
      min_age_days: 'age_min_days',
      max_age_days: 'age_max_days',
      summary: 'insight',
      tip: 'action',
      reassurance: 'encouragement'
    }
  },
  properties: {
    brandName: 'BRAND_NAME',
    defaultTimezone: 'DEFAULT_TIMEZONE',
    twilioSid: 'TWILIO_ACCOUNT_SID',
    twilioToken: 'TWILIO_AUTH_TOKEN',
    twilioPhone: 'TWILIO_PHONE_NUMBER',
    docTemplateId: 'DOC_TEMPLATE_ID',
    dailySendHour: 'DAILY_SEND_HOUR'
  },
  defaults: {
    brandName: 'DaybyDay',
    defaultTimezone: 'America/Denver',
    dailySendHour: '8'
  },
  parentStatuses: {
    NEW: 'NEW',
    WAITING_ONBOARDING_CHOICE: 'WAITING_ONBOARDING_CHOICE',
    WAITING_NAME: 'WAITING_NAME',
    WAITING_CHILD_NAME: 'WAITING_CHILD_NAME',
    WAITING_CHILD_BIRTHDATE: 'WAITING_CHILD_BIRTHDATE',
    ASK_ADD_CHILD: 'ASK_ADD_CHILD',
    ONBOARDED: 'ONBOARDED'
  },
  deliveryStatuses: {
    ACTIVE: 'ACTIVE',
    UNSUBSCRIBED: 'UNSUBSCRIBED'
  },
  onboardingSteps: {
    NEW: 'NEW',
    WAITING_ONBOARDING_CHOICE: 'WAITING_ONBOARDING_CHOICE',
    WAITING_NAME: 'WAITING_NAME',
    WAITING_CHILD_NAME: 'WAITING_CHILD_NAME',
    WAITING_CHILD_BIRTHDATE: 'WAITING_CHILD_BIRTHDATE',
    ASK_ADD_CHILD: 'ASK_ADD_CHILD',
    ONBOARDED: 'ONBOARDED'
  },
  messageKinds: {
    combined: 'combined',
    daily: 'daily',
    onboarding: 'onboarding',
    welcome: 'welcome',
    topicReply: 'topic_reply',
    milestone: 'milestone',
    checkin: 'checkin',
    share: 'share'
  },
  optIn: {
    responseSheetName: 'Opt In',
    formUrl: 'https://docs.google.com/forms/d/e/1FAIpQLSclZzI4m-5wCUQrXvz8NfoENgKAhxTZ0ECgDDve7mmJvJLcCA/viewform?usp=dialog',
    defaultConsentText: 'I agree to receive recurring SMS messages from DaybyDay with parenting guidance based on my child’s age. Message frequency varies, typically 1 message per day. Message and data rates may apply. Reply STOP to unsubscribe or HELP for help. I agree to the Terms of Service and Privacy Policy.',
    welcomeMessage: 'Welcome to DaybyDay 🌱\n\nYou’ll receive daily parenting guidance tailored to your child’s age.\n\nMsg frequency varies (~1/day). Msg & data rates may apply.\n\nReply STOP to unsubscribe or HELP for help.',
    welcomeCooldownHours: 12,
    metadataHeaders: [
      'normalized_phone',
      'processing_status',
      'processed_at',
      'processing_notes',
      'parent_id',
      'child_ids',
      'welcome_sms_status'
    ]
  },
  featureFlags: {
    shareFlowEnabled: true,
    shareAutoSendEnabled: false
  },
  docPlaceholders: {
    parentName: '{{PARENT_NAME}}',
    date: '{{DATE}}',
    kidSections: '{{KID_SECTIONS}}'
  },
  knowledge: {
    maxAgeDays: 21 * 365,
    bucketSizeDays: 30,
    tipVariantsPerTopic: 3,
    recentTipLookbackDays: 45,
    nearbyAgeWindowDays: 21,
    defaultCooldownDays: 21,
    stageBoostWeight: 20,
    leapBoostWeight: 25,
    noveltyWeight: 15,
    categoryRotationPenalty: 18,
    rotationGroupPenalty: 12,
    difficultyPenalty: {
      easy: 0,
      medium: 4,
      hard: 8
    },
    topics: [
      'sleep',
      'feeding',
      'development',
      'learning/play',
      'emotional development',
      'behavior'
    ],
    rotatingCategories: [
      'development',
      'sleep',
      'learning/play',
      'feeding',
      'behavior',
      'emotional development',
      'cognitive development',
      'language development',
      'social development',
      'attachment and bonding',
      'parent emotional support',
      'safety'
    ],
    familyCategories: [
      'development',
      'sleep',
      'learning/play',
      'feeding',
      'behavior',
      'emotional development',
      'safety'
    ]
  },
  messaging: {
    dailyOpeners: [
      'A small moment can teach a lot today.',
      'Your child is learning more than you can see.',
      'Tiny moments matter more than they seem.'
    ]
  },
  sms: {
    maxCombinedMessageLength: 1200,
    maxMessagePartLength: 1200,
    maxInsightLength: 120,
    maxActionLength: 90
  },
  topicReplyMap: {
    '1': 'development',
    '2': 'sleep',
    '3': 'learning/play',
    '4': 'feeding',
    '5': 'behavior',
    '6': 'share'
  },
  topicReplyLabels: {
    '1': 'Another tip',
    '2': 'Sleep tip',
    '3': 'Play',
    '4': 'Feeding tip',
    '5': 'Behavior tip',
    '6': 'Share with another parent'
  },
  stages: [
    { key: 'newborn', label: 'Newborn', minAgeDays: 0, maxAgeDays: 56 },
    { key: 'early_baby', label: 'Early Baby', minAgeDays: 57, maxAgeDays: 120 },
    { key: 'growing_baby', label: 'Growing Baby', minAgeDays: 121, maxAgeDays: 210 },
    { key: 'exploring_baby', label: 'Exploring Baby', minAgeDays: 211, maxAgeDays: 365 },
    { key: 'new_toddler', label: 'New Toddler', minAgeDays: 366, maxAgeDays: 540 },
    { key: 'curious_toddler', label: 'Curious Toddler', minAgeDays: 541, maxAgeDays: 1095 },
    { key: 'preschooler', label: 'Preschooler', minAgeDays: 1096, maxAgeDays: 1825 },
    { key: 'early_school_age', label: 'Early School Age', minAgeDays: 1826, maxAgeDays: 3650 }
  ],
  milestonePrompts: [
    {
      key: 'first_smile',
      label: 'first smile',
      prompt: 'Has {child_name} smiled at you yet?',
      minAgeDays: 28,
      maxAgeDays: 120,
      topic: 'emotional development',
      notYetTip: 'That is still ahead for many babies. Keep leaning into face-to-face time, soft talking, and short playful pauses.'
    },
    {
      key: 'first_roll',
      label: 'first roll',
      prompt: 'Has {child_name} rolled over yet?',
      minAgeDays: 90,
      maxAgeDays: 240,
      topic: 'development',
      notYetTip: 'That is still very normal. A little supervised floor time and reaching play can help build toward it.'
    },
    {
      key: 'first_crawl',
      label: 'first crawl',
      prompt: 'Has {child_name} started crawling yet?',
      minAgeDays: 180,
      maxAgeDays: 360,
      topic: 'development',
      notYetTip: 'Many babies get there on their own timeline. Floor play, reaching, and chances to pivot are enough for today.'
    },
    {
      key: 'first_stand',
      label: 'first stand',
      prompt: 'Is {child_name} pulling up to stand yet?',
      minAgeDays: 240,
      maxAgeDays: 420,
      topic: 'development',
      notYetTip: 'That skill often comes with repetition. A stable surface and plenty of free movement time are enough for now.'
    },
    {
      key: 'first_step',
      label: 'first step',
      prompt: 'Has {child_name} taken first steps yet?',
      minAgeDays: 300,
      maxAgeDays: 540,
      topic: 'development',
      notYetTip: 'Walking can come in a wide range. Cruising, squatting, and playful practice all count as progress.'
    },
    {
      key: 'first_word',
      label: 'first word',
      prompt: 'Has {child_name} said a first word yet?',
      minAgeDays: 270,
      maxAgeDays: 600,
      topic: 'learning/play',
      notYetTip: 'Language builds slowly. Keep naming familiar people, routines, and favorite objects through the day.'
    }
  ]
};

function getConfigValue(key, fallback) {
  var scriptValue = PropertiesService.getScriptProperties().getProperty(key);
  if (scriptValue !== null && scriptValue !== '') {
    return scriptValue;
  }

  var sheetValue = getConfigFromSheet_(key);
  if (sheetValue !== '') {
    return sheetValue;
  }

  return fallback || '';
}

function getBrandName() {
  return getConfigValue(APP_CONFIG.properties.brandName, APP_CONFIG.defaults.brandName);
}

function getDefaultTimezone() {
  return getConfigValue(APP_CONFIG.properties.defaultTimezone, APP_CONFIG.defaults.defaultTimezone);
}

function getDailySendHour() {
  return Number(getConfigValue(APP_CONFIG.properties.dailySendHour, APP_CONFIG.defaults.dailySendHour));
}

function getConfigFromSheet_(key) {
  var sheet = findSheetByConfig_(APP_CONFIG.sheets.config);
  if (!sheet) {
    return '';
  }

  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i += 1) {
    if (String(values[i][0]).trim() === key) {
      return String(values[i][1] || '').trim();
    }
  }

  return '';
}
