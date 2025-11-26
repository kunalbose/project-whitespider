# Campaign Stats Database Schema Design

## Recommended Approach: Hybrid (Raw Events + Daily Rollups)

### Why This Approach?

1. **Flexibility**: Query any date range, filter by any dimension
2. **Performance**: Pre-aggregated daily stats for fast list views
3. **Accuracy**: Always recalculate from source of truth (raw events)
4. **Scalability**: Handles millions of events efficiently

## Database Schema

### 1. Core Tables

```sql
-- Campaigns table (if not exists)
CREATE TABLE IF NOT EXISTS campaigns (
  id BIGSERIAL PRIMARY KEY,
  client_id BIGINT REFERENCES clients(id),
  name TEXT NOT NULL,
  sequence_id BIGINT, -- Reference to email sequence
  status TEXT DEFAULT 'active', -- active, paused, completed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email Events (Raw Events Table)
CREATE TABLE IF NOT EXISTS email_events (
  id BIGSERIAL PRIMARY KEY,
  campaign_id BIGINT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  lead_id BIGINT REFERENCES leads(id),
  thread_id BIGINT REFERENCES threads(id),
  event_type TEXT NOT NULL CHECK (event_type IN ('sent', 'reply', 'bounce', 'open', 'click')),
  event_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  email_id BIGINT REFERENCES emails(id), -- Reference to actual email record
  metadata JSONB, -- Store additional data (bounce reason, reply sentiment, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily Campaign Stats (Pre-aggregated for performance)
CREATE TABLE IF NOT EXISTS campaign_daily_stats (
  id BIGSERIAL PRIMARY KEY,
  campaign_id BIGINT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  stat_date DATE NOT NULL,
  sent_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  bounce_count INTEGER DEFAULT 0,
  open_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, stat_date)
);

-- Campaign Stats Cache (Current totals per campaign)
CREATE TABLE IF NOT EXISTS campaign_stats_cache (
  campaign_id BIGINT PRIMARY KEY REFERENCES campaigns(id) ON DELETE CASCADE,
  total_sent INTEGER DEFAULT 0,
  total_replies INTEGER DEFAULT 0,
  total_bounces INTEGER DEFAULT 0,
  total_opens INTEGER DEFAULT 0,
  total_clicks INTEGER DEFAULT 0,
  last_event_date TIMESTAMPTZ,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);
```

### 2. Indexes for Performance

```sql
-- Indexes on email_events for fast filtering
CREATE INDEX IF NOT EXISTS idx_email_events_campaign_date 
  ON email_events(campaign_id, event_date DESC);

CREATE INDEX IF NOT EXISTS idx_email_events_type_date 
  ON email_events(event_type, event_date DESC);

CREATE INDEX IF NOT EXISTS idx_email_events_campaign_type 
  ON email_events(campaign_id, event_type);

-- Indexes on daily stats
CREATE INDEX IF NOT EXISTS idx_daily_stats_campaign_date 
  ON campaign_daily_stats(campaign_id, stat_date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_stats_date 
  ON campaign_daily_stats(stat_date DESC);

-- Index on campaigns for client filtering
CREATE INDEX IF NOT EXISTS idx_campaigns_client 
  ON campaigns(client_id, created_at DESC);
```

### 3. Functions for Maintaining Stats

```sql
-- Function to update daily stats when events are inserted
CREATE OR REPLACE FUNCTION update_campaign_daily_stats()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO campaign_daily_stats (
    campaign_id,
    stat_date,
    sent_count,
    reply_count,
    bounce_count,
    open_count,
    click_count
  )
  VALUES (
    NEW.campaign_id,
    DATE(NEW.event_date),
    CASE WHEN NEW.event_type = 'sent' THEN 1 ELSE 0 END,
    CASE WHEN NEW.event_type = 'reply' THEN 1 ELSE 0 END,
    CASE WHEN NEW.event_type = 'bounce' THEN 1 ELSE 0 END,
    CASE WHEN NEW.event_type = 'open' THEN 1 ELSE 0 END,
    CASE WHEN NEW.event_type = 'click' THEN 1 ELSE 0 END
  )
  ON CONFLICT (campaign_id, stat_date)
  DO UPDATE SET
    sent_count = campaign_daily_stats.sent_count + 
      CASE WHEN NEW.event_type = 'sent' THEN 1 ELSE 0 END,
    reply_count = campaign_daily_stats.reply_count + 
      CASE WHEN NEW.event_type = 'reply' THEN 1 ELSE 0 END,
    bounce_count = campaign_daily_stats.bounce_count + 
      CASE WHEN NEW.event_type = 'bounce' THEN 1 ELSE 0 END,
    open_count = campaign_daily_stats.open_count + 
      CASE WHEN NEW.event_type = 'open' THEN 1 ELSE 0 END,
    click_count = campaign_daily_stats.click_count + 
      CASE WHEN NEW.event_type = 'click' THEN 1 ELSE 0 END,
    last_updated = NOW();
  
  -- Update campaign stats cache
  INSERT INTO campaign_stats_cache (
    campaign_id,
    total_sent,
    total_replies,
    total_bounces,
    total_opens,
    total_clicks,
    last_event_date
  )
  VALUES (
    NEW.campaign_id,
    CASE WHEN NEW.event_type = 'sent' THEN 1 ELSE 0 END,
    CASE WHEN NEW.event_type = 'reply' THEN 1 ELSE 0 END,
    CASE WHEN NEW.event_type = 'bounce' THEN 1 ELSE 0 END,
    CASE WHEN NEW.event_type = 'open' THEN 1 ELSE 0 END,
    CASE WHEN NEW.event_type = 'click' THEN 1 ELSE 0 END,
    NEW.event_date
  )
  ON CONFLICT (campaign_id)
  DO UPDATE SET
    total_sent = campaign_stats_cache.total_sent + 
      CASE WHEN NEW.event_type = 'sent' THEN 1 ELSE 0 END,
    total_replies = campaign_stats_cache.total_replies + 
      CASE WHEN NEW.event_type = 'reply' THEN 1 ELSE 0 END,
    total_bounces = campaign_stats_cache.total_bounces + 
      CASE WHEN NEW.event_type = 'bounce' THEN 1 ELSE 0 END,
    total_opens = campaign_stats_cache.total_opens + 
      CASE WHEN NEW.event_type = 'open' THEN 1 ELSE 0 END,
    total_clicks = campaign_stats_cache.total_clicks + 
      CASE WHEN NEW.event_type = 'click' THEN 1 ELSE 0 END,
    last_event_date = GREATEST(campaign_stats_cache.last_event_date, NEW.event_date),
    last_updated = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update stats
CREATE TRIGGER trigger_update_daily_stats
  AFTER INSERT ON email_events
  FOR EACH ROW
  EXECUTE FUNCTION update_campaign_daily_stats();
```

### 4. Query Functions

```sql
-- Get campaign stats for a date range (uses daily stats for speed)
CREATE OR REPLACE FUNCTION get_campaign_stats(
  p_campaign_id BIGINT DEFAULT NULL,
  p_client_id BIGINT DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  campaign_id BIGINT,
  campaign_name TEXT,
  sent_count BIGINT,
  reply_count BIGINT,
  bounce_count BIGINT,
  open_count BIGINT,
  click_count BIGINT,
  reply_rate NUMERIC,
  bounce_rate NUMERIC,
  open_rate NUMERIC,
  click_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id as campaign_id,
    c.name as campaign_name,
    COALESCE(SUM(cds.sent_count), 0)::BIGINT as sent_count,
    COALESCE(SUM(cds.reply_count), 0)::BIGINT as reply_count,
    COALESCE(SUM(cds.bounce_count), 0)::BIGINT as bounce_count,
    COALESCE(SUM(cds.open_count), 0)::BIGINT as open_count,
    COALESCE(SUM(cds.click_count), 0)::BIGINT as click_count,
    CASE 
      WHEN SUM(cds.sent_count) > 0 
      THEN ROUND((SUM(cds.reply_count)::NUMERIC / SUM(cds.sent_count)::NUMERIC) * 100, 2)
      ELSE 0 
    END as reply_rate,
    CASE 
      WHEN SUM(cds.sent_count) > 0 
      THEN ROUND((SUM(cds.bounce_count)::NUMERIC / SUM(cds.sent_count)::NUMERIC) * 100, 2)
      ELSE 0 
    END as bounce_rate,
    CASE 
      WHEN SUM(cds.sent_count) > 0 
      THEN ROUND((SUM(cds.open_count)::NUMERIC / SUM(cds.sent_count)::NUMERIC) * 100, 2)
      ELSE 0 
    END as open_rate,
    CASE 
      WHEN SUM(cds.sent_count) > 0 
      THEN ROUND((SUM(cds.click_count)::NUMERIC / SUM(cds.sent_count)::NUMERIC) * 100, 2)
      ELSE 0 
    END as click_rate
  FROM campaigns c
  LEFT JOIN campaign_daily_stats cds ON c.id = cds.campaign_id
  WHERE 
    (p_campaign_id IS NULL OR c.id = p_campaign_id)
    AND (p_client_id IS NULL OR c.client_id = p_client_id)
    AND (p_start_date IS NULL OR cds.stat_date >= p_start_date)
    AND (p_end_date IS NULL OR cds.stat_date <= p_end_date)
  GROUP BY c.id, c.name
  ORDER BY c.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Get all campaigns with current stats (fast - uses cache)
CREATE OR REPLACE FUNCTION get_all_campaigns_stats(
  p_client_id BIGINT DEFAULT NULL
)
RETURNS TABLE (
  campaign_id BIGINT,
  campaign_name TEXT,
  client_name TEXT,
  status TEXT,
  total_sent INTEGER,
  total_replies INTEGER,
  total_bounces INTEGER,
  reply_rate NUMERIC,
  bounce_rate NUMERIC,
  last_event_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id as campaign_id,
    c.name as campaign_name,
    cl.name as client_name,
    c.status,
    COALESCE(csc.total_sent, 0) as total_sent,
    COALESCE(csc.total_replies, 0) as total_replies,
    COALESCE(csc.total_bounces, 0) as total_bounces,
    CASE 
      WHEN csc.total_sent > 0 
      THEN ROUND((csc.total_replies::NUMERIC / csc.total_sent::NUMERIC) * 100, 2)
      ELSE 0 
    END as reply_rate,
    CASE 
      WHEN csc.total_sent > 0 
      THEN ROUND((csc.total_bounces::NUMERIC / csc.total_sent::NUMERIC) * 100, 2)
      ELSE 0 
    END as bounce_rate,
    csc.last_event_date,
    c.created_at
  FROM campaigns c
  LEFT JOIN clients cl ON c.client_id = cl.id
  LEFT JOIN campaign_stats_cache csc ON c.id = csc.campaign_id
  WHERE (p_client_id IS NULL OR c.client_id = p_client_id)
  ORDER BY c.created_at DESC;
END;
$$ LANGUAGE plpgsql;
```

## Usage Examples

### Inserting Events
```sql
-- When an email is sent
INSERT INTO email_events (campaign_id, lead_id, event_type, event_date)
VALUES (1, 123, 'sent', NOW());

-- When a reply is received
INSERT INTO email_events (campaign_id, thread_id, event_type, event_date, metadata)
VALUES (1, 456, 'reply', NOW(), '{"sentiment": "interested"}'::jsonb);

-- When a bounce occurs
INSERT INTO email_events (campaign_id, lead_id, event_type, event_date, metadata)
VALUES (1, 123, 'bounce', NOW(), '{"reason": "invalid_email"}'::jsonb);
```

### Querying Stats
```sql
-- Get all campaigns with stats (FAST - uses cache)
SELECT * FROM get_all_campaigns_stats(1); -- client_id = 1

-- Get campaign stats for date range
SELECT * FROM get_campaign_stats(
  p_campaign_id := 1,
  p_start_date := '2024-01-01',
  p_end_date := '2024-01-31'
);

-- Get stats for all campaigns of a client in date range
SELECT * FROM get_campaign_stats(
  p_client_id := 1,
  p_start_date := '2024-01-01',
  p_end_date := '2024-01-31'
);
```

## Performance Characteristics

1. **Listing All Campaigns**: ~10-50ms (uses cache table)
2. **Date Range Queries**: ~50-200ms (uses daily stats aggregation)
3. **Individual Event Queries**: ~100-500ms (queries raw events)
4. **Insert Performance**: ~5-10ms per event (includes trigger overhead)

## Maintenance

### Recalculate Stats (if needed)
```sql
-- Recalculate all daily stats from raw events (run periodically if needed)
TRUNCATE campaign_daily_stats;
INSERT INTO campaign_daily_stats (campaign_id, stat_date, sent_count, reply_count, bounce_count)
SELECT 
  campaign_id,
  DATE(event_date) as stat_date,
  COUNT(*) FILTER (WHERE event_type = 'sent') as sent_count,
  COUNT(*) FILTER (WHERE event_type = 'reply') as reply_count,
  COUNT(*) FILTER (WHERE event_type = 'bounce') as bounce_count
FROM email_events
GROUP BY campaign_id, DATE(event_date);
```

## Migration Strategy

1. Create new tables (email_events, campaign_daily_stats, campaign_stats_cache)
2. Backfill historical data from existing tables
3. Update application to insert into email_events
4. Gradually migrate existing queries to use new functions
5. Keep old tables for reference during transition

