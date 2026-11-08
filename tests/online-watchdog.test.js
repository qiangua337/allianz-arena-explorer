import test from 'node:test';
import assert from 'node:assert/strict';
import {createOnlineSession,createOnlineSimulation} from '../dist/online-client.js';
import {createFootballSimulation} from '../dist/football-simulation.js';
import {packOnlineState} from '../dist/online-protocol.js';

class Socket{
 static instances=[];
 constructor(url,protocols){this.url=url;this.protocols=protocols;this.readyState=1;this.messages=[];Socket.instances.push(this);}
 send(text){if(this.failSend)throw Error('transport lost');this.messages.push(JSON.parse(text));}
 close(code=1000,reason=''){this.readyState=3;if(!this.suppressClose)this.onclose?.({code,reason});}
 loseTransport(state){this.suppressClose=true;this.readyState=state;}
 message(packet){this.onmessage?.({data:JSON.stringify(packet)});}
}
const room={started:true,ended:false,seats:['home','away'].map(team=>({team,ready:true,connected:true,paused:false}))};
async function connect(t){
 t.mock.timers.enable({apis:['setTimeout','setInterval','Date'],now:1000});Socket.instances=[];
 const sim=createFootballSimulation({humanTeams:['home','away'],rules:{mode:'league',duration:180}});for(let i=0;i<210;i++)sim.update(1/60);
 const session=createOnlineSession({code:'ABCD2345',team:'home',token:'test-credential',opponent:'madrid'},{origin:'https://arena.example',WebSocketClass:Socket});
 const ready=session.connect(),socket=Socket.instances[0];socket.message({type:'welcome',protocol:2,room});await ready;session.setReady(true);socket.message({type:'state',room,state:packOnlineState(sim.state,42)});t.after(()=>session.close());return{sim,session,socket};
}
const pong=(socket)=>socket.message({type:'pong',at:Date.now()});

test('an OPEN socket with live pong but stalled play reconnects, freezes prediction and accepts the preserved second half',async t=>{
 const{sim,session,socket}=await connect(t),client=createOnlineSimulation(session);t.after(()=>client.dispose());client.update(1/60,{x:1,z:0});
 const requestResult=session.request({type:'formation',formation:'442'}).then(()=>null,error=>error);
 for(let i=0;i<5;i++){t.mock.timers.tick(1000);pong(socket);}assert.equal(session.connection,'connected');
 t.mock.timers.tick(1000);assert.equal(session.connection,'reconnecting');assert.equal(socket.readyState,3);assert.equal(client.state.paused,true);assert.equal(client.state.predictionSeconds,0);assert.match((await requestResult).message,/恢复后核对/);
 const x=client.state.players[1].x;for(let i=0;i<30;i++)client.update(1/60,{x:1,z:0});assert.equal(client.state.players[1].x,x);assert.equal(client.action('shoot'),false);
 t.mock.timers.tick(501);const replacement=Socket.instances[1];assert.ok(replacement.protocols.includes('ready-v1'));assert.equal(new URL(replacement.url).search,'');replacement.message({type:'welcome',protocol:2,room});
 assert.equal(client.state.paused,true,'no local restart before the authoritative snapshot');
 Object.assign(sim.state,{elapsed:127,paused:false});Object.assign(sim.state.competition,{period:2,periodStart:90});sim.state.attackDirections={home:1,away:-1};sim.state.players[1].x=7;
 replacement.message({type:'state',room,state:packOnlineState(sim.state,1)});assert.equal(client.state.paused,false);assert.equal(client.state.elapsed,127);assert.equal(client.state.competition.period,2);assert.equal(client.state.players[1].x,7);assert.deepEqual(client.state.score,sim.state.score);
 socket.message({type:'state',room:{...room,ended:true},state:packOnlineState(sim.state,999)});assert.equal(session.room.ended,false,'old queued frames cannot replace a recovered match');
});

test('normal halftime, shared pause and full time remain connected without a state stream while heartbeat replies arrive',async t=>{
 const{sim,session,socket}=await connect(t);
 for(const phase of['interval','playing','fulltime']){
  Object.assign(sim.state,{phase,paused:phase!=='fulltime'});socket.message({type:'state',room,state:packOnlineState(sim.state,43)});
  for(let i=0;i<30;i++){t.mock.timers.tick(1000);pong(socket);}
  assert.equal(session.connection,'connected',phase);assert.equal(Socket.instances.length,1,phase);
 }
});

test('a silent paused link recovers even if the platform never fires a WebSocket close event',async t=>{
 const{sim,session,socket}=await connect(t);sim.setPaused(true);socket.message({type:'state',room,state:packOnlineState(sim.state,43)});
 t.mock.timers.tick(11999);assert.equal(session.connection,'connected');t.mock.timers.tick(1);assert.equal(session.connection,'reconnecting');assert.equal(socket.readyState,3);
});

for(const [label,state]of [['CLOSING',2],['CLOSED',3]])test(`a ${label} transport with no close event recovers on the next heartbeat even after a paused snapshot`,async t=>{
 const{sim,session,socket}=await connect(t),client=createOnlineSimulation(session);t.after(()=>client.dispose());client.update(1/60,{x:1,z:0});const requestResult=session.request({type:'formation',formation:'442'}).then(()=>null,error=>error);
 sim.setPaused(true);const disconnectedRoom={...room,seats:room.seats.map(seat=>({...seat,connected:seat.team==='home'}))};socket.message({type:'state',room:disconnectedRoom,state:packOnlineState(sim.state,43)});socket.loseTransport(state);pong(socket);
 t.mock.timers.tick(999);assert.equal(session.connection,'connected');t.mock.timers.tick(1);assert.equal(session.connection,'reconnecting');assert.equal(Socket.instances.length,1,'a single retry is scheduled after detecting the transport');assert.equal(client.state.paused,true);assert.equal(client.state.predictionSeconds,0);assert.match((await requestResult).message,/恢复后核对/);
 socket.message({type:'welcome',protocol:2,room});assert.equal(session.connection,'reconnecting','queued messages from the retired socket cannot revive it');t.mock.timers.tick(501);assert.equal(Socket.instances.length,2);const replacement=Socket.instances[1];assert.ok(replacement.protocols.includes('ready-v1'));replacement.message({type:'welcome',protocol:2,room});assert.equal(session.connection,'connected');assert.equal(client.state.paused,true,'reconnection waits for the authoritative match state');
 Object.assign(sim.state,{paused:false,elapsed:127});Object.assign(sim.state.competition,{period:2,periodStart:90});replacement.message({type:'state',room,state:packOnlineState(sim.state,1)});assert.equal(client.state.paused,false);assert.equal(client.state.elapsed,127);assert.equal(client.state.competition.period,2);assert.deepEqual(client.state.score,sim.state.score);
});

test('closing during a transport recovery cancels its retry and ignores late welcome messages',async t=>{
 const{session,socket}=await connect(t);socket.loseTransport(2);t.mock.timers.tick(1000);assert.equal(session.connection,'reconnecting');session.close();socket.message({type:'welcome',protocol:2,room});t.mock.timers.tick(20000);assert.equal(session.connection,'closed');assert.equal(Socket.instances.length,1);
});

test('a closed transport for an ended room closes the session without reconnecting',async t=>{
 const{session,socket}=await connect(t);socket.message({type:'state',room:{...room,ended:true,reason:'比赛已结束'},state:session.packet});socket.loseTransport(3);t.mock.timers.tick(1000);assert.equal(session.connection,'closed');assert.equal(session.error,'比赛已结束');t.mock.timers.tick(10000);assert.equal(Socket.instances.length,1);
});

test('regular snapshots tolerate 300 ms replies and jitter without triggering recovery',async t=>{
 const{sim,session,socket}=await connect(t);
 for(let i=0;i<160;i++){t.mock.timers.tick(i%7===0?600:300);sim.update(.25);socket.message({type:'state',state:packOnlineState(sim.state,43+i)});}
 assert.equal(session.connection,'connected');assert.equal(Socket.instances.length,1);
});

test('a reconnect handshake which never welcomes retries instead of staying stuck forever',async t=>{
 const{session,socket}=await connect(t);socket.close(1006);t.mock.timers.tick(501);const stalled=Socket.instances[1];
 t.mock.timers.tick(8000);assert.equal(stalled.readyState,3);assert.equal(session.connection,'reconnecting');t.mock.timers.tick(1001);assert.equal(Socket.instances.length,3);
 const replacement=Socket.instances[2];replacement.message({type:'welcome',protocol:2,room});assert.equal(session.connection,'connected');
});

test('a send failure cannot throw out of the render loop or leave a dead connection marked connected',async t=>{
 const{session,socket}=await connect(t);socket.failSend=true;assert.equal(session.sendInput({x:1,z:0}),0);assert.equal(session.connection,'reconnecting');
});
