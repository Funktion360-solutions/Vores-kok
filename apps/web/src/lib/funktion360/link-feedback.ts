const providerMessages:Record<string,string>={
 identity_already_exists:'Denne Funktion360 ID-konto er allerede koblet til en anden Vores Kok-konto. Log ud hos Funktion360 ID, og prøv med den ID-konto, der skal tilhøre denne Vores Kok-konto.',
 access_denied:'Tilknytningen blev ikke godkendt. Du kan starte igen, når du er klar.',
};
export function providerFeedback(fragment:string){
 const code=new URLSearchParams(fragment.replace(/^#/, '')).get('error_code');
 return code && Object.hasOwn(providerMessages,code)?code:undefined;
}
export function providerMessage(code:string|undefined){return code && Object.hasOwn(providerMessages,code)?providerMessages[code]:undefined;}
export function linkingFailure(reason:string|undefined){
 switch(reason){
 case 'proof_cookie_missing':case 'proof_invalid_or_expired':return 'Forsøget er udløbet eller mangler sin bekræftelse. Start tilknytningen igen i samme browservindue.';
 case 'original_session_missing':case 'original_account_changed':return 'Din Vores Kok-session er ændret. Log ind på den konto, du vil tilknytte, og start igen.';
 case 'account_not_allowed':return 'Kontotilknytning er endnu ikke åbnet for denne konto.';
 case 'linked_account_mismatch':return 'Vi kunne ikke bekræfte, at tilknytningen tilhører den oprindelige Vores Kok-konto. Log ind på din eksisterende konto igen.';
 default:return 'Koblingen kunne ikke bekræftes. Start et nyt forsøg.';
 }
}
