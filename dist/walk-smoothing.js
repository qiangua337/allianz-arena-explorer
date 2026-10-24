// Frame-rate-independent easing of movement input; collisions still resolve
// each small physical step. Clearing input always stops immediately.
export function smoothWalkInput(state,x,z,dt){const amount=1-Math.exp(-Math.min(dt,.25)*18),length=Math.hypot(x,z),scale=length>1?1/length:1;state.x+=(x*scale-state.x)*amount;state.z+=(z*scale-state.z)*amount;if(!length){state.x=state.z=0;}return state;}
