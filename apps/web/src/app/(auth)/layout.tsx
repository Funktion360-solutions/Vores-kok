import type { ReactNode } from 'react';
import { Wordmark } from '@/components/brand';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-brand lg:block" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.18),transparent_55%)]" />
        <div className="relative flex h-full flex-col justify-end p-14 text-white">
          <p className="font-display text-4xl leading-tight">“Mere smør.”</p>
          <p className="mt-3 max-w-md text-lg text-white/85">Familiens opskrifter, historierne bag dem og hverdagens madlavning — samlet ét sted.</p>
        </div>
      </div>
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-10"><Wordmark /></div>
          {children}
        </div>
      </div>
    </div>
  );
}
