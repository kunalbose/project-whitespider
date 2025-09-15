

type CampaignStat = {
  campaign_id: number;
  sent_count: number;
  reply_count: number;
  bounce_count: number;
  total_count: number;
  [key: string]: any;
};

type AggregatedClientMetrics = {
  sendRate: number;
  replyRate: number;
  bounceRate: number;
  sentiment: 'Positive' | 'Negative' | 'Neutral';
  totalSent: number;
  totalReplies: number;
  totalBounces: number;
  totalCampaigns: number;
};

export function calculateClientAggregateStats(stats: CampaignStat[]): AggregatedClientMetrics {
  let totalSent = 0;
  let totalReplies = 0;
  let totalBounces = 0;
  let totalCount = 0;

  for (const stat of stats) {
    totalSent += stat.sent_count || 0;
    totalReplies += stat.reply_count || 0;
    totalBounces += stat.bounce_count || 0;
    totalCount += stat.total_count || 0;
  }

  const sendRate = totalCount > 0 ? (totalSent / totalCount) * 100 : 0;
  const replyRate = totalSent > 0 ? (totalReplies / totalSent) * 100 : 0;
  const bounceRate = totalSent > 0 ? (totalBounces / totalSent) * 100 : 0;

  let sentiment: 'Positive' | 'Negative' | 'Neutral' = 'Neutral';
  if (replyRate > 5) sentiment = 'Positive';
  else if (bounceRate > 10) sentiment = 'Negative';

  return {
    sendRate,
    replyRate,
    bounceRate,
    sentiment,
    totalSent,
    totalReplies,
    totalBounces,
    totalCampaigns: stats.length,
  };
}
