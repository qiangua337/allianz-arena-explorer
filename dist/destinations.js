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
export const destinationName=id=>destinations.find(p=>p.id===id)?.name||'选择地点';
export function matchesDestination(place,query,group='all'){
 return(group==='all'||place.group===group)&&(!query||`${place.name} ${place.detail} ${place.floor}`.toLowerCase().includes(query.trim().toLowerCase()));
}
export function buildDestinationMenu(){
 const nav=document.getElementById('locations'),search=document.getElementById('destination-search'),tabs=document.querySelectorAll('[data-destination-group]');let group='all';
 nav.innerHTML=destinations.map((p,i)=>`<button class="location" data-place="${p.id}" aria-current="false"><span class="location-icon" aria-hidden="true">${String(i+1).padStart(2,'0')}</span><span><b>${p.name}</b><small>${p.detail}</small></span><span class="location-floor">${p.floor}</span></button>`).join('');
 const filter=()=>{let count=0;for(const button of nav.querySelectorAll('.location')){const place=destinations.find(p=>p.id===button.dataset.place);button.hidden=!matchesDestination(place,search.value,group);if(!button.hidden)count++;}document.getElementById('destination-empty').hidden=count>0;};
 search.oninput=filter;for(const tab of tabs)tab.onclick=()=>{group=tab.dataset.destinationGroup;for(const t of tabs)t.setAttribute('aria-selected',String(t===tab));filter();};
 return{filter};
}
