# Quick Start: Campaign Stats Setup

## 1. Run Database Migration

1. Open your Supabase dashboard
2. Go to SQL Editor
3. Copy and paste the contents of `lib/db/migrations/campaign-stats-schema.sql`
4. Run the migration

This creates:
- `campaigns` table
- `email_events` table (raw events)
- `campaign_daily_stats` table (daily rollups)
- `campaign_stats_cache` table (current totals)
- Indexes for performance
- Triggers to auto-update stats
- Functions for querying stats

## 2. Insert Email Events

When emails are sent/replied/bounced, insert events:

```typescript
import { insertEmailEvent } from '@/lib/queries/campaignStats';

// Email sent
await insertEmailEvent({
  campaign_id: 1,
  lead_id: 123,
  event_type: 'sent',
});

// Reply received
await insertEmailEvent({
  campaign_id: 1,
  thread_id: 456,
  event_type: 'reply',
  metadata: { sentiment: 'interested' }
});

// Bounce occurred
await insertEmailEvent({
  campaign_id: 1,
  lead_id: 123,
  event_type: 'bounce',
  metadata: { reason: 'invalid_email' }
});
```

**Note**: Stats are automatically updated via database triggers!

## 3. Query Campaign Stats

### List All Campaigns (Fast)
```typescript
import { getAllCampaignsStats } from '@/lib/queries/campaignStats';

const campaigns = await getAllCampaignsStats(clientId);
// Returns: campaign_id, name, total_sent, total_replies, reply_rate, etc.
```

### Get Stats for Date Range
```typescript
import { getCampaignStats } from '@/lib/queries/campaignStats';

const stats = await getCampaignStats({
  campaignId: 1,
  startDate: '2024-01-01',
  endDate: '2024-01-31'
});
// Returns: sent_count, reply_count, bounce_count, rates, etc.
```

## 4. View Campaign Stats Page

Navigate to `/campaigns` to see the campaign stats page.

## Integration Points

### When Email is Sent (from your sequencer)
```typescript
// In your email sending logic
await insertEmailEvent({
  campaign_id: campaignId,
  lead_id: leadId,
  event_type: 'sent',
  email_id: emailId, // if you have email records
});
```

### When Reply is Received (from your inbox/webhook)
```typescript
// In your reply handling logic
await insertEmailEvent({
  campaign_id: campaignId,
  thread_id: threadId,
  event_type: 'reply',
  metadata: { 
    sentiment: aiSentiment, // if you have AI sentiment analysis
  }
});
```

### When Bounce Occurs (from your email provider webhook)
```typescript
// In your bounce webhook handler
await insertEmailEvent({
  campaign_id: campaignId,
  lead_id: leadId,
  event_type: 'bounce',
  metadata: { 
    reason: bounceReason,
    type: 'hard' // or 'soft'
  }
});
```

## Performance

- **Listing campaigns**: ~10-50ms (uses cache)
- **Date range queries**: ~50-200ms (uses daily stats)
- **Insert events**: ~5-10ms (includes trigger)

## Next Steps

1. Integrate event insertion into your email sending pipeline
2. Set up webhooks to track replies and bounces
3. Customize the campaign stats page UI
4. Add more event types (opens, clicks) if needed

## Troubleshooting

### Stats not updating?
- Check that triggers are enabled: `SELECT * FROM pg_trigger WHERE tgname = 'trigger_update_daily_stats';`
- Verify events are being inserted: `SELECT COUNT(*) FROM email_events;`

### Slow queries?
- Check indexes: `\d email_events` in psql
- Analyze query plans: Use EXPLAIN ANALYZE in Supabase SQL editor

### Need to recalculate stats?
See `docs/database-schema-campaign-stats.md` for recalculation queries.


