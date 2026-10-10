import Link from 'next/link';
export default function NotFound() {
  return (
    <section className="section reading">
      <h1>Den opskrift kunne jeg ikke finde.</h1>
      <p>Den kan være flyttet eller endnu ikke udgivet.</p>
      <Link className="button" href="/opskrifter">
        Se opskrifterne
      </Link>
    </section>
  );
}
