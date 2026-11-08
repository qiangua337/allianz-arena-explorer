// Preparation describes the player's actual body and shooting conditions;
// it is never presented as a probability of scoring.
export const preparationLabels={balanced:'站稳起脚',backfoot:'背身起脚',rushed:'跑动起脚',pressured:'贴身受压',overpowered:'蓄力过满','long-range':'远距离起脚'};
export function shotReadout(preview){
 if(!preview)return{tone:'steady',label:'松开出脚',advice:'方向选择落点'};
 const label=preparationLabels[preview.preparation]||preparationLabels.balanced;
 if(preview.limited)return{tone:'risk',label:'弧线受限',advice:'向前带球或增加力量'};
 const advice={balanced:'方向选择落点',backfoot:'转向球门后再射',rushed:'松开加速，调整步点',pressured:'拉开空当再射',overpowered:'适当减小蓄力','long-range':'靠近球门会更稳'}[preview.preparation]||'方向选择落点';
 return{tone:preview.quality<.55?'risk':preview.quality<.8?'caution':'steady',label,advice};
}
export function shotOutcomeText(shot){
 const outcomes={flight:'射门飞行中',goal:'破门！',saved:'门将抱住',parried:'扑救脱手 · 跟进补射',woodwork:'击中门框',wide:'偏出球门',blocked:'被防守球员挡出',short:'射门未到门前'};
 const result=outcomes[shot?.outcome]||'球在比赛中',reason=preparationLabels[shot?.preparation];
 return reason&&shot.preparation!=='balanced'&&['flight','wide','short','blocked'].includes(shot.outcome)?result+' · '+reason:result;
}
export function shotGuideTiming(ball,target){
 const height=Math.max(.11,ball.y||.11),vy=target.vy||0;
 const landing=(vy+Math.sqrt(vy*vy+19.62*(height-.11)))/9.81;
 return{duration:Math.min(target.flight,landing),lands:landing<target.flight-.001};
}
export function sampleShotGuide(ball,target,time,out={}){
 const travel=-Math.expm1(-.08*time)/.08,curveTravel=(time-travel)/.08;
 out.x=ball.x+target.vx*travel+(target.curve||0)*curveTravel;
 out.y=Math.max(.035,(ball.y||.11)+target.vy*time-4.905*time*time);
 out.z=ball.z+target.vz*travel;return out;
}
export function shotGuideSpread(target,timing){
 const ratio=-Math.expm1(-.08*timing.duration)/-Math.expm1(-.08*target.flight);
 return{width:Math.min(8,Math.max(.12,(target.spread||.12)*ratio)),height:timing.lands?0:Math.min(2,Math.max(.02,target.heightSpread||.02))};
}
