const photos={
 kane:{src:'assets/editorial/kane.webp',alt:'哈里·凯恩，拜仁慕尼黑，2025年萨尔茨堡',width:1000,height:1022,context:'BAYERN / SALZBURG 2025',name:'HARRY KANE',cn:'哈里·凯恩',number:'09'},
 musiala:{src:'assets/editorial/musiala.webp',alt:'穆西亚拉，德国队，2026年世界杯',width:800,height:1200,context:'GERMANY / WORLD CUP 2026',name:'JAMAL MUSIALA',cn:'穆西亚拉',number:'10'}
};

// Native buttons supply pointer, Enter and Space activation. Selection is
// synchronous and never moves focus, starts a timer, or opens another view.
export function buildEditorialCover(root=document){
 const figure=root.id==='hub-cover'?root:root.querySelector('#hub-cover'),image=root.querySelector('#hub-cover-image'),fields=Object.fromEntries(['context','name','cn','number'].map(name=>[name,root.querySelector('#hub-cover-'+name)])),buttons=[...root.querySelectorAll('button[data-cover-player]')].filter(button=>Object.hasOwn(photos,button.dataset.coverPlayer));
 if(!figure||!image||Object.values(fields).some(field=>!field)||!['kane','musiala'].every(id=>buttons.some(button=>button.dataset.coverPlayer===id)))return()=>{};
 let selected=null,disposed=false;
 function select(id){
  if(disposed||selected===id)return;
  const photo=photos[id];
  for(const key of['src','alt','width','height']){const value=String(photo[key]);if(image.getAttribute(key)!==value)image.setAttribute(key,value);}
  for(const[key,field]of Object.entries(fields))field.textContent=photo[key];
  figure.dataset.player=id;
  for(const button of buttons)button.setAttribute('aria-pressed',String(button.dataset.coverPlayer===id));
  selected=id;
 }
 const listeners=buttons.map(button=>{const click=()=>select(button.dataset.coverPlayer);button.addEventListener('click',click);return[button,click];}),initial=Object.hasOwn(photos,figure.dataset.player)?figure.dataset.player:buttons.find(button=>button.getAttribute('aria-pressed')==='true')?.dataset.coverPlayer||'kane';
 select(initial);
 return function dispose(){if(disposed)return;disposed=true;for(const[button,click]of listeners)button.removeEventListener('click',click);};
}
