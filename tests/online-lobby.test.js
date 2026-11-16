import assert from 'node:assert/strict';
import test from 'node:test';
import {buildOnlineLobby,onlineRoomFromInput} from '../dist/online-lobby.js';

const code='M4RT9J8K';
const site='https://arena.example';
const invite=site+'/?place=pitch&experience=football&room='+code;
const flush=()=>new Promise(resolve=>setImmediate(resolve));

function fixture(context,url=site,seat={}){
 const elements=new Map(),requests=[],sockets=[],entered=[];
 const get=id=>{
  if(!elements.has(id)){
   const attributes=new Map();
   elements.set(id,{
    value:'',dataset:{},classList:{toggle(){}},
    focus(){this.focused=true;},
    setAttribute(key,value){attributes.set(key,value);},
    getAttribute(key){return attributes.get(key);},
    querySelector:get,querySelectorAll:()=>[],addEventListener(){}
   });
  }
  return elements.get(id);
 };
 get('online-club-options').querySelectorAll=()=>['bayern','arsenal','inter'].map(club=>{
  const button=get('club-'+club);
  button.dataset.onlineClub=club;
  return button;
 });
 get('match-dialog').open=true;
 class Socket{
  constructor(){this.readyState=0;this.sent=[];sockets.push(this);}
  send(packet){this.sent.push(JSON.parse(packet));}
  close(){this.readyState=3;}
  receive(packet){this.onmessage({data:JSON.stringify(packet)});}
  welcome(started=false,extra={}){
   this.readyState=1;
   this.receive({
    type:'welcome',protocol:2,room:{started,ended:false,seats:[
     {team:'home',connected:true,ready:started},{team:'away',connected:true,ready:started}
    ],...extra}
   });
  }
  updateRoom(room){this.receive({type:'state',room,state:null});}
  acceptLastRequest(room){
   const {id}=this.sent.at(-1);
   this.updateRoom(room);
   this.receive({type:'result',id,ok:true});
  }
 }
 const originalLocation=globalThis.location,originalStorage=globalThis.sessionStorage;
 const originalHistory=globalThis.history,originalSocket=globalThis.WebSocket,originalFetch=globalThis.fetch;
 const originalDocument=globalThis.document;
 globalThis.location=new URL(url);
 globalThis.sessionStorage={getItem:()=>null,setItem(){}};
 globalThis.history={replaceState(_state,_unused,url){globalThis.location=url;}};
 globalThis.WebSocket=Socket;
 globalThis.document={getElementById:get,querySelectorAll:()=>[]};
 globalThis.fetch=async(url,options)=>{
  requests.push([url,JSON.parse(options.body)]);
  return{ok:true,json:async()=>({code,team:'away',opponent:'madrid',token:'test-token',...seat})};
 };
 const lobby=buildOnlineLobby({getOptions:()=>({opponent:'madrid'}),onEnter:session=>entered.push(session)});
 context.after(()=>{
  lobby.reset();
  Object.assign(globalThis,{location:originalLocation,sessionStorage:originalStorage,history:originalHistory,
   WebSocket:originalSocket,fetch:originalFetch,document:originalDocument});
 });
 return{get,requests,sockets,entered,lobby};
}

test('room entry accepts spaced codes and invite URLs without taking a token from the URL',()=>{
 assert.equal(onlineRoomFromInput('m4rt-9j8k'),code);
 assert.equal(onlineRoomFromInput(invite+'&token=ignored'),code);
 assert.equal(onlineRoomFromInput(site+'/?room=11111111'),'');
 assert.equal(onlineRoomFromInput('javascript:?room='+code),'');
 assert.equal(onlineRoomFromInput(site+'/'),'');
});

test('a pasted invite joins after confirmation and waits for the real-time socket before entering',async context=>{
 const {get,requests,sockets,entered}=fixture(context);
 const input=get('online-room-input');
 let replaced=false;
 input.onpaste({clipboardData:{getData:()=>invite},preventDefault(){replaced=true;}});
 assert.equal(replaced,true);
 assert.equal(input.value,code);
 assert.match(get('online-message').textContent,/已识别邀请房间/);
 assert.equal(requests.length,0);

 get('online-join-form').onsubmit({preventDefault(){}});
 assert.match(get('online-message').textContent,/正在加入房间/);
 await flush();
 assert.equal(requests[0][0],'/api/online/rooms/'+code+'/join');
 assert.match(get('online-message').textContent,/正在连接比赛服务器/);
 assert.equal(get('online-ready').disabled,true);
 get('online-ready').onclick();
 assert.equal(entered.length,0);

 sockets[0].welcome();
 await flush();
 assert.match(get('online-message').textContent,/双方已连接/);
 assert.equal(get('online-ready').disabled,false);
 get('online-ready').onclick();
 assert.equal(entered[0].code,code);
});

test('a direct invite preselects the room and leaving cancels a pending socket handshake',async context=>{
 const {get,requests,sockets,lobby}=fixture(context,invite);
 lobby.open();
 assert.equal(get('online-room-input').value,code);
 assert.equal(requests.length,0);
 get('online-join-form').onsubmit({preventDefault(){}});
 await flush();
 get('online-leave').onclick();
 await flush();
 assert.equal(lobby.session,null);
 assert.equal(sockets[0].readyState,3);
 assert.match(get('online-message').textContent,/已离开/);
 assert.equal(get('online-join').disabled,false);
});

const choiceRoom=overrides=>({
 teamChoice:true,homeClub:'bayern',opponent:'dortmund',
 clubs:{home:null,away:null},confirmed:{home:false,away:false},started:false,ended:false,
 seats:[{team:'home',connected:true,ready:false},{team:'away',connected:true,ready:false}],
 ...overrides
});

test('the host creates a room without submitting a club or another player’s lineup',async context=>{
 const {get,requests,sockets,lobby,entered}=fixture(context,site,{team:'home'});
 lobby.open();
 get('online-create').onclick();
 await flush();
 assert.equal(requests[0][0],'/api/online/rooms');
 assert.deepEqual(requests[0][1],{teamChoice:true,protocol:2});
 sockets[0].welcome(false,choiceRoom());
 await flush();
 assert.equal(get('online-home-label').textContent,'主队 · 未选队');
 assert.equal(get('online-ready').disabled,true);
 assert.equal(get('online-lineup-edit').disabled,true);
 assert.equal(get('online-club-options').hidden,false);
 assert.equal(get('online-rules-settings').hidden,false);
 const request=get('club-arsenal').onclick();
 assert.equal(sockets[0].sent.at(-1).type,'club');
 assert.equal(sockets[0].sent.at(-1).club,'arsenal');
 assert.equal(Object.hasOwn(sockets[0].sent.at(-1),'team'),false);
 sockets[0].acceptLastRequest(choiceRoom({homeClub:'arsenal',clubs:{home:'arsenal',away:null}}));
 await request;
 assert.match(get('online-home-label').textContent,/阿森纳/);
 assert.equal(get('online-away-label').textContent,'客队 · 未选队');
 assert.equal(get('online-club-options').hidden,true);
 assert.equal(get('online-lineup-edit').disabled,false);
 assert.equal(get('online-ready').disabled,true);
 assert.equal(entered.length,0);
});

test('the guest selects their club and stays in the lobby until both explicitly confirm',async context=>{
 const {get,sockets,lobby,entered}=fixture(context,invite);
 lobby.open();
 get('online-join-form').onsubmit({preventDefault(){}});
 await flush();
 const socket=sockets[0],initial=choiceRoom({homeClub:'arsenal',clubs:{home:'arsenal',away:null}});
 socket.welcome(false,initial);
 await flush();
 assert.equal(get('online-rules-settings').hidden,true);
 assert.equal(get('online-ready').disabled,true);
 // Both players may choose the same club without reserving it from the guest.
 const pick=get('club-arsenal').onclick();
 const selected=choiceRoom({homeClub:'arsenal',opponent:'arsenal',clubs:{home:'arsenal',away:'arsenal'}});
 socket.acceptLastRequest(selected);
 await pick;
 assert.equal(get('online-ready').disabled,false);
 const confirm=get('online-ready').onclick();
 const {type,confirmed,clubs}=socket.sent.at(-1);
 assert.deepEqual({type,confirmed,clubs},{type:'confirm',confirmed:true,clubs:selected.clubs});
 const oneConfirmed={...selected,confirmed:{home:false,away:true}};
 socket.acceptLastRequest(oneConfirmed);
 await confirm;
 assert.equal(get('online-ready').textContent,'取消确认');
 assert.equal(entered.length,0);
 assert.equal(socket.sent.some(message=>message.type==='ready'&&message.ready===true),false);
 const bothConfirmed={...selected,confirmed:{home:true,away:true}};
 socket.updateRoom(bothConfirmed);
 socket.updateRoom({...bothConfirmed});
 assert.equal(entered.length,1);
 assert.equal(entered[0].room.started,false,'the match can prepare assets before game readiness');
});

test('a confirmed room waits for a disconnected friend and only enters while its lobby is open',async context=>{
 const {get,sockets,lobby,entered}=fixture(context,invite);
 lobby.open();
 get('online-join-form').onsubmit({preventDefault(){}});
 await flush();
 const room=choiceRoom({homeClub:'arsenal',opponent:'inter',clubs:{home:'arsenal',away:'inter'},confirmed:{home:true,away:true}});
 const socket=sockets[0];
 socket.welcome(false,{...room,seats:room.seats.map(seat=>({...seat,connected:seat.team==='away'}))});
 await flush();
 assert.match(get('online-home-label').textContent,/阿森纳/);
 assert.match(get('online-away-label').textContent,/国米|国际米兰/);
 assert.equal(get('online-lineup-edit').disabled,true);
 assert.equal(entered.length,0);
 get('match-dialog').open=false;
 socket.updateRoom(room);
 assert.equal(entered.length,0);
 get('match-dialog').open=true;
 lobby.open();
 assert.equal(entered.length,1);
});
