const red=0xc91c36,crestRed=0xd20c33,white=0xf3f1eb,blue=0x2868d6,slate=0x98a2ac;

function seatMask(width,height,draw){
 const canvas=document.createElement('canvas');
 canvas.width=width;canvas.height=height;
 const context=canvas.getContext('2d');draw(context,width,height);
 const {data}=context.getImageData(0,0,width,height);
 return (u,v)=>{
  if(u<0||u>=1||v<0||v>=1)return null;
  const px=(Math.floor(v*height)*width+Math.floor(u*width))*4;
  if(data[px+3]<128)return null;
  if(data[px+2]>data[px]+45)return blue;
  if(data[px+1]>152)return white;
  return crestRed;
 };
}

function lettering(text,font){
 return seatMask(768,144,(context,w,h)=>{
  context.fillStyle='#fff';context.font=font;context.textAlign='center';context.textBaseline='middle';
  context.fillText(text,w/2,h/2,w-12);
 });
}

export function buildArenaSeatMosaic(crestImage){
 const east=['MÜNCHEN','BAYERN','FC'].map(text=>lettering(text,'900 116px Arial'));
 const eastWidths=[126,126,142];
 const west=lettering('Mia san mia','italic 900 120px Arial');
 const north=seatMask(384,384,(context,w,h)=>{if(crestImage)context.drawImage(crestImage,0,0,w,h);});
 // The club crest spans the three tiers, while the two wordmarks face the
 // field. Sample existing seats so each aisle remains a gap in the mosaic.
 return (x,y,z,tier,row,rows)=>{
  const base=tier===1?red:slate;
  if(z<-59&&Math.abs(x)<28)return north(x/56+.5,(40.25-y)/40)??base;
  const v=1-(row+.5)/rows;
  if(x>0&&east[tier](z/eastWidths[tier]+.5,v)===white)return tier===1?white:red;
  if(tier===0&&x<0&&west(.5-z/113,v)===white)return red;
  return base;
 };
}
