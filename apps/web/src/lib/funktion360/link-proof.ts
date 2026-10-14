import {createHmac} from 'node:crypto';
import {issueProof,verifyProof} from './proof.ts';
import {pilotUser} from './signin-checks.ts';
function linkingKey(secret:string){return createHmac('sha256',Buffer.from(secret,'hex')).update('funktion360-account-link-v1').digest('hex');}
export function issueLinkProof(localId:string,secret:string,now=Date.now()) {
  if(!pilotUser(localId) || !/^[a-f0-9]{64}$/i.test(secret))throw new Error('Invalid linking proof configuration');
  return issueProof('/link/'+localId,linkingKey(secret),now);
}
export function verifyLinkProof(value:string|undefined,secret:string,now=Date.now()) {
  if(!/^[a-f0-9]{64}$/i.test(secret))return undefined;
  const proof=verifyProof(value,linkingKey(secret),now);
  const id=proof?.next.startsWith('/link/')?proof.next.slice(6):undefined;
  return id && pilotUser(id)?{localId:id}:undefined;
}
