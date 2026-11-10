import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../dist/vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const{THREE}=await import('../dist/kit.js');
const{atlasGeometry,athleteAtlasCells,faceTextureWindow}=await import('../dist/football-appearance.js');
const dir=new URL('../dist/assets/players/',import.meta.url),data=JSON.parse(fs.readFileSync(new URL('footballer-850.json',dir))),file=fs.readFileSync(new URL('footballer-850.bin',dir));
function raw(part){const g=new THREE.BufferGeometry(),a=new Float32Array(file.buffer,file.byteOffset+part.offset,part.vertices*16);let offset=0;for(const[name,size]of Object.entries({position:3,normal:3,uv:2,skinIndex:4,skinWeight:4})){const values=[];for(let i=0;i<part.vertices;i++)values.push(...a.slice(i*16+offset,i*16+offset+size));g.setAttribute(name,new THREE.BufferAttribute(name==='skinIndex'?new Uint16Array(values):new Float32Array(values),size));offset+=size;}g.setIndex(new THREE.BufferAttribute(new Uint16Array(file.buffer,file.byteOffset+part.indexOffset,part.indexCount),1));return g;}
const geometries=Object.fromEntries(data.parts.map(p=>[p.name,raw(p)]));
test('the facial patch preserves all 17,700 anatomical triangles and their original positions, normals and skinning',()=>{
 assert.equal(data.parts.filter(p=>['skin','face'].includes(p.name)).reduce((n,p)=>n+p.triangles,0),17700);assert.deepEqual(data.faceUV,faceTextureWindow);const joined=atlasGeometry(geometries,'short02');
 for(const name of['skin','face']){const range=joined.userData.parts[name],source=geometries[name];for(const key of['position','normal','skinIndex','skinWeight']){const attribute=joined.attributes[key],original=source.attributes[key];for(let i=0;i<range.count*original.itemSize;i++)assert.equal(attribute.array[range.start*original.itemSize+i],original.array[i],name+' '+key);}}
});
test('a 512px atlas spends more texels on the original facial UV window without increasing its texture or draw-call budget',()=>{
 const joined=atlasGeometry(geometries,'crop'),range=joined.userData.parts.face,source=geometries.face.attributes.uv,cell=athleteAtlasCells.face,[u0,v0,u1,v1]=faceTextureWindow;
 const oldPixels=512*512*.5*.5*(u1-u0)*(v1-v0),newPixels=512*512*cell[2]*cell[3];assert.ok(newPixels/oldPixels>2.3,'at least 2.3x facial texel area within the existing atlas');
 for(let i=0;i<range.count;i++){const u=joined.attributes.uv.getX(range.start+i),v=joined.attributes.uv.getY(range.start+i),originalU=u0+(u-cell[0]-.002)/(cell[2]-.004)*(u1-u0),originalV=v0+(v-(1-cell[1]-cell[3])-.002)/(cell[3]-.004)*(v1-v0);assert.ok(Math.abs(originalU-source.getX(i))<2e-7&&Math.abs(originalV-source.getY(i))<2e-7,'cropping samples the same facial landmark');}
 assert.equal(joined.groups.length,0,'face and body remain one atlas material');for(const key of['face','skin','shirt']){const[x,y,w,h]=athleteAtlasCells[key];assert.ok(x>=0&&y>=0&&x+w<=1&&y+h<=1);}
 const[a,b]=[athleteAtlasCells.face,athleteAtlasCells.skin];assert.ok(a[0]+a[2]<=b[0],'face never overwrites the arms or knees');
});
test('football boot bounds come from the actual closed soles and studs, with no extra skeleton or material',()=>{
 for(const name of['bootL','bootR']){const source=geometries[name],p=source.attributes.position,bone=data.bones.find(b=>b.name==='foot.'+name.at(-1)),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<p.count;i++)for(let j=0;j<3;j++){const value=p.array[i*3+j]-bone.head[j];min[j]=Math.min(min[j],value);max[j]=Math.max(max[j],value);}for(let j=0;j<3;j++){assert.ok(Math.abs(min[j]-data.bootBounds.min[j])<2e-7);assert.ok(Math.abs(max[j]-data.bootBounds.max[j])<2e-7);}assert.ok(min[1]<-.07,'sole metadata includes stud contact');assert.equal(source.index.count/3,584);for(let i=0;i<p.count;i++)assert.equal(source.attributes.skinWeight.getX(i),1,'equipment follows the foot');}
 assert.equal(data.bones.length,18);
});
