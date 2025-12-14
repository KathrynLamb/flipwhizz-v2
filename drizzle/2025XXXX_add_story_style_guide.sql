CREATE TABLE IF NOT EXISTS story_style_guide (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL UNIQUE REFERENCES stories(id),

  summary TEXT,
  palette TEXT,
  lighting TEXT,
  render TEXT,

  reference_image_url TEXT,

  -- unified art style prompt for image generation
  ai_unified_prompt TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
