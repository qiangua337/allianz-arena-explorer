import assert from 'node:assert/strict';
import test from 'node:test';
import {buildOnlineLobby,onlineRoomFromInput} from '../dist/online-lobby.js';

const code='M4RT9J8K';
const site='https://arena.example';
const invite=site+'/?place=pitch&experience=football&room='+code;
const flush=()=>new Promise(resolve=>setImmediate(resolve));

function fixture(context,url=site){
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
 class Socket{
  constructor(){this.readyState=0;sockets.push(this);}
  send(){}
  close(){this.readyState=3;}
  welcome(started=false){
   this.readyState=1;
   this.onmessage({data:JSON.stringify({
    type:'welcome',protocol:2,room:{started,ended:false,seats:[
     {team:'home',connected:true,ready:started},{team:'away',connected:true,ready:started}
    ]}
   })});
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
  return{ok:true,json:async()=>({code,team:'away',opponent:'madrid',token:'test-token'})};
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
