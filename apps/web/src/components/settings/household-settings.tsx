'use client';
import { createInvite, deleteHousehold, removeMember, renameHousehold, revokeInvite, setMemberRole, toDataError, type Household, type HouseholdInvite, type HouseholdMember } from '@vores-kok/database';
import { assignableRoles, can, formatDate, ROLE_DESCRIPTIONS, ROLE_LABELS, type HouseholdRole } from '@vores-kok/domain';
import { householdNameSchema } from '@vores-kok/validation';
import { Check, Copy, Link2, UserMinus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import { getBrowserClient } from '@/lib/supabase/client';
import { Alert, Badge, Button, Card, Field, Input, Select } from '../ui';

export function HouseholdSettings({ household, members, invites, siteUrl }: { household: Household; members: HouseholdMember[]; invites: HouseholdInvite[]; siteUrl: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string }>();
  const [link, setLink] = useState<string>();
  const [copied, setCopied] = useState(false);
  const [inviteRole, setInviteRole] = useState<Exclude<HouseholdRole, 'owner'>>('member');
  const [inviteEmail, setInviteEmail] = useState('');
  const [pending, start] = useTransition();
  const role = household.role;

  const run = (fn: () => Promise<void>, ok?: string) => start(async () => {
    try { await fn(); if (ok) setMsg({ tone: 'success', text: ok }); router.refresh(); } catch (e) { setMsg({ tone: 'danger', text: toDataError(e).message }); }
  });

  function rename(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = householdNameSchema.safeParse(new FormData(e.currentTarget).get('name'));
    if (!parsed.success) return setMsg({ tone: 'danger', text: parsed.error.issues[0]?.message ?? '' });
    run(() => renameHousehold(getBrowserClient(), household.id, parsed.data), 'Navnet er gemt.');
  }

  const openInvites = invites.filter((i) => !i.accepted_at && !i.revoked_at && new Date(i.expires_at) > new Date());
  const self = members.find((m) => m.is_me);

  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold">Husstand</h2>
      <p className="mt-1 text-sm text-ink-muted">Din rolle: {ROLE_LABELS[role]} — {ROLE_DESCRIPTIONS[role]}</p>
      {msg ? <div className="mt-4"><Alert tone={msg.tone}>{msg.text}</Alert></div> : null}

      {can(role, 'household.rename') ? (
        <form onSubmit={rename} className="mt-5 flex items-end gap-2">
          <Field label="Navn" htmlFor="hh-name" className="flex-1"><Input id="hh-name" name="name" defaultValue={household.name} maxLength={100} /></Field>
          <Button type="submit" variant="secondary" disabled={pending}>Gem</Button>
        </form>
      ) : null}

      <h3 className="mb-2 mt-8 font-display text-lg font-semibold">Medlemmer</h3>
      <ul className="divide-y divide-line">
        {members.map((m) => {
          const options = assignableRoles(role);
          const canManage = !m.is_me && can(role, 'member.manage') && (role === 'owner' || (m.role !== 'owner' && m.role !== 'admin'));
          return (
            <li key={m.user_id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{m.display_name}{m.is_me ? <span className="text-ink-muted"> (dig)</span> : null}</div>
                <div className="text-xs text-ink-muted">Medlem siden {formatDate(m.joined_at)}</div>
              </div>
              {canManage ? (
                <>
                  <Select aria-label={`Rolle for ${m.display_name}`} value={m.role} className="w-auto" disabled={pending}
                    onChange={(e) => run(() => setMemberRole(getBrowserClient(), household.id, m.user_id, e.target.value as HouseholdRole), 'Rollen er ændret.')}>
                    {[...new Set<HouseholdRole>([m.role, ...options])].map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </Select>
                  <button type="button" className="rounded-full p-2 text-danger hover:bg-danger-soft" aria-label={`Fjern ${m.display_name}`}
                    onClick={() => { if (confirm(`Fjern ${m.display_name} fra husstanden?`)) run(() => removeMember(getBrowserClient(), household.id, m.user_id), 'Medlemmet er fjernet.'); }}>
                    <UserMinus className="size-4" />
                  </button>
                </>
              ) : <Badge tone={m.role === 'owner' ? 'brand' : 'neutral'}>{ROLE_LABELS[m.role]}</Badge>}
            </li>
          );
        })}
      </ul>

      {can(role, 'member.invite') ? (
        <>
          <h3 className="mb-2 mt-8 font-display text-lg font-semibold">Invitér familien</h3>
          <div className="grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
            <Field label="E-mail (valgfri)" htmlFor="inv-email" hint="Hvis udfyldt, kan kun den e-mail bruge linket."><Input id="inv-email" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} /></Field>
            <Field label="Rolle" htmlFor="inv-role">
              <Select id="inv-role" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as Exclude<HouseholdRole, 'owner'>)}>
                {(role === 'owner' ? (['admin', 'member', 'viewer'] as const) : (['member', 'viewer'] as const)).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </Select>
            </Field>
            <Button disabled={pending} onClick={() => run(async () => {
              const token = await createInvite(getBrowserClient(), household.id, inviteRole, inviteEmail.trim() || null);
              setLink(`${siteUrl}/invite/${token}`);
              setCopied(false);
              setInviteEmail('');
            })}><Link2 className="size-4" aria-hidden /> Lav link</Button>
          </div>
          {link ? (
            <div className="mt-3 rounded-xl bg-sage-soft p-3 text-sm">
              <p className="mb-2 text-sage">Send dette link — det virker i 14 dage og kan kun bruges én gang. Det vises kun nu.</p>
              <div className="flex gap-2">
                <Input readOnly value={link} aria-label="Invitationslink" onFocus={(e) => e.currentTarget.select()} />
                <Button variant="secondary" onClick={async () => { await navigator.clipboard.writeText(link); setCopied(true); }}>{copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? 'Kopieret' : 'Kopiér'}</Button>
              </div>
            </div>
          ) : null}
          {openInvites.length ? (
            <ul className="mt-4 divide-y divide-line text-sm">
              {openInvites.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-2 py-2">
                  <span>{i.email ?? 'Åbent link'} · {ROLE_LABELS[i.role]} · udløber {formatDate(i.expires_at)}</span>
                  <Button size="sm" variant="ghost" onClick={() => run(() => revokeInvite(getBrowserClient(), i.id), 'Invitationen er trukket tilbage.')}>Tilbagekald</Button>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}

      <div className="mt-8 flex flex-wrap gap-2 border-t border-line pt-5">
        {self ? (
          <Button variant="ghost" onClick={() => { if (confirm('Forlad husstanden? Du mister adgangen til opskrifterne.')) run(async () => { await removeMember(getBrowserClient(), household.id, self.user_id); router.replace('/onboarding'); }); }}>Forlad husstanden</Button>
        ) : null}
        {can(role, 'household.delete') ? (
          <Button variant="ghost" className="text-danger" onClick={() => {
            const answer = prompt(`Skriv husstandens navn for at slette den og ALLE opskrifter permanent:\n${household.name}`);
            if (answer === household.name) run(async () => { await deleteHousehold(getBrowserClient(), household.id); router.replace('/onboarding'); });
          }}>Slet husstand</Button>
        ) : null}
      </div>
    </Card>
  );
}
