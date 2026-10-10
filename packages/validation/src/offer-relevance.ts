// Name-based suggestions, never proof of identical articles or sizes.
const stop = new Set(['hakket','frisk','friske','groft','grov','grove','revet','skiver','skåret','økologisk','økologiske','øko','pakke','pakker','pose','poser','dåse','dåser','stor','store','lille','små','med','uden','til','fra','gram','liter','stk']);
const words = (text: string) => text.toLocaleLowerCase('da').match(/[\p{L}\p{N}]+/gu) ?? [];
export function matchingItems(offerName: string, items: {name:string;checked:boolean}[]): string[] {
 const offered=words(offerName);
 return items.filter(i=>!i.checked).filter(i=>{
  const wanted=words(i.name).filter(w=>(w.length>=3||w==='æg')&&!stop.has(w)&&!/^\d+$/.test(w));
  return wanted.length>0&&wanted.every(w=>offered.some(o=>o===w||(w==='mel'&&o.endsWith('mel')&&o!=='karamel')||(w.length>=4&&(o.startsWith(w)||o.endsWith(w)))||(o.length>=4&&w.startsWith(o))));
 }).map(i=>i.name);
}
