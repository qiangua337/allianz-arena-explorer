export function joystickAxes(dx,dy,radius=25){
 if(![dx,dy,radius].every(Number.isFinite)||radius<=0)return{x:0,y:0,thumbX:0,thumbY:0};
 const length=Math.hypot(dx,dy),amount=Math.min(1,length/radius),strength=amount<.09?0:Math.pow((amount-.09)/.91,1.15),nx=dx/(length||1),ny=dy/(length||1);
 return{x:nx*strength||0,y:-ny*strength||0,thumbX:nx*amount*radius,thumbY:ny*amount*radius};
}
