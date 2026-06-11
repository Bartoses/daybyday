var KNOWLEDGE_CACHE_ = null;

var KNOWLEDGE_STAGE_PROFILES = [
  {
    id: 'newborn',
    min_days: 0,
    max_days: 59,
    label: 'newborn',
    reassurance: 'Short, repetitive routines are enough right now. Responsive care is the work.',
    topics: {
      'sleep': {
        summary: 'sleep is irregular and tightly connected to feeding, contact, and regulation',
        tips: [
          'Keep nights dim, quiet, and simple so day and night begin to separate.',
          'Watch for early sleepy cues like staring away, yawning, or zoning out.',
          'Aim for a calm reset with holding, swaddling if appropriate, and steady motion.'
        ]
      },
      'feeding': {
        summary: 'feeding is frequent and works best when parents follow cues instead of the clock alone',
        tips: [
          'Look for rooting, hand-to-mouth movements, and stirring before crying builds.',
          'Use skin-to-skin contact to support feeding, regulation, and connection.',
          'Track wet diapers and steady feeding patterns more than one difficult feeding.'
        ]
      },
      'motor development': {
        summary: 'movement is mostly reflexive, but daily handling already shapes body awareness',
        tips: [
          'Offer short supervised tummy time when your baby is awake and calm.',
          'Alternate holding positions so your baby experiences different head and body movement.',
          'Give your baby room to stretch on a flat safe surface each day.'
        ]
      },
      'language': {
        summary: 'communication begins through crying, eye contact, and recognition of familiar voices',
        tips: [
          'Narrate simple routines like diaper changes and feeding in a calm voice.',
          'Pause after you speak so your baby can take in your voice and rhythm.',
          'Use face-to-face time to let your baby study your expression and mouth movements.'
        ]
      },
      'behavior': {
        summary: 'behavior is mostly about signaling needs and finding help with regulation',
        tips: [
          'Treat fussiness as information first: hunger, fatigue, temperature, or overstimulation.',
          'Keep soothing routines short and repeatable so your baby learns what to expect.',
          'When one strategy fails, reset with a simpler one instead of adding more stimulation.'
        ]
      },
      'learning': {
        summary: 'learning happens through repeated sensory experiences with trusted caregivers',
        tips: [
          'Repeat the same few songs, voices, and touch routines to build familiarity.',
          'Let your baby see household movement, light, and faces without overloading the moment.',
          'Use slow, predictable routines because repetition is real learning at this stage.'
        ]
      },
      'emotional development': {
        summary: 'emotional security grows through consistent comfort and body-level closeness',
        tips: [
          'Responding quickly helps your baby build trust, not dependency problems.',
          'Use your tone of voice as a calming tool during transitions.',
          'Contact, warmth, and rhythm are emotional support for newborns.'
        ]
      },
      'safety': {
        summary: 'safety centers on sleep position, safe surfaces, hygiene, and close supervision',
        tips: [
          'Use a flat sleep surface with no loose blankets, pillows, or positioners.',
          'Check car seat fit and buckle placement every time, even on short drives.',
          'Keep hot drinks, cords, and pets managed during feeding and holding.'
        ]
      }
    }
  },
  {
    id: 'infant',
    min_days: 60,
    max_days: 365,
    label: 'baby',
    reassurance: 'Progress is uneven in the first year. Patterns over time matter more than one hard day.',
    topics: {
      'sleep': {
        summary: 'sleep is still developing, but predictable routines and wake timing start to matter more',
        tips: [
          'Use a short wind-down routine before naps and bedtime so sleep cues become familiar.',
          'Protect the first nap of the day when possible because it often anchors the rest.',
          'If nights are rough, adjust daytime overstimulation before assuming bedtime is the problem.'
        ]
      },
      'feeding': {
        summary: 'feeding shifts from pure milk intake toward new textures, pacing, and curiosity',
        tips: [
          'Let your baby explore new foods with hands, face, and pace rather than rushing bites.',
          'Keep offering familiar foods alongside new ones so learning feels safe.',
          'Watch appetite over the week instead of expecting the same intake every meal.'
        ]
      },
      'motor development': {
        summary: 'rolling, sitting, reaching, crawling, and cruising grow through floor time and repetition',
        tips: [
          'Give daily floor time where toys are just far enough away to invite movement.',
          'Rotate simple objects with different textures and sizes to support grasping.',
          'Let your baby practice transitions like rolling or sitting without always placing them.'
        ]
      },
      'language': {
        summary: 'babies learn language through back-and-forth sounds, gestures, and repeated words',
        tips: [
          'Label the same everyday objects often: bottle, sock, dog, light.',
          'Imitate your baby’s sounds and wait for a response to build conversation rhythm.',
          'Pair words with gestures like waving, pointing, or reaching.'
        ]
      },
      'behavior': {
        summary: 'behavior becomes more intentional as babies test attention, transitions, and frustration tolerance',
        tips: [
          'Before a meltdown, try reducing noise, moving rooms, or offering a simpler task.',
          'Use the same calm phrase during transitions so your baby learns the pattern.',
          'When frustration builds, support the effort first before stepping in quickly.'
        ]
      },
      'learning': {
        summary: 'babies learn cause and effect by dropping, banging, mouthing, and repeating',
        tips: [
          'Offer one or two objects at a time so your baby can focus longer.',
          'Repeat simple games like peekaboo because repetition builds memory and prediction.',
          'Narrate what just happened: you dropped it, it fell, now I picked it up.'
        ]
      },
      'emotional development': {
        summary: 'secure attachment deepens as babies use caregivers to reset after excitement or stress',
        tips: [
          'Reconnect after brief separations with eye contact, voice, and touch.',
          'Name simple feelings in the moment: surprised, frustrated, calm, sleepy.',
          'Use your calm body and voice first when your baby is dysregulated.'
        ]
      },
      'safety': {
        summary: 'safety needs expand quickly as mobility, mouthing, and climbing increase',
        tips: [
          'Get low to scan for choking hazards because mobility changes risk fast.',
          'Anchor furniture before your baby can reliably pull to stand.',
          'Review safe feeding positions and food sizes as texture skills change.'
        ]
      }
    }
  },
  {
    id: 'toddler',
    min_days: 366,
    max_days: 1095,
    label: 'toddler',
    reassurance: 'Toddlers learn through repetition, protest, and repair. Consistency beats perfect responses.',
    topics: {
      'sleep': {
        summary: 'sleep depends more on routine, transitions, and how stimulation is handled before rest',
        tips: [
          'Use a consistent order at bedtime so your toddler can predict the next step.',
          'Give one small choice in the routine to support cooperation without losing structure.',
          'If bedtime battles spike, simplify the last 30 minutes instead of adding more negotiation.'
        ]
      },
      'feeding': {
        summary: 'feeding becomes more about autonomy, appetite swings, and repeated exposure than volume',
        tips: [
          'Serve a safe familiar food with new foods so pressure stays low.',
          'Let your toddler decide whether to eat from what is offered.',
          'Keep portions small at first because large servings can invite pushback.'
        ]
      },
      'motor development': {
        summary: 'toddlers build balance, climbing, running, and hand control through active practice',
        tips: [
          'Offer chances to climb, carry, squat, and push in safe spaces each day.',
          'Use chunky crayons, cups, and spoons so hand skills build during regular routines.',
          'Let your toddler practice stairs with close supervision instead of always being carried.'
        ]
      },
      'language': {
        summary: 'language grows quickly when toddlers hear labels, choices, and short responsive phrases',
        tips: [
          'Expand one-word speech into two or three words without pressuring imitation.',
          'Name what your toddler notices during play instead of quizzing for labels.',
          'Offer simple choices out loud: apple or banana, book or blocks.'
        ]
      },
      'behavior': {
        summary: 'behavior is shaped by big feelings, low impulse control, and a strong drive for independence',
        tips: [
          'Set limits with short phrases and repeat them calmly instead of explaining too much.',
          'Notice and name the feeling first before redirecting the behavior.',
          'Use transitions warnings early because sudden stops often trigger protest.'
        ]
      },
      'learning': {
        summary: 'toddlers learn by copying adults, repeating actions, and testing what happens next',
        tips: [
          'Invite participation in real tasks like wiping, sorting, or carrying.',
          'Use simple routines with the same sequence so memory and confidence grow together.',
          'Follow your toddler’s curiosity for a few extra minutes before moving on.'
        ]
      },
      'emotional development': {
        summary: 'emotional growth depends on co-regulation, naming feelings, and practicing recovery after upset',
        tips: [
          'Model calm breathing or slow movement instead of expecting self-control too early.',
          'Repair after conflict with brief warmth and clarity once everyone is calmer.',
          'Build in connection before hard transitions because cooperation rises with closeness.'
        ]
      },
      'safety': {
        summary: 'safety needs now include climbing, water, doors, streets, and quick access to hazards',
        tips: [
          'Treat water like an active supervision task every single time, even for a minute.',
          'Use locks, gates, and routines together because toddlers move faster than reminders.',
          'Practice hand-holding and stopping rules before you need them in busy spaces.'
        ]
      }
    }
  },
  {
    id: 'preschool',
    min_days: 1096,
    max_days: 1825,
    label: 'preschooler',
    reassurance: 'Preschool growth is messy and fast. Play, repetition, and warm structure carry a lot of the work.',
    topics: {
      'sleep': {
        summary: 'sleep quality is affected by routine consistency, imagination, and evening stimulation',
        tips: [
          'Keep bedtime predictable and short so stalling has less room to grow.',
          'If fears show up at night, comfort first and then return to the routine.',
          'Use daytime movement and outside time to support easier nighttime settling.'
        ]
      },
      'feeding': {
        summary: 'feeding is shaped by routine, social modeling, and a growing wish for control',
        tips: [
          'Invite your child to help wash, stir, or plate food to build ownership.',
          'Describe food without pressure: crunchy, warm, sweet, soft.',
          'Keep meal structure regular so hunger and expectations stay easier to read.'
        ]
      },
      'motor development': {
        summary: 'preschoolers refine jumping, pedaling, drawing, cutting, and coordinated play',
        tips: [
          'Use outdoor play that includes climbing, jumping, and balancing.',
          'Offer scissors, play dough, and drawing tools for hand strength and control.',
          'Break new physical skills into playful short tries instead of long correction.'
        ]
      },
      'language': {
        summary: 'language expands through storytelling, pretend play, and longer back-and-forth talk',
        tips: [
          'Ask open prompts like what happened next or how did that work.',
          'Use pretend play to model new vocabulary and social language.',
          'Retell parts of the day together to strengthen sequencing and memory.'
        ]
      },
      'behavior': {
        summary: 'behavior improves when expectations are concrete, visual, and practiced ahead of time',
        tips: [
          'State what to do, not only what to stop doing.',
          'Practice tricky routines like leaving the park before emotions are high.',
          'Use fewer words and more consistency when limits are already known.'
        ]
      },
      'learning': {
        summary: 'learning is powered by curiosity, pretend play, repetition, and simple problem solving',
        tips: [
          'Use everyday counting, sorting, and comparing during regular routines.',
          'Leave room for trial and error before jumping in with the answer.',
          'Rotate books and materials so interest stays fresh without needing a lot more stuff.'
        ]
      },
      'emotional development': {
        summary: 'emotional skills grow as children practice naming feelings, waiting, and repairing with support',
        tips: [
          'Use stories and play to talk about feelings when your child is calm.',
          'Praise recovery and problem solving, not only perfect behavior.',
          'Keep connection visible after correction so boundaries and safety stay linked.'
        ]
      },
      'safety': {
        summary: 'safety teaching can now include simple rules, body boundaries, and supervised independence',
        tips: [
          'Practice names, caregiver info, and safety rules in calm moments.',
          'Review body safety using clear correct words and simple rules.',
          'Stay consistent with helmets, buckles, and street routines every time.'
        ]
      }
    }
  },
  {
    id: 'school_age',
    min_days: 1826,
    max_days: 4015,
    label: 'school-age child',
    reassurance: 'Steady routines, felt safety, and interest in their world still matter more than perfect technique.',
    topics: {
      'sleep': {
        summary: 'sleep supports attention, mood, learning, and physical regulation throughout the school day',
        tips: [
          'Protect a consistent lights-out time even on busy weekdays.',
          'Move screens and high stimulation earlier so the brain has space to settle.',
          'Use a simple bedtime checklist to reduce repeated reminders.'
        ]
      },
      'feeding': {
        summary: 'feeding works best with routine meals, exposure to variety, and growing self-awareness of hunger',
        tips: [
          'Build snacks with protein or fiber so energy stays more steady.',
          'Keep involving your child in meal planning or prep at a realistic level.',
          'Talk about fueling the body rather than labeling foods as good or bad.'
        ]
      },
      'motor development': {
        summary: 'motor skills deepen through sports, playground play, handwriting, crafts, and daily movement',
        tips: [
          'Offer varied movement, not only one structured activity, to build broad coordination.',
          'Use hands-on activities like building, cutting, or cooking for fine motor practice.',
          'Watch for fatigue or frustration before assuming unwillingness.'
        ]
      },
      'language': {
        summary: 'language grows through conversation, reading, explanation, and social communication',
        tips: [
          'Ask your child to explain ideas, plans, or stories in their own words.',
          'Read together beyond early reading skills because discussion still builds language.',
          'Introduce richer words in context rather than drilling vocabulary lists.'
        ]
      },
      'behavior': {
        summary: 'behavior responds to clear expectations, predictable consequences, and strong connection',
        tips: [
          'Keep rules short and specific so your child knows what success looks like.',
          'When behavior slips, stay curious about overload, hunger, sleep, or stress.',
          'Use repair after consequences so correction does not become disconnection.'
        ]
      },
      'learning': {
        summary: 'learning improves when curiosity, practice, and manageable challenge are balanced',
        tips: [
          'Break bigger tasks into smaller starts to reduce avoidance.',
          'Praise strategy, persistence, and revision more than speed.',
          'Use real life questions and projects to connect learning to meaning.'
        ]
      },
      'emotional development': {
        summary: 'emotional growth includes perspective taking, self-talk, resilience, and belonging',
        tips: [
          'Make space for debriefing hard social moments without rushing to solve them.',
          'Help your child notice body signs of stress before emotions boil over.',
          'Model how to name a feeling and choose a next step.'
        ]
      },
      'safety': {
        summary: 'safety now includes peers, internet exposure, sports risk, and supervised independence',
        tips: [
          'Practice what to do if plans change or your child feels unsafe with someone.',
          'Review online habits in short regular conversations, not one big lecture.',
          'Keep helmets, seat belts, and sport safety habits fully non-negotiable.'
        ]
      }
    }
  },
  {
    id: 'preteen',
    min_days: 4016,
    max_days: 4745,
    label: 'preteen',
    reassurance: 'Independence grows best when connection and expectations keep pace with it.',
    topics: {
      'sleep': {
        summary: 'sleep needs remain high even as schedules, activities, and devices compete for rest',
        tips: [
          'Protect a tech cutoff before bed so the brain has a real transition to sleep.',
          'Use school mornings as a check on whether bedtime is late for your child right now.',
          'Keep evenings predictable on school nights even if weekends stay looser.'
        ]
      },
      'feeding': {
        summary: 'feeding is influenced by appetite shifts, activity, peers, and growing body awareness',
        tips: [
          'Keep regular meals available so after-school hunger does not turn into chaos.',
          'Invite conversation about body changes without making weight the focus.',
          'Teach simple self-serving and snack-building skills for growing independence.'
        ]
      },
      'motor development': {
        summary: 'motor growth involves coordination changes, endurance, and body awareness during puberty shifts',
        tips: [
          'Expect temporary awkwardness when growth changes speed and balance.',
          'Support recovery, hydration, and sleep if sports or activities intensify.',
          'Encourage movement your child enjoys, not only performance-focused exercise.'
        ]
      },
      'language': {
        summary: 'language becomes more complex through discussion, humor, nuance, and perspective taking',
        tips: [
          'Use car rides or parallel activities for conversation when face-to-face talk feels harder.',
          'Ask what they think before offering your take.',
          'Treat jokes, storytelling, and strong opinions as chances to build communication.'
        ]
      },
      'behavior': {
        summary: 'behavior is shaped by social awareness, sensitivity to fairness, and a stronger push for autonomy',
        tips: [
          'Explain the reason behind limits when possible, then hold the limit clearly.',
          'Use collaborative problem solving on recurring friction points.',
          'Separate normal pushback from truly unsafe behavior so every conflict is not treated the same.'
        ]
      },
      'learning': {
        summary: 'learning benefits from planning support, practice systems, and room to build ownership',
        tips: [
          'Help your child create a plan, then let them carry as much of it as they can.',
          'Use check-ins that focus on process and obstacles, not only grades.',
          'Teach task-starting routines because initiation is often the real hurdle.'
        ]
      },
      'emotional development': {
        summary: 'emotional development includes identity questions, peer influence, and stronger private inner life',
        tips: [
          'Keep curiosity open when moods shift rather than demanding instant explanation.',
          'Normalize mixed feelings during change, disappointment, and friendship stress.',
          'Make repair possible after conflict so your child keeps coming back to you.'
        ]
      },
      'safety': {
        summary: 'safety includes online behavior, peer pressure, transport habits, and growing unsupervised time',
        tips: [
          'Discuss what to do when peers push for secrecy or risk.',
          'Review location, check-in, and ride plans before independence moments happen.',
          'Talk about body boundaries and consent as everyday safety, not a one-time talk.'
        ]
      }
    }
  },
  {
    id: 'teen',
    min_days: 4746,
    max_days: 6570,
    label: 'teen',
    reassurance: 'Teens still need adults who stay calm, present, and interested even when they look less receptive.',
    topics: {
      'sleep': {
        summary: 'sleep strongly affects mood, regulation, learning, and safety during adolescence',
        tips: [
          'Help your teen notice the difference between tired coping and real functioning.',
          'Keep late-night device use and charging locations part of the household plan.',
          'When schedules overload sleep, reduce commitments before only pushing harder.'
        ]
      },
      'feeding': {
        summary: 'feeding supports growth, mood, sports, concentration, and body trust during adolescence',
        tips: [
          'Make filling options easy to grab so hunger does not get delayed all day.',
          'Talk about strength, energy, and recovery rather than appearance-based food rules.',
          'Use shared meals for connection even when timing is imperfect.'
        ]
      },
      'motor development': {
        summary: 'motor and physical development now connect to training load, recovery, confidence, and changing bodies',
        tips: [
          'Watch for overtraining, pain, or burnout when demands spike.',
          'Support regular movement even if your teen is not in organized sports.',
          'Treat body coordination changes during growth as normal, not failure.'
        ]
      },
      'language': {
        summary: 'language development shows up in reasoning, negotiation, identity, and deeper conversation',
        tips: [
          'Invite discussion about values, plans, and tradeoffs instead of only instructions.',
          'Choose timing carefully; harder conversations often land better side by side than face to face.',
          'Model how to disagree without disrespect so your teen can practice it too.'
        ]
      },
      'behavior': {
        summary: 'behavior is influenced by peers, sleep, stress, risk taking, and the drive for more control',
        tips: [
          'Hold firm boundaries around safety while leaving room for voice and problem solving.',
          'Look for the need under the behavior when conflict repeats.',
          'Use fewer power struggles and more clear expectations with follow-through.'
        ]
      },
      'learning': {
        summary: 'learning now depends on executive skills, motivation, stress load, and ownership of work',
        tips: [
          'Support planning systems that your teen will actually use, not idealized ones.',
          'Talk about next steps and habits more than one grade or one missed assignment.',
          'When motivation drops, shrink the first step until it feels possible.'
        ]
      },
      'emotional development': {
        summary: 'emotional growth includes identity formation, self-respect, relationships, and coping under stress',
        tips: [
          'Keep a non-panicked tone so your teen can bring you bigger things over time.',
          'Name concern directly while staying relational instead of purely punitive.',
          'Make it normal to talk about stress, rejection, and disappointment.'
        ]
      },
      'safety': {
        summary: 'safety includes driving, substances, relationships, mental health, online risk, and late independence',
        tips: [
          'Revisit driving, riding, and emergency plans regularly as real situations change.',
          'Talk clearly about substances and peer pressure before events, not only after problems.',
          'Treat mental health and digital safety as core safety topics, not side topics.'
        ]
      }
    }
  },
  {
    id: 'young_adult',
    min_days: 6571,
    max_days: 7665,
    label: 'young adult',
    reassurance: 'Connection still matters in early adulthood. Guidance works best when it respects autonomy.',
    topics: {
      'sleep': {
        summary: 'sleep affects judgment, energy, mood, work, and school performance in early adult life',
        tips: [
          'Encourage realistic sleep habits that fit the actual schedule instead of ideal ones only.',
          'Talk about sleep as maintenance for mood and decision making, not a luxury.',
          'Support routines that protect rest during busy or transitional periods.'
        ]
      },
      'feeding': {
        summary: 'feeding habits become part of self-management, energy, and long-term health',
        tips: [
          'Focus on regular meals and basic prep habits before aiming for perfect nutrition.',
          'Encourage simple go-to meals that support independence on busy days.',
          'Use conversations about food to build self-care, not control.'
        ]
      },
      'motor development': {
        summary: 'physical development shifts toward conditioning, injury prevention, and sustainable movement habits',
        tips: [
          'Support movement that is realistic and repeatable, not all-or-nothing.',
          'Encourage recovery, stretching, or strengthening when responsibilities increase.',
          'Treat physical confidence as something built through consistency, not comparison.'
        ]
      },
      'language': {
        summary: 'communication now supports relationships, self-advocacy, work, and independent decision making',
        tips: [
          'Practice clear planning and follow-up language for school, work, and appointments.',
          'Model respectful disagreement and self-advocacy in everyday situations.',
          'Encourage reflection conversations that help your child hear their own thinking.'
        ]
      },
      'behavior': {
        summary: 'behavior is increasingly shaped by habits, boundaries, responsibility, and social environment',
        tips: [
          'Offer guidance with respect for choice so support does not become control.',
          'Focus on consequences, planning, and values when talking through decisions.',
          'Keep expectations explicit when money, transport, or living arrangements overlap.'
        ]
      },
      'learning': {
        summary: 'learning involves applied problem solving, follow-through, and making sense of longer-term goals',
        tips: [
          'Help break big transitions into next practical steps rather than abstract pressure.',
          'Reflect on what systems actually help your child stay organized.',
          'Encourage learning from setbacks without turning them into identity statements.'
        ]
      },
      'emotional development': {
        summary: 'emotional development includes identity, resilience, relationships, and stress management in new roles',
        tips: [
          'Stay available for perspective without requiring immediate agreement.',
          'Normalize stress during transitions while still supporting recovery habits.',
          'Keep conversations rooted in respect, care, and long-term trust.'
        ]
      },
      'safety': {
        summary: 'safety now includes transport choices, substances, relationships, work settings, and mental health support',
        tips: [
          'Keep talking about emergency plans, transport, and check-ins without making it infantilizing.',
          'Treat consent, boundaries, and digital privacy as ongoing safety topics.',
          'Encourage help-seeking early when stress, isolation, or risk begin to build.'
        ]
      }
    }
  }
];

function generateKnowledgeDataset() {
  setupDayByDay();

  var sheet = getSheetByKey('knowledge');
  var headers = APP_CONFIG.headers.knowledge;
  var rows = [headers];
  var maxDays = APP_CONFIG.knowledge.maxAgeDays;
  var bucketSize = APP_CONFIG.knowledge.bucketSizeDays;
  var topics = APP_CONFIG.knowledge.topics;
  var variants = APP_CONFIG.knowledge.tipVariantsPerTopic;

  for (var ageMin = 0; ageMin <= maxDays; ageMin += bucketSize) {
    var ageMax = Math.min(ageMin + bucketSize - 1, maxDays);
    var bucketMidpoint = ageMin + Math.floor((ageMax - ageMin) / 2);
    var stage = getGuidanceStageForAgeDays(bucketMidpoint);

    for (var topicIndex = 0; topicIndex < topics.length; topicIndex += 1) {
      var topic = topics[topicIndex];
      for (var variantIndex = 0; variantIndex < variants; variantIndex += 1) {
        var row = buildKnowledgeDatasetRow_(stage, topic, ageMin, ageMax, variantIndex);
        rows.push([
          row.age_min_days,
          row.age_max_days,
          row.topic,
          row.summary,
          row.tip,
          row.reassurance,
          row.parent_question,
          row.tip_id
        ]);
      }
    }
  }

  sheet.clearContents();
  sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
  formatHeaderRow_(sheet);
  logInfo('Generated knowledge dataset', { row_count: rows.length - 1 });

  KNOWLEDGE_CACHE_ = null;
  return {
    ok: true,
    row_count: rows.length - 1,
    bucket_size_days: bucketSize,
    max_age_days: maxDays,
    tip_variants_per_topic: variants
  };
}

function getGuidanceStageForAgeDays(ageDays) {
  for (var i = 0; i < KNOWLEDGE_STAGE_PROFILES.length; i += 1) {
    var stage = KNOWLEDGE_STAGE_PROFILES[i];
    if (ageDays >= stage.min_days && ageDays <= stage.max_days) {
      return stage;
    }
  }
  return KNOWLEDGE_STAGE_PROFILES[KNOWLEDGE_STAGE_PROFILES.length - 1];
}

function buildKnowledgeDatasetRow_(stage, topic, ageMin, ageMax, variantIndex) {
  var topicProfile = stage.topics[topic];
  var tip = topicProfile.tips[variantIndex % topicProfile.tips.length];

  return {
    age_min_days: ageMin,
    age_max_days: ageMax,
    topic: topic,
    summary: capitalizeTopic_(topic) + ': At this stage, ' + topicProfile.summary + '.',
    tip: tip,
    reassurance: stage.reassurance,
    parent_question: buildParentQuestion_(topic, stage),
    tip_id: buildTipId_(stage.id, topic, ageMin, variantIndex)
  };
}

function buildParentQuestion_(topic, stage) {
  return 'What is one small way to support ' + topic + ' for my ' + stage.label + ' today?';
}

function buildTipId_(stageId, topic, ageMin, variantIndex) {
  return [
    'tip',
    stageId,
    topic.replace(/[^\w]+/g, '_'),
    ageMin,
    variantIndex + 1
  ].join('_');
}

function capitalizeTopic_(topic) {
  return String(topic || '').charAt(0).toUpperCase() + String(topic || '').slice(1);
}

function loadKnowledgeRows() {
  if (!KNOWLEDGE_CACHE_) {
    KNOWLEDGE_CACHE_ = getKnowledgeRows();
  }
  return KNOWLEDGE_CACHE_;
}

function getKnowledgeRowsForAge(ageDays) {
  var rows = loadKnowledgeRows();
  var matches = [];

  for (var i = 0; i < rows.length; i += 1) {
    var row = rows[i];
    if (!parseBoolean(row.active, true)) {
      continue;
    }
    if (ageDays >= Number(row.child_age_days_min || row.age_min_days) && ageDays <= Number(row.child_age_days_max || row.age_max_days)) {
      matches.push(row);
    }
  }

  return matches;
}

function getKnowledgeRowsForAgeAndTopic(ageDays, topic) {
  var rows = getKnowledgeRowsForAge(ageDays);
  if (!topic) {
    return rows;
  }

  var matches = [];
  for (var i = 0; i < rows.length; i += 1) {
    if (String(rows[i].topic) === String(topic)) {
      matches.push(rows[i]);
    }
  }
  return matches;
}

function getUnusedTips(kidId, knowledgeRows, sentTipIds) {
  var used = {};
  for (var i = 0; i < sentTipIds.length; i += 1) {
    used[String(sentTipIds[i])] = true;
  }

  var unused = [];
  for (var j = 0; j < knowledgeRows.length; j += 1) {
    if (!used[String(knowledgeRows[j].tip_id)]) {
      unused.push(knowledgeRows[j]);
    }
  }
  return unused;
}

function chooseKnowledgeRowForKid(kid, date, options) {
  options = options || {};
  var referenceDate = date ? coerceDate(date) : new Date();
  var timezone = options.timezone || getDefaultTimezone();
  var ageBreakdown = getAgeBreakdown(kid.date_of_birth, timezone);
  var exactAgeDays = ageBreakdown.total_days;
  var ageDisplay = formatChildAge(exactAgeDays);
  var leapContext = getLeapContextForKid(kid, referenceDate, timezone);
  var selectedTopic = canonicalizeTopic_(options.topic || chooseTopicForKid_(kid.kid_id, referenceDate, getKnowledgeRowsForAge(exactAgeDays)));
  var chosen = chooseNormalizedKnowledgeRow_(kid, exactAgeDays, selectedTopic, referenceDate, {
    timezone: timezone,
    lookbackDays: options.lookbackDays,
    leapContext: leapContext
  });

  if (!chosen) {
    chosen = getKnowledgeFallbackRow_(exactAgeDays, selectedTopic);
  }

  return {
    kid_id: kid.kid_id,
    kid_name: kid.kid_name,
    age_days: exactAgeDays,
    age_display: ageDisplay,
    exact_age_display: formatExactAndReadableAge(exactAgeDays),
    stage: chosen.child_age_stage || chosen.stage || getStageForAgeDays(exactAgeDays),
    topic: chosen.category || chosen.topic,
    category: chosen.category || chosen.topic,
    insight: chosen.insight || chosen.summary,
    action: chosen.action || chosen.tip,
    encouragement: chosen.encouragement || chosen.reassurance,
    checkin_question: chosen.checkin_question || '',
    reply_options: chosen.reply_options || '',
    milestone_key: chosen.milestone_key || '',
    summary: chosen.summary,
    tip: chosen.tip,
    reassurance: chosen.reassurance,
    parent_question: chosen.parent_question,
    tip_id: chosen.tip_id,
    leap_context: leapContext,
    leap_line: buildLeapSupportLine(leapContext),
    knowledge_row: chosen,
    personalized_message: generatePersonalizedGuidanceMessage(kid, chosen, {
      age_days: exactAgeDays,
      age_display: ageDisplay,
      topic: chosen.category || chosen.topic
    })
  };
}

function chooseTopicForKid_(kidId, referenceDate, ageRows) {
  var topics = getDistinctTopics_(ageRows);
  if (!topics.length) {
    topics = APP_CONFIG.knowledge.rotatingCategories.slice();
  }
  var recentCategories = getRecentCategoriesForKid(kidId, topics.length);
  for (var i = 0; i < recentCategories.length; i += 1) {
    var idx = topics.indexOf(canonicalizeTopic_(recentCategories[i]));
    if (idx !== -1) {
      topics.splice(idx, 1);
      topics.push(canonicalizeTopic_(recentCategories[i]));
    }
  }
  var dateKey = formatLocalDate(referenceDate, getDefaultTimezone());
  var index = Math.abs(hashString_(String(kidId) + ':' + dateKey)) % topics.length;
  return topics[index];
}

function filterRowsByTopic_(rows, topic) {
  var aliases = getRequestedTopicAliases_(topic);
  var matches = [];
  for (var i = 0; i < rows.length; i += 1) {
    if (aliases.indexOf(canonicalizeTopic_(rows[i].category || rows[i].topic)) !== -1) {
      matches.push(rows[i]);
    }
  }
  return matches;
}

function getRequestedTopicAliases_(topic) {
  var normalized = canonicalizeTopic_(topic);
  if (normalized === 'behavior') {
    return ['behavior', 'emotional development'];
  }
  if (normalized === 'learning/play') {
    return ['learning/play'];
  }
  if (normalized === 'sleep') {
    return ['sleep'];
  }
  if (normalized === 'feeding') {
    return ['feeding'];
  }
  if (normalized === 'safety') {
    return ['safety'];
  }
  return [normalized];
}

function chooseDeterministicRow_(rows, kidId, referenceDate) {
  var sorted = rows.slice().sort(function(a, b) {
    return String(a.tip_id).localeCompare(String(b.tip_id));
  });
  var seed = String(kidId) + ':' + formatLocalDate(referenceDate, getDefaultTimezone()) + ':' + sorted.length;
  var index = Math.abs(hashString_(seed)) % sorted.length;
  return sorted[index];
}

function getDistinctTopics_(rows) {
  var map = {};
  var topics = [];
  for (var i = 0; i < rows.length; i += 1) {
    var topic = String(rows[i].category || rows[i].topic || '');
    if (topic && !map[topic]) {
      map[topic] = true;
      topics.push(topic);
    }
  }
  return topics;
}

function getKnowledgeFallbackRow_(ageDays, topic) {
  return {
    child_age_days_min: ageDays,
    child_age_days_max: ageDays,
    age_min_days: ageDays,
    age_max_days: ageDays,
    child_age_stage: getStageForAgeDays(ageDays),
    stage: getStageForAgeDays(ageDays),
    category: topic || 'development',
    topic: topic || 'development',
    message_type: 'daily',
    insight: getStageForAgeDays(ageDays) + 's this age often do best with simple routines, connection, and chances to practice new skills in short bursts.',
    action: 'Keep one interaction today simple, responsive, and easy to repeat.',
    encouragement: 'Small daily moments add up over time.',
    parent_reassurance: 'Small daily moments add up over time.',
    checkin_question: '',
    reply_options: '',
    milestone_key: '',
    summary: getStageForAgeDays(ageDays) + 's this age often do best with simple routines, connection, and chances to practice new skills in short bursts.',
    tip: 'Keep one interaction today simple, responsive, and easy to repeat.',
    reassurance: 'Small daily moments add up over time.',
    parent_question: '',
    tip_id: 'fallback_' + (topic || 'development') + '_' + ageDays,
    priority_weight: 0,
    cooldown_days: APP_CONFIG.knowledge.defaultCooldownDays,
    rotation_group: topic || 'development',
    active: true
  };
}

function chooseNormalizedKnowledgeRow_(kid, ageDays, preferredTopic, referenceDate, options) {
  options = options || {};
  var allRows = loadKnowledgeRows().filter(function(row) {
    return parseBoolean(row.active, true);
  });
  var history = getRecentMessageHistoryForKid(kid.kid_id, options.lookbackDays || 90, referenceDate);
  var exactRows = getKnowledgeRowsForAge(ageDays);
  var fallbackRows = getKnowledgeRowsNearAge_(ageDays, APP_CONFIG.knowledge.nearbyAgeWindowDays);
  var stages = [getStageForAgeDays(ageDays)];
  var leapContext = options.leapContext || null;
  // Fallback order intentionally mirrors product behavior: exact age and target category first,
  // then broader exact-age coverage, then nearby-age matches if the age bucket is sparse.
  var pools = [
    scoreKnowledgePool_(filterRowsByTopic_(exactRows, preferredTopic), ageDays, preferredTopic, history, stages, leapContext),
    scoreKnowledgePool_(exactRows, ageDays, preferredTopic, history, stages, leapContext),
    scoreKnowledgePool_(filterRowsByTopic_(fallbackRows, preferredTopic), ageDays, preferredTopic, history, stages, leapContext),
    scoreKnowledgePool_(fallbackRows, ageDays, preferredTopic, history, stages, leapContext)
  ];

  for (var i = 0; i < pools.length; i += 1) {
    if (pools[i].length) {
      return pools[i][0].row;
    }
  }

  return null;
}

function getKnowledgeRowsNearAge_(ageDays, windowDays) {
  var rows = loadKnowledgeRows();
  var matches = [];
  var minAge = Math.max(ageDays - windowDays, 0);
  var maxAge = ageDays + windowDays;
  for (var i = 0; i < rows.length; i += 1) {
    var row = rows[i];
    if (!parseBoolean(row.active, true)) {
      continue;
    }
    if (Number(row.child_age_days_max || row.age_max_days) < minAge || Number(row.child_age_days_min || row.age_min_days) > maxAge) {
      continue;
    }
    matches.push(row);
  }
  return matches;
}

function scoreKnowledgePool_(rows, ageDays, preferredTopic, history, preferredStages, leapContext) {
  var scored = [];
  for (var i = 0; i < rows.length; i += 1) {
    var score = scoreKnowledgeRow_(rows[i], ageDays, preferredTopic, history, preferredStages, leapContext);
    if (score !== null) {
      scored.push({
        row: rows[i],
        score: score
      });
    }
  }

  scored.sort(function(a, b) {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return String(a.row.tip_id).localeCompare(String(b.row.tip_id));
  });

  return scored;
}

function scoreKnowledgeRow_(row, ageDays, preferredTopic, history, preferredStages, leapContext) {
  var i;
  var score = Number(row.priority_weight || 1) * 10;
  var category = canonicalizeTopic_(row.category || row.topic);
  var rotationGroup = cleanText(row.rotation_group || category);
  var targetStage = cleanText(row.child_age_stage || row.stage);
  var lastSentAt = null;

  for (i = 0; i < history.length; i += 1) {
    if (String(history[i].tip_id) === String(row.tip_id)) {
      lastSentAt = history[i].sent_at || history[i].date_sent;
      break;
    }
  }

  if (lastSentAt) {
    var daysSince = Math.floor((new Date().getTime() - coerceDate(lastSentAt).getTime()) / (24 * 60 * 60 * 1000));
    if (daysSince < Number(row.cooldown_days || APP_CONFIG.knowledge.defaultCooldownDays)) {
      return null;
    }
    score -= 25;
  } else {
    score += APP_CONFIG.knowledge.noveltyWeight;
  }

  if (getRequestedTopicAliases_(preferredTopic).indexOf(String(category)) !== -1) {
    score += 18;
  }
  if (preferredStages.indexOf(targetStage) !== -1) {
    score += APP_CONFIG.knowledge.stageBoostWeight;
  }

  var ageMidpoint = (Number(row.child_age_days_min || row.age_min_days) + Number(row.child_age_days_max || row.age_max_days)) / 2;
  score -= Math.min(Math.abs(ageDays - ageMidpoint), 40);

  for (i = 0; i < history.length; i += 1) {
    if (canonicalizeTopic_(history[i].topic) === category) {
      score -= APP_CONFIG.knowledge.categoryRotationPenalty / (i + 1);
    }
    if (cleanText(history[i].rotation_group) === rotationGroup) {
      score -= APP_CONFIG.knowledge.rotationGroupPenalty / (i + 1);
    }
  }

  if (leapContext && leapContext.in_leap_window) {
    if (category === 'sleep' || category === 'emotional development' || category === 'behavior') {
      score += APP_CONFIG.knowledge.leapBoostWeight;
    }
  }

  score -= Number(APP_CONFIG.knowledge.difficultyPenalty[String(row.difficulty_level || 'easy').toLowerCase()] || 0);
  return score;
}

function generatePersonalizedGuidanceMessage(kid, knowledgeRow, context) {
  var fallback = buildFallbackGuidanceMessage_(kid, knowledgeRow, context || {});

  try {
    if (typeof generateAiPersonalizedMessage === 'function') {
      return cleanPersonalizedOutput_(generateAiPersonalizedMessage({
        kid_name: kid.kid_name,
        age_days: context.age_days,
        age_display: context.age_display,
        topic: knowledgeRow.topic,
        summary: knowledgeRow.summary,
        tip: knowledgeRow.tip,
        reassurance: knowledgeRow.reassurance,
        parent_question: knowledgeRow.parent_question
      }), fallback);
    }

    if (typeof generateAiDailyGuidance === 'function') {
      return cleanPersonalizedOutput_(generateAiDailyGuidance({
        kid_name: kid.kid_name,
        age_days: context.age_days,
        age_display: context.age_display,
        topic: knowledgeRow.topic,
        summary: knowledgeRow.summary,
        tip: knowledgeRow.tip,
        reassurance: knowledgeRow.reassurance,
        parent_question: knowledgeRow.parent_question
      }), fallback);
    }
  } catch (error) {
    logError('AI personalization failed', error, { kid_id: kid.kid_id, tip_id: knowledgeRow.tip_id });
  }

  return fallback;
}

function buildFallbackGuidanceMessage_(kid, knowledgeRow, context) {
  return 'Today with ' + kid.kid_name + ': ' + (knowledgeRow.action || knowledgeRow.tip);
}

function cleanPersonalizedOutput_(value, fallback) {
  var text = cleanText(value);
  if (!text) {
    return fallback;
  }
  if (text.length > 220) {
    var shortened = text.slice(0, 220);
    var lastSentence = Math.max(shortened.lastIndexOf('. '), shortened.lastIndexOf('! '), shortened.lastIndexOf('? '));
    if (lastSentence >= 120) {
      return shortened.slice(0, lastSentence + 1).trim();
    }
    var lastWord = shortened.lastIndexOf(' ');
    if (lastWord >= 120) {
      return shortened.slice(0, lastWord).replace(/[,:;\-]+$/, '').trim() + '.';
    }
    return fallback;
  }
  return text;
}

function hashString_(value) {
  var hash = 0;
  for (var i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function testGenerateKnowledgeDataset() {
  return generateKnowledgeDataset();
}

function testSimulateGuidanceForKid(kidId) {
  var kid = kidId ? getKidById(kidId) : null;
  if (!kid) {
    var kids = getRows('kids');
    if (!kids.length) {
      throw new Error('No kids found to test');
    }
    kid = kids[0];
  }

  var parent = getParentById(kid.parent_id);
  var guide = chooseKnowledgeRowForKid(kid, new Date(), {
    timezone: parent ? getTimezoneForParent(parent) : getDefaultTimezone()
  });

  logInfo('Simulated guidance for kid', guide);
  return guide;
}

function testSimulateGuidanceForFamily(parentId) {
  var parent = parentId ? getParentById(parentId) : null;
  if (!parent) {
    var parents = getRows('parents');
    if (!parents.length) {
      throw new Error('No parents found to test');
    }
    parent = parents[0];
  }

  var kids = getKidsByParentId(parent.parent_id, false);
  if (!kids.length) {
    throw new Error('No active kids found for parent: ' + parent.parent_id);
  }

  var guides = [];
  for (var i = 0; i < kids.length; i += 1) {
    guides.push(chooseKnowledgeRowForKid(kids[i], new Date(), {
      timezone: getTimezoneForParent(parent)
    }));
  }

  var preview = buildCombinedDailyMessage(parent, kids, new Date());
  return {
    parent_id: parent.parent_id,
    guides: guides,
    preview_message: preview
  };
}
