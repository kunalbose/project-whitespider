'use client';

import { useEffect, useState, useMemo } from 'react';
import { getAllCampaignsTodayStats, CampaignWithTodayStats } from '@/lib/queries/campaignStats';
import { useDashboardStore } from '@/stores/dashboardStore';
import ClientSelector from '@/components/ClientSelector';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ClientSequencerSelector from '@/components/ClientSequencerSelector';

type SortField = 'name' | 'sent' | 'replies' | 'bounces' | 'reply_rate' | 'bounce_rate' | 'created_at';
type SortDirection = 'asc' | 'desc';
type StatusFilter = 'all' | 'active' | 'paused' | 'completed';

export default function CampaignStatsPage() {
  const { selectedClientID, selectedClientSequencerID, setSelectedClientID, setSelectedClientSequencerID } = useDashboardStore();
  const [campaigns, setCampaigns] = useState<CampaignWithTodayStats[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter and sort states
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  useEffect(() => {
    fetchCampaigns();
    console.log('fetching stats');
  }, [selectedClientID, selectedClientSequencerID]);

  async function fetchCampaigns() {
    setLoading(true);
    try {
      const clientId = selectedClientID ? Number(selectedClientID) : undefined;
      const clientSequencerId = selectedClientSequencerID ? Number(selectedClientSequencerID) : undefined;
      const data = await getAllCampaignsTodayStats(clientId, clientSequencerId);
      console.log(data, 'data');
      setCampaigns(data);
    } catch (error) {
      console.error('Error fetching campaigns:', error);
    } finally {
      setLoading(false);
    }
  }

  // Filter and sort campaigns
  const filteredAndSortedCampaigns = useMemo(() => {
    let filtered = [...campaigns];

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(c => c.status === statusFilter);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        c.campaign_name.toLowerCase().includes(query) ||
        c.client_name?.toLowerCase().includes(query)
      );
    }

    // Sort
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'name':
          aValue = a.campaign_name.toLowerCase();
          bValue = b.campaign_name.toLowerCase();
          break;
        case 'sent':
          aValue = a.sent_count;
          bValue = b.sent_count;
          break;
        case 'replies':
          aValue = a.reply_count;
          bValue = b.reply_count;
          break;
        case 'bounces':
          aValue = a.bounce_count;
          bValue = b.bounce_count;
          break;
        case 'reply_rate':
          aValue = a.reply_rate;
          bValue = b.reply_rate;
          break;
        case 'bounce_rate':
          aValue = a.bounce_rate;
          bValue = b.bounce_rate;
          break;
        case 'created_at':
          aValue = new Date(a.created_at || 0).getTime();
          bValue = new Date(b.created_at || 0).getTime();
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [campaigns, statusFilter, searchQuery, sortField, sortDirection]);

  const handleSortChange = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  return (
    <div className="p-6 bg-[#0f0f0f] text-white" style={{ height: 'calc(100vh - 61px)' }}>
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-3xl font-bold">Campaign Stats</h1>
            <p className="text-sm text-gray-400 mt-1">Showing today's stats for all campaigns</p>
          </div>
        </div>

        {/* Filters and Controls */}
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <ClientSelector />
          <ClientSequencerSelector />
          <button>Clear Client and Sequencer</button>

          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
            <SelectTrigger className="w-40 bg-gray-800 border-gray-700 text-white">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>

          <input
            type="text"
            placeholder="Search campaigns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />

        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-4 mb-4 text-sm">
          <span className="text-gray-400">Sort by:</span>
          <div className="flex gap-2">
            {(['name', 'sent', 'replies', 'reply_rate', 'bounce_rate', 'created_at'] as SortField[]).map((field) => (
              <button
                key={field}
                onClick={() => handleSortChange(field)}
                className={`px-3 py-1 rounded transition ${sortField === field
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
              >
                {field.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                {sortField === field && (
                  <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols gap-6">
        {/* Campaigns List */}
        <div className="lg:col-span-2">
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Today's Stats</h2>
              <span className="text-sm text-gray-400">
                {filteredAndSortedCampaigns.length} campaign{filteredAndSortedCampaigns.length !== 1 ? 's' : ''}
              </span>
            </div>
            {loading ? (
              <div className="text-center py-8">Loading campaigns...</div>
            ) : filteredAndSortedCampaigns.length === 0 ? (
              <div className="text-center py-8 text-gray-400">No campaigns found</div>
            ) : (
              <div className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto">
                {filteredAndSortedCampaigns.map((campaign) => (
                  <div
                    key={campaign.campaign_id}
                    className={`p-4 rounded border cursor-pointer transition border-gray-700 hover:border-gray-600`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-lg">{campaign.campaign_name}</h3>
                        <p className="text-sm text-gray-400">{campaign.client_name}</p>
                      </div>
                      <span
                        className={`px-2 py-1 rounded text-xs ${campaign.status === 'active'
                          ? 'bg-green-900/50 text-green-300'
                          : campaign.status === 'paused'
                            ? 'bg-yellow-900/50 text-yellow-300'
                            : 'bg-gray-700 text-gray-300'
                          }`}
                      >
                        {campaign.status}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-gray-400">Sent</div>
                        <div className="text-lg font-semibold">{campaign.sent_count}</div>
                      </div>
                      <div>
                        <div className="text-gray-400">Replies</div>
                        <div className="text-lg font-semibold text-green-400">{campaign.reply_count}</div>
                      </div>
                      <div>
                        <div className="text-gray-400">Bounces</div>
                        <div className="text-lg font-semibold text-red-400">{campaign.bounce_count}</div>
                      </div>
                      <div>
                        <div className="text-gray-400">Opens</div>
                        <div className="text-lg font-semibold text-blue-400">{campaign.open_count}</div>
                      </div>
                    </div>
                    {/* <div className="mt-2 flex gap-4 text-xs">
                      <span className="text-green-400">Reply: {campaign.reply_rate.toFixed(2)}%</span>
                      <span className="text-red-400">Bounce: {campaign.bounce_rate.toFixed(2)}%</span>
                      <span className="text-blue-400">Open: {campaign.open_rate.toFixed(2)}%</span>
                    </div> */}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
