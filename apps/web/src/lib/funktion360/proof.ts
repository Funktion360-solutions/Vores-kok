import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {returnPath} from './signin-checks.ts';
type Proof={v:1,next:string,issued:number,nonce:string};
function key(value:string) {if(!/^[a-f0-9]{64}$/i.test(value))throw new Error('SSO cookie key requires 32 random bytes');return Buffer.from(value,'hex');}
export function issueProof(next:string,secret:string,now=Date.now()) {
  const payload:Proof={v:1,next:returnPath(next),issued:now,nonce:randomBytes(32).toString('base64url')};
  const body=Buffer.from(JSON.stringify(payload)).toString('base64url');
  return body+'.'+createHmac('sha256',key(secret)).update(body).digest('base64url');
}
export function verifyProof(value:string|undefined,secret:string,now=Date.now()):Proof|undefined {
  if(!value || value.length>8192)return undefined;
  try{
    const [body,signature,extra]=value.split('.');
    if(!body || !signature || extra!==undefined || !/^[A-Za-z0-9_-]{43}$/.test(signature))return undefined;
    const expected=createHmac('sha256',key(secret)).update(body).digest();
    const actual=Buffer.from(signature,'base64url');
    if(expected.length!==actual.length || !timingSafeEqual(expected,actual))return undefined;
    const payload=JSON.parse(Buffer.from(body,'base64url').toString()) as Proof;
    if(payload.v!==1 || !Number.isFinite(payload.issued) || now<payload.issued || now-payload.issued>300_000 || typeof payload.next!=='string' || !/^[A-Za-z0-9_-]{43}$/.test(payload.nonce))return undefined;
    return {...payload,next:returnPath(payload.next)};
  }catch{return undefined;}
}
