import type { MetadataRoute } from 'next';
export default function robots():MetadataRoute.Robots {
 const base=process.env.NEXT_PUBLIC_SITE_URL??'https://voreskok.funktion360.dk';
 return {rules:{userAgent:'*',allow:['/om','/funktioner'],disallow:['/recipes','/shopping','/plan','/kitchen','/family','/settings','/onboarding','/assistant','/import','/cook','/api','/auth','/login','/signup','/invite','/more']},sitemap:new URL('/sitemap.xml',base).href};
}
