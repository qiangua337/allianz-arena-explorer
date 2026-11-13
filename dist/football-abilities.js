// Gameplay values tuned for this simulation. Each row is pace, dribbling,
// passing, finishing, defending, and optionally goalkeeping.
const ratings={
 home:{
  1:[51,65,85,30,25,91],26:[44,51,67,26,25,78],40:[51,60,77,27,25,83],
  2:[84,70,77,52,88],3:[80,65,72,48,87],4:[74,62,76,49,89],11:[87,80,76,64,75],
  19:[96,86,78,68,78],21:[77,69,78,55,82],23:[88,76,72,58,78],44:[76,72,78,58,84],
  6:[69,80,94,77,85],8:[75,83,86,73,75],10:[87,96,86,87,57],27:[85,76,81,69,85],
  39:[81,82,74,69,61],42:[84,89,81,81,51],45:[70,80,90,70,82],47:[74,79,83,66,72],
  7:[84,85,80,86,56],9:[72,83,88,96,53],14:[92,91,81,87,62],17:[87,92,92,88,55],34:[84,88,83,79,67]
 },
 dortmund:{
  1:[49,57,72,29,24,90],3:[76,67,76,48,85],4:[78,71,83,56,88],5:[75,71,75,66,83],
  7:[84,86,83,76,72],8:[81,82,83,74,76],9:[79,81,77,91,47],14:[89,85,78,85,57],
  17:[82,88,81,76,62],18:[87,89,82,82,52],19:[84,91,86,79,52],20:[74,80,88,81,77],
  21:[81,84,77,83,51],22:[79,64,70,46,80],23:[72,72,79,70,85],24:[84,78,80,67,79],
  25:[69,79,91,75,71],26:[84,75,78,62,84],33:[47,54,68,26,23,78],36:[87,83,76,69,68]
 },
 madrid:{
  1:[47,56,72,27,23,95],10:[97,94,86,95,43],14:[76,78,85,73,87],4:[78,74,84,56,86],
  22:[83,65,74,52,90],18:[86,82,79,65,81],12:[80,82,94,76,77],8:[89,85,89,87,85],
  5:[86,90,90,90,80],11:[91,91,85,87,57],7:[96,96,85,90,47],13:[51,61,72,28,24,85],
  3:[87,70,75,59,88],2:[80,67,75,54,82],23:[90,79,77,61,84],6:[86,87,86,73,85],
  15:[81,92,91,83,55],9:[89,87,76,88,47],21:[89,93,85,83,51],25:[84,72,78,53,84]
 },
 barcelona:{
  1:[55,61,79,26,25,88],9:[85,88,82,86,59],21:[80,91,92,75,82],5:[74,75,89,51,86],
  15:[74,67,79,48,86],3:[95,86,81,62,79],23:[85,77,83,62,89],8:[79,94,95,81,76],
  20:[82,91,88,88,61],10:[92,97,92,89,51],11:[94,89,88,90,65],13:[47,53,69,27,22,85],
  24:[70,69,84,53,84],18:[81,74,78,59,79],22:[72,79,86,68,79],6:[82,88,88,77,82],
  7:[84,86,82,86,66],14:[97,86,76,83,58],17:[93,88,83,83,66],19:[87,90,83,82,52]
 },
 city:{
  1:[50,57,73,28,24,93],9:[93,82,75,97,45],5:[81,85,87,80,76],3:[67,64,81,52,93],
  6:[80,73,81,56,88],21:[88,90,84,72,77],27:[88,85,84,75,74],8:[76,92,90,77,79],
  10:[81,96,94,85,52],47:[88,94,91,90,61],11:[96,96,80,80,52],28:[50,57,72,27,24,81],
  24:[83,80,84,71,89],45:[90,69,75,52,84],82:[82,85,87,71,77],33:[81,83,85,79,78],
  17:[72,85,94,81,78],32:[76,83,87,70,76],7:[90,92,83,82,57],42:[92,87,81,86,63]
 }
};
export const abilityLabels={pace:'速度',dribbling:'盘带',passing:'传球',finishing:'射门',defending:'防守',goalkeeping:'扑救'};
const keys=Object.keys(abilityLabels);
const profile=(row)=>Object.freeze(Object.fromEntries(keys.map((key,index)=>[key,row[index]??0])));
const neutral=profile([80,80,80,80,80,90]);
const specialties=new Map();
const labelFor=values=>keys.slice(0,5).sort((a,b)=>values[b]-values[a]).slice(0,2).map(key=>abilityLabels[key]).join(' · ');
specialties.set(neutral,labelFor(neutral));
for(const roster of Object.values(ratings))for(const number of Object.keys(roster)){
 const values=roster[number]=profile(roster[number]);
 specialties.set(values,labelFor(values));
}

export function footballAbilities(team,opponent,number){
 return ratings[team==='home'?'home':opponent]?.[number]??neutral;
}
export const playerAbilities=player=>footballAbilities(player?.team,player?.abilityClub,player?.number);
export const abilityFactor=(rating,weight,baseline=80)=>1+(rating-baseline)*weight;
export function playerSpecialties(team,opponent,number,keeper=false){
 const values=footballAbilities(team,opponent,number);
 return keeper?(values.goalkeeping>=values.passing?'扑救 · 传球':'传球 · 扑救'):specialties.get(values);
}
