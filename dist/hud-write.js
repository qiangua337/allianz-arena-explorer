// Read the live DOM before writing. Other panels can share these elements;
// an external change must never be hidden by a stale cached value.
export function writeHudProperty(element,key,value){
 if(!element)return;
 const next=key==='textContent'?String(value??''):value;
 if(element[key]!==next)element[key]=next;
}
export function writeHudAttribute(element,key,value){
 if(!element)return;const next=String(value),previous=element.getAttribute?element.getAttribute(key):element[key];
 if(previous!==next)element.setAttribute(key,next);
}
export function writeHudData(element,key,value){const next=String(value??'');if(element.dataset[key]!==next)element.dataset[key]=next;}
export function writeHudDataset(element,values){for(const key in values)writeHudData(element,key,values[key]);}
