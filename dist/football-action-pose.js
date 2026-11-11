import {applyFootballKick,applyFootballShotPreparation,keepFootballBootsAboveFloor,liftFootballBootsAboveFloor} from './football-kick-pose.js';
// Football strokes layer over the CC0 locomotion clips before the skeleton's
// single world update. Kicks plant their support foot and begin at contact.
export function applyFootballAction(bones,motion,{defending=false,speed=0}={},group){
 const t=motion?Math.max(0,Math.min(1,motion.elapsed/motion.duration)):0,pulse=Math.sin(t*Math.PI);
 if(motion?.type==='booking'){bones[12].rotateX(-2.65);bones[13].rotateX(-.2);bones[2].rotateY(.08);return;}
 if(motion?.type==='prepareShot'){
  const load=.28+Math.min(1,motion.elapsed)*.30;
  const preload=.12*Math.min(1,motion.elapsed/.25)+.88*(1-Math.exp(-Math.max(0,motion.elapsed-.25)*20.4));
  if(!applyFootballShotPreparation(bones,preload,motion,speed)){bones[15].rotateX(load);bones[16].rotateX(-load*.32);}
  return;
 }
 if(motion?.type==='trap'){bones[15].rotateX(-.17*pulse);bones[16].rotateX(.20*pulse);bones[17].rotateX(.13*pulse);bones[6].rotateZ(-.10*pulse);bones[12].rotateZ(.10*pulse);}
 if(motion?.type==='celebrate'){const lift=Math.min(1,motion.elapsed/.40);bones[6].rotateX(-2.15*lift);bones[12].rotateX(-2.15*lift);bones[7].rotateX(-.35*lift);bones[13].rotateX(-.35*lift);bones[2].rotateY(Math.sin(motion.elapsed*3)*.035);return;}
 if(motion?.type==='shoot'||motion?.type==='pass'){
  if(motion.predicted){
   const load=(motion.type==='shoot'?.65:.39)*(.30+.70*Math.sin(Math.min(1,t/.6)*Math.PI/2));
   applyFootballShotPreparation(bones,load,motion,speed);
   return;
  }
  if(applyFootballKick(bones,motion,t,group,speed))return;
 }
 const kick=motion?.type==='shoot'?.82:motion?.type==='pass'?.55:motion?.type==='tackle'?.48:0;
 const strike=motion?.type==='tackle'?pulse:t<.18?Math.sin(t/.18*Math.PI/2):Math.cos((t-.18)/.82*Math.PI/2);
 if(kick&&strike>0){bones[15].rotateX(-kick*strike);bones[16].rotateX(.24*strike);bones[17].rotateX(-.12*strike);bones[6].rotateZ(-.12*strike);bones[12].rotateZ(.15*strike);bones[2].rotateX(.06*strike);}
 if(motion?.type==='save'){bones[6].rotateX(-.85*pulse);bones[12].rotateX(-.85*pulse);bones[7].rotateZ(-.35*pulse);bones[13].rotateZ(.35*pulse);bones[2].rotateX(.14*pulse);}
 if(motion?.type==='dive'){
  const fall=Math.min(1,motion.elapsed/.32),recoverAt=Math.min(.58,Math.max(.32,motion.duration-.42)),rise=motion.elapsed<recoverAt?1:Math.max(0,1-(motion.elapsed-recoverAt)/Math.max(.15,motion.duration-recoverAt)),lean=Math.sin(fall*Math.PI/2)*rise,side=motion.direction||1;
  bones[0].rotateZ(-side*1.08*lean);bones[0].position.y-=.36*lean;bones[0].position.x+=side*.13*lean;
  // Original continuous key pose: lead with one glove while the other arm
  // folds across the chest toward the same side. Mirrored standing arm lifts
  // made the far glove point upward when the torso rolled. Fixed local axes
  // also avoid the elbow-plane flips of a target-driven two-bone solver.
  const reach=Math.min(1,motion.elapsed/.46),recover=Math.min(rise,Math.max(0,(motion.duration-motion.elapsed)/.42)),arm=(reach*reach*(3-2*reach))*(recover*recover*(3-2*recover));
  bones[6].rotateX(-.30*arm);bones[12].rotateX(-.30*arm);bones[6].rotateZ((side>0?2.60:-2.40)*arm);bones[12].rotateZ((side>0?2.40:-2.60)*arm);bones[7].rotateX(.78*arm);bones[13].rotateX(.78*arm);bones[7].rotateZ(.08*arm);bones[13].rotateZ(-.08*arm);bones[16].rotateX(.35*lean);
  // Dives have no fixed support foot. Keep the local skinned pose clear of
  // the turf without moving the authoritative player or changing save reach.
  if(lean>0){bones[0].position.y=Math.max(.28,bones[0].position.y);liftFootballBootsAboveFloor(bones);bones[0].position.y+=.20*arm*(1-arm);}
 }
 if(motion?.type==='trap'||motion?.type==='tackle')keepFootballBootsAboveFloor(bones);
 if(defending){bones[6].rotateZ(-.13);bones[12].rotateZ(.13);bones[2].rotateX(.07);}
 else if(speed>5.5)bones[2].rotateX(Math.min(.11,(speed-5.5)*.055));
}
