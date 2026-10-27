import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {personalHonours,filterPersonalHonours} from '../dist/personal-honours.js';
import {furniture,furnitureBlocksSegment,pressSeats} from '../dist/furniture-layout.js';
import {pressLayout,pressFloorRise} from '../dist/facility-layout.js';
import {floorHeight} from '../dist/navigation.js';
import {roomSpecs} from '../dist/building-layout.js';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../dist/vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const {goldenBallGeometry,goldenBootGeometry}=await import('../dist/personal-gallery.js');
const {bucketSeatBackGeometry}=await import('../dist/facility-equipment.js');
test('personal awards separate Ballon d’Or from World Cup awards and supply primary provenance',()=>{
 assert.equal(personalHonours.length,10);assert.equal(new Set(personalHonours.map(h=>h.id)).size,10);assert.deepEqual(personalHonours.filter(h=>h.category==='ballon').map(h=>h.years),['1970','1972 · 1976','1980 · 1981','2026']);assert.equal(personalHonours.find(h=>h.id==='kahn').award,'世界杯金球奖');assert.equal(personalHonours.find(h=>h.id==='neuer').kind,'glove');assert.equal(personalHonours.find(h=>h.id==='ribery').category,'europe');assert.ok(personalHonours.every(h=>h.records.length&&h.sources.every(s=>/^https:\/\/(app\.)?(fcbayern.com|fifa.com|www.fifa.com|www.uefa.com|app.francefootball.fr)/.test(s.url))));
 assert.deepEqual(filterPersonalHonours('KANE').map(h=>h.id),['kane-ballon','kane-shoe']);assert.equal(filterPersonalHonours('', 'ballon').length,4);assert.ok(filterPersonalHonours('莱万','scorer').length);assert.equal(filterPersonalHonours('卡恩','ballon').length,0);assert.equal(filterPersonalHonours('nonsense').length,0);
});
test('eighteen physical exhibits leave the door, main aisle and two outer aisles clear',()=>{
 assert.equal(furniture.filter(f=>f.owner==='museum').length,18);for(const x of[-101.5,-96,-90.5])assert.equal(furnitureBlocksSegment({x,z:45.7},{x,z:70.3},'museum'),false);assert.equal(furnitureBlocksSegment({x:-88.3,z:58},{x:-96,z:58},'museum'),false);
 for(const h of personalHonours){const f=furniture.find(f=>f.owner==='museum'&&Math.abs(f.x-(-96+h.x))<.01&&Math.abs(f.z-(58+h.z))<.01);assert.ok(f);assert.ok(Math.abs(h.z)<11);if(h.x>0)assert.ok(Math.abs(h.z)>3,'east doorway must stay open');}
});
test('distinct shoe, panelled ball and seat geometries have finite human-scale bounds',()=>{
 const ball=goldenBallGeometry(),shoe=goldenBootGeometry(),seat=bucketSeatBackGeometry();for(const g of[ball,shoe,seat]){g.computeBoundingBox();for(const value of g.attributes.position.array)assert.ok(Number.isFinite(value));assert.ok(g.boundingBox.max.y>g.boundingBox.min.y);}
 assert.ok(ball.boundingBox.max.x-ball.boundingBox.min.x>.6);assert.ok(shoe.boundingBox.max.x-shoe.boundingBox.min.x>.8);assert.ok(seat.boundingBox.max.x-seat.boundingBox.min.x<.65&&seat.boundingBox.max.y<1.1);
});
test('180 media seats, visual risers and walk floors agree while all three aisles remain clear',()=>{
 assert.equal(pressSeats.length,180);assert.equal(pressLayout.rows,9);for(const s of pressSeats){assert.ok(Math.abs(pressFloorRise(s.z)-s.y)<1e-8);assert.ok(Math.abs(floorHeight(-82,-31+s.z,-2.7+s.y,{rooms:roomSpecs})-(-2.7+s.y))<1e-8);}
 for(const x of[-91,-82,-72.8])assert.equal(furnitureBlocksSegment({x,z:-33.4},{x,z:-23.2},'press'),false);
});
