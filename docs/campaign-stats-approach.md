# Campaign Stats Database Design - Decision Guide

## Your Question: Store Daily Stats or Aggregate on Request?

### Short Answer: **Hybrid Approach** - Store both raw events AND daily rollups

## The Problem with Each Approach

### ❌ Only Storing Daily Stats (Pre-aggregated)
**Problems:**
- Inflexible: Can't query arbitrary date ranges easily
- Loss of detail: Can't analyze individual events
- Data integrity: Hard to audit or recalculate
- Storage: Still need to store daily rows (not much savings)

### ❌ Only Storing Raw Events (Aggregate on request)
**Problems:**
- **Slow for listing all campaigns**: Querying millions of events for each campaign is expensive
- **Complex queries**: Need to aggregate every time you want stats
- **Poor user experience**: Page loads take seconds instead of milliseconds

## ✅ Recommended Solution: Hybrid Approach

### Architecture

```
┌─────────────────┐
│  email_events   │  ← Raw events (source of truth)
│  (Raw Data)     │
└────────┬────────┘
         │
         │ Trigger automatically updates ↓
         │
┌────────▼─────────────────┐
│ campaign_daily_stats     │  ← Daily rollups (fast date range queries)
│ (Pre-aggregated)         │
└────────┬─────────────────┘
         │
         │ Aggregated into ↓
         │
┌────────▼─────────────────┐
│ campaign_stats_cache     │  ← Current totals (instant campaign list)
│ (Current totals)         │
└──────────────────────────┘
```

### How It Works

1. **Insert Events**: When an email is sent/replied/bounced, insert into `email_events`
2. **Auto-Update**: Database trigger automatically updates:
   - `campaign_daily_stats` (daily totals)
   - `campaign_stats_cache` (current campaign totals)
3. **Fast Queries**: 
   - Listing campaigns: Query `campaign_stats_cache` (instant)
   - Date ranges: Query `campaign_daily_stats` (fast aggregation)
   - Detailed analysis: Query `email_events` (when needed)

## Performance Comparison

### Scenario: List 100 campaigns with stats

| Approach | Query Time | Notes |
|----------|------------|-------|
| Raw events only | **2-5 seconds** | Must aggregate millions of events |
| Daily stats only | **50-200ms** | Must join and aggregate daily rows |
| **Hybrid (cache)** | **10-50ms** | Single table lookup ✅ |

### Scenario: Get campaign stats for date range

| Approach | Query Time | Notes |
|----------|------------|-------|
| Raw events only | **1-3 seconds** | Filter and aggregate events |
| Daily stats only | **50-100ms** | Aggregate daily rows ✅ |
| **Hybrid (daily)** | **50-100ms** | Aggregate daily rows ✅ |

## Database Schema

### 1. `email_events` - Raw Events
```sql
- Stores every send, reply, bounce, open, click
- Indexed by campaign_id + event_date
- Source of truth for all statistics
```

### 2. `campaign_daily_stats` - Daily Rollups
```sql
- One row per campaign per day
- Pre-aggregated counts (sent, replies, bounces)
- Fast date range queries
- Updated automatically via trigger
```

### 3. `campaign_stats_cache` - Current Totals
```sql
- One row per campaign
- Current total stats (no date filtering)
- Ultra-fast for listing all campaigns
- Updated automatically via trigger
```

## How to Handle "Listing All Campaigns"

### The Challenge
You asked: *"If I aggregate, it will be time consuming to form a list for all the campaigns"*

### The Solution
**Use `campaign_stats_cache` table** - it stores current totals for each campaign, so listing all campaigns is just:

```sql
SELECT 
  c.*,
  csc.total_sent,
  csc.total_replies,
  csc.total_bounces,
  csc.reply_rate,
  csc.bounce_rate
FROM campaigns c
LEFT JOIN campaign_stats_cache csc ON c.id = csc.campaign_id
WHERE c.client_id = ?
ORDER BY c.created_at DESC;
```

**Performance**: ~10-50ms for 1000 campaigns ✅

### When You Need Date Ranges
Use `campaign_daily_stats`:

```sql
SELECT 
  campaign_id,
  SUM(sent_count) as sent,
  SUM(reply_count) as replies,
  SUM(bounce_count) as bounces
FROM campaign_daily_stats
WHERE campaign_id = ? 
  AND stat_date BETWEEN ? AND ?
GROUP BY campaign_id;
```

**Performance**: ~50-200ms (aggregating ~30-90 daily rows) ✅

## Implementation Steps

### 1. Run Migration
Execute `lib/db/migrations/campaign-stats-schema.sql` in Supabase SQL editor

### 2. Insert Events
```typescript
import { insertEmailEvent } from '@/lib/queries/campaignStats';

// When email is sent
await insertEmailEvent({
  campaign_id: 1,
  lead_id: 123,
  event_type: 'sent',
});

// When reply received
await insertEmailEvent({
  campaign_id: 1,
  thread_id: 456,
  event_type: 'reply',
  metadata: { sentiment: 'interested' }
});

// When bounce occurs
await insertEmailEvent({
  campaign_id: 1,
  lead_id: 123,
  event_type: 'bounce',
  metadata: { reason: 'invalid_email' }
});
```

### 3. Query Stats
```typescript
// List all campaigns (FAST - uses cache)
const campaigns = await getAllCampaignsStats(clientId);

// Get stats for date range (FAST - uses daily stats)
const stats = await getCampaignStats({
  campaignId: 1,
  startDate: '2024-01-01',
  endDate: '2024-01-31'
});
```

## Benefits of This Approach

✅ **Fast campaign lists**: 10-50ms (uses cache)  
✅ **Fast date range queries**: 50-200ms (uses daily stats)  
✅ **Flexible**: Can query any date range  
✅ **Accurate**: Always recalculable from raw events  
✅ **Automatic**: Triggers maintain stats automatically  
✅ **Scalable**: Handles millions of events efficiently  
✅ **Auditable**: Raw events available for debugging  

## Maintenance

### Recalculating Stats (if needed)
If you ever need to rebuild stats from raw events:

```sql
-- Recalculate all daily stats
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

### Monitoring
- Check `campaign_stats_cache.last_updated` to ensure stats are current
- Monitor trigger performance (should be <10ms per event)
- Index usage: Ensure indexes are being used (check query plans)

## Cost Analysis

### Storage
- **Raw events**: ~100 bytes per event
- **Daily stats**: ~50 bytes per day per campaign
- **Cache**: ~100 bytes per campaign

**Example**: 1M events, 100 campaigns, 1 year
- Raw events: ~100 MB
- Daily stats: ~1.8 MB (100 campaigns × 365 days × 50 bytes)
- Cache: ~10 KB (100 campaigns × 100 bytes)
- **Total**: ~102 MB (negligible for most databases)

### Performance Cost
- **Insert**: +5-10ms per event (trigger overhead)
- **Query**: -90% faster for common queries
- **Net benefit**: Massive performance improvement

## Conclusion

**Use the hybrid approach**:
1. Store raw events for flexibility and accuracy
2. Store daily stats for fast date range queries  
3. Store cache for instant campaign lists
4. Use database triggers to maintain everything automatically

This gives you the best of both worlds: **flexibility + performance**.


