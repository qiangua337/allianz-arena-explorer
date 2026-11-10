// Nearby activities after a free visit. Guided walks supply their own next stop.
const following={entrance:'arcade',exterior:'arcade',esplanade:'entrance',arcade:'concourse',access:'concourse',concourse:'store',store:'museum',museum:'lounge',lounge:'stands',stands:'upperStands',upperStands:'lowerStands',lowerStands:'pitch',visitorEntry:'pitch',pitch:'tunnel',tunnel:'homeRoom',homeRoom:'guestRoom',guestRoom:'press',press:'arcade'};
export const nextWalkDestination=goal=>following[goal]||'arcade';
