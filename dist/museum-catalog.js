import {personalHonours,museumFilters,filterPersonalHonours,museumVerified,museumObjectLabel} from './personal-honours.js';
import {museumReferences} from './museum-references.js';
const el=(tag,cls,text)=>{const o=document.createElement(tag);if(cls)o.className=cls;if(text)o.textContent=text;return o;};
const icons={ballon:'◉',scorer:'◒',world:'✦',europe:'◇'};
function openMuseum(render){
 const dialog=document.getElementById('info-dialog');document.exitPointerLock?.();document.dispatchEvent(new CustomEvent('museum-open'));dialog.classList.add('museum-dialog');const content=document.getElementById('dialog-content');render(content);
 if(!dialog.open){dialog.showModal();dialog.addEventListener('close',()=>dialog.classList.remove('museum-dialog'),{once:true});}dialog.scrollTop=0;content.scrollTop=0;
}
export function openMuseumExhibit(id){
 const h=personalHonours.find(h=>h.id===id);if(!h)return;
 openMuseum(root=>{root.replaceChildren();const back=el('button','museum-back','← 返回展览目录');back.onclick=()=>openMuseumCatalog();root.append(back);
  const eyebrow=el('div','museum-eyebrow','INDIVIDUAL GREATNESS / '+h.english),hero=el('div','museum-detail-hero'),icon=el('span','museum-award-symbol',icons[h.category]);icon.setAttribute('aria-hidden','true');hero.append(icon,el('span','museum-detail-years',h.years));root.append(eyebrow,el('h2','',h.name),el('p','museum-subtitle',h.award),hero,el('h3','',h.caption),el('p','museum-story',h.detail));
  root.append(el('p','museum-object-label','展品：'+museumObjectLabel(h)));const records=el('dl','museum-records');for(const[year,record]of h.records)records.append(el('dt','',year),el('dd','',record));root.append(records);
  const sources=el('div','museum-sources');sources.append(el('small','','资料来源 · 核对于 '+museumVerified));for(const s of h.sources){const link=el('a','',s.label+' ↗');link.href=s.url;link.target='_blank';link.rel='noopener';sources.append(link);}root.append(sources);
  const browse=el('div','museum-browse'),index=personalHonours.indexOf(h);for(const[delta,label]of[[-1,'← 上一展柜'],[1,'下一展柜 →']]){const b=el('button','',label);b.onclick=()=>openMuseumExhibit(personalHonours[(index+delta+personalHonours.length)%personalHonours.length].id);browse.append(b);}root.append(browse,el('p','museum-footnote','数字展陈为代表性设计；奖杯采用原创简化造型，不代表实物馆藏清单。'));
 });
}
export function openMuseumCatalog(){
 openMuseum(root=>{root.replaceChildren();root.append(el('div','museum-eyebrow','FC BAYERN / HALL OF HONOURS'),el('h2','','把荣耀，留在这里。'),el('p','museum-subtitle','中央 · 球队冠军　两侧 · 球员个人荣誉'));
  const intro=el('div','museum-catalog-intro');intro.append(el('strong','','18'),el('span','','组展陈 / 8 组球队奖杯与 10 组个人荣誉'));root.append(intro);
  const label=el('label','museum-search'),input=el('input');input.type='search';input.placeholder='搜索球员、奖项或年份';input.setAttribute('aria-label','搜索个人荣誉');label.append(input);root.append(label);
  const reference=el('details','museum-reference');reference.append(el('summary','','参照了哪些真实展陈？'));reference.append(el('p','','参考 2026 年双排奖杯大道的透光展台、深色设备顶，以及凯恩个人展柜中的球衣与比赛纪念物。本场景压缩展示空间，未复刻整座 3,300 平方米博物馆的平面。'));for(const s of museumReferences){const a=el('a','',s.label+' ↗');a.href=s.url;a.target='_blank';a.rel='noopener';reference.append(a);}root.append(reference);
  const tabs=el('div','museum-filters');tabs.setAttribute('aria-label','个人荣誉分类');const grid=el('div','museum-card-grid'),count=el('p','museum-count');count.setAttribute('aria-live','polite');let category='all';
  function update(){const list=filterPersonalHonours(input.value,category);grid.replaceChildren();count.textContent=list.length+' 组个人荣誉 · 点开展柜查看故事与资料';for(const button of tabs.children)button.setAttribute('aria-pressed',String(button.dataset.category===category));for(const h of list){const card=el('button','museum-card');card.setAttribute('aria-label',h.name+' · '+h.award+' · '+h.years);const top=el('div','museum-card-top'),icon=el('span','',icons[h.category]);icon.setAttribute('aria-hidden','true');top.append(icon,el('small','',h.years));card.append(top,el('b','',h.name),el('span','',h.award),el('small','',h.english));card.onclick=()=>openMuseumExhibit(h.id);grid.append(card);}if(!list.length)grid.append(el('p','museum-empty','没有找到匹配的展柜。试试姓名、金球或年份。'));}
  for(const[id,name]of museumFilters){const b=el('button','',name);b.dataset.category=id;b.onclick=()=>{category=id;update();};tabs.append(b);}input.oninput=update;root.append(tabs,count,grid,el('p','museum-footnote','金球奖、世界杯金球、欧洲金靴与世界杯金靴分别标注。对准展柜或展品，按 F 查看；目录只负责查阅，不改变所在位置。'));update();
 });
}
