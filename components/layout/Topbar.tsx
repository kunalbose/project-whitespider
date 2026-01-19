'use client'

import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'


import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { ChevronDown } from 'lucide-react'
import { useUserStore } from '@/stores/useUserStore'
import { usePathname } from 'next/navigation'

export default function Topbar() {
  const router = useRouter()
  const { email, setUser } = useUserStore()
  const pathname = usePathname()
  const heading: Record<string, string> = {
    '/': 'Unibox',
    '/leads': 'Leads',
    '/campaigns': 'Campaigns',
    '/inbox': 'Inbox',
    '/settings': 'Settings',
  };

  const handleSignOut = async () => {
    console.log('Signing out...')
    await supabase.auth.signOut()
    setUser(null, null, null)
    router.push('/login')
  }

  return (
    <div className="w-full bg-black border-b px-4 py-3 flex justify-between items-center shadow-sm">
      <h1 className="text-lg font-semibold text-white">{heading[pathname]}</h1>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="flex items-center gap-2 text-sm text-black">
            {email || 'User'}
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>{email || 'User'}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut}>Sign Out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
