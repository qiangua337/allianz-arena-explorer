// Discrete football actions respond to contact. Shooting and pressure keep
// their separate hold/release semantics. The compatibility click after a
// touch/mouse press must not issue the same action a second time.
export function bindInstantAction(button,activate){
 let pointer=null;
 const clear=()=>{const id=pointer;pointer=null;if(id!==null&&button.hasPointerCapture?.(id))button.releasePointerCapture?.(id);};
 button.addEventListener('pointerdown',event=>{
  if(button.disabled||pointer!==null||event.pointerType==='mouse'&&event.button!==0)return;
  event.preventDefault();pointer=event.pointerId;button.setPointerCapture?.(pointer);activate();
 });
 for(const type of['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,event=>{if(event.pointerId===pointer)clear();});
 button.addEventListener('click',event=>{if(event.detail===0&&!button.disabled&&pointer===null){event.preventDefault();activate();}});
 return{clear};
}
