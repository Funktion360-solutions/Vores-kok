import { EmptyState, LinkButton } from '@/components/ui';

export default function NotFound() {
  return <EmptyState title="Siden findes ikke" action={<LinkButton href="/">Til forsiden</LinkButton>}>Opskriften er måske slettet, eller du har ikke adgang til den.</EmptyState>;
}
