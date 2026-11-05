// One representative skybox layout, shared by furniture and walking clearance.
// The entrance landing and the narrow serving aisle remain clear.
export const hospitalityTables=Array.from({length:5},(_,i)=>({x:0,z:-10+i*5,radius:.85,height:.88}));
export const hospitalityChairs=hospitalityTables.flatMap(table=>[-1,1].map(side=>({x:side*1.5,z:table.z,yaw:side*Math.PI/2,width:.8,w:.76,d:.90,height:1.25})));
export const hospitalityBar={x:3.1,z:0,w:1.65,d:16,height:.9825,bodyWidth:1.5};
