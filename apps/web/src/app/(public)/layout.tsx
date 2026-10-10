import Link from 'next/link';
import type { ReactNode } from 'react';
import { Wordmark } from '@/components/brand';
export default function PublicLayout({children}:{children:ReactNode}) {
 return <div className="vk-public"><a href="#main" className="vk-public-skip">Spring til indhold</a><header className="vk-public-header"><Link href="/om" aria-label="Vores Kok forside"><Wordmark /></Link><nav aria-label="Offentlig hovedmenu"><Link href="/funktioner">Funktioner</Link><Link href="/login">Log ind</Link><Link className="vk-public-button" href="/signup">Opret konto</Link></nav></header><main id="main">{children}</main><footer className="vk-public-footer"><div><Wordmark /><p>Familiens opskrifter. Hverdagens køkken.</p></div><nav aria-label="Sidefod"><Link href="/funktioner">Funktioner</Link><Link href="/om#data">Data og AI</Link><Link href="/login">Åbn din kogebog</Link></nav><p>Vores Kok · Et produkt fra Funktion360</p></footer></div>;
}
