import test from 'node:test';
import assert from 'node:assert/strict';
import {buildEditorialCover} from '../dist/editorial-cover.js';

class Element extends EventTarget{
 constructor(id=''){super();this.id=id;this.dataset={};this.attributes=new Map();this.textContent='';this.writes=[];this.listeners=new Set();}
 setAttribute(name,value){this.attributes.set(name,String(value));this.writes.push([name,String(value)]);}
 getAttribute(name){return this.attributes.get(name)??null;}
 addEventListener(type,handler,...args){super.addEventListener(type,handler,...args);this.listeners.add([type,handler]);}
 removeEventListener(type,handler,...args){super.removeEventListener(type,handler,...args);for(const entry of this.listeners)if(entry[0]===type&&entry[1]===handler)this.listeners.delete(entry);}
 click(){this.dispatchEvent(new Event('click'));}
 focus(){throw Error('The cover selector must preserve the native button focus.');}
}
function fixture(initial='kane'){
 const ids=['hub-cover','hub-cover-image','hub-cover-context','hub-cover-name','hub-cover-cn','hub-cover-number'],elements=Object.fromEntries(ids.map(id=>[id,new Element(id)])),buttons=['kane','musiala'].map(id=>{const button=new Element();button.dataset.coverPlayer=id;return button;}),root={activeElement:buttons[0],querySelector:selector=>elements[selector.slice(1)]||null,querySelectorAll:selector=>selector==='button[data-cover-player]'?buttons:[]};elements['hub-cover'].dataset.player=initial;return{root,elements,buttons,image:elements['hub-cover-image'],figure:elements['hub-cover']};
}
function selected(f,id){
 const image=Object.fromEntries(f.image.attributes),caption=['context','name','cn','number'].map(key=>f.elements['hub-cover-'+key].textContent);
 assert.equal(f.figure.dataset.player,id);assert.deepEqual(f.buttons.map(button=>button.getAttribute('aria-pressed')),id==='kane'?['true','false']:['false','true']);
 if(id==='kane'){assert.equal(image.src,'assets/editorial/kane.webp');assert.deepEqual([image.width,image.height],['1000','1022']);assert.match(image.alt,/哈里·凯恩.*拜仁慕尼黑.*2025年萨尔茨堡/);assert.deepEqual(caption,['BAYERN / SALZBURG 2025','HARRY KANE','哈里·凯恩','09']);}
 else{assert.equal(image.src,'assets/editorial/musiala.webp');assert.deepEqual([image.width,image.height],['800','1200']);assert.match(image.alt,/穆西亚拉.*德国队.*2026年世界杯/);assert.deepEqual(caption,['GERMANY / WORLD CUP 2026','JAMAL MUSIALA','穆西亚拉','10']);}
}

test('native button clicks switch the actual image dimensions accessible description and all caption metadata together',()=>{
 const f=fixture(),dispose=buildEditorialCover(f.root);selected(f,'kane');f.root.activeElement=f.buttons[1];f.buttons[1].click();selected(f,'musiala');assert.equal(f.root.activeElement,f.buttons[1],'selection does not steal keyboard focus');f.root.activeElement=f.buttons[0];f.buttons[0].click();selected(f,'kane');assert.equal(f.root.activeElement,f.buttons[0]);dispose();
});

test('repeated activation avoids reassigning the image and uses only the native click event',()=>{
 const f=fixture();buildEditorialCover(f.root);const initial=f.image.writes.length;f.buttons[0].click();f.buttons[0].click();assert.equal(f.image.writes.length,initial);f.buttons[1].dispatchEvent(new Event('click'));selected(f,'musiala');const changed=f.image.writes.length;f.buttons[1].click();assert.equal(f.image.writes.length,changed);for(const button of f.buttons)assert.deepEqual([...button.listeners].map(([type])=>type),['click'],'keyboard activation remains the native button behaviour');
});

test('initial selection is normalized and dispose removes its listeners without resetting the chosen photo',()=>{
 const f=fixture('musiala'),unrelated=()=>{};f.buttons[0].addEventListener('click',unrelated);const dispose=buildEditorialCover(f.root);selected(f,'musiala');dispose();dispose();assert.equal(f.buttons[0].listeners.size,1,'unrelated listeners survive');assert.equal(f.buttons[1].listeners.size,0);f.buttons[0].click();selected(f,'musiala');f.buttons[0].removeEventListener('click',unrelated);
});

test('a page without the cover returns a safe cleanup function without attaching handlers',()=>{
 const f=fixture();delete f.elements['hub-cover-image'];const dispose=buildEditorialCover(f.root);assert.equal(typeof dispose,'function');assert.ok(f.buttons.every(button=>button.listeners.size===0));dispose();
});
