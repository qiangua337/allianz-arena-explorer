import test from 'node:test';
import assert from 'node:assert/strict';
import {floorHeight,groundHeight,esplanadeHeight,mainEntrance,hitsWall,MAX_STEP} from '../dist/navigation.js';
import {numberedPlayers,playerByNumber} from '../dist/roster.js';

const geometry={tiers:[{a:43,b:61,y:.7,rows:30,depth:.76,angle:24},{a:66,b:84,y:13.2,rows:24,depth:.76,angle:30},{a:85,b:103,y:27.1,rows:26,depth:.73,angle:34}],rooms:{store:{x:0,z:111,y:12.2,w:29,d:14}}};

test('first-person entrance is outside the arena, on the promenade',()=>{
 assert.ok(mainEntrance.z>169);
 assert.equal(floorHeight(mainEntrance.x,mainEntrance.z,esplanadeHeight(mainEntrance.z)+.055,geometry),groundHeight(mainEntrance.x,mainEntrance.z));
});

test('walking below stands or the shop never jumps to their upper floor',()=>{
 assert.equal(floorHeight(80,0,-2.9,geometry),-2.9);
 assert.equal(floorHeight(0,111,-2.9,geometry),-2.9);
 assert.equal(floorHeight(0,111,12.2,geometry),12.2);
});

test('the complete south entrance approach has no impassable height jump',()=>{
 let feet=groundHeight(0,214);
 for(let z=214;z>=139;z-=.1){const floor=floorHeight(0,z,feet,geometry);assert.ok(floor-feet<=MAX_STEP+.001,`height jump at z=${z}`);feet=floor;}
});

test('the player tunnel staircase still reaches pitch level',()=>{
 let feet=-2.7;
 for(let x=-63;x<=-39;x+=.08){const floor=floorHeight(x,0,feet,geometry);assert.ok(floor-feet<=MAX_STEP+.001);feet=floor;}
 assert.equal(feet,0);
});

test('hidden room walls cannot block an open route; visible walls stop the body',()=>{
 const walls=[{x0:-1,x1:1,z0:-1,z1:1,y0:-3,y1:1,owner:'room'}];
 assert.equal(hitsWall(0,0,-1.3,walls,()=>false),false);
 assert.equal(hitsWall(0,0,-1.3,walls,()=>true),true);
 assert.equal(hitsWall(0,0,13.9,walls,()=>true),false);
 const cabinet=[{x0:-1,x1:1,z0:-1,z1:1,y0:0,y1:1.2}];
 assert.equal(hitsWall(0,0,1.7,cabinet),true);
});

test('current jerseys use verified unique player-number pairs',()=>{
 assert.equal(playerByNumber(9).name,'KANE');
 assert.equal(playerByNumber(10).name,'MUSIALA');
 assert.equal(playerByNumber(42).name,'KARL');
 assert.equal(new Set(numberedPlayers.map(p=>p.number)).size,numberedPlayers.length);
 assert.ok(!numberedPlayers.some(p=>/LEWANDOWSKI|ROBBEN|RIBÉRY|LAHM|BOATENG|SCHWEINSTEIGER|ALABA|MÜLLER/.test(p.name)));
});
