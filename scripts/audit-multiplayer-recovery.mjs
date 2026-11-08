// Real HTTP/WebSocket traffic through the shipped client, with transport-only
// faults. No game state, score, clock, packet contents or server data is injected.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createOnlineSession,requestOnlineSeat} from '../dist/online-client.js';
const origin=process.argv[2]||'http://127.0.0.1:51736',recordIndex=process.argv.indexOf('--record'),record=recordIndex<0?null:process.argv[recordIndex+1],sessions=[],wires={home:[],away:[]},checks=[];
let stage='connecting',progress=null,regression=null;
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function snapshot(session){const p=session.packet;return{team:session.team,connection:session.connection,transportReadyState:wires[session.team].at(-1)?.readyState,seq:p?.seq,time:p?.time,elapsed:p?.elapsed,phase:p?.phase,period:p?.competition?.period,paused:p?.paused,score:p?.score,serverClock:p?.serverClock,seats:session.room?.seats.map(({team,connected,ready,paused})=>({team,connected,ready,paused}))};}
function log(value){const line=JSON.stringify(value);console.log(line);if(record)fs.appendFileSync(record,line+'\n');}
async function until(fn,label,ms=10000){const start=Date.now();while(Date.now()-start<ms){if(regression){log({type:'failed',label:'authoritative clock rolled back',...regression});throw Error('Authoritative clock rolled back');}if(fn())return;await delay(25);}log({type:'failed',label,waitedMs:Date.now()-start,sessions:sessions.map(snapshot)});throw Error('Timed out: '+label);}
function transport(team){return class{
 constructor(url,protocols){this.delegate=new WebSocket(url,protocols);this.suppressStates=false;wires[team].push(this);this.delegate.addEventListener('message',event=>{if(this.suppressStates){let p;try{p=JSON.parse(event.data);}catch{}if(p?.type==='state')return;}this.onmessage?.(event);});this.delegate.addEventListener('close',event=>this.onclose?.(event));this.delegate.addEventListener('error',event=>this.onerror?.(event));}
 get readyState(){return this.delegate.readyState;}
 send(data){this.delegate.send(data);}
 close(code,reason){this.delegate.close(code,reason);}
};}
async function connect(seat){const session=createOnlineSession(seat,{origin,WebSocketClass:transport(seat.team)});let previous=null,lastElapsed=0;session.subscribe(()=>{const p=session.packet;if(p&&p!==previous){if(p.elapsed<lastElapsed-.001)regression={team:session.team,previousElapsed:lastElapsed,current:snapshot(session)};lastElapsed=p.elapsed;previous=p;}});sessions.push(session);await session.connect();return session;}
try{
 if(record)fs.writeFileSync(record,'');
 const fetcher=(url,options)=>fetch(new URL(url,origin),options),homeSeat=await requestOnlineSeat('',{opponent:'madrid',rules:{mode:'league',duration:180}},fetcher),awaySeat=await requestOnlineSeat(homeSeat.code,{},fetcher);
 const home=await connect(homeSeat),away=await connect(awaySeat);home.setReady(true);away.setReady(true);
 progress=setInterval(()=>log({type:'progress',stage,sessions:sessions.map(snapshot)}),10000);
 await until(()=>sessions.every(s=>s.packet?.phase==='kickoff'&&!s.packet.paused),'both prepared');checks.push('actual shipped clients prepare both teams');
 stage='first half';await until(()=>sessions.every(s=>s.packet?.phase==='interval'),'real first half',240000);
 assert.equal(home.packet.elapsed,90);assert.equal(away.packet.elapsed,90);checks.push('real halftime reaches 90');
 await home.request({type:'continue'});await delay(500);assert.equal(home.packet.phase,'interval');assert.equal(home.packet.elapsed,90);checks.push('one confirmation cannot start the half');
 await away.request({type:'formation',formation:'442'});await away.request({type:'continue'});
 await until(()=>sessions.every(s=>s.packet?.competition?.period===2&&!s.packet.paused),'both resume second half');assert.equal(home.packet.attackDirections.home,1);checks.push('both confirm and swap ends');
 stage='second half';await until(()=>home.packet.elapsed>=110,'second half advances',60000);
 stage='OPEN socket snapshot stall';const staleWire=wires.away.at(-1),beforePacket=away.packet,score={...home.packet.score};staleWire.suppressStates=true;
 await until(()=>away.connection==='reconnecting','OPEN snapshot stall detected with live heartbeat',9000);assert.ok([2,3].includes(staleWire.readyState));checks.push('OPEN socket missing snapshots is detected');
 await until(()=>away.connection==='connected'&&wires.away.at(-1)!==staleWire&&away.packet!==beforePacket&&!away.packet.paused,'automatic authenticated recovery',12000);
 assert.equal(away.packet.competition.period,2);assert.ok(away.packet.elapsed>=beforePacket.elapsed);assert.deepEqual(away.packet.score,score);checks.push('recovery preserves half clock score and readiness');
 stage='transport interruption';const brokenWire=wires.home.at(-1),packet=home.packet;brokenWire.close(4002,'audit transport interruption');
 await until(()=>home.connection==='reconnecting','transport loss detected');await until(()=>home.connection==='connected'&&wires.home.at(-1)!==brokenWire&&home.packet!==packet&&!home.packet.paused,'transport reconnect',12000);checks.push('transport close reconnects without restarting match');
 stage='finish second half';await until(()=>sessions.every(s=>s.packet?.phase==='fulltime'),'real second half after recoveries',240000);
 for(const s of sessions){assert.equal(s.packet.elapsed,180);assert.equal(s.packet.competition.period,2);assert.equal(s.packet.competition.result.reason,'regular');}
 assert.deepEqual(home.packet.score,away.packet.score);checks.push('both finish the same actual 180 second match');log({type:'result',ok:true,origin,checks,sessions:sessions.map(snapshot)});
}finally{clearInterval(progress);for(const s of sessions)s.leave();await delay(150);}
