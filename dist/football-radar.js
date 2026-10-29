// This tactical view is a small 2D canvas, independent of the WebGL scene.
export function radarPoint(x,z,width=180,height=116){return{x:Math.max(0,Math.min(width,(52.5-z)/105*width)),y:Math.max(0,Math.min(height,(34-x)/68*height))};}
export function buildFootballRadar(canvas){
 const c=canvas?.getContext?.('2d');if(!c)return{update(){}};
 const w=180,h=116,pad=7;canvas.width=w+pad*2;canvas.height=h+pad*2;
 function point(x,z){const p=radarPoint(x,z,w,h);return{x:p.x+pad,y:p.y+pad};}
 return{update(state){c.clearRect(0,0,w+pad*2,h+pad*2);c.strokeStyle='#eeeadd66';c.lineWidth=.8;c.strokeRect(pad,pad,w,h);c.beginPath();c.moveTo(pad+w/2,pad);c.lineTo(pad+w/2,pad+h);c.moveTo(pad+w/2+15,pad+h/2);c.arc(pad+w/2,pad+h/2,15,0,Math.PI*2);c.stroke();for(const x of[pad,pad+w-28])c.strokeRect(x,pad+h/2-25,28,50);
  for(const p of state.players){if(p.dismissed)continue;const q=point(p.x,p.z),controlled=p.id===state.controlledId;c.beginPath();c.fillStyle=controlled?'#f6d68a':p.team==='home'?'#f55a70':state.fixture?.kit.shirt||'#ebcc3d';c.arc(q.x,q.y,controlled?3.6:2.3,0,Math.PI*2);c.fill();if(controlled){c.strokeStyle='#ffffff';c.stroke();}}
  const b=point(state.ball.x,state.ball.z);c.beginPath();c.fillStyle='#fff';c.arc(b.x,b.y,2.1,0,Math.PI*2);c.fill();
 }};
}
