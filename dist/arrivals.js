import {tourNodes,tourGoals} from './tour-route.js';
import {EYE_HEIGHT,floorHeight} from './navigation.js';

export const normalizeDestination=id=>id==='exterior'?'entrance':tourGoals[id]?id:'arcade';
export function destinationArrival(id,geometry){
 const goal=normalizeDestination(id),n=tourNodes[goal],point={x:n.x,y:n.y,z:n.z};
 if(goal==='lounge')point.x=93;
 // The rear centre aisle presents the complete room instead of spawning
 // directly in front of the press table and filling the view with its face.
 if(goal==='press'){point.z=tourNodes.pressWalkCB.z;point.y=tourNodes.pressWalkCB.y;}
 const feet=floorHeight(point.x,point.z,point.y,geometry),position=[point.x,feet+EYE_HEIGHT,point.z];
 const looks={arcade:[0,feet+EYE_HEIGHT,104.4],entrance:[0,-.5,174],esplanade:[0,18,0],concourse:[96,feet+EYE_HEIGHT,-12],access:[100,feet+3,-5],store:[1,feet+EYE_HEIGHT,118],museum:[-99.7,feet+EYE_HEIGHT,55.3],homeRoom:[-88,feet+EYE_HEIGHT,-3],guestRoom:[-88,feet+EYE_HEIGHT,25],press:[-82,feet+EYE_HEIGHT,-37],lounge:[55,feet+EYE_HEIGHT,0],visitorEntry:[22,feet+EYE_HEIGHT,85],tunnel:[-42,feet+EYE_HEIGHT,0],pitch:[0,3,-45],lowerStands:[0,8,0],stands:[0,9,0],upperStands:[0,15,0]};
 return{goal,position,look:looks[goal]||[0,5,0],feet};
}
