const minScale=.70;
const sampleSeconds=.55;
const gesturePause=.32;
const longFrame=1/28;

// Sample only while the visitor is moving the camera. Scale the canvas, not
// the walking speed, touch controls, or the route HUD.
export function createWalkFrameRate(){
 let scale=1,seconds=0,frames=0,slow=0,steady=0,settle=0,pause=0,longFrames=0;
 function interrupt(){seconds=frames=slow=steady=settle=pause=longFrames=0;}
 function lower(amount){
  scale=Math.max(minScale,Math.round((scale-amount)*100)/100);
  seconds=frames=slow=steady=longFrames=0;
  settle=1;return scale;
 }
 return {
  reset(){scale=1;interrupt();return scale;},
  interrupt,
  update(delta,active){
   if(delta>.25){interrupt();return scale;}
   // A lift between a swipe and the next joystick movement is part of the
   // same turn. Keep the budget, but do not count that idle time as slow frames.
   if(!active){pause+=delta;if(pause>gesturePause)interrupt();return scale;}
   pause=0;
   frames++;
   seconds+=delta;
   longFrames=delta>longFrame?longFrames+1:0;
   if(!settle&&longFrames>=4&&scale>minScale)return lower(.12);
   if(seconds<sampleSeconds)return scale;
   const fps=frames/seconds;
   seconds=frames=0;
   if(settle){settle--;longFrames=0;return scale;}
   if(fps<47){
    steady=0;
    slow++;
    const severe=fps<34;
    if((severe||slow>=2)&&scale>minScale)return lower(severe?.12:.08);
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
