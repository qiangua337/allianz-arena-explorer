import {honours} from './honours.js';
import {personalHonours,museumFilters,filterPersonalHonours,museumVerified,museumObjectLabel} from './personal-honours.js';
import {museumReferences} from './museum-references.js';

const el=(tag,cls,text)=>{
 const node=document.createElement(tag);
 if(cls)node.className=cls;
 if(text)node.textContent=text;
 return node;
};
const icons={ballon:'◉',scorer:'◒',world:'✦',europe:'◇',shield:'◉',pokal:'◇'};
const filters=[museumFilters[0],['club','球队奖杯'],...museumFilters.slice(1)];
const footnote='数字展陈为代表性设计；奖杯采用原创简化造型，不代表实物馆藏清单。';

function clubAwardName(exhibit){
 if(exhibit.kind==='shield')return '德甲冠军盘';
 if(exhibit.kind==='pokal')return '德国杯';
 return Number(exhibit.year)<1992?'欧洲冠军杯':'欧洲冠军联赛';
}

export function filterMuseumHonours(query='',category='all'){
 const q=query.trim().toLocaleLowerCase();
 const clubs=category==='all'||category==='club'?honours.filter(exhibit=>{
  const {year,title,kind,opponent,city,score,detail}=exhibit;
  const aliases=kind==='europe'?'欧冠 Champions League European Cup':kind==='shield'?'德甲 Bundesliga Meisterschale':'DFB-Pokal Pokal';
  return !q||[year,title,clubAwardName(exhibit),opponent,city,score,detail,aliases].join(' ').toLocaleLowerCase().includes(q);
 }):[];
 const individuals=category==='club'?[]:filterPersonalHonours(query,category);
 return {clubs,individuals};
}

function openMuseum(render,{scrollTop=0,focus=''}={}){
 const dialog=document.getElementById('info-dialog'),root=document.getElementById('dialog-content');
 document.exitPointerLock?.();
 document.dispatchEvent(new CustomEvent('museum-open'));
 dialog.classList.add('museum-dialog');
 root.replaceChildren();
 render(root);
 if(!dialog.open){
  dialog.showModal();
  dialog.addEventListener('close',()=>dialog.classList.remove('museum-dialog'),{once:true});
 }
 const focusTarget=focus?root.querySelector('[data-exhibit="'+focus+'"]'):root.querySelector('.museum-back');
 focusTarget?.focus({preventScroll:true});
 dialog.scrollTop=0;
 root.scrollTop=scrollTop;
}

function detailNavigation(root,exhibits,index,open,catalogue){
 const back=el('button','museum-back','← 返回展览目录');
 back.onclick=()=>openMuseumCatalog(catalogue);
 root.prepend(back);
 const browse=el('div','museum-browse');
 for(const [delta,label] of [[-1,'← 上一展柜'],[1,'下一展柜 →']]){
  const button=el('button','',label),target=exhibits[(index+delta+exhibits.length)%exhibits.length];
  button.onclick=()=>open(target,catalogue);
  browse.append(button);
 }
 root.append(browse,el('p','museum-footnote',footnote));
}

function sourcesIn(root,sources,note){
 const container=el('div','museum-sources');
 if(note)container.append(el('small','',note));
 for(const source of sources){
  const link=el('a','',source.label+' ↗');
  link.href=source.url;
  link.target='_blank';
  link.rel='noopener';
  container.append(link);
 }
 root.append(container);
}

export function openMuseumExhibit(id,catalogue){
 const h=personalHonours.find(h=>h.id===id);
 if(!h)return;
 openMuseum(root=>{
  const hero=el('div','museum-detail-hero'),icon=el('span','museum-award-symbol',icons[h.category]);
  icon.setAttribute('aria-hidden','true');
  hero.append(icon,el('span','museum-detail-years',h.years));
  root.append(el('div','museum-eyebrow',h.english),el('h2','',h.name),el('p','museum-subtitle',h.award),hero);
  root.append(el('h3','',h.caption),el('p','museum-story',h.detail));
  root.append(el('p','museum-object-label','展品：'+museumObjectLabel(h)));
  const records=el('dl','museum-records');
  for(const [year,record] of h.records)records.append(el('dt','',year),el('dd','',record));
  root.append(records);
  sourcesIn(root,h.sources,'资料来源 · 核对于 '+museumVerified);
  detailNavigation(root,personalHonours,personalHonours.indexOf(h),(target,previous)=>openMuseumExhibit(target.id,previous),catalogue);
 });
}

export function openMuseumClubExhibit(year,catalogue){
 const h=honours.find(h=>h.year===year);
 if(!h)return;
 openMuseum(root=>{
  const hero=el('div','museum-detail-hero museum-team-hero');
  const final=h.kind==='europe';
  hero.append(el('span','museum-detail-years',h.score));
  if(final)hero.append(el('span','museum-exhibit-context',h.opponent));
  root.append(el('div','museum-eyebrow','FC BAYERN / '+h.city),el('h2','',final?h.year+' · '+h.title:h.title));
  root.append(el('p','museum-subtitle',final?clubAwardName(h):h.opponent),hero,el('p','museum-story',h.detail));
  sourcesIn(root,[{label:'查看历史资料',url:h.source}]);
  detailNavigation(root,honours,honours.indexOf(h),(target,previous)=>openMuseumClubExhibit(target.year,previous),catalogue);
 });
}

export function openMuseumCatalog({query='',category='all',scrollTop=0,focus=''}={}){
 openMuseum(root=>{
  root.append(el('h2','','展览目录'),el('p','museum-subtitle','中央 · 球队奖杯　两侧 · 球员个人荣誉'));
  const label=el('label','museum-search'),input=el('input');
  input.type='search';
  input.placeholder='搜索球员、奖项或年份';
  input.setAttribute('aria-label',input.placeholder);
  input.value=query;
  label.append(input);
  const tabs=el('div','museum-filters'),grid=el('div','museum-card-grid'),count=el('p','museum-count');
  tabs.setAttribute('aria-label','展览分类');
  count.setAttribute('aria-live','polite');
  function addCard({key,icon,period,name,summary,context,open}){
   const card=el('button','museum-card');
   card.dataset.exhibit=key;
   card.setAttribute('aria-label',[period,name,summary].filter(Boolean).join(' · '));
   const top=el('div','museum-card-top'),mark=el('span','',icon);
   mark.setAttribute('aria-hidden','true');
   top.append(mark,el('small','',period));
   card.append(top,el('b','',name),el('span','',summary),el('small','',context));
   card.onclick=()=>open({query:input.value,category,scrollTop:root.scrollTop,focus:key});
   grid.append(card);
  }
  function update(){
   const {clubs,individuals}=filterMuseumHonours(input.value,category),total=clubs.length+individuals.length;
   grid.replaceChildren();
   count.textContent=category==='all'&&!input.value.trim()
    ?total+' 组展陈 · '+clubs.length+' 组球队奖杯与 '+individuals.length+' 组个人荣誉'
    :total+' 组展陈';
   for(const button of tabs.children)button.setAttribute('aria-pressed',String(button.dataset.category===category));
   for(const h of clubs){
    const final=h.kind==='europe';
    addCard({key:'club-'+h.year,icon:icons[h.kind],period:final?h.year:'',name:h.title,
     summary:final?clubAwardName(h)+' · '+h.score:h.score,context:final?h.opponent:h.city,
     open:previous=>openMuseumClubExhibit(h.year,previous)});
   }
   for(const h of individuals)addCard({key:'personal-'+h.id,icon:icons[h.category],period:h.years,
    name:h.name,summary:h.award,context:h.english,open:previous=>openMuseumExhibit(h.id,previous)});
   if(!total)grid.append(el('p','museum-empty','没有找到匹配的展柜。试试姓名、温布利或年份。'));
  }
  for(const [id,name] of filters){
   const button=el('button','',name);
   button.dataset.category=id;
   button.onclick=()=>{category=id;update();};
   tabs.append(button);
  }
  input.oninput=update;
  root.append(label,tabs,count,grid);
  const reference=el('details','museum-reference');
  reference.append(el('summary','','参照了哪些真实展陈？'));
  reference.append(el('p','','参考 2026 年双排奖杯大道的透光展台、深色设备顶，以及凯恩个人展柜中的球衣与比赛纪念物。本场景压缩展示空间，未复刻整座 3,300 平方米博物馆的平面。'));
  for(const source of museumReferences){
   const link=el('a','',source.label+' ↗');
   link.href=source.url;
   link.target='_blank';
   link.rel='noopener';
   reference.append(link);
  }
  root.append(reference,el('p','museum-footnote','对准场景中的展柜或展品，按 F 或点互动按钮，也能查看同一份资料。'));
  update();
 },{scrollTop,focus});
}
