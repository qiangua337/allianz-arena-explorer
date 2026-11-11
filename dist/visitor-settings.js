const key='arena-visitor-v1';
export const matchFpsCap=value=>Number(value)===120?120:60;
export function loadVisitorSettings(storage){try{const p=JSON.parse(storage?.getItem(key)||'{}');return{quality:['standard','high','low'].includes(p.quality)?p.quality:'standard',matchFps:matchFpsCap(p.matchFps)};}catch{return{quality:'standard',matchFps:60};}}
export function saveVisitorSettings(storage,settings){try{storage?.setItem(key,JSON.stringify({quality:settings.quality,matchFps:matchFpsCap(settings.matchFps)}));}catch{}}
export function qualityProfile(quality,width,height,dpr=1,scale=1){const high=quality==='high',low=quality==='low',cap=high?1.7:low?.85:1,pixels=high?2400000:low?650000:1050000;return{pixelRatio:Math.min(dpr,cap,Math.sqrt(pixels/(width*height)))*scale,shadows:high,grass:low?0:high?26000:16000};}
