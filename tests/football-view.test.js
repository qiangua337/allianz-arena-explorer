import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../dist/vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:()=>{}});
globalThis.document={createElement:()=>({getContext:()=>context}),createElementNS:()=>{const listeners={};return{addEventListener:(k,f)=>listeners[k]=f,removeEventListener(){},set src(value){queueMicrotask(()=>listeners.load?.call(this));}};}};
const {THREE}=await import('../dist/kit.js');
const {buildEntrancePlayers,matchOfficialPose}=await import('../dist/entrance-players.js');
const {applyFootballAction}=await import('../dist/football-action-pose.js');
const {buildFootballView}=await import('../dist/football-view.js');
const {homeXI,awayXI}=await import('../dist/matchday-roster.js');
const {createFootballSimulation}=await import('../dist/football-simulation.js');
const {buildArenaScreens}=await import('../dist/arena-screens.js');
const realFetch=globalThis.fetch;
globalThis.fetch=async url=>{const data=await fs.readFile(new URL(url));return{ok:true,json:async()=>JSON.parse(data),arrayBuffer:async()=>data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength)};};
const scene=new THREE.Scene(),actors=buildEntrancePlayers(scene);await actors.prepare();globalThis.fetch=realFetch;
const makeState=()=>({players:[...homeXI,...awayXI].map((d,i)=>({id:d.team+':'+d.player.number,team:d.team,index:i%11,number:d.player.number,name:d.player.name,keeper:d.keeper,x:-22+i%11*4,z:i<11?-20:20,vx:0,vz:0,yaw:i<11?Math.PI:0})),controlledId:'home:9',ball:{x:0,y:.11,z:0,vx:0,vy:0,vz:0,ownerId:null},phase:'playing'});

test('live match actors use their own team and shirt number positions instead of the camera or entrance queue',()=>{
 const state=makeState();actors.reset();actors.updateMatch(state,0,new THREE.Vector3(0,5,0));scene.updateMatrixWorld(true);
 const starters=actors.root.children.filter(o=>o.userData.role==='player');assert.equal(starters.length,22);
 for(const actor of actors.root.children.filter(o=>o.isGroup))assert.ok(actor.position.toArray().every(Number.isFinite),actor.name+' position');assert.equal(actors.positions.split(';').length,52);
 for(const actor of starters){const p=state.players.find(p=>p.team===actor.userData.team&&p.number===actor.userData.playerNumber);assert.ok(p);assert.ok(actor.visible);assert.equal(actor.position.x,p.x);assert.equal(actor.position.z,p.z);assert.equal(actor.position.y,0);}
 const fixed=starters.map(o=>o.position.toArray());actors.updateMatch(state,.1,new THREE.Vector3(28,2,-40));assert.deepEqual(starters.map(o=>o.position.toArray()),fixed);
 actors.updateMatch(state,.2,new THREE.Vector3(0,1.7,0),{firstPerson:true});assert.equal(starters.filter(o=>o.visible).length,21);assert.equal(starters.find(o=>o.userData.team==='home'&&o.userData.playerNumber===9).visible,false);
 actors.updateMatch(state,.3,new THREE.Vector3(0,5,0));assert.equal(starters.filter(o=>o.visible).length,22);
});

test('officials track play along the touchlines without teleporting with a long pass',()=>{
 const referee={role:'referee',phase:0},assistant={role:'assistantReferee',flag:true,phase:.7};let p=matchOfficialPose(referee,{x:0,z:0},null);
 const next=matchOfficialPose(referee,{x:33,z:50},p,.1);assert.ok(Math.hypot(next.x-p.x,next.z-p.z)<=.340001);assert.ok(next.moving);assert.ok(Math.abs(next.x)<28&&Math.abs(next.z)<45);
 assert.equal(matchOfficialPose(assistant,{x:0,z:70},null).x,-35.5);assert.equal(matchOfficialPose({...assistant,phase:1.4},{x:0,z:0},null).x,35.5);assert.equal(matchOfficialPose(assistant,{x:0,z:70},null).z,49);
 const paused=matchOfficialPose(referee,{x:33,z:50},p,0);assert.equal(paused.x,p.x);assert.equal(paused.z,p.z);
 assert.deepEqual(matchOfficialPose({role:'fourth'},null,null),{x:-37.4,z:3.8,yaw:Math.PI/2,moving:false});
});

test('ball and selected-player cues follow simulation state and switching perspective reuses the same character objects',()=>{
 const ball=new THREE.Mesh(new THREE.IcosahedronGeometry(.11,1),new THREE.MeshBasicMaterial()),view=buildFootballView(scene,ball,actors),state=makeState(),childCount=actors.root.children.length;scene.add(ball);
 view.setEnabled(true);view.update(state,1,new THREE.Vector3(0,6,0));assert.equal(ball.position.y,.115);assert.equal(view.root.getObjectByName('Controlled footballer').position.x,state.players.find(p=>p.id===state.controlledId).x);
 state.ball.x=1;state.ball.z=-2;state.ball.y=2;view.update(state,1.1,new THREE.Vector3(0,6,0),{firstPerson:true});assert.equal(ball.position.x,1);assert.equal(ball.position.y,2);assert.equal(ball.position.z,-2);assert.notEqual(ball.rotation.x,0);assert.equal(view.root.getObjectByName('Game ball marker').visible,false);assert.equal(actors.root.children.length,childCount);
 const before=JSON.stringify(state);view.update(state,1.2,new THREE.Vector3(30,15,40));assert.equal(JSON.stringify(state),before);view.setEnabled(false);assert.equal(view.root.visible,false);view.update(state,1.3,new THREE.Vector3());assert.equal(view.root.visible,false);
});


test('shot aiming shows body-condition dispersion and stops at first landing without altering the simulated shot',()=>{
 const state=makeState(),p=state.players.find(p=>p.id===state.controlledId),view=buildFootballView(new THREE.Scene(),null,{ready:true,root:new THREE.Group(),updateMatch(){}});view.setEnabled(true);state.ball.ownerId=p.id;state.chargePower=.7;state.shotKind='drive';state.shotPreview={x:2,y:.8,z:-52.5,vx:1,vz:-28,vy:4,flight:1,distance:28,quality:.4,preparation:'backfoot',spread:2,heightSpread:.6};
 const before=JSON.stringify(state);view.update(state,1,new THREE.Vector3());assert.equal(JSON.stringify(state),before);
 const guide=view.root.getObjectByName('Directional pass or charged shot preview'),dispersion=view.root.getObjectByName('Shot preparation dispersion'),aim=view.root.getObjectByName('Charged shot goal target'),points=guide.geometry.attributes.position,distances=guide.geometry.attributes.lineDistance;
 assert.equal(guide.visible,true);assert.equal(dispersion.visible,true);assert.equal(dispersion.geometry.drawRange.count,6);assert.equal(aim.rotation.x,-Math.PI/2);assert.ok(points.getZ(32)>state.shotPreview.z);assert.ok(Math.abs(points.getY(32)-.11)<1e-6);assert.equal(guide.material.color.getHex(),0xf39483);
 Object.assign(state.shotPreview,{vy:6,flight:.5,quality:1,preparation:'balanced'});view.update(state,1.1,new THREE.Vector3());assert.equal(dispersion.geometry.drawRange.count,12);assert.equal(aim.rotation.x,0);assert.equal(guide.material.color.getHex(),0xf2c46c);
 assert.equal(guide.geometry.attributes.lineDistance,distances,'the guide reuses its GPU buffer');
 assert.ok(distances.getX(32)>distances.getX(31));
 state.chargePower=0;state.passPreview={x:3,z:4};view.update(state,1.15,new THREE.Vector3());
 assert.equal(guide.geometry.drawRange.count,2);assert.equal(distances.getX(1),5);
 state.chargePower=0;state.shotPreview=null;state.passPreview=null;view.update(state,1.2,new THREE.Vector3());assert.equal(guide.visible,false);assert.equal(aim.visible,false);assert.equal(dispersion.visible,false);
});

test('a ball previously frozen with the static arena still visibly moves through its world matrix during live play',()=>{
 const frozenBall=new THREE.Mesh(new THREE.SphereGeometry(.11),new THREE.MeshBasicMaterial());frozenBall.position.set(0,.115,0);scene.add(frozenBall);frozenBall.updateMatrix();frozenBall.matrixAutoUpdate=false;frozenBall.matrixWorldAutoUpdate=false;
 const view=buildFootballView(scene,frozenBall,actors),state=makeState();view.setEnabled(true);Object.assign(state.ball,{x:12,y:1.4,z:-21});view.update(state,3,new THREE.Vector3());scene.updateMatrixWorld(true);
 assert.equal(frozenBall.matrixAutoUpdate,true);assert.equal(frozenBall.matrixWorldAutoUpdate,true);assert.deepEqual(frozenBall.getWorldPosition(new THREE.Vector3()).toArray(),[12,1.4,-21]);Object.assign(state.ball,{x:-4,y:.11,z:7});view.update(state,3.1,new THREE.Vector3());scene.updateMatrixWorld(true);assert.deepEqual(frozenBall.getWorldPosition(new THREE.Vector3()).toArray(),[-4,.115,7]);
});


test('the free running clips and football strokes keep the support leg while exposing actual action feedback',()=>{
 const bones=Array.from({length:18},()=>new THREE.Bone()),support=[9,10,11].map(i=>bones[i].quaternion.toArray());applyFootballAction(bones,{type:'shoot',elapsed:.2,duration:.4});assert.notDeepEqual(bones[15].quaternion.toArray(),[0,0,0,1]);assert.deepEqual([9,10,11].map(i=>bones[i].quaternion.toArray()),support);assert.deepEqual(bones[0].position.toArray(),[0,0,0]);
});

test('opponent changes update the actual athlete shirts, numbers and matching world positions, then restore the original squad',()=>{
 for(const opponent of['madrid','barcelona','city','dortmund']){actors.setOpponent(opponent);actors.reset();const state=createFootballSimulation({opponent}).state;actors.updateMatch(state,0,new THREE.Vector3(0,20,0));const away=actors.root.children.filter(o=>o.userData.role==='player'&&o.userData.team==='away');assert.equal(away.length,11);for(const o of away){const p=state.players.find(p=>p.team==='away'&&p.number===o.userData.playerNumber);assert.ok(p,o.name);assert.ok(o.name.endsWith(p.name));assert.equal(o.position.x,p.x);assert.equal(o.position.z,p.z);assert.ok(o.getObjectByName('athlete').material.map);}}
 assert.equal(awayXI[1].player.name,'GUIRASSY');
});

test('distant match athletes use substantially fewer triangles while preserving finite normalized skin weights',()=>{
 actors.reset();actors.updateMatch(makeState(),0,new THREE.Vector3(70,20,70));const body=actors.root.children.find(o=>o.userData.role==='player'&&o.userData.playerNumber===9).getObjectByName('athlete'),g=body.geometry;assert.ok(g.index.count/3<9000);const a=g.attributes;for(let i=0;i<a.position.count;i++){assert.ok([a.position.getX(i),a.position.getY(i),a.position.getZ(i)].every(Number.isFinite));let weight=0;for(let j=0;j<4;j++)weight+=a.skinWeight.array[i*4+j];assert.ok(Math.abs(weight-1)<.00001);}
});

test('both featured players share their studio model with the live match and preserve the rig and shoes',async()=>{
 const kane=await actors.preview('kane'),musiala=await actors.preview('musiala');
 const profiles=[kane,musiala];
 for(const actor of profiles){
  const starter=actors.root.children.find(o=>o.userData.role==='player'&&o.userData.team==='home'&&o.userData.playerNumber===actor.definition.player.number);
  const data=makeState(),p=data.players.find(p=>p.team==='home'&&p.number===actor.definition.player.number);
  actors.updateMatch(data,1,new THREE.Vector3(p.x,1.7,p.z));
  assert.equal(starter.getObjectByName('athlete').geometry,actor.body.geometry);
  assert.equal(actor.body.skeleton.bones.length,18);
  assert.equal(actor.body.geometry.groups.length,0);
 }
 function dimensions(actor,part){
  const geometry=actor.body.geometry,{start,count}=geometry.userData.parts[part],positions=geometry.attributes.position;
  let left=Infinity,right=-Infinity,front=-Infinity,back=Infinity;
  for(let i=start;i<start+count;i++){
   const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
   if(part==='shirt'&&(y<1.28||y>1.49))continue;
   left=Math.min(left,x);right=Math.max(right,x);front=Math.max(front,z);back=Math.min(back,z);
  }
  return [right-left,front-back];
 }
 const [wide,slim]=profiles.map(actor=>dimensions(actor,'shirt'));
 assert.ok(wide[0]>slim[0]+.02&&wide[1]>slim[1]+.02);
 assert.deepEqual(dimensions(kane,'bootL'),dimensions(musiala,'bootL'));
 assert.equal(kane.definition.height,1.88);assert.equal(musiala.definition.height,1.86);
 for(const actor of profiles){actor.body.material.map.dispose();actor.body.material.dispose();actor.body.skeleton.dispose();}
});

test('every numbered Bayern player previews a distinct head and reserves can start with that same model',async()=>{
 const {numberedPlayers}=await import('../dist/roster.js');
 const {defaultSelection}=await import('../dist/football-squads.js');
 const {rosterHeadProfile}=await import('../dist/football-roster-heads.js');
 const models=new Map();
 for(const {number} of numberedPlayers){
  const actor=await actors.preview(String(number));
  const geometry=actor.body.geometry;
  assert.equal(actor.definition.player.number,number);
  assert.equal(geometry.groups.length,0);
  if(number!==9&&number!==10)assert.ok(rosterHeadProfile(actor.definition),'missing appearance for #'+number);
  models.set(number,geometry);
  actor.body.material.map.dispose();actor.body.material.dispose();actor.body.skeleton.dispose();
 }
 assert.equal(new Set(models.values()).size,numberedPlayers.length);
 const kim=models.get(3),ito=models.get(21);
 assert.notDeepEqual(kim.attributes.position.array,ito.attributes.position.array);
 const selection=defaultSelection('home');selection.xi[2]=47;
 const state=createFootballSimulation({selections:{home:selection}}).state;
 const reserve=state.players.find(p=>p.team==='home'&&p.number===47);
 assert.ok(reserve);
 actors.reset();actors.updateMatch(state,0,new THREE.Vector3(reserve.x,1.7,reserve.z));
 const rendered=actors.root.children.find(o=>o.userData.team==='home'&&o.userData.role==='player'&&o.userData.playerNumber===47);
 assert.equal(rendered.getObjectByName('athlete').geometry,models.get(47));
 assert.equal(state.teamSheets.home.bench.length,9);
 actors.setOpponent('dortmund');
});

test('live substitutions replace the same field actor and sent-off players disappear from the rendered eleven',()=>{
 const sim=createFootballSimulation({rules:{mode:'league',duration:180}}),s=sim.state;actors.setOpponent('dortmund');actors.reset();actors.updateMatch(s,0,new THREE.Vector3(0,20,0));const actor=actors.root.children.find(o=>o.userData.role==='player'&&o.userData.team==='home'&&o.userData.playerNumber===9),oldMap=actor.getObjectByName('athlete').material.map;
 assert.equal(sim.substitute('home','home-1',7).ok,true);actors.updateMatch(s,.1,new THREE.Vector3(0,20,0));assert.equal(actor.userData.playerNumber,7);assert.ok(actor.name.endsWith('GNABRY'));assert.notEqual(actor.getObjectByName('athlete').material.map,oldMap);assert.ok(actor.visible);
 s.players[1].dismissed=true;actors.updateMatch(s,.2,new THREE.Vector3(0,20,0));assert.equal(actor.visible,false);assert.equal(actors.root.children.filter(o=>o.userData.role==='player'&&o.userData.team==='home'&&o.visible).length,10);actors.setOpponent('dortmund');assert.equal(actor.userData.playerNumber,9);assert.ok(actor.name.endsWith('KANE'));
});

test('the actual LED display follows the chosen opponent and live score without allocating a texture each frame',()=>{
 const labels=[];context.fillText=s=>labels.push(s);const bowl=new THREE.Group(),screens=buildArenaScreens(bowl,{add(){}},{dark:new THREE.MeshBasicMaterial(),steel:new THREE.MeshBasicMaterial()}),s=createFootballSimulation({opponent:'barcelona'}).state;
 labels.length=0;screens.setMatchScore(s);assert.ok(labels.includes('FC BAYERN × FC BARCELONA'));assert.ok(!labels.includes('DORTMUND'));const material=bowl.children[0].children.find(o=>o.geometry?.type==='PlaneGeometry').material,texture=material.map,version=texture.version;screens.setMatchScore(s);assert.equal(texture.version,version);s.score.home=1;screens.setMatchScore(s);assert.equal(material.map,texture);assert.ok(texture.version>version);assert.ok(labels.includes('1 : 0'));delete context.fillText;
});
test('real jog and sprint skins stay finite and above the pitch through acceleration and turning',()=>{
 const state=makeState(),selected=state.players.find(p=>p.id===state.controlledId);actors.reset();const point=new THREE.Vector3();
 for(let frame=0;frame<150;frame++){
  const speed=frame<60?frame/60*7.1:7.1;selected.z-=speed/60;selected.vz=-speed;selected.yaw=Math.PI;actors.updateMatch(state,frame/60,new THREE.Vector3(selected.x,4,selected.z+5));scene.updateMatrixWorld(true);
  const group=actors.root.children.find(o=>o.userData.team==='home'&&o.userData.playerNumber===9),body=group.getObjectByName('athlete');let minimum=Infinity;
  for(const name of['bootL','bootR']){const part=body.geometry.userData.parts[name];for(let i=part.start;i<part.start+part.count;i++){body.getVertexPosition(i,point);body.localToWorld(point);minimum=Math.min(minimum,point.y);}}
  assert.ok(Number.isFinite(minimum)&&minimum>-.10&&minimum<.55,'grounded running at frame '+frame+': '+minimum);
 }
});
