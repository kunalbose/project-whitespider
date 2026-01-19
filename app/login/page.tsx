'use client'

import { login } from './actions'
import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { useUserStore } from '@/stores/useUserStore'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { email } = useUserStore()
  const router = useRouter();

  // useEffect(() => {
  //   router.replace('/inbox');
  // });

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <Card className="w-full max-w-md shadow-md">
        <CardContent className="p-6 space-y-6">
          <h1 className="text-2xl font-bold text-center">Unibox - Login</h1>

          <form
            action={async (formData) => {
              setIsSubmitting(true)
              await login(formData)
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                placeholder="you@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                placeholder="••••••••"
              />
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Logging in...' : 'Login'}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground">
            Don't have any account?{' '}
            <a href="/signup" className="text-blue-600 hover:underline">
              Signup
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
