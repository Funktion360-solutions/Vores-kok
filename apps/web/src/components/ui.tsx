import clsx from 'clsx';
import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-dark shadow-sm',
  secondary: 'bg-paper text-ink border border-line hover:bg-sand',
  ghost: 'text-ink-soft hover:bg-sand hover:text-ink',
  danger: 'bg-danger text-white hover:opacity-90',
  soft: 'bg-brand-soft text-brand-dark hover:bg-brand-soft/70',
};
const sizes: Record<Size, string> = {
  sm: 'min-h-9 px-3 text-sm gap-1.5',
  md: 'min-h-11 px-4 text-[15px] gap-2',
  lg: 'min-h-12 px-5 text-base gap-2',
};

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', extra?: string) {
  return clsx(
    'inline-flex items-center justify-center rounded-full font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none select-none',
    variants[variant], sizes[size], extra,
  );
}

export function Button({ variant = 'primary', size = 'md', className, type = 'button', ...props }: ComponentProps<'button'> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}

export function LinkButton({ variant = 'primary', size = 'md', className, ...props }: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

export function IconButton({ label, className, children, ...props }: ComponentProps<'button'> & { label: string }) {
  return (
    <button type="button" aria-label={label} title={label}
      className={clsx('inline-flex size-11 items-center justify-center rounded-full text-ink-soft hover:bg-sand hover:text-ink transition-colors disabled:opacity-50', className)}
      {...props}>
      {children}
    </button>
  );
}

const fieldBase = 'w-full rounded-xl border border-line bg-paper px-3.5 text-[15px] text-ink placeholder:text-ink-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25 aria-[invalid=true]:border-danger';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={clsx(fieldBase, 'min-h-11 py-2', className)} {...props} />;
}
export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={clsx(fieldBase, 'py-2.5 leading-relaxed', className)} {...props} />;
}
export function Select({ className, ...props }: ComponentProps<'select'>) {
  return <select className={clsx(fieldBase, 'min-h-11 py-2 pr-8', className)} {...props} />;
}

export function Field({ label, htmlFor, error, hint, children, className }: { label: string; htmlFor?: string; error?: string | undefined; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={clsx('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">{label}</label>
      {children}
      {hint && !error ? <p className="text-xs text-ink-muted">{hint}</p> : null}
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return <div className={clsx('rounded-[var(--radius-card)] border border-line bg-paper', className)} {...props} />;
}

export function Badge({ tone = 'neutral', className, ...props }: ComponentProps<'span'> & { tone?: 'neutral' | 'brand' | 'sage' | 'honey' }) {
  const tones = { neutral: 'bg-sand text-ink-soft', brand: 'bg-brand-soft text-brand-dark', sage: 'bg-sage-soft text-sage', honey: 'bg-honey-soft text-ink' };
  return <span className={clsx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', tones[tone], className)} {...props} />;
}

export function Alert({ tone = 'danger', children }: { tone?: 'danger' | 'info' | 'success'; children: ReactNode }) {
  const tones = { danger: 'bg-danger-soft text-danger border-danger/20', info: 'bg-honey-soft text-ink border-honey/30', success: 'bg-sage-soft text-sage border-sage/30' };
  return <div role={tone === 'danger' ? 'alert' : 'status'} className={clsx('rounded-xl border px-4 py-3 text-sm', tones[tone])}>{children}</div>;
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: string; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? <div className="mb-1 text-sm text-ink-muted">{eyebrow}</div> : null}
        <h1 className="text-3xl font-semibold text-ink sm:text-4xl">{title}</h1>
        {subtitle ? <p className="mt-1.5 text-ink-soft">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 no-print">{actions}</div> : null}
    </header>
  );
}

export function EmptyState({ title, children, action, icon }: { title: string; children?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-[var(--radius-card)] border border-dashed border-line bg-paper/60 px-6 py-14 text-center">
      {icon ? <div className="mb-3 text-brand">{icon}</div> : null}
      <h2 className="text-xl font-semibold">{title}</h2>
      {children ? <div className="mt-2 max-w-md text-ink-soft">{children}</div> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <span aria-hidden className={clsx('inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent', className)} />;
}
