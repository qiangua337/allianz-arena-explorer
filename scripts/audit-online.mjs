// Real HTTP + WebSocket integration audit. No browser or gameplay state injection.
import assert from 'node:assert/strict';
import {footballClubs,footballTeam} from '../dist/football-teams.js';
import {defaultSelection} from '../dist/football-squads.js';
const origin=process.argv[2]||'http://127.0.0.1:51736';
const requestedHome=process.argv[4],teamChoice=requestedHome!==undefined;
const requestedAway=process.argv[3]??'madrid';
if(teamChoice&&!footballClubs.some(club=>club.id===requestedAway))throw Error('Unknown away club: '+requestedAway);
if(teamChoice&&!footballClubs.some(club=>club.id===requestedHome))throw Error('Unknown home club: '+requestedHome);
const homeClub=requestedHome??'bayern',opponent=teamChoice?requestedAway:footballTeam(requestedAway).id;
const homeSelection=defaultSelection('home',opponent,homeClub),awaySelection=defaultSelection('away',opponent,homeClub);
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const connections=[];let created;
async function post(path,data={}){const response=await fetch(origin+'/api/online'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({protocol:2,...data})});return{status:response.status,data:await response.json()};}
async function until(fn,label,ms=8000){const started=Date.now();while(Date.now()-started<ms){if(fn())return;await delay(30);}throw Error('Timed out: '+label);}
async function connect(seat,resumeReady=false){const url=origin.replace(/^http/,'ws')+'/api/online/rooms/'+seat.code+'/socket',ws=new WebSocket(url,['arena-v2','seat.'+seat.token,...(resumeReady?['ready-v1']:[])]),client={ws,room:null,state:null,states:new Map(),results:new Map(),send:data=>ws.send(JSON.stringify(data))};connections.push(client);ws.addEventListener('message',event=>{const p=JSON.parse(event.data);if(p.type==='result')client.results.set(p.id,p);if(p.room)client.room=p.room;if(p.state){client.state=p.state;client.states.set(p.state.seq,p.state);if(client.states.size>30)client.states.delete(client.states.keys().next().value);}});await until(()=>ws.readyState===1&&client.room,'socket welcome');return client;}
let requestID=0;
async function request(client,message){
 const id=++requestID;
 client.send({...message,id});
 await until(()=>client.results.has(id),'room command '+message.type);
 return client.results.get(id);
}
try{
 created=await post('/rooms',teamChoice?{teamChoice:true}:{opponent});assert.equal(created.status,201);const seat=created.data;assert.equal(seat.team,'home');if(!teamChoice)assert.equal(seat.opponent,opponent);assert.match(seat.code,/^[A-HJ-NP-Z2-9]{8}$/);
 const foreign=await fetch(origin+'/api/online/rooms',{method:'POST',headers:{Origin:'https://not-the-arena.example','Content-Type':'application/json'},body:'{}'});assert.equal(foreign.status,403);
 const joined=await post('/rooms/'+seat.code+'/join');assert.equal(joined.status,200);assert.equal(joined.data.team,'away');if(!teamChoice)assert.equal(joined.data.opponent,opponent);assert.equal((await post('/rooms/'+seat.code+'/join')).status,409);
 const home=await connect(seat),away=await connect(joined.data);
 if(teamChoice){
  assert.deepEqual(home.room.clubs,{home:null,away:null});
  assert.equal((await request(home,{type:'ready',ready:true})).ok,false);
  assert.equal((await request(home,{type:'club',club:homeClub})).ok,true);
  assert.equal((await request(away,{type:'club',club:opponent})).ok,true);
  const clubs={home:homeClub,away:opponent};
  await until(()=>home.room.clubs.away===opponent&&away.room.clubs.home===homeClub,'both receive the same fixture');
  for(const client of [home,away])assert.equal((await request(client,{type:'confirm',confirmed:true,clubs})).ok,true);
  assert.equal(home.room.started,false,'confirmation alone does not start the match');
 }
 away.send({type:'mode',mode:'manual'});away.send({type:'shot-kind',kind:'lob'});home.send({type:'ready',ready:true});await delay(200);assert.equal(home.room.started,false,'one ready seat cannot start the match');away.send({type:'ready',ready:true});await until(()=>home.state?.phase==='playing'&&away.state?.phase==='playing','both ready + kickoff');assert.equal(home.state.controlModes.away,'manual','preferences selected before kickoff are applied');assert.equal(home.state.shotKinds.away,'lob');
 for(const client of [home,away]){
  assert.equal(client.room.opponent,opponent);
  if(teamChoice){
   assert.equal(client.room.homeClub,homeClub);
   assert.deepEqual(client.room.lineups.home,homeSelection);
   assert.deepEqual(client.state.players.slice(0,11).map(player=>player[10]),homeSelection.xi);
  }
  assert.deepEqual(client.room.lineups.away,awaySelection);
  assert.deepEqual(client.state.players.slice(11).map(player=>player[10]),awaySelection.xi);
 }
 let inputSequence=0;const before=[home.state.players[1][0],away.state.players[12][0]],movement=setInterval(()=>{const seq=++inputSequence;home.send({type:'input',x:1,z:0,seq});away.send({type:'input',x:-1,z:0,seq});},80);try{await until(()=>home.state.players[1][0]>before[0]+1&&away.state.players[12][0]<before[1]-1,'both authoritative players move over one metre',6000);}catch(e){console.error(JSON.stringify({before,after:[home.state.players[1][0],away.state.players[12][0]],phase:home.state.phase,elapsed:home.state.elapsed,controls:home.state.controlledIds}));throw e;}finally{clearInterval(movement);const seq=++inputSequence;home.send({type:'input',x:0,z:0,seq});away.send({type:'input',x:0,z:0,seq});home.send({type:'input',x:-1,z:0,seq:seq-1});}await until(()=>home.state.ack?.home===inputSequence&&away.state.ack?.away===inputSequence,'inputs acknowledged after simulation and stale commands ignored');
 const common=[...home.states.keys()].reverse().find(seq=>away.states.has(seq));assert.ok(common);assert.deepEqual(home.states.get(common),away.states.get(common),'both sockets receive exactly the same authoritative state');
 home.send({type:'pause',paused:true});await until(()=>home.state.paused&&away.state.paused,'shared pause');const frozen=home.state.elapsed;away.send({type:'mode',mode:'assisted'});away.send({type:'shot-kind',kind:'finesse'});await until(()=>home.state.controlModes.away==='assisted'&&away.state.shotKinds.away==='finesse','paused preferences broadcast');away.send({type:'pause',paused:false});await delay(220);assert.equal(home.state.elapsed,frozen,'preferences and other seat cannot override an outstanding pause');home.send({type:'pause',paused:false});await until(()=>!home.state.paused,'resume');
 away.ws.close();await until(()=>home.state.paused&&home.room.seats[1].connected===false,'disconnect freezes match');const remaining=home.state.elapsed,reconnected=await connect(joined.data,true);await until(()=>!home.state.paused&&!reconnected.state?.paused&&reconnected.state,'same seat reconnects');assert.ok(reconnected.state.elapsed>=remaining);assert.equal(reconnected.state.controlledIds.away,home.state.controlledIds.away);
 assert.equal(reconnected.room.opponent,opponent);assert.deepEqual(reconnected.state.players.slice(11).map(player=>player[10]),awaySelection.xi);
 reconnected.send({type:'mode',mode:'manual'});await until(()=>home.state.controlModes.away==='manual','remote control mode');reconnected.send({type:'action',action:'switch'});await until(()=>home.state.controlledIds.away!=='away-1','remote player switch');
 home.send({type:'leave'});await until(()=>reconnected.room.ended,'leave closes the shared room');console.log(JSON.stringify({ok:true,checks:['create','same-origin','two seats','room full','readiness','opponent roster','independent movement','identical state','shared pause','pre-kickoff preferences','paused preferences','disconnect freeze','authenticated reconnect','away controls','sequenced input acknowledgement','leave cleanup',...(teamChoice?['independent club choice','confirmed fixture','home roster']:[])],homeClub,opponent,players:22,origin}));
}finally{for(const client of connections){try{if(client.ws.readyState===1)client.send({type:'leave'});client.ws.close();}catch{}}}
