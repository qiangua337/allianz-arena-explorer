import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../dist/vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const {THREE}=await import('../dist/kit.js');
const {buildPlayableMatch}=await import('../dist/playable-match.js');
const {createFootballSimulation}=await import('../dist/football-simulation.js');
const {packOnlineState}=await import('../dist/online-protocol.js');
function fixture(mobile=false,{onReadGameInput,now}={}){
 const nodes=new Map(),node=id=>{if(!nodes.has(id)){const handlers={};nodes.set(id,{hidden:false,textContent:'',dataset:{},classList:{toggle(){}},setAttribute(k,v){this[k]=v;},addEventListener(k,v){handlers[k]=v;},fire(k,v){handlers[k]?.(v);},showModal(){this.open=true;},close(){if(this.open){this.open=false;handlers.close?.();}},focus(){}});}return nodes.get(id);};
 let radarDraws=0;const context=new Proxy({clearRect(){radarDraws++;},createRadialGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:()=>{}}),classes=new Set(),actions=['pass','through','switch','tackle'].map(type=>{const b=node(type==='tackle'?'game-tackle':'action-'+type);b.dataset.gameAction=type;return b;});
 globalThis.document={createElement:()=>({getContext:()=>context}),getElementById:node,querySelectorAll:selector=>selector==='[data-game-action]'?actions:[],exitPointerLock(){},body:{dataset:{},classList:{add:x=>classes.add(x),remove:x=>classes.delete(x)}}};
 node('game-radar').getContext=()=>context;
 for(const id of ['game-penalty-target','game-penalty-dive-target'])node(id).firstElementChild={style:{}};
 let actorUpdates=0,scoreUpdates=0,cheers=0;const contacts=[];const audio={muted:false,state:'playing',cheer(){},cue(){},kick(power){contacts.push(power);},setMuted(value){this.muted=value;}},players={ready:true,root:new THREE.Group(),updateMatch(){actorUpdates++;}},ball=new THREE.Mesh();let game;const views=[];
 game=buildPlayableMatch({scene:new THREE.Scene(),stadium:{matchBall:ball,setMatchScore(){scoreUpdates++;}},players,audio,mobile,onReadGameInput,now,onCamera(){},onView:v=>views.push(v),onPause:value=>game.setPaused(value),onRestart:()=>game.start(),onExit:()=>game.exit(),onCheer:()=>cheers++});
 return{game,node,audio,views,classes,ball,contacts,get actorUpdates(){return actorUpdates;},get scoreUpdates(){return scoreUpdates;},get cheers(){return cheers;},get radarDraws(){return radarDraws;}};
}
const run=(game,seconds,input={})=>{for(let i=0;i<Math.round(seconds*60);i++)game.update(1/60,input,{x:0,y:5,z:9});};

test('an online touch pass sounds once at local contact and keeps the confirmed scoreboard authoritative',()=>{
 const server=createFootballSimulation({humanTeams:['home','away']});
 run(server,3.05);
 const carrier=server.state.players.find(player=>player.id===server.state.controlledIds.home);
 for(const player of server.state.players)if(player.team==='away'){player.x=24;player.z=-30;}
 Object.assign(server.state.ball,{ownerId:carrier.id,x:carrier.x,y:.11,z:carrier.z-.55});
 const listeners=new Set(),sent=[];
 const session={team:'home',opponent:'dortmund',code:'ABCDEFGH',connection:'connected',latency:300,
  room:{started:true,seats:[{team:'home'},{team:'away'}]},packet:packOnlineState(server.state,1),
  subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},setReady(){},leave(){},
  send(message){sent.push(message);return true;},sendInput(){return 1;}
 };
 const {game,node,contacts}=fixture(true);
 game.start({},session);game.ready();
 node('action-pass').fire('pointerdown',{pointerType:'touch',pointerId:1,preventDefault(){}});
 assert.equal(sent.filter(message=>message.action==='pass').length,1);
 assert.deepEqual(contacts,[.6]);
 assert.equal(game.state.ball.ownerId,carrier.id);
 assert.equal(game.state.stats.home.passes,0);
 run(game,.14);
 assert.equal(server.action('pass',{},'home'),true);
 session.packet=packOnlineState(server.state,2);
 for(const notify of listeners)notify();
 run(game,.1);
 assert.deepEqual(contacts,[.6],'the matching server event must not sound the same kick again');
 assert.equal(game.state.stats.home.passes,1);
 assert.deepEqual(game.state.score,server.state.score);
 game.exit();
});

test('touch first-time passing and shooting prepare the actual receiver without taking back a ball in flight',()=>{
 const f=fixture(true);f.game.start({training:'passing'});f.game.ready();f.game.action('pass');run(f.game,.04);const receiver=f.game.state.receiveTarget.playerId;
 assert.equal(f.node('action-pass').disabled,false);assert.equal(f.node('game-shoot').disabled,false);assert.equal(f.node('game-tackle').disabled,true);assert.ok(f.node('game-ball-hint').textContent.includes('接应'));
 assert.equal(f.game.beginCharge(),true);run(f.game,.2);assert.equal(f.node('game-shoot')['aria-pressed'],'true');assert.equal(f.node('game-charge-advice').textContent,'松手预备 · 真实接球后起脚');assert.equal(f.game.root.getObjectByName('Charged shot goal target').visible,false,'incoming reception must not display a fabricated shooting arc');assert.ok([...f.game.root.getObjectByName('Directional pass or charged shot preview').geometry.attributes.position.array].every(Number.isFinite));assert.equal(f.game.releaseCharge(),true);assert.equal(f.game.state.stats.home.shots,0);assert.equal(f.game.state.preparedAction.playerId,receiver);assert.ok(f.node('game-ball-hint').textContent.includes('已预备'));run(f.game,2);assert.equal(f.game.state.stats.home.shots,1);assert.equal(f.game.state.lastShot.playerId,receiver);
});

test('opponent shot feedback names the opposing team and goal banners replace the small shot status',()=>{
 const f=fixture(true);f.game.start({opponent:'madrid'});f.game.ready();run(f.game,3.1);const s=f.game.state;s.lastShot={id:12,team:'away',kind:'drive',outcome:'flight',updatedAt:s.time};f.game.setControlMode('semi');assert.ok(f.node('game-shot-feedback').textContent.startsWith('皇马 · '));assert.equal(f.node('game-shot-feedback').hidden,false);s.phase='goal';f.game.setControlMode('semi');assert.equal(f.node('game-shot-feedback').hidden,true);
});
test('holding a shot across automatic reception preserves charge and manual release cannot recall the outgoing ball',()=>{
 const f=fixture(true);f.game.start({training:'passing'});f.game.ready();f.game.action('pass');run(f.game,.04);const receiver=f.game.state.receiveTarget.playerId;assert.equal(f.game.beginCharge(),true);
 for(let i=0;i<180&&f.game.state.ball.ownerId!==receiver;i++)f.game.update(1/60,{},{});assert.equal(f.game.state.ball.ownerId,receiver);assert.equal(f.node('game-shoot')['aria-pressed'],'true');assert.equal(f.game.releaseCharge(),true);assert.equal(f.game.state.lastShot.playerId,receiver);
 f.game.exit();f.game.start({training:'passing'});f.game.ready();f.game.setControlMode('manual');f.game.action('pass');run(f.game,.04);assert.equal(f.game.beginCharge(),false);assert.equal(f.node('action-pass').disabled,true);assert.ok(f.node('game-ball-hint').textContent.includes('换控接应'));
});

test('training HUD uses physical receptions, keeps course results separate, and returning to a match restores its controls',()=>{
 const f=fixture(true);f.game.start({training:'passing'});assert.equal(f.game.training,'passing');assert.equal(f.node('training-hud').hidden,false);assert.equal(f.node('game-training-reset').disabled,true);f.game.ready();assert.equal(f.game.state.phase,'playing');assert.equal(f.node('game-result').hidden,true);assert.equal(f.scoreUpdates,0,'practice cannot overwrite the real stadium screens with a match clock');assert.equal(f.game.startReplay(),false);
 for(let i=0;i<5;i++){assert.equal(f.game.action('pass'),true);run(f.game,2.5);}
 assert.equal(f.game.state.training.metrics.completedPasses,5);assert.equal(f.game.state.phase,'fulltime');assert.equal(f.node('game-overlay-title').textContent,'训练完成');assert.equal(f.node('game-result').hidden,true);assert.equal(f.node('training-result').hidden,false);assert.ok(f.node('training-result').innerHTML.includes('成功传接'));assert.equal(f.node('game-overlay-team').hidden,true);
 f.game.exit();assert.equal(document.body.dataset.gameTraining,'');f.game.start();f.game.ready();run(f.game,3.1);assert.equal(f.game.training,null);assert.equal(f.node('training-hud').hidden,true);assert.equal(f.node('training-result').hidden,true);f.game.setPaused(true);assert.equal(f.node('game-overlay-title').textContent,'比赛已暂停');assert.equal(f.node('game-change-match').textContent,'更换对手与难度 →');assert.equal(f.node('game-result').hidden,false);assert.equal(f.node('game-overlay-team').hidden,false);
});
test('training reset cancels held shooting and pressure, restores a ball position and retains actual attempted shots',()=>{
 const f=fixture(true);f.game.start({training:'shooting'});f.game.ready();f.game.action('shoot',{power:.55});run(f.game,4);assert.equal(f.game.state.training.metrics.shots,1);assert.equal(f.game.beginCharge(),true);run(f.game,.2);f.node('game-training-reset').onclick();assert.equal(f.game.releaseCharge(),false);assert.equal(f.game.state.chargePower,0);assert.equal(f.game.state.training.metrics.shots,1);assert.equal(f.game.state.ball.ownerId,f.game.state.controlledId);assert.equal(f.game.state.training.attempt,2);
 f.node('training-pause').onclick();const elapsed=f.game.state.time;run(f.game,4);assert.equal(f.game.state.time,elapsed);assert.equal(f.node('game-overlay-title').textContent,'训练已暂停');f.node('game-resume').onclick();assert.equal(f.game.state.paused,false);f.node('training-exit').onclick();assert.equal(f.game.active,false);
});

test('training starts in its purpose-built close view without overwriting a previous match camera preference',()=>{
 const{game}=fixture(true);game.start({camera:'follow'});game.ready();assert.equal(game.camera,'follow');game.exit();game.start({training:'shooting'});game.ready();assert.equal(game.camera,'close');game.setCamera('broadcast');assert.equal(game.camera,'broadcast');game.setView('first');game.setView('third');assert.equal(game.camera,'broadcast','a lesson retains its own camera choice');game.exit();game.start();game.ready();assert.equal(game.camera,'follow','ordinary match preferences remain unchanged');game.exit();game.start({training:'passing'});game.ready();assert.equal(game.camera,'close','each course starts in its readable training view');
});

test('touch short passes leave the foot on contact, never wait for release, and do not repeat after the compatibility click',()=>{
 const{game,node}=fixture(true);game.start();game.ready();run(game,3.1);const button=node('action-pass'),elapsed=game.state.elapsed;
 const touch={pointerId:2,pointerType:'touch',button:0,preventDefault(){}};button.fire('pointerdown',touch);
 assert.equal(game.state.stats.home.passes,1,'physical pass occurs before pointerup');assert.equal(game.state.ball.ownerId,null);assert.ok(Math.hypot(game.state.ball.vx,game.state.ball.vz)>5);assert.equal(game.state.elapsed,elapsed);
 button.fire('pointerdown',{...touch,pointerId:3});assert.equal(game.state.stats.home.passes,1,'a second finger on the held button cannot repeat');
 for(let i=0;i<180&&game.state.ball.ownerId!==game.state.controlledId;i++)game.update(1/60,{},{});assert.equal(game.state.ball.ownerId,game.state.controlledId,'the pass is actually received');
 button.fire('pointerup',touch);button.fire('click',{detail:1,preventDefault(){}});assert.equal(game.state.stats.home.passes,1,'generated click cannot pass again with the recipient');
 button.fire('click',{detail:0,preventDefault(){}});assert.equal(game.state.stats.home.passes,2,'keyboard and assistive activation remain available');
});

test('instant cursor and tackle controls survive canceled touches, focus clearing, pause and restart without delayed duplicate actions',()=>{
 const{game,node}=fixture(true);game.start();game.ready();run(game,3.1);const button=node('action-switch'),touch={pointerId:11,pointerType:'touch',button:0,preventDefault(){}},original=game.state.controlledId;
 button.fire('pointerdown',touch);const next=game.state.controlledId;assert.notEqual(next,original);button.fire('pointercancel',touch);button.fire('click',{detail:1});assert.equal(game.state.controlledId,next);
 button.fire('pointerdown',{...touch,pointerId:12});assert.notEqual(game.state.controlledId,next);game.clearInput();const frozen=game.state.controlledId;button.fire('click',{detail:1});assert.equal(game.state.controlledId,frozen);
 game.setPaused(true);button.fire('pointerdown',{...touch,pointerId:13});assert.equal(game.state.controlledId,frozen);game.setPaused(false);game.exit();game.start();game.ready();run(game,3.1);button.fire('pointerdown',{...touch,pointerId:14});assert.notEqual(game.state.controlledId,'home-1','a previous held pointer cannot block a new match');
 const s=game.state,p=s.players.find(p=>p.id===s.controlledId);s.ball.ownerId=null;s.ball.x=p.x+1.2;s.ball.z=p.z;s.ball.y=.11;p.tackleAt=0;game.update(1/60,{},{});
 assert.equal(document.body.dataset.controlContext,'loose');assert.equal(node('game-tackle').disabled,false,'possession change enables the action on the first frame');assert.equal(node('game-tackle-label').textContent,'争球');assert.equal(node('game-shoot').disabled,false,'the loose-ball layout also preserves one-touch shooting');
 node('game-tackle').fire('pointerdown',{...touch,pointerId:15});assert.equal(p.motion.type,'tackle','the actual tackle motion starts before the finger is released');
});

test('the ordinary-penalty HUD waits for the human goalkeeper and uses the selected dive after kickoff',()=>{
 const f=fixture(true);f.game.start({rules:{mode:'league',duration:180}});f.game.ready();run(f.game,3.2);const s=f.game.state,attacker=s.players.find(p=>p.id==='away-1'),defender=s.players.find(p=>p.id===s.controlledId);
 Object.assign(attacker,{x:0,z:42,yaw:0,vx:0,vz:0,protectedUntil:0,tackleAt:0});Object.assign(defender,{x:0,z:41,yaw:0,vx:0,vz:5.4,tackleAt:0});Object.assign(s.ball,{x:0,y:.11,z:42.6,vx:0,vy:0,vz:0,ownerId:attacker.id,shot:null});f.game.action('tackle');assert.equal(s.setPiece.type,'penalty');run(f.game,2);
 assert.equal(document.body.dataset.controlContext,'penalty-keeper');const keeper=s.players.find(p=>p.id===s.controlledId);assert.equal(keeper.keeper,true);assert.equal(f.node('game-tackle-label').textContent,'扑救');assert.equal(f.node('game-tackle')['aria-label'],'门将扑救');assert.equal(f.node('game-shoot').disabled,true);assert.equal(f.node('action-switch').disabled,true);assert.equal(f.node('action-pass').disabled,true);assert.equal(f.node('game-pressure').disabled,true);assert.equal(f.game.beginCharge(),false);assert.equal(f.node('game-penalty-hint').hidden,false);assert.equal(f.node('game-penalty-status').textContent,'你守门');
 run(f.game,4);assert.equal(s.setPiece.stage,'ready');assert.equal(f.node('game-penalty-ready').hidden,false);assert.equal(f.node('game-tackle').disabled,true);
 f.node('game-penalty-ready').onclick();assert.equal(s.setPiece.keeperReady,true);assert.match(f.node('game-penalty-timing').textContent,/3 秒后可射门/);assert.equal(f.node('game-penalty-ready').hidden,true);
 run(f.game,.05,{penaltyAimAxis:{x:1,y:1}});assert.equal(document.body.dataset.gamePenaltyAim,'1.00,1.00');
 const pad=f.node('game-penalty-dive-target');pad.getBoundingClientRect=()=>({left:0,top:0,width:180,height:120});
 const touch={pointerId:81,pointerType:'touch',button:0,preventDefault(){}};
 pad.fire('pointerdown',{...touch,clientX:20,clientY:110,timeStamp:10});
 pad.fire('pointerup',{...touch,clientX:20,clientY:110,timeStamp:100});
 assert.equal(document.body.dataset.gamePenaltyAim,'-1.00,-1.00');
 assert.equal(s.setPiece.diveQueued,false,'the touch zone can select a direction while waiting without diving');
 for(let i=0;i<250&&s.setPiece.stage==='ready';i++)f.game.update(1/60,{},{});
 assert.equal(s.setPiece.stage,'runup');assert.equal(f.node('game-tackle').disabled,false);
 assert.equal(f.node('game-penalty-runup').hidden,false);
 pad.fire('pointerdown',{...touch,clientX:90,clientY:60,timeStamp:1000});
 pad.fire('pointerup',{...touch,clientX:148,clientY:22,timeStamp:1100});
 assert.equal(s.setPiece.diveQueued,true,'one directional swipe queues a dive during the opponent run-up');
 assert.equal(f.node('game-tackle').disabled,true);
 for(let i=0;i<70&&!keeper.motion;i++)f.game.update(1/60,{},{});
 assert.equal(keeper.motion.type,'dive');assert.equal(keeper.keeperState.direction,-1);assert.ok(keeper.keeperState.targetY>1.9);assert.equal(s.competition.shootout,null);
});

test('the online ordinary-penalty taker can charge and shoot once, then cannot recharge during flight',()=>{
 const server=createFootballSimulation({humanTeams:['home','away'],rules:{mode:'league',duration:180}});run(server,3.2);const s=server.state,a=s.players[1],d=s.players[12];Object.assign(a,{x:0,z:-42,yaw:Math.PI,vx:0,vz:0,protectedUntil:0});Object.assign(d,{x:0,z:-41,yaw:Math.PI,vx:0,vz:-5.4,tackleAt:0});Object.assign(s.ball,{x:0,y:.11,z:-42.6,vx:0,vy:0,vz:0,ownerId:a.id,shot:null});server.action('tackle',{},'away');assert.equal(s.setPiece.type,'penalty');
 const listeners=new Set(),messages=[],session={team:'home',opponent:'dortmund',connection:'connected',latency:300,room:{started:true,seats:[{team:'home'},{team:'away'}],rules:{mode:'league',duration:180}},packet:packOnlineState(s,1),subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},setReady(){},sendInput(){return 1;},send(p){messages.push(p);if(p.type==='action')server.action(p.action,{power:p.power,direction:p.direction,penaltyAim:p.penaltyAim},'home');return true;}};
 const f=fixture(true),deliver=frame=>{session.packet=packOnlineState(s,frame);for(const fn of listeners)fn();run(f.game,.12);};f.game.start({},session);f.game.ready();assert.equal(f.game.beginCharge(),false);
 run(server,2);deliver(2);assert.equal(document.body.dataset.controlContext,'penalty-shooter');assert.equal(f.node('game-shoot').disabled,true);assert.equal(f.game.beginCharge(),false);
 assert.equal(server.action('penalty-ready',{},'away'),true);run(server,2.6);deliver(3);
 assert.equal(f.node('game-shoot').disabled,false);assert.equal(f.node('game-tackle').disabled,true);assert.equal(f.node('action-pass').disabled,true);
 assert.equal(f.game.beginCharge(),true);run(f.game,.3,{penaltyAimAxis:{x:-1,y:1}});
 assert.equal(f.node('game-charge').hidden,true);assert.ok(f.node('game-penalty-power').value>.62);
 assert.equal(f.game.releaseCharge(),true);assert.equal(s.stats.home.shots,0);assert.equal(s.setPiece.stage,'runup');
 const shots=messages.filter(p=>p.type==='action'&&p.action==='shoot');assert.equal(shots.length,1);assert.ok(shots[0].penaltyAim.x<-.5&&shots[0].penaltyAim.y>.5);
 assert.equal(f.game.beginCharge(),false,'latency does not permit a duplicate shot before acknowledgement');
 deliver(4);assert.equal(f.game.beginCharge(),false);assert.equal(f.node('game-shoot').disabled,true);
 run(server,s.setPiece.runupDuration+.03);assert.equal(s.setPiece.stage,'flight');assert.equal(s.stats.home.shots,1);assert.ok(s.ball.vx<0);
 deliver(5);assert.equal(f.game.beginCharge(),false);assert.equal(s.competition.shootout,null);
});

test('a short mobile swipe on the penalty shoot button sends one directed shot',()=>{
 const f=fixture(true);f.game.start({rules:{mode:'shootout'}});f.game.ready();
 const shoot=f.node('game-shoot'),touch={pointerId:26,pointerType:'touch',button:0,preventDefault(){}};
 shoot.fire('pointerdown',{...touch,clientX:350,clientY:730,timeStamp:200});
 shoot.fire('pointerup',{...touch,clientX:290,clientY:696,timeStamp:300});
 shoot.onclick({detail:1});
 const s=f.game.state,round=s.competition.shootout;
 assert.equal(round.stage,'runup');
 assert.equal(document.body.dataset.gamePenaltyAim,'-1.00,0.57');
 assert.equal(f.node('game-shoot').disabled,true);
 run(f.game,round.runupDuration+.04);
 assert.equal(s.stats.home.shots,1);assert.ok(s.ball.vx<0);assert.ok(s.lastShot.power>.62);
});

test('the shootout score shows five recent attempts and the next kicker in sudden death',()=>{
 const f=fixture(true);f.game.start({opponent:'madrid',rules:{mode:'shootout'}});f.game.ready();
 const round=f.game.state.competition.shootout,box=f.node('game-penalty-score');
 assert.equal(box.hidden,false);assert.equal(f.node('game-penalty-round').textContent,'第 1 轮');
 assert.equal(f.node('game-penalty-home-0').dataset.result,'next');
 round.home.push(true,false,true,true,false);round.away.push(false,true,false,true,true);
 f.game.setControlMode('manual');
 assert.equal(f.node('game-penalty-round').textContent,'第 6 轮');
 assert.equal(f.node('game-penalty-home-0').dataset.result,'miss');
 assert.equal(f.node('game-penalty-home-4').dataset.result,'next');
 assert.equal(f.node('game-clock').textContent,'3–3');
 round.home.push(true);round.away.push(false);round.stage='result';round.winner='home';
 f.game.setControlMode('manual');
 assert.equal(f.node('game-penalty-round').textContent,'第 6 轮');
 assert.equal(f.node('game-penalty-home-4').dataset.result,'goal');
 assert.equal(f.node('game-penalty-away-4').dataset.result,'miss');
 assert.equal(f.node('game-clock').textContent,'4–3');
 assert.match(box['aria-label'],/拜仁 4 · 皇马 3/);
});
test('the actual match HUD presents half time and continues into the second half instead of remaining under a pause overlay',async()=>{
 const {game,node}=fixture();game.start({rules:{mode:'league',duration:180}});game.ready();run(game,3.1);game.state.elapsed=89.99;run(game,.1);assert.equal(game.state.phase,'playing');assert.equal(node('game-period').textContent,'上半场 · 补时 +1′');assert.ok(node('game-clock').textContent.startsWith('45:00 +00:'));run(game,2.1);assert.equal(game.state.phase,'interval');assert.equal(node('game-overlay').hidden,false);assert.equal(node('game-overlay-title').textContent,'中场休息');assert.equal(node('game-resume').textContent,'开始下半场');await node('game-resume').onclick();run(game,.2);assert.equal(game.state.competition.period,2);assert.equal(game.state.paused,false);assert.equal(node('game-overlay').hidden,true);assert.equal(node('game-period').textContent,'下半场');
});
test('display controls preserve the live match, and pausing exposes an actual readable statistics report',()=>{const {game,node}=fixture();game.start();game.ready();run(game,3.2);const time=game.state.elapsed;node('game-more').onclick();assert.equal(node('game-ui').dataset.more,'true');assert.equal(node('game-more')['aria-label'],'收起比赛设置');node('game-radar-toggle').onclick();assert.equal(document.body.dataset.gameRadar,'false');assert.equal(game.state.elapsed,time);assert.equal(game.state.paused,false);node('game-pause').onclick();assert.equal(game.state.paused,true);assert.equal(node('game-result').hidden,false);assert.ok(node('game-result').innerHTML.includes('report-score'));assert.ok(node('game-result').innerHTML.includes('射正'));assert.equal(node('game-overlay-team').hidden,false);game.start();assert.equal(node('game-ui').dataset.more,'false');assert.equal(node('game-more')['aria-label'],'展开比赛设置');});

test('a hidden mobile radar does no canvas work; showing it draws current positions and hiding or pausing it stops again',()=>{
 const f=fixture(true);f.game.start();f.game.ready();run(f.game,3.2);const hidden=f.radarDraws;run(f.game,2);assert.equal(f.radarDraws,hidden);const elapsed=f.game.state.elapsed;f.node('game-radar-toggle').onclick();assert.ok(f.radarDraws>hidden);const visible=f.radarDraws;run(f.game,.3);assert.ok(f.radarDraws>visible);assert.ok(f.game.state.elapsed>elapsed);f.node('game-radar-toggle').onclick();const stopped=f.radarDraws;run(f.game,.3);assert.equal(f.radarDraws,stopped);f.node('game-radar-toggle').onclick();f.game.setPaused(true);const paused=f.radarDraws;run(f.game,.3);assert.equal(f.radarDraws,paused);
});
test('a pending or failed player load never advances a live match; retry starts a fresh kick-off',()=>{
 const{game,node,classes}=fixture();game.start();run(game,10);assert.equal(game.state.phaseTime,0);assert.equal(game.state.elapsed,0);assert.equal(game.action('shoot'),false);assert.equal(node('game-overlay').hidden,false);assert.ok(classes.has('game-active'));
 game.fail();assert.equal(node('game-overlay-title').textContent,'球员暂未加载');assert.equal(node('game-restart').hidden,false);game.start();game.ready();run(game,3.1);assert.equal(game.state.phase,'playing');assert.ok(game.state.elapsed<.2);assert.equal(node('game-overlay').hidden,true);
});
test('pause is explicit, help preserves a previous pause, and exit clears the live HUD before callbacks can resume it',()=>{
 const{game,node,classes,views}=fixture();game.start();game.ready();run(game,3.1);game.setPaused(true);const before=JSON.stringify(game.state);run(game,5);assert.equal(JSON.stringify(game.state),before);assert.equal(node('game-resume').hidden,false);
 game.showHelp();assert.equal(node('game-help-dialog').open,true);node('game-help-close').onclick();assert.equal(game.state.paused,true);game.setPaused(false);game.showHelp();node('game-help-close').onclick();assert.equal(game.state.paused,false);
 game.setView('first');assert.equal(views.at(-1),'first');game.exit();assert.equal(game.active,false);assert.equal(node('game-ui').hidden,true);assert.ok(!classes.has('game-active'));assert.equal(game.action('pass'),false);
});
test('sound remains controllable during play and restarting resets possession and score',()=>{
 const{game,node,audio}=fixture();game.start();game.ready();run(game,3.1);node('game-mute').onclick();assert.equal(audio.muted,true);assert.equal(node('game-mute')['aria-label'],'开启比赛声音');game.state.score.home=2;node('game-restart').onclick();assert.deepEqual(game.state.score,{home:0,away:0});assert.equal(game.state.phase,'kickoff');assert.equal(game.state.ball.ownerId,'home-1');
});


test('control assistance can change during a match without resetting it, and pressure releases on pause',()=>{
 const{game,node}=fixture();game.start();game.ready();run(game,3.2);const elapsed=game.state.elapsed,controlled=game.state.controlledId;game.setControlMode('manual');assert.equal(game.state.controlMode,'manual');assert.equal(game.state.elapsed,elapsed);assert.equal(game.state.controlledId,controlled);assert.equal(node('game-control-mode').textContent,'手动 ↻');
 const button=node('game-pressure');button.fire('pointerdown',{pointerId:7,preventDefault(){}});run(game,.1);assert.equal(game.state.players.find(p=>p.id===controlled).defending,true);assert.equal(button['aria-pressed'],'true');game.setPaused(true);assert.equal(button['aria-pressed'],'false');game.setPaused(false);run(game,.1);assert.equal(game.state.players.find(p=>p.id===controlled).defending,false);
 node('game-control-mode').onclick();assert.equal(game.state.controlMode,'semi');
});

test('mobile expanded settings change assistance and shot type without restarting or kicking',()=>{
 const{game,node}=fixture(true);game.start();game.ready();run(game,3.2);node('game-more').onclick();
 const before={elapsed:game.state.elapsed,controlled:game.state.controlledId,owner:game.state.ball.ownerId,score:{...game.state.score},shots:game.state.stats.home.shots};
 assert.equal(node('game-assist-toggle')['aria-label'],'切换换人辅助，当前半自动');
 node('game-assist-toggle').onclick();assert.equal(game.state.controlMode,'assisted');assert.equal(node('game-control-mode').textContent,'辅助 ↻');
 node('game-assist-toggle').onclick();assert.equal(game.state.controlMode,'manual');node('game-control-mode').onclick();assert.equal(game.state.controlMode,'semi');assert.equal(node('game-assist-toggle').textContent,'半自动 ↻');
 node('game-shot-toggle').onclick();assert.equal(game.state.shotKind,'finesse');assert.equal(node('game-shot-mode').textContent,'搓射 Z');
 node('game-shot-mode').onclick();assert.equal(game.state.shotKind,'lob');assert.equal(node('game-shot-toggle').textContent,'挑射 ↻');
 assert.equal(game.state.elapsed,before.elapsed);assert.equal(game.state.controlledId,before.controlled);assert.equal(game.state.ball.ownerId,before.owner);assert.deepEqual(game.state.score,before.score);assert.equal(game.state.stats.home.shots,before.shots);assert.equal(game.state.paused,false);
 game.setPaused(true);assert.equal(node('game-ui').dataset.more,'false');assert.equal(node('game-overlay-settings').hidden,false);node('game-overlay-assist').onclick();assert.equal(game.state.controlMode,'assisted');node('game-overlay-shot').onclick();assert.equal(game.state.shotKind,'drive');assert.equal(game.state.paused,true);assert.equal(game.state.elapsed,before.elapsed);assert.deepEqual(game.state.score,before.score);
});

test('a charged shot releases exactly once, pointer cancellation and pausing discard it safely',()=>{
 const speeds=[];for(const hold of[.1,.8]){const{game,node}=fixture();game.start();game.ready();run(game,3.1);assert.equal(game.beginCharge(),true);run(game,hold);assert.equal(node('game-shoot')['aria-pressed'],'true');assert.equal(game.releaseCharge(),true);assert.equal(game.state.stats.home.shots,1);assert.equal(game.releaseCharge(),false);speeds.push(Math.hypot(game.state.ball.vx,game.state.ball.vz));}assert.ok(speeds[1]>speeds[0]+7);
 const{game,node}=fixture();game.start();game.ready();run(game,3.1);const shoot=node('game-shoot');shoot.fire('pointerdown',{pointerId:9,preventDefault(){}});run(game,.3);shoot.fire('pointercancel',{pointerId:9});assert.equal(game.state.chargePower,0);assert.equal(game.state.stats.home.shots,0);assert.equal(game.releaseCharge(),false);assert.equal(game.beginCharge(),true);game.setPaused(true);game.setPaused(false);assert.equal(game.releaseCharge(),false);assert.equal(game.state.stats.home.shots,0);
});

test('manual support play explains teammate possession and offers switching instead of an ineffective tackle',()=>{
 const{game,node}=fixture(true);game.start();game.ready();run(game,3.1);game.setControlMode('manual');const state=game.state,controlled=state.controlledId,mate=state.players.find(p=>p.team==='home'&&p.id!==controlled&&!p.keeper);
 Object.assign(state.ball,{ownerId:mate.id,x:mate.x,z:mate.z});game.setControlMode('manual');assert.equal(node('game-ball-hint').textContent,'队友控球 · 换控接管');assert.equal(node('game-tackle').disabled,true);assert.equal(node('game-pressure').disabled,true);assert.equal(node('action-switch').disabled,false);assert.equal(node('action-pass').disabled,true);
 node('action-switch').fire('click',{detail:0,preventDefault(){}});assert.equal(state.controlledId,mate.id);assert.equal(node('action-pass').disabled,false);assert.equal(node('game-pressure').disabled,false);
});

test('a loose ball leaving shooting range cancels touch charge and old fingers cannot fire or block the next shot',()=>{
 const{game,node}=fixture(true);game.start();game.ready();run(game,3.1);game.setControlMode('manual');const s=game.state,p=s.players.find(p=>p.id===s.controlledId);for(const other of s.players)if(other!==p)Object.assign(other,{x:25,z:45,vx:0,vz:0});Object.assign(p,{x:0,z:0,vx:0,vz:0});Object.assign(s.ball,{ownerId:null,x:4,y:.11,z:0,vx:25,vy:0,vz:0,targetId:null});
 const shoot=node('game-shoot');shoot.fire('pointerdown',{pointerId:91,preventDefault(){}});assert.equal(shoot['aria-pressed'],'true');run(game,.3);assert.ok(Math.hypot(s.ball.x-p.x,s.ball.z-p.z)>5);assert.equal(shoot['aria-pressed'],'false');assert.equal(s.chargePower,0);assert.equal(s.stats.home.shots,0);
 Object.assign(s.ball,{ownerId:p.id,x:p.x,y:.11,z:p.z-.6,vx:0,vy:0,vz:0});shoot.fire('pointerdown',{pointerId:92,preventDefault(){}});assert.equal(shoot['aria-pressed'],'true');run(game,.1);shoot.fire('pointerup',{pointerId:91});assert.equal(s.stats.home.shots,0);assert.equal(shoot['aria-pressed'],'true');shoot.fire('pointerup',{pointerId:92});assert.equal(s.stats.home.shots,1);assert.equal(shoot['aria-pressed'],'false');
});

test('clearing focus input cancels held charge and pressure without pausing or firing a delayed shot',()=>{
 const{game,node}=fixture();game.start();game.ready();run(game,3.1);const shoot=node('game-shoot'),pressure=node('game-pressure');
 shoot.fire('pointerdown',{pointerId:9,preventDefault(){}});pressure.fire('pointerdown',{pointerId:7,preventDefault(){}});run(game,.2);
 assert.ok(game.state.chargePower>.25);assert.equal(pressure['aria-pressed'],'true');const elapsed=game.state.elapsed;
 game.clearInput();assert.equal(game.state.paused,false);assert.equal(game.state.chargePower,0);assert.equal(shoot['aria-pressed'],'false');assert.equal(pressure['aria-pressed'],'false');assert.equal(game.releaseCharge(),false);
 // Releasing a pointer captured before focus was lost must not kick the ball.
 shoot.fire('pointerup',{pointerId:9});pressure.fire('pointerup',{pointerId:7});run(game,.2);
 assert.ok(game.state.elapsed>elapsed);assert.equal(game.state.stats.home.shots,0);assert.equal(game.state.players.find(p=>p.id===game.state.controlledId).defending,false);assert.equal(game.state.chargePower,0);
 // The next fresh touch still starts and releases normally.
 shoot.fire('pointerdown',{pointerId:10,preventDefault(){}});run(game,.2);shoot.fire('pointerup',{pointerId:10});assert.equal(game.state.stats.home.shots,1);
});

test('a cleared online HUD sends neutral input on subsequent frames instead of restoring held actions',()=>{
 const server=createFootballSimulation({humanTeams:['home','away']});run(server,3.1);const inputs=[],messages=[],session={team:'home',opponent:'dortmund',code:'ABCDEFGH',connection:'connected',latency:0,room:{started:true,seats:[{team:'home'},{team:'away'}]},packet:packOnlineState(server.state,1),subscribe:()=>()=>{},setReady(){},send:p=>{messages.push(p);return true;},sendInput:p=>{inputs.push(p);return inputs.length;}};
 const{game,node}=fixture();game.start({},session);game.ready();node('game-pressure').fire('pointerdown',{pointerId:7,preventDefault(){}});node('game-shoot').fire('pointerdown',{pointerId:9,preventDefault(){}});run(game,.2);
 assert.ok(inputs.some(p=>p.charging&&p.defend));game.clearInput();run(game,.2);const latest=inputs.at(-1);assert.equal(latest.charging,false);assert.equal(latest.defend,false);assert.equal(latest.power,0);assert.equal(game.state.paused,false);assert.equal(game.releaseCharge(),false);assert.equal(messages.some(p=>p.type==='pause'),false);assert.equal(messages.some(p=>p.type==='action'&&p.action==='shoot'),false);
});

test('online touch actions sample current aim and shot hold time between rendered frames',()=>{
 const server=createFootballSimulation({humanTeams:['home','away']});run(server,3.1);
 const messages=[],session={team:'home',opponent:'dortmund',code:'ABCDEFGH',connection:'connected',latency:200,room:{started:true,seats:[{team:'home'},{team:'away'}]},packet:packOnlineState(server.state,1),subscribe:()=>()=>{},setReady(){},send:p=>{messages.push(p);return true;},sendInput:p=>{messages.push({type:'input',...p});return messages.length;},leave(){}};
 let aim={x:0,z:0},time=1000;
 const {game,node}=fixture(true,{onReadGameInput:()=>aim,now:()=>time});
 try{
  game.start({},session);game.ready();run(game,.02,{x:0,z:1});
  aim={x:1,z:0};
  node('action-pass').fire('pointerdown',{pointerId:7,pointerType:'touch',preventDefault(){}});
  assert.equal(messages.find(p=>p.action==='pass').direction.x,1);
  aim={x:-1,z:0};
  node('game-shoot').fire('pointerdown',{pointerId:8,pointerType:'touch',preventDefault(){}});
  time+=425;
  node('game-shoot').fire('pointerup',{pointerId:8,pointerType:'touch'});
  const shot=messages.find(p=>p.action==='shoot');
  assert.equal(shot.direction.x,-1);
  assert.equal(shot.power,.625,'425 ms of charge counts without another render');
  assert.equal(game.state.ball.ownerId,server.state.ball.ownerId,'sending a shot cannot change authoritative possession');
 }finally{game.exit();}
});

test('changing opponent replaces the simulated squad and scoreboard while camera switches preserve a live match',()=>{
 const{game,node}=fixture();game.start({opponent:'barcelona',difficulty:'challenge',camera:'broadcast'});game.ready();run(game,3.2);assert.equal(node('game-away-name').textContent,'巴萨');assert.equal(game.state.players.find(p=>p.id==='away-9').name,'LAMINE YAMAL');const elapsed=game.state.elapsed;assert.equal(game.camera,'broadcast');assert.equal(game.cycleCamera(),'follow');assert.equal(game.cycleCamera(),'first');assert.equal(game.view,'first');assert.equal(game.cycleCamera(),'close');assert.equal(node('game-camera')['aria-label'],'切换比赛镜头，当前近景转播');assert.equal(game.cycleCamera(),'broadcast');assert.equal(game.state.elapsed,elapsed);assert.equal(game.state.fixture.id,'barcelona');game.start({opponent:'city',difficulty:'casual'});assert.equal(node('game-away-name').textContent,'曼城');assert.equal(game.state.players.find(p=>p.id==='away-1').name,'HAALAND');assert.equal(game.state.elapsed,0);
});

test('pausing stops repeated skeleton work while a paused perspective change still refreshes the scene once',()=>{
 const f=fixture();f.game.start();f.game.ready();run(f.game,3.2);f.game.setPaused(true);const before=f.actorUpdates;run(f.game,1);assert.equal(f.actorUpdates,before);f.game.setCamera('first');run(f.game,.2);assert.equal(f.actorUpdates,before+1);f.game.setPaused(false);run(f.game,.2);assert.ok(f.actorUpdates>before+5);
});

test('unchanged online pauses stop actor uploads while retaining neutral input heartbeats on desktop and mobile',()=>{
 for(const mobile of [false,true]){
  const server=createFootballSimulation({humanTeams:['home','away']});run(server,3.1);server.setPaused(true);const listeners=new Set(),inputs=[],session={team:'home',opponent:'dortmund',code:'ABCDEFGH',connection:'connected',latency:80,room:{started:true,seats:[{team:'home',paused:false},{team:'away',paused:true}]},packet:packOnlineState(server.state,1),subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},setReady(){},send:()=>true,sendInput:p=>{inputs.push(p);return inputs.length;}};
  const f=fixture(mobile);f.game.start({},session);f.game.ready();run(f.game,.1);const before=f.actorUpdates,hud=f.scoreUpdates;
  // The server can continue sending identical paused poses with new packet IDs.
  for(let i=0;i<200;i++){session.packet=packOnlineState(server.state,i+2);for(const receive of listeners)receive();run(f.game,.05);}
  assert.equal(f.actorUpdates,before,'paused acknowledgement packets do not rebuild 22 actors');assert.ok(f.scoreUpdates-hud<=11,'unchanged paused HUD refreshes at most once a second');assert.ok(inputs.length>=40,'neutral input and session heartbeats continue');assert.ok(inputs.every(p=>!p.x&&!p.z&&!p.defend&&!p.charging));
  server.state.players[0].x+=2;server.state.ball.x=5;session.packet=packOnlineState(server.state,203);for(const receive of listeners)receive();run(f.game,.1);assert.equal(f.actorUpdates,before+1,'a new authoritative paused pose refreshes once');assert.equal(f.ball.position.x,5);
  const atPause=f.actorUpdates;f.game.setCamera('first');run(f.game,.1);assert.equal(f.actorUpdates,atPause+1,'paused camera choices still update actor visibility');
  session.connection='reconnecting';for(const receive of listeners)receive();run(f.game,1/60);assert.equal(f.node('game-overlay-title').textContent,'正在重新连接','connection state is shown on the next frame');
  session.connection='connected';server.setPaused(false);run(server,.1);session.packet=packOnlineState(server.state,204);for(const receive of listeners)receive();run(f.game,.2);assert.equal(f.game.state.paused,false);assert.ok(f.actorUpdates>atPause+3,'a resumed authoritative match animates again');assert.equal(f.node('game-overlay').hidden,true);
 }
});

test('cheering works independently of ball possession and cannot fire during loading, pause or after exit',()=>{
 const f=fixture(),cheer=f.node('game-cheer');f.game.start();cheer.onclick();assert.equal(f.cheers,0);f.game.ready();run(f.game,3.1);const before=JSON.stringify(f.game.state);cheer.onclick();assert.equal(f.cheers,1);assert.equal(JSON.stringify(f.game.state),before,'cheering never changes the score, ball or player state');f.game.state.ball.ownerId='away-1';cheer.onclick();assert.equal(f.cheers,2);f.game.setPaused(true);assert.equal(cheer.disabled,true);cheer.onclick();assert.equal(f.cheers,2);f.game.exit();cheer.onclick();assert.equal(f.cheers,2);
});

test('optional replay freezes the real score, ball and clock, then returns paused without changing the chosen perspective',()=>{
 const f=fixture();f.game.start();assert.equal(f.game.startReplay(),false);f.game.ready();run(f.game,8);f.game.setCamera('first');assert.equal(f.game.startReplay(),true);const before=JSON.stringify(f.game.state);run(f.game,1);assert.equal(JSON.stringify(f.game.state),before);assert.equal(f.game.action('shoot'),false);assert.equal(f.game.replaying,true);assert.ok(f.classes.has('game-replay'));f.game.endReplay();assert.equal(f.game.replaying,false);assert.equal(f.game.state.paused,true);assert.equal(f.game.view,'first');assert.ok(!f.classes.has('game-replay'));f.game.setPaused(false);const time=f.game.state.elapsed;run(f.game,.3);assert.ok(f.game.state.elapsed>time);f.game.exit();assert.equal(f.game.startReplay(),false);
});

test('shot style buttons cycle without resetting a match and changing style cancels an unfinished charge',()=>{
 const f=fixture();f.game.start();f.game.ready();run(f.game,3.1);const before=f.game.state.elapsed;assert.equal(f.game.beginCharge(),true);f.node('game-shot-mode').onclick();assert.equal(f.game.state.shotKind,'finesse');assert.equal(f.game.releaseCharge(),false);assert.equal(f.game.state.stats.home.shots,0);assert.equal(f.game.state.elapsed,before);f.game.cycleShotKind();assert.equal(f.game.state.shotKind,'lob');assert.equal(f.node('game-shot-mode').textContent,'挑射 Z');f.game.start({opponent:'madrid'});assert.equal(f.game.state.shotKind,'lob');
});

test('goalkeeper possession explains automatic distribution and identifies goal-kick setup',()=>{
 const {game,node}=fixture(true);game.start();game.ready();run(game,3.1);
 const s=game.state,keeper=s.players.find(p=>p.team==='home'&&p.keeper);
 Object.assign(s.ball,{ownerId:keeper.id,x:keeper.x,y:.11,z:keeper.z});
 game.setControlMode('manual');
 assert.equal(node('game-ball-hint').textContent,'门将持球 · 正在组织出球');
 assert.equal(node('action-pass').disabled,true);
 node('action-switch').fire('click',{detail:0,preventDefault(){}});
 assert.notEqual(s.controlledId,keeper.id);
 s.phase='kickoff';s.restartType='goalkick';
 game.setControlMode('manual');
 assert.equal(node('game-ball-hint').textContent,'球门球 · 门将准备开球');
});
