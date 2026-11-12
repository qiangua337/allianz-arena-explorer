export const destinations=[
 {id:'exterior',name:'球场全景',group:'outside',floor:'场外',detail:'气枕外壳 · 建筑全景'},
 {id:'esplanade',name:'南广场',group:'outside',floor:'场外',detail:'绿色步道 · 周边环境'},
 {id:'entrance',name:'南侧正门',group:'outside',floor:'场外',detail:'返回参观起点'},
 {id:'arcade',name:'接待大厅',group:'public',floor:'入口层',detail:'咨询台 · 服务窗口'},
 {id:'access',name:'室内公共楼梯',group:'public',floor:'各层',detail:'连接大厅、看台与包厢'},
 {id:'concourse',name:'公共大厅',group:'public',floor:'2F',detail:'餐饮 · 场馆导览'},
 {id:'store',name:'球迷商店',group:'public',floor:'2F',detail:'球衣 · 围巾 · 装备'},
 {id:'museum',name:'荣誉展厅',group:'public',floor:'2F',detail:'六座冠军杯 · 俱乐部历史'},
 {id:'lounge',name:'贵宾包厢',group:'public',floor:'3F',detail:'餐叙空间 · 看台观景'},
 {id:'lowerStands',name:'下层看台',group:'pitch',floor:'1F',detail:'北侧缓坡 · 近场视角'},
 {id:'stands',name:'中层看台',group:'pitch',floor:'3F',detail:'东侧连廊 · 观赛座位'},
 {id:'upperStands',name:'上层看台',group:'pitch',floor:'4F',detail:'高处俯瞰整个球场'},
 {id:'visitorEntry',name:'草坪参观入口',group:'pitch',floor:'入口层',detail:'开放通道 · 步行进入草坪'},
 {id:'pitch',name:'草坪',group:'pitch',floor:'球场层',detail:'105 × 68 米 · 球门与边线'},
 {id:'tunnel',name:'球员入场通道',group:'team',floor:'球员层',detail:'红色通道 · 场边台阶'},
 {id:'homeRoom',name:'主队更衣室',group:'team',floor:'球员层',detail:'拜仁球衣 · 战术与备战'},
 {id:'guestRoom',name:'客队更衣室',group:'team',floor:'球员层',detail:'更衣区域 · 淋浴区'},
 {id:'press',name:'新闻发布厅',group:'team',floor:'球员层',detail:'发布台 · 媒体座席'}
];
const aliases={
 entrance:'南门 正门',
 arcade:'入口大厅 咨询大厅 接待台 服务台',
 concourse:'环形大厅 环廊',
 store:'拜仁商店 纪念品',
 museum:'博物馆 荣誉室 荣誉展示 奖杯',
 lounge:'贵宾室 包间',
 visitorEntry:'草坪入口 球场入口',
 pitch:'草地',
 tunnel:'球员通道 入场走廊',
 homeRoom:'拜仁更衣室',
 guestRoom:'客队衣柜',
 press:'发布会 媒体厅'
};
export const destinationName=id=>destinations.find(p=>p.id===id)?.name||'选择地点';
export function matchesDestination(place,query='',group='all'){
 if(group!=='all'&&place.group!==group)return false;
 const searchable=`${place.name} ${place.detail} ${place.floor} ${aliases[place.id]||''}`.toLowerCase();
 const terms=String(query??'').normalize('NFKC').trim().toLowerCase().split(/\s+/).filter(Boolean);
 return terms.every(term=>searchable.includes(term));
}
export function buildDestinationMenu({onDismiss}={}){
 const panel=document.getElementById('explore');
 const nav=document.getElementById('locations'),search=document.getElementById('destination-search');
 const tabs=[...document.querySelectorAll('[data-destination-group]')],empty=document.getElementById('destination-empty');
 const defaultTrigger=document.getElementById('nav-trigger');
 let group='all';
 let openRequest,invoker;
 const status=document.createElement('span');
 status.className='destination-status';
 status.setAttribute('role','status');
 nav.before(status);
 // Keep the location list ahead of secondary actions in visual and tab order.
 document.getElementById('walking-tour').before(panel.querySelector('.explore-entrypoints'));
 nav.innerHTML=destinations.map((p,i)=>`<button class="location" data-place="${p.id}" aria-current="false"><span class="location-icon" aria-hidden="true">${String(i+1).padStart(2,'0')}</span><span><b>${p.name}</b><small>${p.detail}</small></span><span class="location-floor">${p.floor}</span></button>`).join('');
 const buttons=[...nav.querySelectorAll('.location')];
 function filter(){
  let count=0;
  for(const [index,button] of buttons.entries()){
   button.hidden=!matchesDestination(destinations[index],search.value,group);
   if(!button.hidden)count++;
  }
  empty.hidden=count>0;
  const announcement=count?`找到 ${count} 个地点`:empty.textContent;
  if(status.textContent!==announcement)status.textContent=announcement;
  panel.scrollTop=0;
 }
 function selectGroup(tab){
  group=tab.dataset.destinationGroup;
  for(const item of tabs){
   item.setAttribute('aria-selected',String(item===tab));
   item.tabIndex=item===tab?0:-1;
  }
  filter();
 }
 search.oninput=()=>selectGroup(tabs[0]);
 search.addEventListener('focus',()=>{panel.dataset.searchActive='true';});
 function focusResult(button){
  button.focus({preventScroll:true});
  button.scrollIntoView({block:'nearest',inline:'nearest'});
 }
 panel.addEventListener('keydown',e=>{
  if(e.ctrlKey||e.metaKey||e.altKey)return;
  // The same arrow and letter keys also drive the first-person view.
  e.stopPropagation();
  if(e.isComposing)return;
  const visible=buttons.filter(button=>!button.hidden);
  if(e.target===search){
   if(!visible.length)return;
   if(e.key==='ArrowDown'||e.key==='ArrowUp'){
    e.preventDefault();
    focusResult(e.key==='ArrowDown'?visible[0]:visible.at(-1));
   }else if(e.key==='Enter'&&search.value.trim()){
    e.preventDefault();
    if(visible.length===1)visible[0].click();
    else focusResult(visible[0]);
   }
   return;
  }
  const index=visible.indexOf(e.target);
  if(index<0)return;
  if(e.key==='ArrowUp'){
   e.preventDefault();
   if(index===0)search.focus();
   else focusResult(visible[index-1]);
  }else if(e.key==='ArrowDown'){
   e.preventDefault();
   focusResult(visible[Math.min(visible.length-1,index+1)]);
  }else if(e.key==='Home'||e.key==='End'){
   e.preventDefault();
   focusResult(e.key==='Home'?visible[0]:visible.at(-1));
  }
 });
 for(const [index,tab] of tabs.entries()){
  tab.onclick=()=>selectGroup(tab);
  tab.onkeydown=e=>{
   let next;
   if(e.key==='ArrowRight')next=(index+1)%tabs.length;
   else if(e.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;
   else if(e.key==='Home')next=0;
   else if(e.key==='End')next=tabs.length-1;
   else return;
   e.preventDefault();e.stopPropagation();
   selectGroup(tabs[next]);tabs[next].focus({preventScroll:true});
  };
 }
 document.addEventListener('click',event=>{
  const trigger=event.target.closest?.('#nav-trigger,#guide-goal');
  if(!trigger||!panel.hidden)return;
  const request={trigger,keyboard:event.detail===0};
  openRequest=request;
  setTimeout(()=>{if(openRequest===request)openRequest=undefined;},0);
 },true);
 function setOpen(open){
  if(open){
   invoker=openRequest?.trigger??defaultTrigger;
   if(openRequest?.keyboard){
    panel.scrollTop=0;
    search.focus({preventScroll:true});
   }
  }else{
   invoker=undefined;
   delete panel.dataset.searchActive;
  }
  openRequest=undefined;
 }
 function dismiss(){
  if(panel.hidden)return;
  const returnTo=invoker??defaultTrigger;
  onDismiss?.();
  if(panel.hidden)(returnTo.getClientRects().length?returnTo:defaultTrigger).focus({preventScroll:true});
 }
 document.addEventListener('keydown',event=>{
  if(!onDismiss||panel.hidden||event.key!=='Escape'||event.isComposing||event.ctrlKey||event.metaKey||event.altKey||document.querySelector('dialog[open]'))return;
  event.preventDefault();
  event.stopPropagation();
  dismiss();
 },true);
 selectGroup(tabs[0]);
 return{filter,setOpen,dismiss};
}
