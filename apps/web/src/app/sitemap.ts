import type { MetadataRoute } from 'next';
export default function sitemap():MetadataRoute.Sitemap {
 const base=process.env.NEXT_PUBLIC_SITE_URL??'https://voreskok.funktion360.dk';
 return ['/om','/funktioner'].map(path=>({url:new URL(path,base).href}));
}
