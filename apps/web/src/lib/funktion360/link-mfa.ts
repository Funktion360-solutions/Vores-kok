type Factor={id:string,status:string,factor_type:string};
type MfaApi={challengeAndVerify:(input:{factorId:string,code:string})=>Promise<{error:unknown}>,getAuthenticatorAssuranceLevel:()=>Promise<{data:{currentLevel:string|null}|null,error:unknown}>};
export function linkingFactors(factors:Factor[]|undefined){return (factors || []).filter(f=>f.status==='verified');}
export async function verifyLinkingMfa(api:MfaApi,factors:Factor[]|undefined,factorId:string,code:string) {
 const verified=linkingFactors(factors);
 if(!verified.length)return true;
 if(!verified.some(f=>f.id===factorId && f.factor_type==='totp') || !/^[0-9]{6}$/.test(code))return false;
 const result=await api.challengeAndVerify({factorId,code});
 if(result.error)return false;
 const assurance=await api.getAuthenticatorAssuranceLevel();
 return !assurance.error && assurance.data?.currentLevel==='aal2';
}
