import {getSquadEditor,buildRulesPicker,rulesSummary} from './squad-editor.js';
import {normalizeSelection,footballFormations} from './football-squads.js';
import {createOnlineSession,requestOnlineSeat} from './online-client.js';
import {roomCode,validRoomCode} from './online-protocol.js';
import {footballClubs,footballTeam} from './football-teams.js';
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
 const $=id=>document.getElementById(id),roomInput=$('online-room-input'),dialog=$('match-dialog');
 const clubList=$('online-club-options'),clubToggle=$('online-club-toggle');
 let session=null,enteredSession=null,unsubscribe=null,busy=false,statusMessage='',invalidCode=false,inviteCode='',operation=0,clubPickerOpen=null;
 const idleMessage='输入 8 位房间码，或粘贴朋友发来的邀请链接。';
 const formatCode=code=>code.slice(0,4)+' '+code.slice(4);
 const bothConfirmed=room=>Boolean(room?.confirmed?.home&&room?.confirmed?.away);
 const bothClubs=room=>Boolean(room?.clubs?.home&&room?.clubs?.away);
 const connected=()=>session?.connection==='connected'&&!session.room?.ended;
 const canEdit=()=>connected()&&!busy&&!session.room?.started&&!session.room?.confirmed?.[session.team];
 const homeClub=()=>session?.room?.homeClub||session?.homeClub||'bayern';
 const awayClub=()=>session?.room?.opponent||session?.opponent;
 const selectedClub=team=>session?.room?.teamChoice?session.room.clubs?.[team]:team==='home'?homeClub():awayClub();
 clubList.innerHTML=footballClubs.map(club=>`<button type="button" class="online-club-card" data-online-club="${club.id}" aria-pressed="false"><span class="club-swatch" style="--shirt:${club.kit.shirt};--ink:${club.kit.ink};--stripe:${club.kit.stripe||club.kit.shirt}" aria-hidden="true">${club.code}</span><b>${club.name}</b></button>`).join('');
 const clubButtons=[...clubList.querySelectorAll('button')];
 const picker=buildRulesPicker($('online-rules-picker'),async rules=>{
  const current=session;
  if(!canEdit()||current.team!=='home')return;
  busy=true;statusMessage='正在保存赛制…';render();
  try{
   await current.request({type:'rules',rules});
   if(current===session)statusMessage='';
  }catch(error){if(current===session)statusMessage=error.message;}
  finally{if(current===session){busy=false;render();}}
 });

 function enterOnce(){
  if(enteredSession===session)return;
  enteredSession=session;
  onEnter?.(session);
 }
 function maybeEnter(){
  const room=session?.room;
  if(!busy&&dialog.open&&dialog.dataset.panel==='online'&&connected()&&room?.teamChoice&&!room.started&&
     bothConfirmed(room)&&room.seats.length===2&&room.seats.every(seat=>seat.connected))enterOnce();
 }
 function seatStatus(team,room){
  const seat=room?.seats.find(s=>s.team===team);
  if(seat?.connected&&room.teamChoice&&!room.started){
   return room.confirmed?.[team]?'已确认':selectedClub(team)?'已选队':'正在选队';
  }
  return !seat?.connected?'等待加入':seat.ready?'已准备':'已连接';
 }
 function render(){
  const room=session?.room,isConnected=connected();
  for(const button of document.querySelectorAll('[data-match-tab]'))button.disabled=(busy||!!session)&&button.dataset.matchTab!=='online';
  dialog.classList.toggle('online-room-open',!!session);
  $('online-lobby-idle').hidden=!!session;
  $('online-lobby-room').hidden=!session;
  $('online-create').disabled=$('online-join').disabled=roomInput.disabled=busy;
  roomInput.setAttribute('aria-invalid',String(invalidCode));
  const message=$('online-message');
  if(!session){
   const options=getOptions();
   $('online-fixture-summary').textContent='房间赛制 · '+rulesSummary(options.rules);
   message.textContent=statusMessage||idleMessage;
   return;
  }
  const rules=room?.rules||session.rules||getOptions().rules;
  const ownClub=selectedClub(session.team),allowChanges=canEdit(),isConfirmed=room?.confirmed?.[session.team];
  const selection=ownClub?normalizeSelection(room?.lineups?.[session.team],session.team,awayClub(),homeClub()):null;
  $('online-code').textContent=formatCode(session.code);
  $('online-side').textContent=session.team==='home'?'你是主队 · 房主':'你是客队';
  $('online-home-status').textContent=seatStatus('home',room);
  $('online-away-status').textContent=seatStatus('away',room);
  const home=selectedClub('home'),away=selectedClub('away');
  $('online-home-label').textContent='主队 · '+(home?footballTeam(home).short:'未选队');
  $('online-away-label').textContent='客队 · '+(away?footballTeam(away).short:'未选队');
  $('online-club-setup').hidden=!room?.teamChoice||room.started;
  $('online-club-name').textContent=ownClub?footballTeam(ownClub).name:'尚未选择';
  const expanded=Boolean(room?.teamChoice&&!room.started&&(clubPickerOpen??!ownClub)&&!isConfirmed);
  clubToggle.setAttribute('aria-expanded',String(expanded));
  clubToggle.disabled=!allowChanges;
  clubList.hidden=!expanded;
  for(const button of clubButtons){
   button.disabled=!allowChanges;
   button.setAttribute('aria-pressed',String(button.dataset.onlineClub===ownClub));
  }
  $('online-rules-summary').textContent=rulesSummary(rules);
  $('online-rules-settings').hidden=session.team!=='home'||room?.started;
  picker.set(rules,!allowChanges);
  $('online-lineup-summary').textContent=selection?footballFormations[selection.formation].label+' · '+selection.xi.length+' 名首发':'请先选择球队';
  $('online-lineup-edit').disabled=!allowChanges||!selection;
  const friend=room?.seats.find(s=>s.team!==session.team);
  const waitingForConfirmation=Boolean(room?.teamChoice&&!room.started);
  $('online-ready').disabled=!isConnected||busy||waitingForConfirmation&&(!bothClubs(room)||bothConfirmed(room));
  $('online-ready').textContent=room?.started?'返回比赛 →':!waitingForConfirmation?'阵容就绪 · 准备进入球场 →':
   bothConfirmed(room)?'正在进入球场…':isConfirmed?'取消确认':!ownClub?'请先选择球队':!bothClubs(room)?'等待对方选队':'确认球队与阵容';
  const roomMessage=!isConnected?'正在连接比赛服务器…':room?.started?'连接已恢复，可以返回比赛。':
   waitingForConfirmation?!friend?.connected?'等待朋友加入。你可以先选队。':
    !ownClub?'请选择你的球队。':!bothClubs(room)?'对方正在选择球队，你可以先调整阵容。':
     bothConfirmed(room)?'双方已确认，球场加载完成后开球。':isConfirmed?'已确认，等待对方。':
      '双方确认球队与阵容后进入球场。':friend?.connected?
       '双方已连接，分别确认阵容并进入球场后开球。':'等待朋友加入。可以复制邀请链接，也可以先进入球场等候。';
  message.textContent=session.error||statusMessage||roomMessage;
  maybeEnter();
 }
 function saved(code){try{return JSON.parse(sessionStorage.getItem('arena-online-'+code)||'null');}catch{return null;}}
 function releaseSession(leave=false){
  const previous=session;
  unsubscribe?.();unsubscribe=null;session=null;enteredSession=null;clubPickerOpen=null;
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
   const seat=await requestOnlineSeat(code,code?{token:existing?.token}:{teamChoice:true,rules:options.rules});
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
   $('online-rules-settings').open=false;statusMessage='';render();
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
 clubToggle.onclick=()=>{
  if(!canEdit()||!session.room?.teamChoice)return;
  clubPickerOpen=clubList.hidden;render();
 };
 for(const button of clubButtons)button.onclick=async()=>{
  const current=session,club=button.dataset.onlineClub;
  if(!canEdit()||!current.room?.teamChoice)return;
  if(club===selectedClub(current.team)){clubPickerOpen=false;render();clubToggle.focus();return;}
  busy=true;statusMessage='正在保存球队…';render();
  try{
   await current.request({type:'club',club});
   if(current===session){clubPickerOpen=false;statusMessage='';}
  }catch(error){if(current===session)statusMessage=error.message;}
  finally{if(current===session){busy=false;render();if(!clubPickerOpen)clubToggle.focus();}}
 };
 $('online-ready').onclick=async()=>{
  if(busy||!connected())return;
  const current=session,room=current.room;
  if(!room?.teamChoice||room.started){enterOnce();return;}
  if(!bothClubs(room)||bothConfirmed(room))return;
  const confirmed=!room.confirmed?.[current.team];
  busy=true;statusMessage='正在同步确认…';render();
  try{
   await current.request({type:'confirm',confirmed,clubs:room.clubs});
   if(current===session)statusMessage='';
  }catch(error){if(current===session)statusMessage=error.message;}
  finally{if(current===session){busy=false;render();}}
 };
 $('online-lineup-edit').onclick=()=>{
  const current=session;
  if(!canEdit()||!selectedClub(current.team))return;
  getSquadEditor().open({team:current.team,opponent:awayClub(),homeClub:homeClub(),selection:current.room?.lineups?.[current.team],onSave:async selection=>{
   const result=await current.request({type:'lineup',selection});
   if(current===session){statusMessage='';toast?.('首发已保存');render();}
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
