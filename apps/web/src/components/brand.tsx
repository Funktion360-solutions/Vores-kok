export function BrandMark({ className = 'size-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="16" fill="var(--vk-terracotta)" />
      <path d="M14 30h36v6a14 14 0 0 1-14 14h-8a14 14 0 0 1-14-14z" fill="var(--vk-cream)" />
      <path d="M10 30h44" stroke="var(--vk-cream)" strokeWidth="4" strokeLinecap="round" />
      <path d="M26 22c0-3 3-3 3-6M35 22c0-3 3-3 3-6" stroke="var(--vk-terracotta-soft)" strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <BrandMark />
      <span className="font-display text-xl font-semibold tracking-tight text-ink">Vores Kok</span>
    </span>
  );
}
