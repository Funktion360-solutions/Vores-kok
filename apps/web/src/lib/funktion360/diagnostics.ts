export function safeFailure(error: unknown): string {
  const value = error as {code?:unknown,error?:unknown,message?:unknown,cause?:{claim?:unknown}} | null;
  const known:Record<string,string>={'Missing login binding':'missing_cookie','Expired or consumed login':'expired_transaction','Invalid state':'invalid_state','Missing subject':'missing_subject'};
  if(typeof value?.message==='string' && known[value.message]) return known[value.message]!;
  let code=typeof value?.code==='string' && /^[A-Za-z0-9_]{1,80}$/.test(value.code) ? value.code : 'unknown_error';
  if(typeof value?.error==='string' && ['access_denied','invalid_grant','invalid_client','invalid_request','server_error'].includes(value.error)) code+='_'+value.error;
  const claim=value?.cause?.claim;
  if(typeof claim==='string' && ['iss','aud','nonce','exp','iat','sub','auth_time'].includes(claim)) code+='_'+claim;
  return code;
}
