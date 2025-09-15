'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { LayoutDashboard, Menu, Inbox } from 'lucide-react';
import clsx from 'clsx';

const links = [
  // { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/inbox', label: 'Unibox', icon: Inbox },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(true);

  return (
    <aside
      className={clsx(
        'h-screen bg-black p-4 transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="bg-white mb-6 focus:outline-none cursor-pointer rounded p-1"
      >
        <Menu className="h-6 w-6" />
      </button>

      <nav className="space-y-2">
        {links.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center px-3 py-2 rounded hover:bg-gray-200 transition-colors',
                collapsed ? 'justify-center' : 'space-x-3',
                isActive && 'bg-gray-300 font-semibold rounded-md shadow-[0_2px_6px_rgba(147,197,253,0.5)]'
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span className="whitespace-nowrap">{label}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
