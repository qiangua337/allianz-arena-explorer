const club='https://fcbayern.com/en/club/honours/champions-league/';
export const honours=[
 {year:'1974',kind:'europe',title:'第一次登上欧洲之巅',opponent:'Atlético Madrid',score:'1–1 · 重赛 4–0',city:'BRUSSELS',detail:'决赛加时结束时双方 1–1 战平，两天后的重赛拜仁以 4–0 获胜。这是俱乐部的首座欧洲冠军杯。',source:club+'european-cup-winner-1974'},
 {year:'1975',kind:'europe',title:'卫冕欧洲冠军',opponent:'Leeds United',score:'2–0',city:'PARIS',detail:'拜仁在巴黎以 2–0 击败利兹联，成功卫冕欧洲冠军杯。',source:'https://fcbayern.com/en/club/honours'},
 {year:'1976',kind:'europe',title:'欧洲冠军三连冠',opponent:'Saint-Étienne',score:'1–0',city:'GLASGOW',detail:'拜仁以 1–0 战胜圣埃蒂安，连续第三年获得欧洲冠军杯。',source:'https://fcbayern.com/en/club/honours'},
 {year:'2001',kind:'europe',title:'点球大战重返巅峰',opponent:'Valencia',score:'1–1 · 点球 5–4',city:'MILAN',detail:'米兰决赛双方在加时后仍为 1–1，拜仁在点球大战中以 5–4 胜出，第四次成为欧洲冠军。',source:'https://www.uefa.com/uefachampionsleague/news/01e5-0e74903ad234-f85fb970c47d-1000--past-finals-bayern/'},
 {year:'2013',kind:'europe',title:'温布利之夜',opponent:'Borussia Dortmund',score:'2–1',city:'LONDON',detail:'曼朱基奇先拔头筹，罗本在第 89 分钟打入制胜球，拜仁在温布利以 2–1 击败多特蒙德。',source:club+'champions-league-winner-2013'},
 {year:'2020',kind:'europe',title:'里斯本，第六座欧洲冠军杯',opponent:'Paris Saint-Germain',score:'1–0',city:'LISBON',detail:'科曼在第 59 分钟头球破门，拜仁以 1–0 战胜巴黎圣日耳曼，第六次夺得欧洲冠军，并完成俱乐部的第二次三冠王。',source:'https://fcbayern.com/en/news/matchreports/2020/08/match-report-champions-league-final-paris-saint-german-v-fc-bayern-230820'},
 {year:'MEISTER',kind:'shield',title:'德甲冠军盘 · Meisterschale',opponent:'DEUTSCHE MEISTERSCHAFT',score:'德国顶级联赛冠军',city:'BUNDESLIGA',detail:'环形银盘、放射纹样与绿色宝石构成德甲冠军盘的鲜明轮廓。本展品为程序建模的代表性陈列，近看可观察同心金属环与镶嵌细节。',source:'https://fcbayern.com/en/club/honours'},
 {year:'POKAL',kind:'pokal',title:'德国杯 · DFB-Pokal',opponent:'DEUTSCHER POKALSIEGER',score:'德国杯冠军奖杯',city:'DFB-POKAL',detail:'金色杯身与绿色装饰是德国杯奖杯的标志。本展品以不同于欧洲冠军杯的轮廓、杯沿和装饰带作代表性还原。',source:'https://fcbayern.com/en/club/honours'}
].map((h,i)=>({...h,x:i%2?3.7:-3.7,z:-8+Math.floor(i/2)*5.3}));
