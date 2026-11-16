import {trainingDrills} from './football-training-layout.js';

const key='arena-training-records';
const ids=trainingDrills.map(drill=>drill.id);
const counts=Object.fromEntries(trainingDrills.map(drill=>[drill.id,drill.targetCount]));
const validTime=seconds=>Number.isFinite(seconds)&&seconds>0;
const secondsText=seconds=>seconds.toFixed(1)+' 秒';

function normalize(id,entry){
 if(id==='free'&&validTime(entry?.seconds))return{seconds:entry.seconds};
 if(id==='passing'&&validTime(entry?.seconds)&&Number.isSafeInteger(entry.attempts)&&entry.attempts>=counts[id]){
  return{seconds:entry.seconds,attempts:entry.attempts};
 }
 if(id==='shooting'&&Number.isInteger(entry?.goals)&&Number.isInteger(entry.onTarget)&&entry.goals>=0&&entry.onTarget>=entry.goals&&entry.onTarget<=counts[id]){
  return{goals:entry.goals,onTarget:entry.onTarget};
 }
 return null;
}

function better(id,next,best){
 if(!best)return true;
 if(id==='free')return next.seconds<best.seconds;
 if(id==='passing')return next.attempts<best.attempts||next.attempts===best.attempts&&next.seconds<best.seconds;
 return next.goals>best.goals||next.goals===best.goals&&next.onTarget>best.onTarget;
}

export function createTrainingRecords(storage){
 const records=Object.create(null);
 function refresh(){
  let saved;
  try{saved=JSON.parse(storage?.getItem(key));}catch{}
  for(const id of ids){
   const entry=normalize(id,saved?.[id]);
   if(entry&&better(id,entry,records[id]))records[id]=entry;
  }
 }
 return {
  get(id){refresh();return records[id]??null;},
  submit(id,entry){
   const next=normalize(id,entry);
   refresh();
   if(!next||!better(id,next,records[id]))return false;
   records[id]=next;
   try{storage?.setItem(key,JSON.stringify(records));}catch{}
   return true;
  }
 };
}

export function trainingRecordText(id,record){
 if(!record)return '';
 const prefix='个人最佳 · ';
 if(id==='free')return prefix+secondsText(record.seconds);
 if(id==='passing')return prefix+record.attempts+' 次传球 · '+secondsText(record.seconds);
 return prefix+record.goals+' 球 · '+record.onTarget+' 次射正';
}
