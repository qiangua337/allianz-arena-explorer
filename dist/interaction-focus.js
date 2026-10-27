// Metres, shared by the interaction controller and regression tests.
// Transparent empty space in a glass case is not a selectable solid.
export function focusBox(x,y,z,w,h,d){return{x0:x-w/2,x1:x+w/2,y0:y-h/2,y1:y+h/2,z0:z-d/2,z1:z+d/2};}
export function rayBoxDistance(origin,direction,box){
 let near=0,far=Infinity;
 for(const axis of['x','y','z']){const low=box[axis+'0'],high=box[axis+'1'],value=origin[axis],delta=direction[axis];if(Math.abs(delta)<1e-9){if(value<low||value>high)return null;continue;}let a=(low-value)/delta,b=(high-value)/delta;if(a>b)[a,b]=[b,a];near=Math.max(near,a);far=Math.min(far,b);if(near>far)return null;}
 return far>=0?near:null;
}
export function pointAhead(origin,direction,point,cosine=.55){
 if(!direction)return false;const dx=point.x-origin.x,dy=point.y-origin.y,dz=point.z-origin.z,d=Math.hypot(dx,dy,dz),n=Math.hypot(direction.x,direction.y,direction.z);return d<.15||n>0&&(dx*direction.x+dy*direction.y+dz*direction.z)/(d*n)>=cosine;
}
export function chooseInteraction(items,origin,direction){
 if(!direction)return null;const length=Math.hypot(direction.x,direction.y,direction.z);if(!Number.isFinite(length)||length<1e-8)return null;const ray={x:direction.x/length,y:direction.y/length,z:direction.z/length};let selected=null,nearest=Infinity;
 for(const item of items){
  if(item.region&&!['x','y','z'].every(a=>origin[a]>=item.region[a+'0']&&origin[a]<=item.region[a+'1']))continue;
  let entry=null;for(const box of item.focusBoxes){const distance=rayBoxDistance(origin,ray,box);if(distance!==null&&(entry===null||distance<entry))entry=distance;}
  if(entry===null||entry>item.reach)continue;const distance=item.hitTest?item.hitTest(origin,ray):entry;if(distance!==null&&distance<=item.reach&&distance<nearest){selected=item;nearest=distance;}
 }return selected;
}
