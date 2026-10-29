// Small football-specific strokes layered over the CC0 locomotion clips.
// The left support leg and root stay in the grounded base pose.
export function applyFootballAction(bones,motion,{defending=false,speed=0}={}){
 const t=motion?Math.max(0,Math.min(1,motion.elapsed/motion.duration)):0,pulse=Math.sin(t*Math.PI);
 if(motion?.type==='booking'){bones[12].rotateX(-2.65);bones[13].rotateX(-.2);bones[2].rotateY(.08);return;}
 const kick=motion?.type==='shoot'?.82:motion?.type==='pass'?.55:motion?.type==='tackle'?.48:0;
 if(kick&&pulse>0){bones[15].rotateX(-kick*pulse);bones[16].rotateX(.24*pulse);bones[17].rotateX(-.12*pulse);bones[6].rotateZ(-.12*pulse);bones[12].rotateZ(.15*pulse);bones[2].rotateX(.06*pulse);}
 if(motion?.type==='save'){bones[6].rotateX(-.85*pulse);bones[12].rotateX(-.85*pulse);bones[7].rotateZ(-.35*pulse);bones[13].rotateZ(.35*pulse);bones[2].rotateX(.14*pulse);}
 if(motion?.type==='dive'){
  const fall=Math.min(1,motion.elapsed/.32),rise=motion.elapsed<.58?1:Math.max(0,1-(motion.elapsed-.58)/Math.max(.15,motion.duration-.58)),lean=Math.sin(fall*Math.PI/2)*rise,side=motion.direction||1;
  bones[0].rotateZ(-side*1.08*lean);bones[0].position.y-=.36*lean;bones[0].position.x+=side*.13*lean;
  bones[6].rotateX(-.85*lean);bones[12].rotateX(-.85*lean);bones[6].rotateZ(-.40*lean);bones[12].rotateZ(.40*lean);bones[7].rotateZ(-.18*lean);bones[13].rotateZ(.18*lean);bones[16].rotateX(.35*lean);
 }
 if(defending){bones[6].rotateZ(-.13);bones[12].rotateZ(.13);bones[2].rotateX(.07);}
 else if(speed>5.5)bones[2].rotateX(Math.min(.11,(speed-5.5)*.055));
}
