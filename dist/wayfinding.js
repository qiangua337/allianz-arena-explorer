export function relativeBearing(position,yaw,target){const targetYaw=Math.atan2(position.x-target.x,position.z-target.z),angle=yaw-targetYaw;return Math.atan2(Math.sin(angle),Math.cos(angle));}
export function waypointReached(position,target,anchor,next,isFinal=false){
 if(Math.abs(position.y-target.y)>.9)return false;
 if(isFinal)return Math.hypot(position.x-target.x,position.z-target.z)<=1.7;
 const tight=target.level==='core'||target.level==='clearance'||/^landing|Door|Start|Out|Turn|End/.test(target.id),radius=isFinal?1.7:tight?.65:/^(lower|upper)\d+$/.test(target.id)?3:1.4;
 if(Math.hypot(position.x-target.x,position.z-target.z)<=radius)return true;
 if(anchor&&Math.abs(anchor.y-target.y)<.45){const dx=target.x-anchor.x,dz=target.z-anchor.z,length=Math.hypot(dx,dz);if(length>2){const along=((position.x-anchor.x)*dx+(position.z-anchor.z)*dz)/(length*length),cross=Math.abs((position.x-anchor.x)*dz-(position.z-anchor.z)*dx)/length;if(along>1&&cross<(tight?.55:1.7))return true;}}
 // A visitor already following the next corridor need not return to its exact corner.
 if(!tight&&next&&Math.abs(next.y-target.y)<.45){const dx=next.x-target.x,dz=next.z-target.z,length=Math.hypot(dx,dz);if(length>4){const along=((position.x-target.x)*dx+(position.z-target.z)*dz)/length,cross=Math.abs((position.x-target.x)*dz-(position.z-target.z)*dx)/length;if(along>1&&along<length&&cross<1.4)return true;}}
 return false;
}
const doorRooms={homeDoor:['homeRoom','主队更衣室'],guestRoomDoor:['guestRoom','客队更衣室'],pressDoor:['press','新闻发布厅'],storeDoor:['store','球迷商店'],museumDoor:['museum','荣誉展厅'],loungeDoor:['lounge','贵宾包厢']};
export function movementInstruction(position,yaw,target,next){
 const distance=Math.hypot(target.x-position.x,target.z-position.z),angle=relativeBearing(position,yaw,target),height=target.y-position.y;
 let action=height>1.5?'沿楼梯上行':height<-1.5?'沿楼梯下行':/^lower\d+$/.test(target.id)?'沿入口环廊前行':/^upper\d+$/.test(target.id)?'沿公共大厅前行':target.label;
 let hint=target.hint;
 const door=doorRooms[target.id];
 if(door){const entering=next&&(next.id===door[0]||next.id.startsWith(door[0]+'Walk')||door[0]==='press'&&next.id==='pressEntry');action=(entering?'进入':'走出')+door[1];hint=entering?'靠近感应门后，从开放门洞步行进入。':'穿过房门回到走廊，再沿地线继续前行。';}
 else if(target.id.includes('RoomWalk'))hint='沿衣柜与备战台之间的过道通行。';
 else if(['tunnel','tunnelStairs','tunnelMouth'].includes(target.id)){const out=(next?.x??target.x)>(next?target.x:position.x);action=out?'沿球员通道返回草坪':'沿球员通道前往更衣区';hint=out?'朝明亮的出口前行，沿台阶上行走出通道。':'沿红色通道向内，前方连接主客队更衣室与发布厅。';}
 else if(['visitorGate','passage','ramp','pitchExit','pitchEdge'].includes(target.id)){const back=(next?.z??target.z)>(next?target.z:position.z);action=back?'沿参观通道返回大厅':'沿参观通道前往草坪';hint=back?'沿灯带向接待大厅前行，靠近场边时先下台阶。':'沿灯带直行，走上场边台阶后进入草坪。';}
 else if(target.id==='reception'){hint=next?.id==='door'?'沿大厅中央开放通道向南离开，前往正门。':next?.id==='turn'?'跟随地线前往红色开放入口，进入参观通道。':'沿地线前往接待区或环廊内的公共楼梯。';}
 else if(target.id==='turn'){action=next?.id==='reception'?'返回接待大厅':'前往球场参观入口';hint=next?.id==='reception'?'从红色通道出口沿地线回到大厅中央。':'红色开放门连接通往草坪的参观通道。';}
 else if(['security','forecourt','door'].includes(target.id)){const out=next&&next.z>target.z;action=out?'前往南侧正门':'进入接待大厅';hint=out?'沿中央开放通道离开大厅，直达南侧正门。':'沿中央开放通道进入大厅，抵达后跟随所选目的地。';}
 else if(target.id==='pitch'&&next?.id==='pitchEdge'){action='穿过草坪前往参观通道';hint='南侧场边的开放通道通往接待大厅与正门。';}
 else if(target.id==='westField'&&next?.id==='pitch'){action='返回草坪';hint='走出球员通道，沿地线前往南侧的参观通道。';}
 else if(target.id==='lowerEntry'){const leaving=next?.id==='upper24';action=leaving?'返回公共大厅':'进入下层看台';hint=leaving?'沿北侧缓坡前往公共大厅，继续跟随地线。':'沿北侧缓坡进入看台，留意座椅之间的过道。';}
 else if(target.id.includes('Bridge'))hint='沿带扶手的连廊通行，到转角后继续跟随地线。';
 else if(target.id.startsWith('core'))hint='沿楼梯与大厅之间的开放平台通行，跟随地线前往下一段走廊。';
 else if(target.level==='core'||target.level==='stairs'||/^T\d+(Top|Middle|Bottom)$/.test(target.id)){const rise=(next?.y??target.y)-position.y;action=Math.abs(rise)>.45?rise>0?'沿楼梯上行':'沿楼梯下行':'前往楼梯平台';hint='沿扶手与踏步到达平台，再跟随地线转弯。';}
 else if(Object.values(doorRooms).some(([id])=>id===target.id))hint='沿门内过道前往目的地，留意桌台、座椅与展柜。';
 if(target.id==='tunnel'&&!next){action=target.label;hint='前方台阶通往草坪，通道另一端连接更衣区。';}
 if(Math.abs(angle)>2.35)action='转身，'+action;else if(angle>.65)action='右转，'+action;else if(angle<-.65)action='左转，'+action;
 return{angle,distance,action,hint};
}
