import 'server-only';
import {pilotUser} from './signin-checks';
export const PROOF_COOKIE='vk_f360_signin_proof';
export function signinConfig() {
  const enabled=process.env.F360_SSO_ENABLED==='true' || (process.env.NODE_ENV==='development' && process.env.F360_SSO_PILOT==='true');
  if(!enabled)throw new Error('SSO disabled');
  const origin=new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001');
  if(origin.username || origin.password || origin.pathname!=='/' || origin.search || origin.hash)throw new Error('Invalid app origin');
  if(origin.protocol!=='https:' && !(process.env.NODE_ENV==='development' && origin.protocol==='http:' && origin.hostname==='localhost'))throw new Error('HTTPS required');
  const raw=process.env.F360_SSO_ALLOWED_USER_IDS || process.env.F360_SSO_PILOT_LOCAL_USER_ID || '';
  const allowed=raw.split(',').map(s=>s.trim()).filter(Boolean);
  if(!allowed.length || allowed.some(id=>!pilotUser(id)))throw new Error('Explicit local user allowlist required');
  const secret=process.env.F360_SSO_COOKIE_SECRET || '';
  if(!/^[a-f0-9]{64}$/i.test(secret))throw new Error('SSO cookie secret missing');
  return {origin:origin.origin,allowed,secret,cookies:{httpOnly:true,secure:origin.protocol==='https:',sameSite:'lax' as const,path:'/auth/funktion360/signin',maxAge:300}};
}
export function signinReady(){try{signinConfig();return true;}catch{return false;}}
