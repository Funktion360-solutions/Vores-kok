import 'server-only';
import * as oidc from 'openid-client';
import {cookies} from 'next/headers';
import {join} from 'node:path';
import {PilotStore} from './store';
export const TX_COOKIE='vk_f360_pilot_tx';
export const SESSION_COOKIE='vk_f360_pilot_session';
export const cookieOptions={httpOnly:true,secure:false,sameSite:'lax' as const,path:'/auth/funktion360'};
export type Identity={subject:string,issuer:string};
type Transaction={state:string,nonce:string,verifier:string};
export function settings() {
  if(process.env.NODE_ENV!=='development' || process.env.F360_SSO_PILOT!=='true') throw new Error('Local SSO pilot is disabled');
  const issuer=process.env.F360_ID_ISSUER || '';
  const clientId=process.env.F360_ID_CLIENT_ID || '';
  const clientSecret=process.env.F360_ID_CLIENT_SECRET || '';
  const redirectUri='http://localhost:3001/auth/funktion360/callback';
  if(!clientId || !clientSecret || new URL(issuer).protocol!=='https:') throw new Error('Missing SSO configuration');
  return {issuer,clientId,clientSecret,redirectUri};
}
export function store(){return new PilotStore(join(process.cwd(),'.funktion360-sso-pilot'));}
export async function connect() {
  const cfg=settings();
  const client=await oidc.discovery(new URL(cfg.issuer),cfg.clientId,undefined,oidc.ClientSecretPost(cfg.clientSecret));
  client[oidc.customFetch]=async (input,init)=>{
    const response=await fetch(input,init as RequestInit);
    if(!response.ok){
      const path=new URL(String(input)).pathname;
      let providerCode='unavailable';
      try{
        const body=await response.clone().json();
        const candidate=body?.error_code || body?.code || body?.error;
        if(typeof candidate==='string' && /^[a-z][a-z0-9_]{0,79}$/.test(candidate)) providerCode=candidate;
      }catch{ /* Only machine-readable error codes are logged. */ }
      console.error('[Funktion360 SSO HTTP]',JSON.stringify({endpoint:path,status:response.status,providerCode}));
    }
    return response;
  };
  oidc.enableNonRepudiationChecks(client);
  return {cfg,client};
}
export async function start() {
  const {cfg,client}=await connect();
  const tx:Transaction={state:oidc.randomState(),nonce:oidc.randomNonce(),verifier:oidc.randomPKCECodeVerifier()};
  const url=oidc.buildAuthorizationUrl(client,{redirect_uri:cfg.redirectUri,response_type:'code',scope:'openid email profile',state:tx.state,nonce:tx.nonce,code_challenge:await oidc.calculatePKCECodeChallenge(tx.verifier),code_challenge_method:'S256'});
  const db=store();let binding:string;
  try {binding=db.put('transaction',tx,300_000);}finally{db.close();}
  (await cookies()).set(TX_COOKIE,binding,cookieOptions);
  return url;
}
export async function finish(search:string) {
  const jar=await cookies();const binding=jar.get(TX_COOKIE)?.value;
  jar.set(TX_COOKIE,'',{...cookieOptions,maxAge:0});
  if(!binding) throw new Error('Missing login binding');
  const db=store();let tx:Transaction|undefined;
  try{tx=db.take<Transaction>(binding,'transaction');}finally{db.close();}
  if(!tx)throw new Error('Expired or consumed login');
  const {cfg,client}=await connect();
  const callback=new URL(cfg.redirectUri+search);
  if(callback.searchParams.getAll('state').length!==1 || callback.searchParams.get('state')!==tx.state)throw new Error('Invalid state');
  const token=await oidc.authorizationCodeGrant(client,callback,{pkceCodeVerifier:tx.verifier,expectedState:tx.state,expectedNonce:tx.nonce,idTokenExpected:true});
  const claims=token.claims();if(!claims?.sub)throw new Error('Missing subject');
  const identity:Identity={subject:claims.sub,issuer:claims.iss};
  const sessions=store();let key:string;
  try{key=sessions.put('identity',identity,900_000);}finally{sessions.close();}
  jar.set(SESSION_COOKIE,key,{...cookieOptions,maxAge:900});
  // Access/refresh/ID tokens are neither persisted nor sent to the browser in this pilot.
}
export async function identity() {
  settings();const key=(await cookies()).get(SESSION_COOKIE)?.value;if(!key)return undefined;
  const db=store();try{return db.get<Identity>(key,'identity');}finally{db.close();}
}
