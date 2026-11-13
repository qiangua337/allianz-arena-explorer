export const ONLINE_DELTA_CAPABILITY='state-delta-v1';
export const ONLINE_FLOW_CAPABILITY='state-flow-v1';

const playerCount=22,playerColumns=17,allColumns=(1<<playerColumns)-1;
const snapshotKeys=new Set(['v','seq','players']);
const unsafeKeys=new Set(['__proto__','constructor','prototype']);
const patchable=key=>!snapshotKeys.has(key)&&!unsafeKeys.has(key);
const equal=(a,b)=>a===b||a!=null&&b!=null&&typeof a==='object'&&typeof b==='object'&&JSON.stringify(a)===JSON.stringify(b);

export function encodeOnlineDelta(previous,current){
 if(previous?.players?.length!==playerCount||current?.players?.length!==playerCount||
    current.v!==previous.v||current.seq<=previous.seq)return null;
 const fields={},removed=[],players=[];
 for(const key of Object.keys(current)){
  if(patchable(key)&&current[key]!==undefined&&!equal(previous[key],current[key]))fields[key]=current[key];
 }
 for(const key of Object.keys(previous)){
  if(patchable(key)&&previous[key]!==undefined&&current[key]===undefined)removed.push(key);
 }
 for(let index=0;index<playerCount;index++){
  const oldRow=previous.players[index],newRow=current.players[index];
  if(oldRow?.length!==playerColumns||newRow?.length!==playerColumns)return null;
  let mask=0;
  const values=[];
  for(let column=0;column<playerColumns;column++){
   const value=newRow[column]??null;
   if(equal(oldRow[column]??null,value))continue;
   mask|=1<<column;
   values.push(value);
  }
  if(mask)players.push([index,mask,...values]);
 }
 return{base:previous.seq,seq:current.seq,fields,players,...(removed.length&&{removed})};
}

export function decodeOnlineDelta(previous,delta){
 if(previous?.players?.length!==playerCount||!delta||delta.base!==previous.seq||
    !Number.isSafeInteger(delta.seq)||delta.seq<=delta.base||
    !delta.fields||typeof delta.fields!=='object'||Array.isArray(delta.fields)||
    !Array.isArray(delta.players)||delta.players.length>playerCount)return null;
 const keys=Object.keys(delta.fields),removed=delta.removed??[];
 if(!Array.isArray(removed)||!keys.every(patchable)||
    !removed.every(key=>typeof key==='string'&&patchable(key)&&!Object.hasOwn(delta.fields,key)))return null;
 const players=previous.players.slice();
 let lastIndex=-1;
 for(const patch of delta.players){
  if(!Array.isArray(patch))return null;
  const [index,mask]=patch;
  if(!Number.isInteger(index)||index<=lastIndex||index>=playerCount||
     !Number.isInteger(mask)||mask<=0||mask>allColumns||players[index]?.length!==playerColumns)return null;
  lastIndex=index;
  const row=players[index].slice();
  let nextValue=2;
  for(let column=0;column<playerColumns;column++){
   if(mask&(1<<column))row[column]=patch[nextValue++];
  }
  if(nextValue!==patch.length)return null;
  players[index]=row;
 }
 const result={...previous,...delta.fields,seq:delta.seq,players};
 for(const key of removed)delete result[key];
 return result;
}
