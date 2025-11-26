import { supabase } from '@/lib/supabase';

export type EmailEventType = 'sent' | 'reply' | 'bounce' | 'open' | 'click';

export interface CampaignDailyStats {
  id?: number;
  campaign_id: number;
  stat_date: string;
  sent_count: number;
  reply_count: number;
  bounce_count: number;
  open_count: number;
  click_count: number;
}

export interface CampaignStats {
  campaign_id: number;
  campaign_name: string;
  stats_date: Date;
  sent_count: number;
  reply_count: number;
  bounce_count: number;
  open_count: number;
  click_count: number;
  reply_rate: number;
  bounce_rate: number;
  open_rate: number;
  click_rate: number;
}

export interface CampaignWithTodayStats extends CampaignStats {
  status?: string;
  client_name?: string;
  client_id?: number;
  created_at?: string;
}

export interface CampaignListStats {
  campaign_id: number;
  campaign_name: string;
  client_name: string;
  status: string;
  total_sent: number;
  total_replies: number;
  total_bounces: number;
  reply_rate: number;
  bounce_rate: number;
  last_event_date: string | null;
  created_at: string;
}

export async function getAllCampaignsTodayStats(
  clientId?: number,
  clientSequencerId?: number
): Promise<CampaignWithTodayStats[]> {
  const today = new Date().toISOString().split("T")[0];

  // 1) Call RPC – this returns { status, stats: [...] }
  const { data: statsData, error: statsError } = await supabase.rpc("get_campaign_stats", {
    p_campaign_id: null,
    p_client_id: clientId ?? null,
    p_client_sequencer_id: clientSequencerId ?? null,
    p_start_date: today,
  });

  console.log(statsData, 'statsData');

  if (statsError) {
    console.error("Error fetching today's campaign stats:", statsError);
    throw statsError;
  }

  const statsArray: CampaignStats[] = (statsData?.stats as any[]) ?? [];

  // 2) Fetch campaign metadata via client_sequencers → clients
  let campaignsQuery = supabase
    .from("campaigns")
    .select(`
      id,
      name,
      status,
      created_at,
      client_sequencer_id,
      client_sequencers (
        id,
        client_id,
        clients (
          id,
          name
        )
      )
    `);

  if (clientSequencerId) {
    campaignsQuery = campaignsQuery.eq("client_sequencer_id", clientSequencerId);
  } else if (clientId) {
    // filter via the join
    campaignsQuery = campaignsQuery.eq("client_sequencers.client_id", clientId);
  }

  const { data: campaignsData, error: campaignsError } = await campaignsQuery;

  if (campaignsError) {
    console.error("Error fetching campaigns:", campaignsError);
    throw campaignsError;
  }

  // 3) Build map campaign_id → stats for today
  const statsMap = new Map<number, CampaignStats>(
    statsArray.map((stat: any) => [stat.campaign_id as number, stat as CampaignStats])
  );

  // 4) Merge stats + campaign metadata
  const result: CampaignWithTodayStats[] = (campaignsData || []).map((campaign: any) => {
    const stats = statsMap.get(campaign.id);

    console.log(stats, 'stats');

    const cs = campaign.client_sequencers as any | null;
    const client = cs?.clients as any | null;

    return {
      ...stats,
      campaign_name: campaign.name,
      status: campaign.status,
      client_name: client?.name ?? "",
      client_id: cs?.client_id ?? null,
      created_at: campaign.created_at,
    } as CampaignWithTodayStats;
  }).filter(campaign => campaign?.stats_date);

  return result;
}


