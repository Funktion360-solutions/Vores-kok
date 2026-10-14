import 'server-only';
import {signinConfig} from './signin-config';
export const LINK_COOKIE='vk_f360_link_proof';
export function linkConfig(){
 const cfg=signinConfig();
 if(process.env.NODE_ENV!=='development' && process.env.F360_ACCOUNT_LINKING_ENABLED!=='true')throw new Error('Linking disabled');
 return {...cfg,cookies:{...cfg.cookies,path:'/auth/funktion360/link'}};
}
export function linkingReady(){try{linkConfig();return true;}catch{return false;}}
