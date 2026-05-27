create table if not exists story_types (
  id                    text primary key,
  name                  text not null,
  description           text not null,
  system_prompt_suffix  text not null,
  structure_template    text not null,
  page_guidance         jsonb not null default '{}',
  occasion_required     boolean not null default false,
  extra_input_label     text,
  extra_input_hint      text,
  sort_order            integer not null default 0,
  is_active             boolean not null default true
);

-- 1. Bedtime
insert into story_types (id, name, description, system_prompt_suffix, structure_template, page_guidance, occasion_required, extra_input_label, extra_input_hint, sort_order, is_active)
values (
  'bedtime',
  'Bedtime Story',
  'A calming story that winds down gently, perfect for drifting off to sleep.',
  $$This is a bedtime story. Write with a slow, soothing, rhythmic pace. Use soft sensory language — warm, cozy, gentle, quiet. Energy should decrease gradually across the pages. Avoid excitement spikes, cliffhangers, or anything stimulating in the second half of the story. Sentences should feel like a lullaby — unhurried and peaceful.$$,
  $$The story opens by gently establishing the setting and introducing the child character in a calm, comfortable moment. An easy, low-stakes adventure or discovery begins — something curious and warm rather than exciting or urgent. As the story progresses, the pace slows. The world around the character becomes quieter, softer. By the final pages, the character is winding down naturally — yawning, feeling cozy, ready to rest. The story ends with the character peacefully asleep or settling in for sleep.$$,
  $${"first": "Establish a warm, cozy setting. Introduce the child character in a calm, comfortable moment. Set a gentle, unhurried tone from the first sentence.", "middle": "A soft, low-stakes discovery or gentle adventure. Keep energy mild. Introduce wonder and warmth but nothing that raises the heart rate. Each page should feel slightly quieter than the last.", "last": "The character is sleepy and content. Use sensory wind-down language — heavy eyelids, soft pillows, warm blankets, quiet sounds. End with the character asleep or just on the edge of sleep. Leave the reader feeling peaceful."}$$,
  false,
  null,
  null,
  1,
  true
);

-- 2. Fairytale
insert into story_types (id, name, description, system_prompt_suffix, structure_template, page_guidance, occasion_required, extra_input_label, extra_input_hint, sort_order, is_active)
values (
  'fairytale',
  'Fairytale',
  'A classic magical tale with a hero, a challenge, and a triumphant ending.',
  $$This is a fairytale. Write with a timeless, slightly formal tone — the feeling of "once upon a time." Use wonder, magic, and vivid imagery. The story should feel like it has always existed. Include fantastical or magical elements naturally woven into the world. There should be a clear moral or lesson that emerges organically from the story — never stated directly, always shown through what happens.$$,
  $$The story opens by establishing a magical world and introducing the child character. A problem, challenge, or quest is introduced early — something that requires courage, cleverness, or kindness to overcome. The middle of the story follows the character through the challenge, encountering magical helpers, obstacles, or discoveries along the way. The story builds to a triumphant resolution where the character succeeds through their own qualities. The ending is joyful and satisfying, with a clear sense that the world is better for what the character did.$$,
  $${"first": "Open with a sense of magic and possibility. Establish the world and the child character. Introduce the challenge or quest clearly by the end of the first page or two.", "middle": "Follow the character through obstacles and discoveries. Each page should advance the quest. Magical elements should feel natural, not jarring. Build toward the climax.", "last": "Triumphant, joyful resolution. The character succeeds because of who they are — their courage, kindness, or cleverness. A warm sense of moral satisfaction without preaching. Classic fairytale ending energy."}$$,
  false,
  null,
  null,
  2,
  true
);

-- 3. Adventure
insert into story_types (id, name, description, system_prompt_suffix, structure_template, page_guidance, occasion_required, extra_input_label, extra_input_hint, sort_order, is_active)
values (
  'adventure',
  'Adventure',
  'A bold, exciting quest where the hero faces challenges and discovers what they are made of.',
  $$This is an adventure story. Write with energy, momentum, and excitement. Use vivid action language and propulsive sentences. Each page should feel like something is happening — movement, discovery, challenge, triumph. Build tension naturally toward a climactic moment, then land on a satisfying, triumphant resolution. The child character should feel genuinely brave and capable.$$,
  $$The story opens with the child character being called into or stumbling upon an adventure. The mission or goal is established quickly and clearly. The middle of the story follows the character through a series of escalating challenges — each one requiring something different from them. There is a climactic moment of highest tension or greatest challenge near the end. The character overcomes it through courage, cleverness, or determination. The resolution is triumphant and energizing — the character has grown and succeeded.$$,
  $${"first": "Hook the reader immediately. Establish the adventure premise and the goal within the first page. The character should feel ready for action.", "middle": "Escalating challenges and discoveries. Each page raises the stakes slightly. Keep the pace fast. The character should use real skills and courage to advance — not luck.", "last": "The climax and triumphant resolution. The character's defining moment. End with a strong sense of accomplishment and energy — this is a story the child will want to hear again."}$$,
  false,
  null,
  null,
  3,
  true
);

-- 4. Silly
insert into story_types (id, name, description, system_prompt_suffix, structure_template, page_guidance, occasion_required, extra_input_label, extra_input_hint, sort_order, is_active)
values (
  'silly',
  'Silly Story',
  'Something wonderfully absurd happens and keeps getting funnier from there.',
  $$This is a silly, funny story. Write with playful, irreverent energy. Embrace the absurd. Use fun sounds, silly words, comic timing, and unexpected escalations. Puns are welcome. The tone should be light, bouncy, and joyful — the kind of story that makes a child giggle out loud. Do not try to resolve the silliness too neatly — a warm but still playful ending is better than a tidy one.$$,
  $$The story opens with something unexpected or absurd happening — something that makes no sense and is immediately funny. Each page escalates the absurdity in a new direction. The child character reacts with delight, bewilderment, or gleeful participation. The middle builds comic complications on top of each other. The ending resolves warmly but does not need to explain or fix everything — some delightful chaos can remain. The overall feeling is joy and laughter.$$,
  $${"first": "Open with the absurd premise immediately. Do not build slowly to the funny part — start there. Hook the reader with something unexpected and delightful.", "middle": "Each page adds a new comic complication or escalation. The silliness compounds. Use sound words, unexpected comparisons, and physical comedy where it fits the story.", "last": "A warm, playful resolution. Does not need to be tidy. Can leave some chaos intact. Should end on a laugh or a smile — never a lesson or a moral."}$$,
  false,
  null,
  null,
  4,
  true
);

-- 5. Mystery
insert into story_types (id, name, description, system_prompt_suffix, structure_template, page_guidance, occasion_required, extra_input_label, extra_input_hint, sort_order, is_active)
values (
  'mystery',
  'Mystery',
  'Something curious needs solving — and the young detective is on the case.',
  $$This is a mystery story for young children. Write with curious, suspenseful energy — but keep it warm and safe at all times. The mystery must be age-appropriate and lighthearted (missing cookies, a disappeared toy, a strange sound in the garden) — never dark, scary, or threatening. Use detective language and rhetorical questions to draw the reader in ("But where could it be?" "Who could have done it?"). The child character is clever and observant. The resolution should feel satisfying — the mystery is solved and everything is okay.$$,
  $$The story opens with the mystery: something is missing, strange, or unexplained. The child character decides to investigate. Each page reveals a new clue or a false lead — the investigation progresses page by page. The character uses observation and deduction (not luck) to piece together what happened. The mystery is solved in the final pages with a satisfying reveal that makes sense in retrospect. Everything is resolved warmly and completely — no loose ends.$$,
  $${"first": "Establish the mystery clearly and immediately. The child character notices something is wrong or strange. The investigation begins. Keep the tone curious and exciting, never scary.", "middle": "Clue by clue, page by page. Each page should move the investigation forward. Include at least one false lead or surprising discovery. The character should feel genuinely clever.", "last": "The satisfying reveal. The mystery is solved. Everything makes sense. The ending should feel complete and warm — the world is safe and right again."}$$,
  false,
  null,
  null,
  5,
  true
);

-- 6. Special Event
insert into story_types (id, name, description, system_prompt_suffix, structure_template, page_guidance, occasion_required, extra_input_label, extra_input_hint, sort_order, is_active)
values (
  'special_event',
  'Special Event',
  'A story that celebrates a real moment — a birthday, a holiday, a milestone.',
  $$This story celebrates a specific real occasion in the child's life. Weave the occasion naturally and joyfully into the story — it should feel personal, warm, and celebratory. The child character should be the center of the celebration. The emotional throughline is joy, pride, and the feeling of being loved and special. Reference the specific occasion provided directly and meaningfully — do not treat it as a backdrop.$$,
  $$The story opens on the day of the occasion — the child character wakes up or arrives somewhere knowing something special is happening. The story follows the character through the experience of the occasion, with the toy companion present throughout. There are moments of anticipation, delight, and celebration. The ending captures the warm feeling of a perfect special day — happiness, gratitude, and the sense that this moment will be remembered.$$,
  $${"first": "Open on the occasion itself — the morning of the birthday, the first moment of the holiday, the arrival at the milestone event. Establish the excitement and warmth immediately. Reference the specific occasion by name.", "middle": "Follow the character through the experience of the occasion. Build joy and celebration page by page. The toy companion should be part of the celebration. Include sensory details that make the occasion feel real and special.", "last": "A warm, complete ending that captures the feeling of the day. The character feels happy, loved, and special. The occasion is honored fully. Leave the reader (and the child) with a warm glow."}$$,
  true,
  'What are we celebrating?',
  'e.g. Emma''s 5th birthday, first day of kindergarten, Christmas morning',
  6,
  true
);

-- 7. Educational
insert into story_types (id, name, description, system_prompt_suffix, structure_template, page_guidance, occasion_required, extra_input_label, extra_input_hint, sort_order, is_active)
values (
  'educational',
  'Learning Story',
  'A story built around something the child is learning — woven in naturally and joyfully.',
  $$This is an educational story. The learning topic provided must be woven naturally and joyfully into the story — never forced or didactic. The child character encounters and engages with the topic organically through the adventure. Use age-appropriate vocabulary. Incorporate gentle repetition of key concepts across pages — this aids learning without feeling like a lesson. The story should feel fun and engaging first, educational second. Celebrate curiosity and discovery throughout.$$,
  $$The story opens with the child character in a situation where the learning topic naturally arises. The topic is introduced clearly and joyfully through the first encounter. As the story progresses, the character engages with the topic repeatedly in different ways — each page reinforces the concept through a new context or application. By the end, the character has experienced the topic fully and the reader has encountered it multiple times in memorable ways. The ending celebrates the character's curiosity and what they have discovered.$$,
  $${"first": "Introduce the learning topic naturally within the first page through the story situation — not as an announcement. The child character should encounter it as part of the adventure, not as a lesson.", "middle": "Each page should engage with the topic in a new way. Gentle repetition is good — return to key words or concepts across pages. Keep the adventure moving so it never feels like a worksheet.", "last": "Reinforce the topic one final time in a memorable, satisfying way. Celebrate what the character has learned or discovered. End with warmth and a sense of accomplishment."}$$,
  false,
  'What is the child learning?',
  'e.g. colors, counting to 10, sharing, the alphabet, being kind',
  7,
  true
);

-- 8. Custom
insert into story_types (id, name, description, system_prompt_suffix, structure_template, page_guidance, occasion_required, extra_input_label, extra_input_hint, sort_order, is_active)
values (
  'custom',
  'Custom Story',
  $$You describe it — we'll write it. Any theme, any style, any adventure.$$,
  $$This is a custom story type described by the parent. Read the story type description carefully and use it to shape the voice, tone, pacing, and structure of the story. Honor the spirit of what was described — if it calls for excitement, be exciting; if it calls for spookiness, be appropriately spooky for the child's age; if it calls for a specific theme, make that theme central. Use good judgment to make the story age-appropriate while fully embracing what was asked for.$$,
  $$Shape the narrative arc to fit the custom story type described. If the description implies a genre (superhero, horror-lite, sci-fi, sports), use the conventions of that genre to structure the story. If it implies a theme (dinosaurs, space, ocean), make that theme the world of the story. Always ensure a clear beginning that establishes the premise, a middle that develops it, and a satisfying resolution. The child character should be the hero of whatever world or genre is described.$$,
  $${"first": "Establish the custom premise immediately and fully. The reader should understand the world and tone of this story from the first page. Honor the parent's description.", "middle": "Develop the story according to the genre or theme described. Use the conventions of that type of story to shape each page. Keep the child character central and active.", "last": "A satisfying resolution appropriate to the genre or theme. The ending should feel complete and true to the story type requested."}$$,
  false,
  'Describe the story type',
  'e.g. a spooky Halloween story, a superhero adventure, a story about dinosaurs',
  8,
  true
);
