import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { isIP } from 'node:net';
export function isPublicIPv4(address: string): boolean {
  if (isIP(address) !== 4) return false;
  const [a, b] = address.split('.').map(Number);
  return !(a === 0 || a === 10 || a === 127 || a! >= 224 || a === 169 && b === 254 || a === 172 && b! >= 16 && b! <= 31 || a === 192 && [0, 168].includes(b!) || a === 100 && b! >= 64 && b! <= 127 || a === 198 && [18, 19, 51].includes(b!) || a === 203 && b === 0);
}
export async function fetchRecipeUrl(raw: string, redirects = 0): Promise<{ html: string; url: string }> {
  if (redirects > 3) throw new Error('For mange viderestillinger.');
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.username || url.password || url.port && url.port !== '443' || isIP(url.hostname)) throw new Error('Brug en offentlig HTTPS-hjemmeside uden login eller særlig port.');
  const addresses = await lookup(url.hostname, { all: true, family: 4 });
  if (!addresses.length || addresses.some(a => !isPublicIPv4(a.address))) throw new Error('Adressen er ikke tilladt.');
  const result = await new Promise<{ status: number; location?: string; html: string }>((resolve, reject) => {
    const req = request(url, {
      headers: { 'User-Agent': 'VoresKok-RecipeImporter/1.0', Accept: 'text/html', 'Accept-Encoding': 'identity' },
      // Pin the validated address. A second DNS lookup cannot rebind it to a private IP.
      lookup: (_hostname, options, callback) => {
        // Node may request either the scalar or all-address callback overload.
        const done = callback as (...args: unknown[]) => void;
        if (typeof options === 'object' && 'all' in options && options.all) done(null, [addresses[0]!]);
        else done(null, addresses[0]!.address, 4);
      },
    }, res => {
      const status = res.statusCode ?? 500;
      if ([301,302,303,307,308].includes(status)) { res.destroy(); resolve({ status, location: res.headers.location, html: '' }); return; }
      if (status !== 200 || !(res.headers['content-type'] ?? '').includes('text/html') || res.headers['content-encoding'] && res.headers['content-encoding'] !== 'identity') { res.destroy(); reject(new Error('Siden kunne ikke hentes. Indsæt opskriftsteksten i stedet.')); return; }
      let size = 0; const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => { size += chunk.length; if (size > 2 * 1024 * 1024) { res.destroy(); reject(new Error('Hjemmesiden er for stor.')); } else chunks.push(chunk); });
      res.on('end', () => resolve({ status, html: Buffer.concat(chunks).toString('utf8') }));
      res.on('error', reject);
    });
    const timer = setTimeout(() => req.destroy(new Error('Hjemmesiden svarede ikke i tide.')), 12000);
    req.on('close', () => clearTimeout(timer)); req.on('error', reject); req.end();
  });
  if (result.location) return fetchRecipeUrl(new URL(result.location, url).href, redirects + 1);
  if (result.status !== 200) throw new Error('Ugyldig viderestilling.');
  return { html: result.html, url: url.href };
}
const decode = (text: string) => text.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
export function extractRecipeSource(html: string): { text: string; structured: boolean } {
  const recipes: Record<string, unknown>[] = [];
  const visit = (value: unknown, depth = 0) => {
    if (depth > 30 || recipes.length >= 10) return;
    if (Array.isArray(value)) { value.forEach(v => visit(v, depth + 1)); return; }
    if (!value || typeof value !== 'object') return;
    const obj = value as Record<string, unknown>;
    const types = Array.isArray(obj['@type']) ? obj['@type'] : [obj['@type']];
    if (types.includes('Recipe')) recipes.push(obj);
    else Object.values(obj).forEach(v => visit(v, depth + 1));
  };
  for (const match of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { visit(JSON.parse(match[1]!)); } catch { /* Other website data is not an import failure. */ }
  }
  if (recipes.length) return { text: JSON.stringify(recipes).slice(0, 60000), structured: true };
  const text = decode(html.replace(/<(script|style|nav|footer)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<[^>]+>/g, '\n')).replace(/\n\s*\n/g, '\n').trim();
  if (!text) throw new Error('Ingen opskriftstekst på siden.');
  if (text.length > 60000) throw new Error('Siden indeholder for meget tekst. Kopiér kun opskriften ind.');
  return { text, structured: false };
}

/** Complete JSON-LD recipes can be mapped without an AI call. */
export function mapStructuredRecipes(text: string) {
  const values: unknown = JSON.parse(text);
  if (!Array.isArray(values)) return null;
  const flattenSteps = (value: unknown): string[] => {
    if (typeof value === 'string') return value.split(/\n+/).filter(Boolean);
    if (Array.isArray(value)) return value.flatMap(flattenSteps);
    if (value && typeof value === 'object') {
      const object = value as Record<string, unknown>;
      if (object.itemListElement) return flattenSteps(object.itemListElement);
      if (typeof object.text === 'string') return [object.text];
    }
    return [];
  };
  const duration = (value: unknown) => {
    if (typeof value !== 'string') return null;
    const match = value.match(/^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
    return match ? Number(match[1] ?? 0) * 1440 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0) + Math.ceil(Number(match[4] ?? 0) / 60) : null;
  };
  const result = [];
  for (const value of values) {
    if (!value || typeof value !== 'object') return null;
    const r = value as Record<string, unknown>;
    if (typeof r.name !== 'string' || !Array.isArray(r.recipeIngredient) || !r.recipeIngredient.every(i => typeof i === 'string')) return null;
    const steps = flattenSteps(r.recipeInstructions);
    if (!steps.length || !r.recipeIngredient.length) return null;
    const yieldText = typeof r.recipeYield === 'string' || typeof r.recipeYield === 'number' ? String(r.recipeYield) : null;
    const yieldMatch = yieldText?.match(/^(\d+)\s*(.*)$/);
    result.push({ title: decode(r.name), description: typeof r.description === 'string' ? decode(r.description.replace(/<[^>]*>/g, '')) : null,
      servings: yieldMatch ? Number(yieldMatch[1]) : null, yield_unit: yieldMatch?.[2] || null,
      prep_minutes: duration(r.prepTime), cook_minutes: duration(r.cookTime), total_minutes: duration(r.totalTime),
      ingredients: r.recipeIngredient.map(i => decode(i)), steps: steps.map(s => decode(s.replace(/<[^>]*>/g, ''))),
      notes: null, warnings: ['Automatisk udtræk fra hjemmesidens opskriftsdata. Kontrollér portioner, mængder og trin.'], original_text: text });
  }
  return result;
}
