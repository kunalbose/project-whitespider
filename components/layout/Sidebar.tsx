'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { LayoutDashboard, Menu, Inbox, BarChart3, Users, Settings, View } from 'lucide-react';
import clsx from 'clsx';
import { getAllCampaignsTodayStats } from '@/lib/queries/campaignStats';
import { useDashboardStore } from '@/stores/dashboardStore';

const links = [
  { href: '/inbox', label: 'Unibox', icon: Inbox },
  { href: '/leads', label: 'Leads', icon: Users },
  { href: '/campaigns', label: 'Campaign Stats', icon: BarChart3 },
  { href: '/views', label: 'Views', icon: View },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { selectedClientID } = useDashboardStore();
  const [campaignStats, setCampaignStats] = useState({
    totalCampaigns: 0,
    totalSent: 0,
    totalReplies: 0,
    totalBounces: 0,
    replyRate: 0,
  });
  // const [statsLoading, setStatsLoading] = useState(true);

  // useEffect(() => {
  //   async function fetchCampaignStats() {
  //     try {
  //       setStatsLoading(true);
  //       const clientId = selectedClientID ? Number(selectedClientID) : undefined;
  //       const campaigns = await getAllCampaignsTodayStats(clientId);

  //       const totals = campaigns.reduce((acc, campaign) => {
  //         acc.totalSent += campaign.sent_count;
  //         acc.totalReplies += campaign.reply_count;
  //         acc.totalBounces += campaign.bounce_count;
  //         return acc;
  //       }, { totalSent: 0, totalReplies: 0, totalBounces: 0 });

  //       const replyRate = totals.totalSent > 0 
  //         ? (totals.totalReplies / totals.totalSent) * 100 
  //         : 0;

  //       setCampaignStats({
  //         totalCampaigns: campaigns.length,
  //         totalSent: totals.totalSent,
  //         totalReplies: totals.totalReplies,
  //         totalBounces: totals.totalBounces,
  //         replyRate: replyRate,
  //       });
  //     } catch (error) {
  //       console.error('Error fetching campaign stats:', error);
  //       // Set to 0 on error to avoid showing stale data
  //       setCampaignStats({
  //         totalCampaigns: 0,
  //         totalSent: 0,
  //         totalReplies: 0,
  //         totalBounces: 0,
  //         replyRate: 0,
  //       });
  //     } finally {
  //       setStatsLoading(false);
  //     }
  //   }

  //   fetchCampaignStats();
  //   // Refresh stats every 30 seconds
  //   const interval = setInterval(fetchCampaignStats, 30000);
  //   return () => clearInterval(interval);
  // }, [selectedClientID]);

  return (
    <aside
      className={clsx(
        'h-screen bg-black border-r border-gray-800 p-4 transition-all duration-300 flex flex-col',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="bg-gray-800 hover:bg-gray-700 text-white mb-6 focus:outline-none cursor-pointer rounded p-2 transition-colors"
      >
        <Menu className="h-4 w-4" />
      </button>

      <nav className="space-y-2 flex-1">
        {links.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname?.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center px-3 py-2 rounded transition-colors text-white',
                collapsed ? 'justify-center' : 'space-x-3',
                isActive
                  ? 'bg-purple-600 hover:bg-purple-700 font-semibold'
                  : 'hover:bg-gray-800'
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span className="whitespace-nowrap">{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Campaign Stats Section */}
      {/* {!collapsed && (
        <div className="mt-auto pt-4 border-t border-gray-800">
          <div className="text-xs text-gray-400 mb-2 px-2 flex items-center justify-between">
            <span>Today's Stats</span>
            {statsLoading && (
              <span className="text-xs text-gray-500">Loading...</span>
            )}
          </div>
          <div className="space-y-2">
            <div className="bg-gray-900 rounded-lg p-3 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-xs">Campaigns</span>
                <span className="text-white font-semibold">
                  {statsLoading ? '-' : campaignStats.totalCampaigns}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-xs">Sent</span>
                <span className="text-white font-semibold">
                  {statsLoading ? '-' : campaignStats.totalSent.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-xs">Replies</span>
                <span className="text-green-400 font-semibold">
                  {statsLoading ? '-' : campaignStats.totalReplies.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-xs">Bounces</span>
                <span className="text-red-400 font-semibold">
                  {statsLoading ? '-' : campaignStats.totalBounces.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-gray-800">
                <span className="text-gray-400 text-xs">Reply Rate</span>
                <span className="text-green-400 font-semibold">
                  {statsLoading ? '-' : `${campaignStats.replyRate.toFixed(1)}%`}
                </span>
              </div>
            </div>
          </div>
        </div>
      )} */}
    </aside>
  );
}
