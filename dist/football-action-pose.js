// Small football-specific strokes layered over the CC0 locomotion clips.
// The left support leg and root stay in the grounded base pose.
export function applyFootballAction(bones,motion,{defending=false,speed=0}={}){
 const t=motion?Math.max(0,Math.min(1,motion.elapsed/motion.duration)):0,pulse=Math.sin(t*Math.PI);
 const kick=motion?.type==='shoot'?.82:motion?.type==='pass'?.55:motion?.type==='tackle'?.48:0;
 if(kick&&pulse>0){bones[15].rotateX(-kick*pulse);bones[16].rotateX(.24*pulse);bones[17].rotateX(-.12*pulse);bones[6].rotateZ(-.12*pulse);bones[12].rotateZ(.15*pulse);bones[2].rotateX(.06*pulse);}
 if(motion?.type==='save'){bones[6].rotateX(-.85*pulse);bones[12].rotateX(-.85*pulse);bones[7].rotateZ(-.35*pulse);bones[13].rotateZ(.35*pulse);bones[2].rotateX(.14*pulse);}
 if(defending){bones[6].rotateZ(-.13);bones[12].rotateZ(.13);bones[2].rotateX(.07);}
 else if(speed>5.5)bones[2].rotateX(Math.min(.11,(speed-5.5)*.055));
}
