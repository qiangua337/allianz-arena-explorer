// Keep the fractional frame budget. Resetting it to zero turns a nominal
// 30 Hz limit into 20 Hz on a slightly irregular 60 Hz display.
export function createFramePacer(){let deadline=null,previousRate=0;return{ready(time,rate=30){const interval=1/rate;if(deadline===null||rate!==previousRate||time<deadline-1){deadline=time;previousRate=rate;}if(time+1e-6<deadline)return false;const late=Math.max(0,time-deadline);deadline+=Math.floor((late+1e-6)/interval)*interval+interval;return true;},reset(){deadline=null;}};}
