export const PROVIDER='custom:funktion360-id';
export function verifiedLink(localId:string, expectedId:string, identities:Array<{provider:string}>|undefined) {
  return localId===expectedId && Boolean(identities?.some(i=>i.provider===PROVIDER));
}
export function linkEnabled(environment:string|undefined, flag:string|undefined) {
  return environment==='development' && flag==='true';
}
