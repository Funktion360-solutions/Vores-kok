'use client';
import {useSyncExternalStore} from 'react';
import {useFormStatus} from 'react-dom';
import {providerFeedback,providerMessage,linkingFailure} from '@/lib/funktion360/link-feedback';
import styles from './link.module.css';
const subscribe=(notify:()=>void)=>{window.addEventListener('hashchange',notify);return ()=>window.removeEventListener('hashchange',notify);};
const snapshot=()=>providerFeedback(window.location.hash);
const serverSnapshot=()=>undefined;
export function LinkingFeedback({reason}:{reason?:string}){
 const code=useSyncExternalStore(subscribe,snapshot,serverSnapshot);
 return <div role="status" className={styles.notice}><p>{providerMessage(code) || linkingFailure(reason)}</p>{code==='identity_already_exists'?<a className={styles.helpLink} href="https://id.funktion360.dk/account">Åbn Funktion360 ID og skift konto</a>:null}<details className={styles.technical}><summary>Teknisk fejlkode</summary><code>{code || reason || 'unknown'}</code></details></div>;
}
export function LinkSubmit(){
 const {pending}=useFormStatus();
 return <button className={styles.submit} type="submit" disabled={pending} aria-busy={pending}>{pending?'Kontrollerer din konto…':'Bekræft og fortsæt til Funktion360 ID'}</button>;
}
