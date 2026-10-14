export function returnPath(value:string|null|undefined):string {
  if(!value || !value.startsWith('/') || value.startsWith('//') || (value.includes('\\') || [...value].some(c=>c.charCodeAt(0)<=32))) return '/recipes';
  const url=new URL(value,'https://local.invalid');
  return url.origin==='https://local.invalid' ? url.pathname+url.search : '/recipes';
}
export function pilotUser(value:string|undefined):string|undefined {
  return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ? value:undefined;
}
