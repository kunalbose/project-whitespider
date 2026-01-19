'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useUserStore } from '@/stores/useUserStore';

export default function HomePage() {
  const router = useRouter();
  const { email } = useUserStore()

  // useEffect(() => {
  //   if (email) {
  //     router.replace('/inbox');
  //   } else {
  //     router.replace('/login');
  //   }
  // }, [email]);

  return null;
}
