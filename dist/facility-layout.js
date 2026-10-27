export const pressLayout={rows:9,columns:20,rowDepth:1.05,rise:.095,firstZ:-1};
export function pressFloorRise(localZ){return Math.max(0,Math.min(pressLayout.rows-1,Math.floor((localZ-pressLayout.firstZ+pressLayout.rowDepth/2)/pressLayout.rowDepth)))*pressLayout.rise;}
