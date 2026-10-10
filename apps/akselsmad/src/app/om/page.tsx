import type { Metadata } from 'next';
import Link from 'next/link';
export const metadata: Metadata = { title: 'Om Aksel' };
export default function About() {
  return (
    <article className="section reading">
      <span className="eyebrow">HEJ, JEG HEDDER AKSEL</span>
      <h1>
        Madglæde.
        <br />
        Og drømme, der hæver.
      </h1>
      <p className="lede">
        Jeg drømmer om at blive kok og bager. Indtil da begynder det hele her: i køkkenet, med
        nysgerrighed og lysten til at lave noget godt.
      </p>
      <h2>Glæden ved at lave mad</h2>
      <p>
        For mig handler madlavning om glæden ved at skabe noget, som andre kan samles om. På
        AkselsMad deler jeg mine opskrifter med forklaringer og detaljer, så du kan tage dem med ind
        i dit eget køkken.
      </p>
      <h2>En kærlighed til Italien</h2>
      <p>
        Italien har en særlig plads i mit madunivers. Jeg holder af inspirationen fra det italienske
        køkken og af at lade råvarerne få plads.
      </p>
      <h2>Fra køkken til kogebog</h2>
      <p>
        Min plan er en dag at samle opskrifterne i trykte kogebøger. Først skal de have liv her,
        blive lavet og blive delt.
      </p>
      <Link className="button" href="/opskrifter">
        Gå på opdagelse i opskrifterne ↗
      </Link>
    </article>
  );
}
