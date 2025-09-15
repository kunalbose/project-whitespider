'use server'

import { createClient } from '@/utils/supabase/server'

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/login`
    }
  })

  if (error) {
    return { success: false, message: error.message }
  }

  const { error: profileError } = await supabase.from('profiles').insert({
    id: data.user?.id,
    email,
    role: 'client',
  })

  if (profileError) {
    return { success: false, message: 'Account already exists! Log in' }
  }

  return { success: true, message: 'Check your email to verify your account.' }
}
