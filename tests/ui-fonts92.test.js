import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';

const directory=new URL('../dist/assets/fonts/',import.meta.url),manifest=JSON.parse(fs.readFileSync(new URL('SOURCES.json',directory))),hash=data=>createHash('sha256').update(data).digest('hex');
const cjk=cp=>[[0x2e80,0x9fff],[0xf900,0xfaff],[0xfe10,0xfe1f],[0xfe30,0xfe4f],[0xff00,0xffef],[0x20000,0x323af]].some(([a,b])=>cp>=a&&cp<=b);
function uiFiles(directory,prefix=''){return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.name==='vendor'?[]:entry.isDirectory()?uiFiles(new URL(entry.name+'/',directory),prefix+entry.name+'/'):/\.(?:js|html)$/.test(entry.name)?[prefix+entry.name]:[]);}

test('the shipped WOFF2 faces and complete licenses match their verified source and output records within the transfer budget',()=>{
 assert.equal(manifest.license,'SIL Open Font License 1.1');assert.equal(manifest.fonts.length,3);let bytes=0;
 for(const font of manifest.fonts){const data=fs.readFileSync(new URL(font.file,directory));assert.equal(data.subarray(0,4).toString(),'wOF2');assert.equal(data.length,font.bytes);assert.equal(hash(data),font.sha256);assert.ok(fs.existsSync(new URL(font.licenseFile,directory)));bytes+=data.length;}
 assert.ok(bytes<450000,'all three faces remain below 450 kB');
 for(const[output,input]of[['OFL-NotoSansSC.txt','NotoSansSC-OFL.txt'],['OFL-BarlowCondensed.txt','BarlowCondensed-OFL.txt']]){const data=fs.readFileSync(new URL(output,directory)),source=manifest.sources.find(s=>s.file===input);assert.equal(hash(data),source.sha256,'the complete upstream license is unchanged');assert.match(data.toString(),/SIL OPEN FONT LICENSE Version 1\.1/);assert.match(source.url,/raw\.githubusercontent\.com\/google\/fonts\/[a-f0-9]{40}\//);}
});

test('both Chinese weights preserve identical current CJK coverage including the final landing copy and credits page',()=>{
 const fonts=manifest.fonts.filter(f=>f.family==='Arena Sans SC');assert.deepEqual(fonts.map(f=>f.weight),[500,800]);assert.equal(fonts[0].characters,fonts[1].characters);const coverage=new Set(manifest.coverage.subsetCodepoints);assert.ok(manifest.coverage.scannedFiles.some(s=>s.file==='visual-credits.html'));
 for(const file of uiFiles(new URL('../dist/',import.meta.url))){const text=fs.readFileSync(new URL('../dist/'+file,import.meta.url),'utf8');const required=[...text].map(c=>c.codePointAt(0));for(const match of text.matchAll(/\\u\{([0-9a-fA-F]{1,6})\}|\\u([0-9a-fA-F]{4})/g))required.push(parseInt(match[1]||match[2],16));for(const match of text.matchAll(/&#(?:x([0-9a-fA-F]+)|(\d+));/g))required.push(parseInt(match[1]||match[2],match[1]?16:10));for(const cp of required)if(cjk(cp))assert.ok(coverage.has(cp),'rebuild fonts for '+file+' U+'+cp.toString(16).toUpperCase());}
 for(const c of '这里是主场。下一脚，你来。人机实战好友联机步行探索一键传送球员视角感受声浪影像与字体来源')assert.ok(coverage.has(c.codePointAt(0)),c);
});
