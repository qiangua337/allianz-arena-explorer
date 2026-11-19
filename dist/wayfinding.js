import {roomAt} from './building-layout.js';

export function relativeBearing(position,yaw,target){const targetYaw=Math.atan2(position.x-target.x,position.z-target.z),angle=yaw-targetYaw;return Math.atan2(Math.sin(angle),Math.cos(angle));}
const upperLandingTurn=id=>id==='upperThresholdFoot'||id==='upperAisleEntry';
const galleryTurn=id=>id==='upperGalleryFront'||id==='upperGalleryOuter'||id==='upperBridgeStart';
const coreTurn=id=>/^flight\d+(?:Out|Turn)$/.test(id)||/^landing\d+$/.test(id)||id==='corePublicFront';
function passedCorner(position,target,anchor,lateralLimit,overshootLimit){
 if(!anchor)return false;
 const dx=target.x-anchor.x,dz=target.z-anchor.z,length=Math.hypot(dx,dz);
 if(length<.4)return false;
 const x=position.x-target.x,z=position.z-target.z;
 const ahead=(x*dx+z*dz)/length,cross=(x*dz-z*dx)/length;
 return ahead>0&&ahead<=overshootLimit&&Math.abs(cross)<=lateralLimit;
}
export function waypointReached(position,target,anchor,next,isFinal=false){
 const vertical=Math.abs(position.y-target.y);
 if(vertical>.9)return false;
 if(isFinal)return Math.hypot(position.x-target.x,position.z-target.z)<=1.7;
 const distance=Math.hypot(position.x-target.x,position.z-target.z);
 if(upperLandingTurn(target.id)){
  return vertical<.25&&(distance<=.25||passedCorner(position,target,anchor,.18,.42));
 }
 if(target.id==='upperStairAlign')return vertical<.24&&distance<=.23;
 if(target.id==='upperThreshold'){
  return vertical<.24&&(distance<=.65||passedCorner(position,target,anchor,.42,1.1));
 }
 const controlledTurn=coreTurn(target.id)||galleryTurn(target.id);
 const tight=target.level==='core'||target.level==='clearance'||controlledTurn||/^landing|Door|Start|Out|Turn|End/.test(target.id),radius=tight?.65:/^(lower|upper)\d+$/.test(target.id)?3:1.4;
 if(distance<=radius)return !controlledTurn||vertical<=.4;
 if(controlledTurn)return vertical<.35&&passedCorner(position,target,anchor,.44,1.08);
 if(anchor&&Math.abs(anchor.y-target.y)<.45){const dx=target.x-anchor.x,dz=target.z-anchor.z,length=Math.hypot(dx,dz);if(length>2){const along=((position.x-anchor.x)*dx+(position.z-anchor.z)*dz)/(length*length),cross=Math.abs((position.x-anchor.x)*dz-(position.z-anchor.z)*dx)/length;if(along>1&&cross<(tight?.55:1.7))return true;}}
 // A visitor already following the next corridor need not return to its exact corner.
 if(!tight&&next&&Math.abs(next.y-target.y)<.45){const dx=next.x-target.x,dz=next.z-target.z,length=Math.hypot(dx,dz);if(length>4){const along=((position.x-target.x)*dx+(position.z-target.z)*dz)/length,cross=Math.abs((position.x-target.x)*dz-(position.z-target.z)*dx)/length;if(along>1&&along<length&&cross<1.4)return true;}}
 return false;
}
const doorRooms={homeDoor:['homeRoom','主队更衣室'],guestRoomDoor:['guestRoom','客队更衣室'],pressDoor:['press','新闻发布厅'],storeDoor:['store','球迷商店'],museumDoor:['museum','荣誉展厅'],loungeDoor:['lounge','贵宾包厢']};
const galleryReturnNext={
 upperBridgeStart:'upperGalleryOuter',
 upperGalleryOuter:'upperGalleryFront',
 upperGalleryFront:'landing3'
};
export function movementInstruction(position,yaw,target,next,goal){
 const distance=Math.hypot(target.x-position.x,target.z-position.z),angle=relativeBearing(position,yaw,target),height=target.y-position.y;
 let action=height>1.5?'沿楼梯上行':height<-1.5?'沿楼梯下行':/^lower\d+$/.test(target.id)?'沿入口环廊前行':/^upper\d+$/.test(target.id)?'沿公共大厅前行':target.label;
 let hint=target.hint;
 const door=doorRooms[target.id];
 const doorway=door||['coreFront','corePublicFront','upperThreshold'].includes(target.id);
 if(door){
  const entering=next&&(next.id===door[0]||next.id.startsWith(door[0]+'Walk')||door[0]==='press'&&next.id==='pressEntry');
  action=(entering?'进入':'走出')+door[1];
  if(entering)hint='靠近感应门后，从开放门洞步行进入。';
  else if(target.id==='museumDoor'||target.id==='storeDoor')hint='穿过东侧感应门，回到公共大厅。';
  else hint='穿过房门回到走廊，再沿地线继续前行。';
 }else if(/^upper\d+$/.test(target.id)&&next?.id==='museumDoor'){
  action='前往荣誉展厅入口';hint='沿公共大厅走到展厅东侧的感应门。';
 }
 else if(target.id==='museum'||target.id.startsWith('museumWalk')){
  const entering=goal==='museum'||target.id==='museum'&&!next;
  const outside=entering&&roomAt(position)!=='museum';
  if(outside){action='穿过荣誉展厅感应门';hint='等门打开后，直走穿过门洞。';}
  else {action=entering?'前往荣誉展厅中央展区':'沿展柜间通道前往出口';
   hint=entering?'沿两排奖杯展柜之间的过道前进。':'沿展柜之间的通道前往东侧感应门，出去就是公共大厅。';}
 }
 else if(target.id==='store'||target.id.startsWith('storeWalk')){
  const entering=goal==='store'||target.id==='store'&&!next;
  action=entering?'前往球迷商店展示区':'沿货架间通道前往出口';
  hint=entering?'沿货架之间的开放通道继续前进。':'沿货架之间的通道走向东侧感应门，出去就是公共大厅。';
 }
 else if(target.id.includes('RoomWalk'))hint='沿衣柜与备战台之间的过道通行。';
 else if(['tunnel','tunnelStairs','tunnelMouth'].includes(target.id)){const out=(next?.x??target.x)>(next?target.x:position.x);action=out?'沿球员通道返回草坪':'沿球员通道前往更衣区';hint=out?'朝明亮的出口前行，沿台阶上行走出通道。':'沿红色通道向内，前方连接主客队更衣室与发布厅。';}
 else if(['visitorGate','passage','ramp','pitchExit','pitchEdge'].includes(target.id)){const back=(next?.z??target.z)>(next?target.z:position.z);action=back?'沿参观通道返回大厅':'沿参观通道前往草坪';hint=back?'沿灯带向接待大厅前行，靠近场边时先下台阶。':'沿灯带直行，走上场边台阶后进入草坪。';}
 else if(target.id==='reception'){hint=next?.id==='door'?'沿大厅中央开放通道向南离开，前往正门。':next?.id==='turn'?'跟随地线前往红色开放入口，进入参观通道。':'沿地线前往接待区或环廊内的公共楼梯。';}
 else if(target.id==='turn'){action=next?.id==='reception'?'返回接待大厅':'前往球场参观入口';hint=next?.id==='reception'?'从红色通道出口沿地线回到大厅中央。':'红色开放门连接通往草坪的参观通道。';}
 else if(target.id==='museumWestApproach'){
  const returning=next?.id==='forecourt';
  action=returning?'返回接待大厅':'前往 T3 楼梯';
  hint=returning?'沿外环步道回到南侧大厅入口。':'沿外环步道向西，前方是通往公共大厅的楼梯。';
 }
 else if(['security','forecourt','door'].includes(target.id)){
  if(next?.id==='museumWestApproach'){
   action='前往 T3 楼梯';hint='走出大厅后转向西侧外环，沿地线前往 T3 楼梯。';
  }else if(next?.id?.startsWith('outside')){
   action='前往球场外环步道';hint='出大厅后沿外环跟随地线，前往室外楼梯。';
  }else if(next&&next.z>target.z){
   const leavingHall=target.id==='door';
   action=leavingHall?'走出接待大厅':'前往南侧正门';
   hint=leavingHall?'沿中央开放通道离开大厅，然后跟随地线。':
    target.id==='forecourt'?'走出大厅后，沿南广场步道前往正门。':'沿南广场中央步道穿过验票通道。';
  }else{
   action='进入接待大厅';hint='沿中央开放通道进入大厅，抵达后跟随所选目的地。';
  }
 }
 else if(target.id==='pitch'&&next?.id==='pitchEdge'){action='穿过草坪前往参观通道';hint='南侧场边的开放通道通往接待大厅与正门。';}
 else if(target.id==='westField'&&next?.id==='pitch'){action='返回草坪';hint='走出球员通道，沿地线前往南侧的参观通道。';}
 else if(target.id==='lowerEntry'){const leaving=next?.id==='upper24';action=leaving?'返回公共大厅':'进入下层看台';hint=leaving?'沿北侧缓坡前往公共大厅，继续跟随地线。':'沿北侧缓坡进入看台，留意座椅之间的过道。';}
 else if(target.id==='upperThreshold'){const entering=next?.id==='upperThresholdFoot';action=entering?'进入上层看台':'返回上层连廊';hint=entering?'穿过门口，在台阶底部沿平台转弯。':'沿台阶上行，从门口回到连廊。';}
 else if(target.id==='upperThresholdFoot'){const entering=next?.id==='upperAisleEntry';action=entering?'下到看台入口平台':'沿平台前往连廊台阶';hint=entering?'到台阶底部后沿地线转入座席过道。':'沿地线走到台阶正前方，再上楼返回连廊。';}
 else if(target.id==='upperAisleEntry'){const leaving=next?.id==='upperThresholdFoot';action=leaving?'沿座席台阶上行':'前往座席过道';hint=leaving?'沿座席之间的台阶上行，在平台转向连廊入口。':'在平台转弯，沿座席之间的台阶下行。';}
 else if(target.id==='upperStands'&&position.y-target.y>1){action='沿台阶进入上层看台';hint='走到台阶后的座席过道。';}
 else if(target.id==='upperBridgeStart'&&next?.id==='upperThreshold'){action='走到上层连廊转角';hint='走到连廊尽头，再转向看台门洞。';}
 else if(next?.id&&galleryReturnNext[target.id]===next.id){
  action='沿连廊返回楼梯间';
  hint=target.id==='upperGalleryFront'?'走到连廊转角，再沿地线进入楼梯间。':'沿连廊走到前方转角，继续跟随地线。';
 }
 else if(target.id.includes('Bridge'))hint='沿带扶手的连廊通行，到转角后继续跟随地线。';
 else if(target.id==='coreFront'&&next?.id==='coreApproach'){action='走出楼梯间';hint='穿过开放门洞，在入口环廊继续跟随地线。';}
 else if(target.id==='coreApproach'&&/^lower\d+$/.test(next?.id??'')){action='返回入口环廊';hint='转入环廊，沿地线前往接待大厅。';}
 else if(target.id==='corePublicApproach'&&next?.id==='corePublicFront'){action='前往公共楼梯';hint='沿公共大厅走向开放的楼梯门洞，进入后沿台阶上行。';}
 else if(target.id==='corePublicFront'&&next?.id==='landing1'){action='进入公共楼梯间';hint='穿过门洞，沿地线转入楼梯平台。';}
 else if(target.id==='corePublicFront'&&next?.id==='corePublicApproach'){action='走出楼梯间';hint='穿过开放门洞，转入公共大厅。';}
 else if(target.id.startsWith('landing')&&next?.level==='core'){action='前往楼梯平台';hint='在平台转弯，继续沿下一段楼梯走。';}
 else if(target.id.startsWith('core'))hint='沿楼梯与大厅之间的开放平台通行，跟随地线前往下一段走廊。';
 else if(/^T\d+(Top|Middle|Bottom)$/.test(target.id)){
  const name=target.id.replace(/(?:Top|Middle|Bottom)$/,'')+' 楼梯';
  action=height>.55?'沿 '+name+'上行':height<-.55?'沿 '+name+'下行':'前往 '+name;
  hint='沿扶手与踏步前进，到平台后继续跟随地线。';
 }
 else if(target.level==='core'||target.level==='stairs'){
  action=Math.abs(height)>.45?height>0?'沿楼梯上行':'沿楼梯下行':'前往楼梯平台';
  hint=Math.abs(height)>.45?'沿扶手与踏步到达平台，再跟随地线转弯。':'沿地线穿过平台，在下一段踏步前转弯。';
 }
 else if(Object.values(doorRooms).some(([id])=>id===target.id))hint='沿门内过道前往目的地，留意桌台、座椅与展柜。';
 if(target.id==='tunnel'&&!next){action=target.label;hint='前方台阶通往草坪，通道另一端连接更衣区。';}
 const returningToLanding=target.id==='upperThresholdFoot'&&next?.id==='upperThreshold'&&height<-.28;
 if(returningToLanding){
  action='退回连廊楼梯底部';hint='先回到下方平台，沿地线走到连廊台阶正前方。';
 }
 const upperLanding=upperLandingTurn(target.id),gallery=galleryTurn(target.id);
 const previewClearance=upperLanding?.24:.43;
 if(!returningToLanding&&next&&distance>previewClearance&&distance<3&&Math.abs(angle)<.48&&(upperLanding||gallery||coreTurn(target.id))){
  const towardTarget=Math.atan2(position.x-target.x,position.z-target.z),turn=relativeBearing(target,towardTarget,next);
  if(Math.abs(turn)>.88&&Math.abs(turn)<2.45){
   const direction=turn>0?'右转':'左转';
   action=(doorway?'过门口后':gallery?'到连廊转角后':'到平台后')+direction;
   const approach=doorway?'沿地线穿过门洞':gallery?'沿地线走到转角':Math.abs(height)>.45?'沿扶手与踏步到平台':'沿地线走到平台';
   hint=approach+'，再'+direction+'。';
  }
 }
 if(Math.abs(angle)>2.35)action='转身，'+action;else if(angle>.65)action='右转，'+action;else if(angle<-.65)action='左转，'+action;
 const landmark=doorway?'门口':gallery?'转角':upperLanding||coreTurn(target.id)?'平台':null;
 return{angle,distance,action,hint,landmark};
}
