'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Loader from '@/components/loader/Loader'
import { createClient } from '@/utils/supabase/client'
import { useUserStore } from '@/stores/useUserStore'


const Page = () => {
  const router = useRouter()
  const setUser = useUserStore((s) => s.setUser)

  useEffect(() => {
    // const checkRoleAndRedirect = async () => {
    //   const supabase = createClient()

    //   const {
    //     data: { user },
    //   } = await supabase.auth.getUser()

    //   if (!user) {
    //     router.push('/login')
    //     return
    //   }

    //   const { data: profile, error } = await supabase
    //     .from('profiles')
    //     .select('role, client_id, email')
    //     .eq('id', user.id)
    //     .single()

    //   if (error || !profile) {
    //     router.push('/signup')
    //     return
    //   }

    //   console.log(profile, 'profile')

    //   setUser(profile.role, profile.client_id ?? null, profile.email ?? null)

    //   if (profile.role === 'admin') {
    //     router.push('/inbox')
    //   } else {
    //     router.push('/inbox')
    //   }
    // }

    // checkRoleAndRedirect()
    // router.push('/inbox');
  }, [router, setUser])

  return <Loader />
}

export default Page
