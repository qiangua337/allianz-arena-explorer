// Official first-team roster, checked 2026-10-20. Keep names and numbers together.
export const rosterInfo={season:'2026/27',checked:'2026-10-20',source:'https://fcbayern.com/en/teams/first-team'};
export const firstTeam=[
 {number:1,name:'NEUER',fullName:'Manuel Neuer'},
 {number:26,name:'ULREICH',fullName:'Sven Ulreich'},
 {number:40,name:'URBIG',fullName:'Jonas Urbig'},
 {number:2,name:'UPAMECANO',fullName:'Dayot Upamecano'},
 {number:3,name:'KIM',fullName:'Minjae Kim'},
 {number:4,name:'TAH',fullName:'Jonathan Tah'},
 {number:11,name:'BROWN',fullName:'Nathaniel Brown'},
 {number:19,name:'DAVIES',fullName:'Alphonso Davies'},
 {number:21,name:'ITO',fullName:'Hiroki Ito'},
 {number:23,name:'BOEY',fullName:'Sacha Boey'},
 {number:44,name:'STANIŠIĆ',fullName:'Josip Stanišić'},
 {number:6,name:'KIMMICH',fullName:'Joshua Kimmich'},
 {number:8,name:'BISCHOF',fullName:'Tom Bischof'},
 {number:10,name:'MUSIALA',fullName:'Jamal Musiala'},
 {number:27,name:'LAIMER',fullName:'Konrad Laimer'},
 {number:39,name:'NDIAYE',fullName:'Bara Sapoko Ndiaye'},
 {number:42,name:'KARL',fullName:'Lennart Karl'},
 {number:45,name:'PAVLOVIĆ',fullName:'Aleksandar Pavlović'},
 {number:null,name:'SANTOS DAIBER',fullName:'David Santos Daiber'},
 {number:7,name:'GNABRY',fullName:'Serge Gnabry'},
 {number:9,name:'KANE',fullName:'Harry Kane'},
 {number:14,name:'LUIS DÍAZ',fullName:'Luis Díaz'},
 {number:17,name:'OLISE',fullName:'Michael Olise'},
 {number:34,name:'SAIBARI',fullName:'Ismael Saibari'}
];
export const numberedPlayers=firstTeam.filter(player=>Number.isInteger(player.number));
export const playerByNumber=number=>numberedPlayers.find(player=>player.number===number);
