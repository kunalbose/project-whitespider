import { parseISO } from "date-fns";

export function calculateReplyRateStats(stats) {
  const totalSent = stats.reduce((acc, stat) => acc + (stat.sent_count || 0), 0);
  const totalReplies = stats.reduce((acc, stat) => acc + (stat.reply_count || 0), 0);
  const replyRate = totalSent > 0 ? (totalReplies / totalSent) * 100 : 0;

  return {
    replied: parseFloat(replyRate.toFixed(1)),
    notReplied: parseFloat((100 - replyRate).toFixed(1)),
  };
}

export function calculateBounceRateStats(stats) {
  const totalSent = stats.reduce((acc, stat) => acc + (stat.sent_count || 0), 0);
  const totalBounces = stats.reduce((acc, stat) => acc + (stat.bounce_count || 0), 0);
  const bounceRate = totalSent > 0 ? (totalBounces / totalSent) * 100 : 0;

  return {
    bounced: parseFloat(bounceRate.toFixed(1)),
    delivered: parseFloat((100 - bounceRate).toFixed(1)),
  };
}
export function calculateOverallSentRate(stats: any[]) {
  const totalSent = stats.reduce((sum, stat) => sum + (stat.sent_count || 0), 0);
  const totalCampaigns = stats.length || 1;

  const sentRate = (totalSent / totalCampaigns) * 100;
  return {
    sentRate: +sentRate.toFixed(2),
    totalSent,
    totalCampaigns
  };
}
export function getMonthlySentData(stats: any[]) {
  const monthlyTotals: Record<string, number> = {};

  stats.forEach((stat) => {
    const month = parseISO(stat.end_date).toLocaleString("default", { month: "short" });
    if (!monthlyTotals[month]) monthlyTotals[month] = 0;
    monthlyTotals[month] += stat.sent_count || 0;
  });

  return Object.entries(monthlyTotals).map(([month, sent]) => ({
    month,
    sent,
  }));
}

