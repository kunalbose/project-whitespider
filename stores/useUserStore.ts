import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Role = 'admin' | 'client' | null

type UserStore = {
  role: Role
  clientId: number | null
  email: string | null
  setUser: (role: Role, clientId?: number | null, email?: string | null) => void
}

export const useUserStore = create<UserStore>()(
  persist(
    (set) => ({
      role: null,
      clientId: null,
      email: null,
      setUser: (role, clientId = null, email = null) =>
        set({ role, clientId, email }),
    }),
    {
      name: 'user-store',
    }
  )
)