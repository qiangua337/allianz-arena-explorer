export const MOBILE_ONLINE_FRAME_SLACK = .003;
export const WALK_FRAME_SLACK = .0015;

// Keep the fractional frame budget. Resetting it to zero turns a nominal
// 30 Hz limit into 20 Hz on a slightly irregular 60 Hz display.
export function createFramePacer() {
 let deadline = null, previousRate = 0;
 return {
  ready(time, rate = 30, tolerance = .000001) {
   const interval = 1 / rate;
   if (deadline === null || rate !== previousRate || time < deadline - 1) {
    deadline = time;
    previousRate = rate;
   }
   // A display callback may arrive a fraction of a millisecond before its
   // nominal deadline. Render callers can absorb that jitter without skipping
   // a whole refresh. The absolute schedule still enforces the average cap.
   const slack = Math.max(0, Math.min(tolerance, interval * .375));
   const elapsedSinceDeadline = time + slack - deadline;
   if (elapsedSinceDeadline < 0) return false;
   deadline += (Math.floor(elapsedSinceDeadline / interval) + 1) * interval;
   return true;
  },
  reset() { deadline = null; }
 };
}
