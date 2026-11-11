import {getSquadEditor,buildRulesPicker,rulesSummary} from './squad-editor.js';
import {normalizeSelection,footballFormations} from './football-squads.js';
import {createOnlineSession,requestOnlineSeat} from './online-client.js';
import {roomCode,validRoomCode} from './online-protocol.js';
import {footballTeam} from './football-teams.js';
export function onlineInvite(code){const link=new URL(location.href);link.search='?place=pitch&night=1&experience=football&room='+code;link.hash='';return link.href;}
export async function copyOnlineInvite(session,toast){try{await navigator.clipboard.writeText(onlineInvite(session.code));toast?.('邀请链接已复制，发给朋友即可');return true;}catch{toast?.('请复制房间码：'+session.code);return false;}}

export function onlineRoomFromInput(value){
 const text=String(value??'').trim(),code=roomCode(text);
 if(validRoomCode(code))return code;
 try{
  const invite=new URL(text);
  if(invite.protocol!=='http:'&&invite.protocol!=='https:')return '';
  const invitedCode=roomCode(invite.searchParams.get('room'));
  return validRoomCode(invitedCode)?invitedCode:'';
 }catch{return '';}
}

export function buildOnlineLobby({getOptions,onEnter,toast,onOpen}){
 const $=id=>document.getElementById(id),roomInput=$('online-room-input');
 let session=null,unsubscribe=null,busy=false,statusMessage='',invalidCode=false,inviteCode='',operation=0;
 const idleMessage='输入 8 位房间码，或粘贴朋友发来的邀请链接。';
 const formatCode=code=>code.slice(0,4)+' '+code.slice(4);
 const picker=buildRulesPicker($('online-rules-picker'),async rules=>{
  const current=session;
  if(!current||busy||current.connection!=='connected'||current.room?.ended)return;
  busy=true;statusMessage='正在保存赛制…';render();
  try{
   await current.request({type:'rules',rules});
   if(current===session)statusMessage='赛制已更新，双方需要重新准备。';
  }catch(error){if(current===session)statusMessage=error.message;}
  finally{if(current===session){busy=false;render();}}
 });

 function seatStatus(team,room){
  const seat=room?.seats.find(s=>s.team===team);
  return !seat?.connected?'等待加入':seat.ready?'已准备':'已连接';
 }
 function render(){
  const room=session?.room,connected=session?.connection==='connected'&&!room?.ended;
  for(const button of document.querySelectorAll('[data-match-tab]'))button.disabled=(busy||!!session)&&button.dataset.matchTab!=='online';
  $('match-dialog').classList.toggle('online-room-open',!!session);
  $('online-lobby-idle').hidden=!!session;
  $('online-lobby-room').hidden=!session;
  $('online-create').disabled=$('online-join').disabled=roomInput.disabled=busy;
  roomInput.setAttribute('aria-invalid',String(invalidCode));
  const message=$('online-message');
  if(!session){
   const options=getOptions();
   $('online-fixture-summary').textContent='拜仁 × '+footballTeam(options.opponent).name+' · '+rulesSummary(options.rules);
   message.textContent=statusMessage||idleMessage;
   return;
  }
  const rules=room?.rules||session.rules||getOptions().rules;
  const selection=normalizeSelection(room?.lineups?.[session.team],session.team,session.opponent);
  $('online-code').textContent=formatCode(session.code);
  $('online-side').textContent='你控制'+(session.team==='home'?'拜仁':footballTeam(session.opponent).name)+' · '+(session.team==='home'?'房主':'朋友');
  $('online-home-status').textContent=seatStatus('home',room);
  $('online-away-status').textContent=seatStatus('away',room);
  $('online-away-label').textContent=footballTeam(session.opponent).short;
  $('online-rules-summary').textContent=rulesSummary(rules);
  $('online-rules-picker').hidden=session.team!=='home';
  picker.set(rules,busy||!connected||room?.started);
  $('online-lineup-summary').textContent=footballFormations[selection.formation].label+' · '+selection.xi.length+' 名首发';
  $('online-lineup-edit').disabled=busy||!connected||room?.started;
  $('online-ready').disabled=!connected||busy;
  $('online-ready').textContent=room?.started?'返回比赛 →':'阵容就绪 · 准备进入球场 →';
  const friend=room?.seats.find(s=>s.team!==session.team);
  const roomMessage=!connected?'正在连接比赛服务器…':room?.started?'连接已恢复，可以返回比赛。':friend?.connected?
   '双方已连接，分别确认阵容并进入球场后开球。':'等待朋友加入。可以复制邀请链接，也可以先进入球场等候。';
  message.textContent=session.error||statusMessage||roomMessage;
 }
 function saved(code){try{return JSON.parse(sessionStorage.getItem('arena-online-'+code)||'null');}catch{return null;}}
 function releaseSession(leave=false){
  const previous=session;
  unsubscribe?.();unsubscribe=null;session=null;
  if(leave)previous?.leave();
  else previous?.close();
 }
 async function connect(code){
  if(busy)return;
  const attempt=++operation;
  busy=true;invalidCode=false;inviteCode='';statusMessage=code?'正在加入房间…':'正在创建房间…';
  render();
  try{
   const existing=code?saved(code):null,options=getOptions();
   const seat=await requestOnlineSeat(code,code?{token:existing?.token}:{opponent:options.opponent,rules:options.rules,selection:normalizeSelection(options.selection)});
   if(attempt!==operation)return;
   releaseSession();
   const current=createOnlineSession(seat);session=current;
   try{sessionStorage.setItem('arena-online-'+seat.code,JSON.stringify(seat));}catch{}
   let previousRoom,previousConnection,previousError;
   unsubscribe=current.subscribe(()=>{
    // Live match packets usually share the same room object and require no lobby update.
    const {room,connection,error}=current;
    if(room===previousRoom&&connection===previousConnection&&error===previousError)return;
    previousRoom=room;previousConnection=connection;previousError=error;
    render();
   });
   statusMessage='';render();
   await current.connect();
  }catch(error){
   if(attempt!==operation)return;
   releaseSession();statusMessage=error.message||'连接失败，请重试。';
  }finally{
   if(attempt===operation){busy=false;render();}
  }
 }
 function showInvite(code){
  roomInput.value=code;
  invalidCode=false;inviteCode=code;
  statusMessage='已识别邀请房间 '+formatCode(code)+'，点击「加入房间」继续。';
  render();
 }
 function open(){
  onOpen?.();$('match-dialog').dataset.panel='online';$('online-lobby').hidden=false;
  const invite=new URLSearchParams(location.search).get('room');
  if(!session&&!busy&&invite&&!roomInput.value){
   const code=onlineRoomFromInput(invite);
   if(code){showInvite(code);return;}
   statusMessage='邀请链接中的房间码无效，可以手动输入有效房间码。';
  }
  render();
 }

 $('match-online').onclick=open;
 $('online-create').onclick=()=>connect();
 $('online-join-form').onsubmit=e=>{
  e.preventDefault();
  if(busy)return;
  const code=onlineRoomFromInput(roomInput.value);
  if(!code){
   invalidCode=true;statusMessage='请输入有效的 8 位房间码，或粘贴完整邀请链接。';
   render();roomInput.focus();return;
  }
  roomInput.value=code;connect(code);
 };
 roomInput.oninput=()=>{
  if(!invalidCode&&(!inviteCode||roomInput.value===inviteCode))return;
  invalidCode=false;inviteCode='';statusMessage='';render();
 };
 roomInput.onpaste=e=>{
  const code=onlineRoomFromInput(e.clipboardData?.getData('text'));
  if(!code)return;
  e.preventDefault();showInvite(code);
 };
 $('online-copy').onclick=()=>session&&copyOnlineInvite(session,toast);
 $('online-leave').onclick=()=>{
  operation++;busy=false;releaseSession(true);
  statusMessage='已离开，可创建新的房间。';render();
 };
 $('online-ready').onclick=()=>{
  if(!busy&&session?.connection==='connected'&&!session.room?.ended)onEnter(session);
 };
 $('online-lineup-edit').onclick=()=>{
  const current=session;
  if(!current||busy||current.connection!=='connected'||current.room?.started||current.room?.ended)return;
  getSquadEditor().open({team:current.team,opponent:current.opponent,selection:current.room?.lineups?.[current.team],onSave:async selection=>{
   const result=await current.request({type:'lineup',selection});
   if(current===session){statusMessage='首发已保存，请点击准备。';render();}
   return result;
  }});
 };
 render();
 return{open,reset(){
  operation++;busy=false;invalidCode=false;inviteCode='';releaseSession();statusMessage='';roomInput.value='';
  const url=new URL(location.href);url.searchParams.delete('room');history.replaceState(null,'',url);
  render();
 },get session(){return session;}};
}
