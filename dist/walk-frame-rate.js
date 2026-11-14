const minScale=.70;
const sampleSeconds=.55;

// Sample only while the visitor is moving the camera. Scale the canvas, not
// the walking speed, touch controls, or the route HUD.
export function createWalkFrameRate(){
 let scale=1,seconds=0,frames=0,slow=0,steady=0,settle=0;
 function interrupt(){seconds=frames=slow=steady=settle=0;}
 return {
  reset(){scale=1;interrupt();return scale;},
  interrupt,
  update(delta,active){
   if(!active||delta>.25){interrupt();return scale;}
   frames++;
   seconds+=delta;
   if(seconds<sampleSeconds)return scale;
   const fps=frames/seconds;
   seconds=frames=0;
   if(settle){settle--;return scale;}
   if(fps<47){
    steady=0;
    slow++;
    const severe=fps<34;
    if((severe||slow>=2)&&scale>minScale){
     scale=Math.max(minScale,Math.round((scale-(severe?.12:.08))*100)/100);
     settle=1;slow=0;
    }
   }else{
    slow=0;
    steady=fps>=55?steady+1:0;
    if(steady>=8&&scale<1){
     scale=Math.min(1,Math.round((scale+.05)*100)/100);
     steady=0;settle=1;
    }
   }
   return scale;
  }
 };
}
