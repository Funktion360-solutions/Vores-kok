'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="section reading">
      <h1>Køkkenet kunne ikke åbnes lige nu.</h1>
      <p>Der opstod en fejl ved hentning af indholdet. Prøv igen om lidt.</p>
      <button onClick={reset}>Prøv igen</button>
    </section>
  );
}
