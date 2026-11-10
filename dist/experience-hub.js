// A mode chooser leaves the full viewport to the stadium after selection.
export function shouldOpenExperienceHub(search=''){
 const params=new URLSearchParams(search);return !['place','view','experience','room'].some(key=>params.has(key));
}
export function buildExperienceHub({onExplore,onTraining,onMatch,onEntrance,onOpen,onClose,onEnvironment,onQuality,getSettings}={}){
 const $=id=>document.getElementById(id),dialog=$('arena-hub');let previousState,opened=false;
 function sync(){const state=getSettings();$('hub-quality').value=state.quality;for(const button of dialog.querySelectorAll('[data-hub-time]'))button.setAttribute('aria-pressed',String((button.dataset.hubTime==='night')===state.night));}
 function open(){if(dialog.open)return;previousState=onOpen?.();opened=true;sync();document.body.classList.add('hub-open');dialog.showModal();}
 function finishClose(){if(!opened)return;opened=false;document.body.classList.remove('hub-open');onClose?.(previousState);}
 function close(){if(!dialog.open)return;dialog.close();finishClose();}
 dialog.addEventListener('close',finishClose);
 $('hub-close').onclick=close;
 for(const button of dialog.querySelectorAll('[data-hub-mode]'))button.onclick=()=>{const mode=button.dataset.hubMode;close();({explore:onExplore,training:onTraining,match:onMatch,entrance:onEntrance})[mode]?.();};
 for(const button of dialog.querySelectorAll('[data-hub-time]'))button.onclick=()=>{onEnvironment(button.dataset.hubTime==='night');sync();};
 $('hub-quality').onchange=()=>{onQuality($('hub-quality').value);sync();};
 return{open,close,get active(){return dialog.open;}};
}
