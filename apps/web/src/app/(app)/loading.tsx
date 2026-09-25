export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Indlæser" className="animate-pulse">
      <div className="mb-6 h-10 w-64 rounded-xl bg-sand" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="aspect-[4/3] rounded-[var(--radius-card)] bg-sand" />)}
      </div>
    </div>
  );
}
