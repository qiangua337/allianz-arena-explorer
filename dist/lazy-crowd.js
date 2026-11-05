// Visiting the arena does not need the match audience's matrices and records.
// Keep its settings, then construct the real crowd only when a match needs it.
export function createLazyCrowd(factory){
 let crowd=null,enabled=false,quality=null,lighting=null,opponent=null;
 function ensure(){
  if(crowd)return crowd;
  const next=factory();
  if(quality)next.setQuality(...quality);
  if(lighting)next.night(...lighting);
  if(opponent)next.setOpponent(...opponent);
  crowd=next;return crowd;
 }
 return{
  get root(){return crowd?.root??null;},
  get count(){return crowd?.count??0;},
  get nearCount(){return crowd?.nearCount??0;},
  get visitorCount(){return crowd?.visitorCount??0;},
  get assetState(){return crowd?.assetState??'off';},
  prepare(){return ensure().prepare();},
  setEnabled(on){const next=!!on;if(next===enabled&&(!next||crowd))return;enabled=next;if(next)ensure().setEnabled(true);else crowd?.setEnabled(false);},
  setQuality(...args){quality=args;crowd?.setQuality(...args);},
  night(...args){lighting=args;crowd?.night(...args);},
  setOpponent(...args){opponent=args;crowd?.setOpponent(...args);},
  react(...args){if(enabled)crowd?.react(...args);},
  update(...args){if(enabled)crowd?.update(...args);}
 };
}
