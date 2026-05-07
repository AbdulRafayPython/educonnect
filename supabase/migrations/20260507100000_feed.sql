-- v1.1 AI Feed: news (automated, simplified by Gemini) + concepts (teacher-authored).
-- See EduConnect_PRD.md §13 for the spec.

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE feed_sources (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name                 text NOT NULL,
    rss_url              text NOT NULL UNIQUE,
    is_active            bool NOT NULL DEFAULT true,
    brand_color          text,
    last_fetched_at      timestamptz,
    consecutive_failures int NOT NULL DEFAULT 0,
    created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE feed_items (
    id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    type                     text NOT NULL CHECK (type IN ('news','concept')),
    status                   text NOT NULL DEFAULT 'published'
                                CHECK (status IN ('published','hidden','archived','draft')),
    difficulty               text DEFAULT 'core'
                                CHECK (difficulty IN ('foundations','core','advanced')),
    title                    text NOT NULL,
    summary                  text NOT NULL,
    body                     text,
    cover_image_url          text,
    cover_image_url_original text,
    source_id                uuid REFERENCES feed_sources(id) ON DELETE SET NULL,
    source_name              text,
    source_url               text UNIQUE,
    published_at             timestamptz NOT NULL DEFAULT now(),
    pinned_until             timestamptz,
    created_by               uuid REFERENCES profiles(id) ON DELETE SET NULL,
    created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX feed_items_published_at_idx
    ON feed_items (published_at DESC)
    WHERE status = 'published';

CREATE INDEX feed_items_type_published_idx
    ON feed_items (type, published_at DESC)
    WHERE status = 'published';

CREATE INDEX feed_items_source_idx ON feed_items (source_id);

CREATE TABLE feed_ingest_runs (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    started_at     timestamptz NOT NULL DEFAULT now(),
    finished_at    timestamptz,
    sources_seen   int NOT NULL DEFAULT 0,
    items_inserted int NOT NULL DEFAULT 0,
    llm_calls      int NOT NULL DEFAULT 0,
    errors         jsonb
);

CREATE TABLE feed_interactions (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id    uuid NOT NULL REFERENCES feed_items(id) ON DELETE CASCADE,
    user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    is_read    bool NOT NULL DEFAULT false,
    is_saved   bool NOT NULL DEFAULT false,
    reaction   text CHECK (reaction IN ('like','curious','mind_blown')),
    read_at    timestamptz,
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (item_id, user_id)
);

CREATE INDEX feed_interactions_user_saved_idx
    ON feed_interactions (user_id)
    WHERE is_saved = true;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE feed_sources       ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_ingest_runs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_interactions  ENABLE ROW LEVEL SECURITY;

-- feed_sources — teacher only
CREATE POLICY "feed_sources_teacher_all" ON feed_sources FOR ALL
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'teacher'))
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'teacher'));

-- feed_items — teacher full CRUD; student SELECT only published
CREATE POLICY "feed_items_teacher_all" ON feed_items FOR ALL
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'teacher'))
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'teacher'));

CREATE POLICY "feed_items_student_read_published" ON feed_items FOR SELECT
USING (status = 'published');

-- feed_ingest_runs — teacher SELECT only; service role inserts via Edge Function (bypasses RLS)
CREATE POLICY "feed_ingest_runs_teacher_read" ON feed_ingest_runs FOR SELECT
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'teacher'));

-- feed_interactions — user owns own rows; teacher reads all
CREATE POLICY "feed_interactions_self_all" ON feed_interactions FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "feed_interactions_teacher_read" ON feed_interactions FOR SELECT
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'teacher'));

-- ============================================================
-- REALTIME
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE feed_items;

-- ============================================================
-- SEED DEFAULT RSS SOURCES
-- ============================================================

INSERT INTO feed_sources (name, rss_url, brand_color) VALUES
  ('Hugging Face Papers', 'https://huggingface.co/papers/rss', '#ff9d00'),
  ('Anthropic',           'https://www.anthropic.com/news/rss.xml', '#cc785c'),
  ('OpenAI',              'https://openai.com/news/rss.xml', '#10a37f'),
  ('Google DeepMind',     'https://deepmind.google/blog/rss.xml', '#4285f4'),
  ('Simon Willison',      'https://simonwillison.net/atom/everything/', '#ff5d3a'),
  ('MIT Tech Review — AI','https://www.technologyreview.com/topic/artificial-intelligence/feed', '#000000'),
  ('The Verge — AI',      'https://www.theverge.com/ai-artificial-intelligence/rss/index.xml', '#5200ff')
ON CONFLICT (rss_url) DO NOTHING;
