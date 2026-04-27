-- db/migrations/002_art_styles.sql
-- Adds art_style column to story_templates and seeds 8 art style options
-- Run in Supabase SQL Editor

-- ─── 1. Add art_style column to story_templates ───────────────────────────────
alter table story_templates
  add column if not exists art_style text not null default 'soft_watercolor';

-- ─── 2. Add art_styles lookup table ──────────────────────────────────────────
create table if not exists art_styles (
  id          text primary key,  -- slug, used in image prompts
  name        text not null,     -- display name shown to users
  description text not null,     -- short user-facing description
  prompt_prefix text not null,   -- prepended to image_prompt_template at generation time
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ─── 3. Seed art styles ───────────────────────────────────────────────────────
insert into art_styles (id, name, description, prompt_prefix, sort_order) values

(
  'soft_watercolor',
  'Soft Watercolor',
  'Dreamy, gentle washes of color — the classic storybook look.',
  'Children''s book illustration, soft watercolor style, warm pastel color washes, delicate brushwork, gentle translucent layers, luminous and airy, storybook aesthetic,',
  1
),
(
  'classic_storybook',
  'Classic Storybook',
  'Timeless illustrations like the books you loved as a kid.',
  'Children''s picture book illustration, classic storybook art style, detailed ink linework with hand-painted color fills, warm earthy tones, nostalgic and charming, reminiscent of golden-age picture books,',
  2
),
(
  'colored_pencil',
  'Colored Pencil',
  'Cozy, handcrafted texture with visible pencil strokes.',
  'Children''s book illustration, colored pencil drawing style, visible pencil stroke texture, soft hatching and blending, warm and handcrafted feel, cozy and intimate,',
  3
),
(
  'flat_vector',
  'Flat Vector / Sticker Art',
  'Bold outlines and bright colors — modern and playful.',
  'Children''s book illustration, flat vector art style, bold clean outlines, bright saturated colors, simple geometric shapes, modern and playful, cheerful sticker-book aesthetic,',
  4
),
(
  'pixar_3d',
  '3D Pixar-Style',
  'Expressive 3D characters with a cinematic, magical feel.',
  'Children''s book illustration, Pixar-inspired 3D CGI style, soft subsurface lighting, expressive rounded character designs, rich vibrant colors, cinematic depth of field, magical and polished,',
  5
),
(
  'gouache_painterly',
  'Gouache / Painterly',
  'Rich, opaque paint strokes — vibrant and full of life.',
  'Children''s book illustration, gouache painting style, opaque rich color blocks, visible brushwork, bold and saturated palette, painterly texture, lush and expressive,',
  6
),
(
  'pastel_chalk',
  'Pastel Chalk',
  'Soft, powdery textures — perfect for dreamy bedtime scenes.',
  'Children''s book illustration, soft pastel chalk art style, powdery blended textures, muted dreamy color palette, gentle smudged edges, ethereal and calming, bedtime storybook feel,',
  7
),
(
  'anime_manga',
  'Anime / Manga',
  'Expressive characters with big eyes and vivid energy.',
  'Children''s book illustration, anime art style, expressive large eyes, clean cel-shaded linework, vibrant saturated colors, dynamic and emotive character poses, friendly and adventurous,',
  8
)

on conflict (id) do update set
  name          = excluded.name,
  description   = excluded.description,
  prompt_prefix = excluded.prompt_prefix,
  sort_order    = excluded.sort_order;

-- ─── 4. RLS — art_styles readable by all authenticated users ─────────────────
alter table art_styles enable row level security;

create policy "authenticated read art_styles"
  on art_styles for select using (auth.uid() is not null and is_active = true);