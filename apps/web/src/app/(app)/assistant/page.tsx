import { listPantryItems } from '@vores-kok/database';
import { formatQuantity } from '@vores-kok/domain';
import { requireHousehold } from '@/lib/session';
import { PageHeader } from '@/components/ui';
import { Assistant } from '@/components/assistant';
export default async function AssistantPage({ searchParams }: { searchParams: Promise<{ pantry?: string }> }) {
  const { db, household } = await requireHousehold();
  const { pantry } = await searchParams;
  let initialMessage = '';
  if (pantry === '1') {
    const items = (await listPantryItems(db, household.id)).filter(item => item.quantity === null || item.quantity > 0);
    if (items.length) {
      initialMessage = 'Hvad kan jeg lave med disse registrerede råvarer? Foreslå retter og sig, hvad jeg ellers skal bruge. Lageret kan være forældet.\n';
      let included = 0;
      for (const item of items.slice(0, 200)) {
        const line = [item.quantity !== null ? formatQuantity(item.quantity) : '', item.unit ?? '', item.name].filter(Boolean).join(' ');
        if (initialMessage.length + line.length + 1 > 1850) break;
        initialMessage += `${line}\n`; included++;
      }
      if (included < items.length) initialMessage += `\nViser ${included} af ${items.length} registrerede varer. Tilpas gerne listen.`;
    } else initialMessage = 'Mit registrerede køkkenlager er tomt. Hjælp mig med en opskrift ud fra disse ingredienser: ';
  }
  return <div className="mx-auto max-w-3xl"><PageHeader title="Vores Kok AI" /><Assistant key={`${household.id}:${pantry ?? ''}`} householdId={household.id} initialMessage={initialMessage} /></div>;
}
