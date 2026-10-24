const key='arena-visitor-v1';
export function loadVisitorSettings(storage){try{const p=JSON.parse(storage?.getItem(key)||'{}');return{quality:['standard','high','low'].includes(p.quality)?p.quality:'standard'};}catch{return{quality:'standard'};}}
export function saveVisitorSettings(storage,settings){try{storage?.setItem(key,JSON.stringify({quality:settings.quality}));}catch{}}
export function qualityProfile(quality,width,height,dpr=1,scale=1){const high=quality==='high',low=quality==='low',cap=high?1.7:low?.85:1,pixels=high?2400000:low?650000:1050000;return{pixelRatio:Math.min(dpr,cap,Math.sqrt(pixels/(width*height)))*scale,shadows:high,grass:low?0:high?26000:16000};}
