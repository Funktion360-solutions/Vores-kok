import type { Metadata } from 'next';
import Link from 'next/link';
import '@fontsource-variable/fraunces';
import '@fontsource-variable/inter';
import './globals.css';
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://akselsmad.dk'),
  title: { default: 'AkselsMad – Opskrifter af Aksel Slot', template: '%s | AkselsMad' },
  description:
    'Madglæde, italiensk inspiration og bagning. Detaljerede opskrifter fra Aksel Slots køkken.',
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="da">
      <body>
        <a className="skip" href="#main">
          Spring til indhold
        </a>
        <header className="site-header">
          <Link className="wordmark" href="/">
            Aksels<span>Mad</span>
            <small>OPSKRIFTER AF AKSEL SLOT</small>
          </Link>
          <nav aria-label="Hovednavigation">
            <Link href="/opskrifter">Opskrifter</Link>
            <Link href="/opskrifter?kategori=Boller">Bagning</Link>
            <Link href="/opskrifter?q=italiensk">Italiensk</Link>
            <Link href="/guides">Guides</Link>
            <Link href="/blog">Blog</Link>
            <Link href="/forloeb">Temaforløb</Link>
            <Link href="/kogeboeger">Kogebøger</Link>
            <Link href="/om">Om Aksel</Link>
            <Link className="nav-account" href="/konto">
              Mit køkken ↗
            </Link>
          </nav>
        </header>
        <main id="main">{children}</main>
        <footer className="site-footer">
          <div>
            <Link className="wordmark" href="/">
              Aksels<span>Mad</span>
            </Link>
            <p>
              Mad skal være en glæde.
              <br />
              Både at lave og at dele.
            </p>
          </div>
          <div>
            <Link href="/opskrifter">Find din næste opskrift</Link>
            <Link href="/om">Historien bag AkselsMad</Link>
            <Link href="/login">Funktion360-login</Link>
            <Link href="/nyhedsbrev">Nyhedsbrev fra mit køkken</Link>
            <Link href="/privatliv">Privatliv</Link>
          </div>
          <small>© {new Date().getFullYear()} Aksel Slot · Et produkt fra Funktion360</small>
        </footer>
      </body>
    </html>
  );
}
