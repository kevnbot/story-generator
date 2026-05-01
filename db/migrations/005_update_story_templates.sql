-- Simplify story template system prompts to tone/voice only.
-- Word-count constraints and ending mandates conflicted with the page-based
-- format and custom story descriptions controlled by the generation route.
-- The user_prompt_template is no longer used for story generation — the route
-- builds the user prompt directly from profile fields.

update story_templates set
  system_prompt = 'You are a master children''s storyteller. Write warm, imaginative stories with a calming, gentle narrative voice. Use simple, vivid language. Create stories that feel safe and comforting.'
where name = 'Cozy Adventure';

update story_templates set
  system_prompt = 'You are a children''s storyteller specializing in funny, lighthearted stories. Write silly, playful stories with funny situations and lovable characters. Keep it age-appropriate with an upbeat, joyful tone.'
where name = 'Silly Creatures';

update story_templates set
  system_prompt = 'You are a children''s storyteller specializing in gentle fantasy. Write magical stories set in enchanted worlds with rich imagery and wonder. The magic should feel safe and wondrous, sparking imagination.'
where name = 'Magical Quest';
