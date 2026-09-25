'use client';
import { createContext, useContext, useState, type ReactNode } from 'react';

const Ctx = createContext<{ servings: number | null; setServings: (n: number) => void } | null>(null);

/** Shares the chosen number of servings between the scaler, cook mode link and shopping/plan actions. */
export function ServingsProvider({ initial, children }: { initial: number | null; children: ReactNode }) {
  const [servings, setServings] = useState(initial);
  return <Ctx.Provider value={{ servings, setServings }}>{children}</Ctx.Provider>;
}

export function useServings() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useServings outside ServingsProvider');
  return c;
}
