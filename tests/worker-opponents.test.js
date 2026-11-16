import assert from 'node:assert/strict';
import test from 'node:test';
import worker,{FootballRoom} from '../multiplayer/worker.js';
import {footballTeams,opponentSquad} from '../dist/football-teams.js';
import {defaultSelection} from '../dist/football-squads.js';
import {ONLINE_PROTOCOL} from '../dist/online-protocol.js';

const origin='https://arena.example';
const roomAPI='/api/online/rooms';
const addedClubs=['liverpool','arsenal','united','psg','inter','atletico'];

function fixture(){
 const data=new Map(),sockets=[];
 const context={
  storage:{
   get:async key=>structuredClone(data.get(key)),
   put:async entries=>{for(const [key,value] of Object.entries(entries))data.set(key,structuredClone(value));},
   setAlarm:async()=>{},
  },
  getWebSockets:()=>sockets,
  blockConcurrencyWhile(initialise){this.ready=initialise();},
 };
 let room;
 const env={ROOMS:{idFromName:code=>code,get:()=>({fetch:request=>room.fetch(request)})}};
 return{
  async restore(){room=new FootballRoom(context);await context.ready;return room;},
  attach(team){
   const socket={deserializeAttachment:()=>({team}),packets:[],send(value){this.packets.push(JSON.parse(value));}};
   sockets.push(socket);
   return socket;
  },
  fetch(path,{method='POST',data,headers}={}){
   const body=data===undefined?undefined:JSON.stringify(data);
   return worker.fetch(new Request(origin+path,{method,body,headers}),env);
  },
 };
}

test('room creation supports every club in the shared opponent registry',async()=>{
 assert.ok(addedClubs.every(id=>footballTeams.some(club=>club.id===id)));
 for(const {id} of footballTeams){
  const service=fixture(),room=await service.restore();
  const response=await service.fetch(roomAPI,{data:{protocol:ONLINE_PROTOCOL,opponent:id}});
  assert.equal(response.status,201,id);
  assert.equal((await response.json()).opponent,id);
  assert.deepEqual(room.publicRoom().lineups.away,defaultSelection('away',id),id);
 }
});

test('new opponent identity and squad survive joining, both players ready, kickoff and room reconstruction',async t=>{
 let now=1_000_000;
 t.mock.method(Date,'now',()=>now);
 t.mock.method(globalThis,'setInterval',callback=>({callback}));
 t.mock.method(globalThis,'clearInterval',()=>{});
 const service=fixture(),opponent='arsenal';
 await service.restore();
 const created=await service.fetch(roomAPI,{data:{protocol:ONLINE_PROTOCOL,opponent}});
 assert.equal(created.status,201);
 const host=await created.json();
 assert.equal(host.opponent,opponent);
 const joinPath=roomAPI+'/'+host.code+'/join';
 const joined=await service.fetch(joinPath,{data:{protocol:ONLINE_PROTOCOL}});
 assert.equal(joined.status,200);
 assert.equal((await joined.json()).opponent,opponent);

 // Attach sockets as accepted, hibernating Cloudflare connections.
 const home=service.attach('home'),away=service.attach('away');
 const room=await service.restore();
 const send=(socket,packet)=>room.webSocketMessage(socket,JSON.stringify(packet));
 const squad=opponentSquad(opponent);
 const selection=defaultSelection('away',opponent);
 const substitute=squad.bench.find(player=>!player.keeper);
 selection.xi[1]=substitute.player.number;
 await send(away,{type:'lineup',selection});
 assert.deepEqual(room.publicRoom().lineups.away,selection);
 await send(home,{type:'ready',ready:true});
 assert.equal(room.publicRoom().started,false);
 await send(away,{type:'ready',ready:true});
 for(let tick=0;tick<70&&room.sim.state.phase!=='playing';tick++){
  now+=50;
  room.timer.callback();
 }
 assert.equal(room.sim.state.phase,'playing');
 assert.equal(room.sim.state.fixture.id,opponent);
 assert.equal(room.sim.state.players.find(player=>player.id==='away-1').name,substitute.player.name);
 for(const socket of [home,away]){
  const state=socket.packets.at(-1).state;
  assert.equal(state.v,ONLINE_PROTOCOL);
  assert.equal(state.players.length,22);
  assert.deepEqual(state.players.slice(11).map(player=>player[10]),selection.xi);
 }

 await room.persist();
 const recovered=await service.restore();
 recovered.broadcast(true);
 assert.equal(recovered.publicRoom().opponent,opponent);
 assert.equal(recovered.sim.state.phase,'playing');
 assert.equal(recovered.sim.state.players.find(player=>player.id==='away-1').name,substitute.player.name);
 assert.deepEqual(away.packets.at(-1).state.players.slice(11).map(player=>player[10]),selection.xi);
});

test('opponent lookup preserves the default team and existing origin and seat checks',async()=>{
 const service=fixture();
 await service.restore();
 const rejected=await service.fetch(roomAPI,{data:{protocol:ONLINE_PROTOCOL,opponent:'arsenal'},
  headers:{Origin:'https://different.example'}});
 assert.equal(rejected.status,403);
 const created=await service.fetch(roomAPI,{data:{protocol:ONLINE_PROTOCOL,opponent:'constructor'}});
 assert.equal(created.status,201);
 const host=await created.json();
 assert.equal(host.opponent,'dortmund');
 const denied=await service.fetch(roomAPI+'/'+host.code+'/socket',{method:'GET',
  headers:{Upgrade:'websocket','Sec-WebSocket-Protocol':'arena-v2, seat.invalid'}});
 assert.equal(denied.status,403);
});
