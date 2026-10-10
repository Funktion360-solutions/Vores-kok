'use client';
import { useRouter } from 'next/navigation';
import { browserDb } from '@/lib/client';
export function SignOut() {
  const router = useRouter();
  return (
    <button
      className="secondary"
      onClick={async () => {
        await browserDb().auth.signOut();
        router.push('/');
        router.refresh();
      }}
    >
      Log ud af AkselsMad
    </button>
  );
}
