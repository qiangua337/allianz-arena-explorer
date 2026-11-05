export const pressLayout={rows:9,columns:20,rowDepth:1.05,rise:.095,firstZ:-1};
export function pressFloorRise(localZ){return Math.max(0,Math.min(pressLayout.rows-1,Math.floor((localZ-pressLayout.firstZ+pressLayout.rowDepth/2)/pressLayout.rowDepth)))*pressLayout.rise;}
export const pressCameras=[-10.05,10.05].map(x=>({x,z:6.7,y:pressFloorRise(6.7),yaw:Math.PI}));
export function pressFloorSegments(start,end){const points=[start];for(let row=1;row<pressLayout.rows;row++){const z=pressLayout.firstZ+(row-.5)*pressLayout.rowDepth;if(z>start&&z<end)points.push(z);}points.push(end);return points.slice(0,-1).map((z,i)=>({start:z,end:points[i+1],y:pressFloorRise((z+points[i+1])/2)}));}
