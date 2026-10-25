const clamp=x=>Math.max(0,Math.min(1,x));
export function lightingProfile({night=false,enclosed=false,position={x:0,y:0,z:0}}={}){
 if(enclosed)return{hemi:.62,ambient:.11,key:.12,fill:.035,sky:0xeee8dd,ground:0x79746b,keyColor:0xffead3};
 if(!night)return{hemi:.98,ambient:.16,key:2.8,fill:.22,sky:0xdce8f1,ground:0x65664e,keyColor:0xffefd9};
 const outside=(Math.abs(position.x)/112)**2.8+(Math.abs(position.z)/128)**2.8,weight=clamp((outside-1)/.4),blend=(a,b)=>a+(b-a)*weight;
 return{hemi:blend(.76,.32),ambient:blend(.18,.10),key:blend(1.5,.28),fill:blend(.6,.1),sky:0x9baecb,ground:0x343b35,keyColor:0xd9e6ff};
}
export function updateSceneLighting(lights,profile,dt){
 const amount=1-Math.exp(-Math.min(dt,.25)*6);let changing=false;
 for(const[key,target]of[['hemi',profile.hemi],['ambient',profile.ambient],['dayLight',profile.key],['arenaFill',profile.fill]]){const light=lights[key];light.intensity+=(target-light.intensity)*amount;if(Math.abs(target-light.intensity)>.001)changing=true;}
 lights.hemi.color.set(profile.sky);lights.hemi.groundColor.set(profile.ground);lights.dayLight.color.set(profile.keyColor);return changing;
}
