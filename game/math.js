/* Reimplemented arithmetic and puzzle rules. No original executable is run. */
(function(root){
'use strict';
const subjects=['Addition','Subtraction','Number Patterns','Estimation','Multiplication','Division','Fractions, Decimals, Percents','Review'];
const int=(rng,a,b)=>a+Math.floor(rng()*(b-a+1));
const pick=(rng,a)=>a[int(rng,0,a.length-1)];
const shuffle=(a,rng=Math.random)=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=int(rng,0,i);[a[i],a[j]]=[a[j],a[i]];}return a;};
function parseAnswer(input){
 const s=String(input).trim().replace(/,/g,'').replace(/−/g,'-');
 if(!s)return NaN;
 let m=s.match(/^(-?\d+)\s+(\d+)\/(\d+)$/);if(m)return +m[3]===0?NaN:+m[1]+(m[1].startsWith('-')?-1:1)*(+m[2]/+m[3]);
 m=s.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)$/);if(m)return +m[2]===0?NaN:+m[1]/+m[2];
 m=s.match(/^(-?(?:\d+(?:\.\d*)?|\.\d+))\s*(%)?$/);return m?+m[1]/(m[2]?100:1):NaN;
}
const equal=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=1e-7*Math.max(1,Math.abs(b));
const fmt=n=>Number.isInteger(n)?String(n):String(Math.round(n*1000000)/1000000);
// 5:4a9e inserts the decimal point directly, without a leading zero.
function originalDecimal(n,power){const s=String(n),at=s.length+power;return power>=0?s+'0'.repeat(power):at<=0?'.'+'0'.repeat(-at)+s:s.slice(0,at)+'.'+s.slice(at);}
// Default problem parameters: MBDATA1.MBD, six 92-byte records after EFAB ABCD.
const originalLevels=[[0,6,0,5,0,9,0,0,9,0,5,0,6,0,0,25,1,1,0,0,30,10,0,1,10,0,2,0,20,0,0,20,1,2,0,10,0,2,12,8,18,0,1,0,1,0],[4,10,1,7,10,14,0,10,14,1,7,4,10,0,0,25,2,3,0,31,60,10,0,1,12,3,4,0,48,0,0,48,3,4,0,12,0,3,15,2,8,1,2,1,2,0],[8,14,2,9,15,18,0,15,18,2,9,8,14,0,26,60,2,4,0,50,449,100,0,1,12,5,6,0,72,0,0,72,5,6,0,12,0,1,8,2,5,1,4,1,4,0],[0,90,10,50,10,100,3,10,90,10,50,0,80,3,26,60,5,8,5,450,949,100,0,10,90,0,30,0,2700,2,10,750,10,30,1,25,2,0,1,0,0,0,100,0,100,6],[10,18,4,11,19,22,1,19,22,4,11,10,18,1,60,100,7,10,5,950,4499,1000,0,1,12,7,9,7,108,0,1,108,7,9,1,12,0,20,50,0,0,0,200,0,200,3],[10,18,6,14,22,25,1,22,25,6,14,10,18,1,100,150,8,10,5,4500,9499,1000,0,2,12,10,12,20,144,0,20,144,10,12,2,12,0,1,10,0,0,1,100,1,100,0]];
const problemBanks=new Map();
const gcd=(a,b)=>{while(b){const n=a%b;a=b;b=n;}return Math.abs(a)||1;};
function originalBank(subject,level){
 const key=subject+':'+level;if(problemBanks.has(key))return problemBanks.get(key);
 const p=originalLevels[level-1],bank=[];
 const add=(a,b,result,extra={})=>bank.push({a,b,result,...extra});
 if([0,1,4,5].includes(subject)){
  const start={0:0,1:7,4:23,5:30}[subject],v=p.slice(start,start+7),[amin,amax,bmin,bmax,rmin,rmax,flags]=v;
  for(let a=amin;a<=amax;a++)for(let b=bmin;b<=bmax;b++){
   if((flags&2)&&(a%10||b%10))continue;
   const result=subject===0?a+b:subject===1?a-b:subject===4?a*b:b?a/b:NaN;
   if(!Number.isInteger(result)||result<rmin||result>rmax)continue;
   // 5:3fc5 / 5:40bb: the source only checks carrying when an addend
   // exceeds ten. Subtraction applies that same test to b + result.
   if(!(flags&1)&&(subject===0||subject===1)){
    const x=subject===0?a:result,y=b;
    if((x>10||y>10)&&(x%10+y%10>9||Math.trunc(x/10)+Math.trunc(y/10)>9))continue;
   }
   add(a,b,result);
  }
 }else if(subject===2){
  for(let start=p[14];start<=p[15];start++)for(let step=p[16];step<=p[17];step++){
   const index=bank.length,descending=!!(p[18]&1)&&!!(index&1),a=descending?start+4*step:start,b=descending?-step:step;
   add(a,b,a+4*b,{blank:p[18]&2?index%5:4});
  }
 }else if(subject===3){
  const place=p[21]||10;for(let a=p[19];a<=p[20];a++)add(a,place,Math.trunc((a+Math.trunc(place/2))/place)*place);
 }else if(subject===6){
  if(level===1){
   for(let a=p[37];a<=p[38];a++)for(let b=Math.max(a+1,p[39]);b<=p[40];b++){
    const g=gcd(a,b);if(g>1)add(a,b,a/g,{denominator:b/g});
   }
  }else if(level===2){
   for(let a=p[37];a<=p[38];a++)for(let b=p[39];b<=Math.min(a,p[40]);b++){
    if(!b)continue;const result=Math.trunc(a/b);if(result<p[43]||result>p[44])continue;
    const rem=a-result*b,g=gcd(rem,b);add(a,b,result,{remainder:rem/g,denominator:b/g});
   }
  }else if(level===3){
   // 5:456c..473e: all additions precede all subtractions in the bank.
   for(const sign of [1,-1])for(let a=p[37];a<=p[38];a++)for(let b=p[39];b<=p[40];b++)for(let c=p[41];c<=p[42];c++){
    const n=a+sign*c;if(n<=0||n>=b)continue;const g=gcd(n,b);add(a,b,n/g,{c,sign,denominator:b/g});
   }
  }else if(level===4){
   const minPower=p[45]&2?1:2,maxPower=p[45]&4?2:1;
   for(let places=1;places<4;places++)for(let power=minPower;power<=maxPower;power++)for(let n=1;n<Math.min(10**places,100);n++){
    if(n%10)add(10**power,n/10**places,n*10**(power-places),{places,power,n});
   }
  }else if(level===5){
   for(let power=0;power<=1;power++)for(let n=Math.max(1,p[37]);n<=p[38];n++)for(let places=0;10**places<=n;places++){
    if(n%10&&(places?(p[45]&1):(p[45]&2)))add(10**(power-2),n/10**places,n*10**(power-places-2),{places,power,n});
   }
  }else{
   for(let a=p[37];a<=p[38];a++)for(const b of [2,3,4,5,6,8,10,12,20,25,50,100]){
    if(a>=b||gcd(a,b)!==1)continue;
    const result=Math.trunc(100*a/b),rem=100*a-result*b,g=gcd(rem,b);add(a,b,result,{remainder:rem/g,denominator:b/g});
   }
  }
 }
 if(!bank.length)throw Error('Empty original problem bank '+key);
 problemBanks.set(key,bank);return bank;
}
let problemPool=null,poolVersion=0;
function resetQuestions(){problemPool=null;poolVersion++;}
// 3:7ecc and 1:0544: Goal Setter advances to the next subject after level 6;
// a failed level 1 stays put. Both accuracy boundaries are inclusive.
function goalAdjustment(settings,accuracy,practice=true){
 const goal=settings.goal||{};if(!goal.enabled||!practice)return{subject:settings.subject,level:settings.level};
 const delta=accuracy>=goal.increase?1:accuracy<=goal.decrease?-1:0;
 let level=settings.level+delta,subject=settings.subject;
 if(level<1)level=1;
 if(level>6){level=1;const order=[2,0,1,3,4,5,6,7];subject=order[(order.indexOf(subject)+1)%order.length];}
 return{subject,level};
}
function insertPersonalBest(entries,entry){
 // 4:581a..58ed inserts before an equal score and retains exactly ten slots.
 const result=entries.slice(0,10),index=result.findIndex(old=>entry.score>=old.score);
 if(index>=0)result.splice(index,0,entry);else if(result.length<10)result.push(entry);
 return result.slice(0,10);
}
function acceptQuestion(q,correct=true){
 if(problemPool&&q.poolVersion===problemPool.version){if(correct)problemPool.available.delete(q.sourceIndex);else problemPool.attempted.add(q.sourceIndex);}
}
function question(subject=0,level=1,settings={},rng=Math.random,sourceIndexOverride=null){
 level=Math.max(1,Math.min(6,level));if(subject===7)subject=pick(rng,[0,1,2,3,4,5,6]);
 const bank=originalBank(subject,level),key=subject+':'+level;
 const reset=()=>problemPool={key,version:++poolVersion,available:new Set(bank.map((_,i)=>i)),attempted:new Set()};
 if(!problemPool||problemPool.key!==key||!problemPool.available.size)reset();
 let candidates=Array.from(problemPool.available);
 if(settings.order==='file'&&sourceIndexOverride===null){candidates=candidates.filter(i=>!problemPool.attempted.has(i));if(!candidates.length){reset();candidates=Array.from(problemPool.available);}}
 const sourceIndex=sourceIndexOverride??candidates[settings.order==='file'?0:Math.floor(rng()*32768)%candidates.length],p=bank[sourceIndex];
 if(!p)throw Error('Unknown original problem '+sourceIndex);
 const format=settings.format==='mixed'?(rng()<.5?'vertical':'horizontal'):settings.format||'horizontal';
 const operand=settings.missing==='operand'||(settings.missing==='either'&&rng()<.5);
 let {a,b,result}=p,op,kind='arithmetic',missing=operand?'b':'result',answer,answerText,display,solution,instruction,tip;
 const choose=(lhs,rhs,operandText,operandAnswer)=>{
  solution=lhs+' = '+rhs;
  if(operand&&operandText){display=operandText+' = '+rhs;answer=operandAnswer;missing='operand';}
  else{display=lhs+' = '+rhs.replace(/\|([^|]+)\|/,'__');answer=result;missing='result';}
  solution=solution.replaceAll('|','');display=display.replaceAll('|','');
 };
 if(subject===2){
  kind='pattern';missing='result';const seq=Array.from({length:5},(_,i)=>a+i*b);answer=seq[p.blank];
  display=seq.map((v,i)=>i===p.blank?'__':String(v)).join(', ');solution=seq.join(', ');instruction='Find the missing number.';tip=`Count ${b<0?'backward':'forward'} by ${Math.abs(b)}.`;
 }else if(subject===3){
  kind='estimate';missing='result';answer=result;display=`${a} »» __`;solution=`${a} »» ${result}`;instruction=`Round to the nearest ${b}.`;tip=`Round ${a} to the nearest ${b}.`;
 }else if(subject===6){
  kind='fraction';instruction='Find the missing number.';
  if(level===1){
   // The original blanks only the reduced numerator, never its denominator.
   answer=result;missing='result';display=`${a} / ${b} = __ / ${p.denominator}`;solution=`${a} / ${b} = ${result} / ${p.denominator}`;
  }else if(level===2){
   const tail=p.remainder?` + ${p.remainder} / ${p.denominator}`:'';
   choose(`${a} / ${b}`,`|${result}|${tail}`,`__ / ${b}`,a);
  }else if(level===3){
   op=p.sign<0?'−':'+';choose(`${a} / ${b} ${op} ${p.c} / ${b}`,`|${result}| / ${p.denominator}`,`${a} / ${b} ${op} __ / ${b}`,p.c);
  }else if(level===4||level===5){
   op='×';const left=level===5?(p.power?'10%':'1%'):fmt(a);
   const operandText=originalDecimal(p.n,-p.places),resultText=originalDecimal(p.n,p.power-p.places-(level===5?2:0));
   choose(`${left} × ${operandText}`,`|${resultText}|`,`${left} × __`,b);
  }else{
   const tail=p.remainder?`   ${p.remainder} / ${p.denominator}`:'';
   choose(`${a} / ${b}`,`|${result}|${tail}%`,`__ / ${b}`,a);
  }
  tip=solution;
 }else{
  op=({0:'+',1:'−',4:'×',5:'÷'})[subject];
  missing=operand?(subject===5?'a':'b'):'result';
  answer=missing==='a'?a:missing==='b'?b:result;
  solution=`${a} ${op} ${b} = ${result}`;
  display=`${missing==='a'?'__':a} ${op} ${missing==='b'?'__':b} = ${missing==='result'?'__':result}`;
  instruction=({0:operand?'Find the missing addend.':'Find the sum.',1:operand?'Find the subtrahend.':'Find the difference.',4:operand?'Find the missing factor.':'Find the product.',5:operand?'Find the divisor.':'Find the quotient.'})[subject];
  // The shipped game says "divisor" although it blanks the dividend.
  tip=solution;
 }
 answerText=subject===6&&(level===4||level===5)?originalDecimal(p.n,(missing==='operand'?0:p.power-(level===5?2:0))-p.places):fmt(answer);
 return {subject,level,kind,a,b,result,op,missing,format,answer,answerText,display,solution,instruction,tip,sourceIndex,poolVersion:problemPool.version};
}
function mathTip(q){
 // 5:7586 chooses the number-line dialog; 5:8af2 selects a strategy
 // resource and its numeric/string substitutions for the other problems.
 const p=originalBank(q.subject,q.level)[q.sourceIndex],s=q.subject,result=q.missing==='result',a=p.a,b=p.b,r=p.result;
 let id=40225,values=[a,b,r,0,0,0,0],strings=['','',''];
 const division=()=>{if(!result)id=40236;else if(b===1)id=40237;else if(a%10===0&&b%10===0){id=40238;values[3]=Math.trunc(a/10);values[4]=Math.trunc(b/10);}else if(a<=144)id=40239;};
 if(s===0||s===1){
  if(!result)id=s===0?40226:40228;
  else if(a%10===0&&b%10===0){id=s===0?40227:40229;values[3]=a/10;values[4]=b/10;values[5]=Math.trunc(r/10);}
 }else if(s===2){id=40259;values[1]=Math.abs(b);}
 else if(s===3)id=40260;
 else if(s===4){
  if(!result)id=40230;
  else if(a===0||b===0)id=40231;
  else if(a===1||b===1)id=40232;
  else if(a%10===0&&b%10===0){id=40233;values[3]=a/10;values[4]=b/10;values[5]=Math.trunc(r/100);}
  else if(a>1&&a<10&&b>1&&b<10){id=40234;strings[0]=Array(Math.min(a,b)).fill(Math.max(a,b)).join(' + ');}
  else{const lo=Math.min(a,b),hi=Math.max(a,b),ones=hi%10,tens=hi-ones;id=40235;values=[lo,hi,ones,tens,lo*ones,lo*tens,r];}
 }else if(s===5)division();
 else if(s===6){
  if(q.level===1){id=40240;values[3]=p.denominator;}
  else if(q.level===2||q.level===6){
   values[3]=p.remainder;values[4]=p.denominator;
   if(q.level===2&&!p.remainder)division();
   else if(!result){id=q.level===2?40241:p.remainder?40256:40254;values[5]=b*r;values[6]=Math.trunc(b*p.remainder/p.denominator);}
   else if(q.level===2){const factor=Math.trunc(b/p.denominator);id=factor===1?40242:40243;values[5]=factor*p.remainder;}
   else{id=p.remainder?40257:40258;values[5]=Math.trunc(100/b);values[6]=Math.trunc((100%b)/Math.trunc(b/p.denominator));}
  }else if(q.level===3){
   values=[a,b,p.c,r,p.denominator,a+p.sign*p.c,0];strings[0]=p.sign>0?'+':'-';strings[1]=p.sign>0?'-':'+';
   id=b===p.denominator?(result?40244:p.sign>0?40245:40246):(result?40247:p.sign>0?40248:40249);
  }else{
   const percent=q.level===5,places=percent?2-p.power:p.power;
   id=percent?(result?40253:40252):(result?40251:40250);
   values=[percent?(p.power?10:1):10**p.power,places,p.places,0,0,0,0];
   strings=[places===1?'':'s',originalDecimal(p.n,-p.places),originalDecimal(p.n,p.power-p.places-(percent?2:0))];
  }
 }
 return {id,values,strings,numberLine:result&&(s===0||s===1)&&Math.max(a,r)<=25&&(a%10!==0||b%10!==0)};
}
function advanceMathTip(d,q){
 // 5:96f8 / 8602: the first update follows one waiting tick; subsequent
 // updates follow three. The number line pauses at each endpoint.
 if(!d.active||d.countdown-->0)return false;
 let cue=false;
 if(!d.numberLine){if(d.phase<=6)d.phase++;else if(d.phase===7)d.active=false;}
 else if(d.phase===0){if(d.number===q.a){d.phase++;cue=true;}else d.number+=d.direction;}
 else if(d.phase===4||d.phase===5){
  if(d.phase===4){d.phase++;d.direction=q.result>d.number?1:-1;}
  if(d.number===q.result){d.phase++;cue=true;}else d.number+=d.direction;
 }else if(d.phase===9){d.number=-1;d.active=false;}
 else d.phase++;
 d.countdown=3;return cue;
}
function wrongAnswers(q,roll){
 const p=originalBank(q.subject,q.level)[q.sourceIndex];
 // 5:3420: rounding alternatives straddle the actual result and include
 // the midpoint of the two nearest candidate multiples.
 if(q.subject===3){const lower=Math.trunc(q.a/q.b)*q.b,first=lower===q.answer?lower+q.b:lower;return [first,Math.trunc((q.answer+first)/2),lower+2*q.b].map(String);}
 if(q.subject===6&&(q.level===4||q.level===5)){
  const places=[p.places+1,p.places?p.places-1:p.places+3,p.places+2],base=q.missing==='operand'?0:p.power-(q.level===5?2:0);
  return places.map(n=>originalDecimal(p.n,base-n));
 }
 // 5:3236: preserve trailing zeroes, then replace the last nonzero digit
 // using three distinct, weighted offsets modulo ten.
 let base=q.answer,scale=1;while(base&&base%10===0){scale*=10;base=Math.trunc(base/10);}
 const cutoffs=[0,17,30,40,47,52,59,69,82,100],offsets=[];
 while(offsets.length<3){const n=roll()%100,offset=cutoffs.findIndex(c=>c>n);if(!offsets.includes(offset))offsets.push(offset);}
 return offsets.map(offset=>String((Math.trunc(base/10)*10+(base%10+offset)%10)*scale));
}
function choices(q,rng=Math.random){
 const roll=()=>Math.floor(rng()*32768),correct=roll()%4,wrong=wrongAnswers(q,roll),result=[];let n=0;
 // 4:34a6 and 2ec4: choose the correct port first; the other three
 // retain their generation order rather than undergoing a full shuffle.
 for(let i=0;i<4;i++)result.push(i===correct?q.answerText:wrong[n++]);return result;
}
function operate(a,op,b){if(op==='+')return a+b;if(op==='−'||op==='-')return a-b;if(op==='×'||op==='*')return a*b;if(op==='÷'||op==='/')return b===0?NaN:a/b;return NaN;}
// MB4 3:a83c, b25c, b346: fill eight deliberately incorrect equations,
// build a five-equation move recipe, then stamp correct equations into the
// tokens reached by that recipe. Resetting positions reveals the puzzle.
function recyclerBoard(subject,difficulty,roll,nextProblem,selectSubject=()=>{}){
 const review=subject===7,operations=[0,1,4,5],signs={0:'+',1:'−',4:'×',5:'÷'};
 let current=review?operations[roll()%4]:subject;selectSubject(current);
 const columns=Array.from({length:5},()=>[]),colors=columns.map(()=>Array(8).fill(0));
 function values(wrong){
  const q=nextProblem(current),result=operate(q.a,signs[current],q.b)+(wrong?roll()%6+1:0);
  return difficulty>2&&(roll()&1)?[result,'=',q.a,signs[current],q.b]:[q.a,signs[current],q.b,'=',result];
 }
 for(let row=0;row<8;row++)values(true).forEach((v,c)=>columns[c].push(v));
 const remaining=Array(5).fill(8),used=Array(5).fill(false),recipe=[];
 for(let round=0;round<5;round++){
  const count=roll()%((difficulty&254)+1)+round;
  for(let n=0;n<count;n++){const c=roll()%5;if(remaining[c]>5-round){recipe.push(c+1);remaining[c]--;used[c]=true;}}
  recipe.push(0);
  for(let c=0;c<5;c++){if(!used[c])remaining[c]--;used[c]=false;}
 }
 const positions=columns.map(c=>c.map((_,i)=>i));let equation=0;
 for(const step of recipe){
  if(step){positions[step-1]=positions[step-1].map(row=>row<0||row===9?-1:row+1);continue;}
  if(review&&difficulty>2){current=operations[roll()%4];selectSubject(current);}
  const target=positions.map(p=>p.indexOf(7)),v=values(false);equation++;
  for(let c=0;c<5;c++){
   const p=positions[c],i=target[c];
   if(i<0)throw Error('Original Recycler recipe exhausted a column');
   columns[c][i]=v[c];colors[c][i]=equation;p[i]=-1;
   const recycling=p.indexOf(8);if(recycling>=0)p[recycling]=Math.min(7,...p.filter(row=>row>=0))-1;
   for(let j=0;j<8;j++)if(p[j]>=0||j===recycling)p[j]=p[j]===9?-1:p[j]+1;
  }
 }
 return {columns,colors,recipe,positions:columns.map(c=>c.map((_,i)=>i)),selected:2,fuel:0,difficulty,boardVersion:3};
}
function recycler(subject=0,level=1,rng=Math.random,options={}){
 subject=({2:0,3:1,6:5})[subject]??subject;
 if(![0,1,4,5,7].includes(subject))subject=0;
 return recyclerBoard(subject,Math.max(0,Math.min(4,options.difficulty??0)),()=>Math.floor(rng()*32768),s=>{const q=question(s,level,{missing:'result'},rng);acceptQuestion(q);return q;},()=>resetQuestions());
}
function recyclerValues(r,row=7){return r.columns.map((c,i)=>c[r.positions[i].indexOf(row)]);}
function equationValid(v){return v[1]==='='?equal(v[0],operate(v[2],v[3],v[4])):v[3]==='='&&equal(operate(v[0],v[1],v[2]),v[4]);}
function recyclerValid(r){return equationValid(recyclerValues(r));}
// MB4 3:9ee8, c4cc and d117: eight distinct tokens per column. Rows 7,
// 8 and 9 are the equation, recycling and zap chambers, respectively.
function recyclerPush(r,column){
 const zapped=[];
 if(r.positions[column].includes(9))r.positions.forEach((p,c)=>p.forEach((row,i)=>{if(row===9){p[i]=-1;zapped.push([c,i]);}}));
 r.positions[column]=r.positions[column].map(row=>row<0?row:row+1);
 return {zapped};
}
function recyclerAccept(r){
 if(!recyclerValid(r))return null;
 const consumed=[],recycled=[],zapped=[];
 r.positions.forEach((p,c)=>{
  p.forEach((row,i)=>{if(row===7){p[i]=-1;consumed.push([c,i]);}});
  const i=p.indexOf(8);
  if(i>=0){p[i]=Math.min(7,...p.filter(row=>row>=0))-1;recycled.push([c,i]);}
  p.forEach((row,i)=>{if(row===9){p[i]=-1;zapped.push([c,i]);}});
  // A returned token may temporarily occupy row -1 above the top slot.
  p.forEach((row,i)=>{if(row>=0||recycled.some(([cc,ii])=>cc===c&&ii===i))p[i]=row+1;});
 });
 return {consumed,recycled,zapped};
}
function recyclerSolution(r,undoColumn=-1){
 const candidates=r.columns.map((c,j)=>c.map((v,i)=>i).filter(i=>r.positions[j][i]>=0&&r.positions[j][i]<=(j===undoColumn?8:7)).sort((a,b)=>r.positions[j][b]-r.positions[j][a]));
 for(const a of candidates[0])for(const b of candidates[2])for(const c of candidates[4])for(const op of candidates[1])for(const eq of candidates[3]){
  const indices=[a,op,b,eq,c];if(equationValid(indices.map((i,j)=>r.columns[j][i])))return indices;
 }return null;
}
function cave(level=1,count=5,rng=Math.random){
 const max=[10,20,40,100,200,500][level-1];let number=int(rng,2,max-2);const rows=[];
 for(let i=0;i<count;i++){const wanted=Math.max(1,number+int(rng,-2,2)),lo=Math.max(0,wanted-int(rng,1,4)),hi=wanted+int(rng,1,4);let labels;
  if(rng()<.5)labels=[hi,lo,Math.max(hi+1,lo+int(rng,2,6))];else labels=[Math.max(0,lo-3),hi,lo];
  rows.push({y:212-i*176,middle:i%2?230:345,labels,passed:false,gem:int(rng,0,1),hazard:level>=3&&i%3===2?pick(rng,['bat','rock','web','spider']):null});number=wanted;
 }
 return {number:int(rng,2,Math.min(max-2,8)),rows};
}
const inGap=(n,a,b)=>n>Math.min(a,b)&&n<Math.max(a,b);
root.MBMath={subjects,int,pick,shuffle,originalLevels,originalBank,acceptQuestion,resetQuestions,goalAdjustment,insertPersonalBest,question,parseAnswer,equal,choices,mathTip,advanceMathTip,wrongAnswers,originalDecimal,operate,recycler,recyclerBoard,recyclerValues,equationValid,recyclerValid,recyclerSolution,recyclerPush,recyclerAccept,cave,inGap,fmt};
if(typeof module!=='undefined')module.exports=root.MBMath;
})(typeof window!=='undefined'?window:globalThis);
