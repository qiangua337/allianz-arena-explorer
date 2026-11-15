import test from 'node:test';
import assert from 'node:assert/strict';
import {buildArenaSeatMosaic} from '../dist/seat-mosaic.js';

test('north crest spans the three tiers and the side lettering faces the pitch',()=>{
 const previous=globalThis.document,written=[],crest={fixture:true};
 globalThis.document={createElement(){
  let picture,text;
  return {getContext(){return {
   fillText(value){text=value;written.push(value);},
   drawImage(value){picture=value;},
   getImageData(_x,_y,width,height){
    const data=new Uint8ClampedArray(width*height*4);
    for(let row=0;row<height;row++)for(let col=0;col<width;col++){
     const i=(row*width+col)*4;
     if(text&&col<width/2){data.fill(255,i,i+4);}
     else if(picture===crest&&col>width*.35&&col<width*.65){data[i]=40;data[i+1]=108;data[i+2]=252;data[i+3]=255;}
    }
    return {data};
   }
  };}};
 }};
 try{
  const sample=buildArenaSeatMosaic(crest),red=0xc91c36,white=0xf3f1eb,blue=0x2868d6,slate=0x98a2ac;
  assert.deepEqual(written,['MÜNCHEN','BAYERN','FC','Mia san mia']);
  for(const [tier,y,rows] of [[0,7,30],[1,19,24],[2,33,26]]){
   assert.equal(sample(0,y,-93,tier,10,rows),blue);
   assert.equal(sample(26,y,-93,tier,10,rows),tier===1?red:slate);
   assert.equal(sample(0,y,93,tier,10,rows),tier===1?red:slate);
  }
  assert.equal(sample(70,19,-33,1,10,24),white,'facing east puts negative z at the left');
  assert.equal(sample(70,19,33,1,10,24),red);
  assert.equal(sample(55,7,-33,0,10,30),red,'lower stand lettering is red on slate');
  assert.equal(sample(90,33,-33,2,10,26),red,'upper stand lettering is red on slate');
  assert.equal(sample(-55,7,33,0,10,30),red,'facing west puts positive z at the left');
  assert.equal(sample(-55,7,-33,0,10,30),slate);
  assert.equal(sample(-70,19,33,1,10,24),red,'the motto belongs only on the lower tier');
 }finally{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
});
