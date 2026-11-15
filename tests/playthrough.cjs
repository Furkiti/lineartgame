const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
let activeBrowser;
fs.mkdirSync('.local', { recursive: true });
(async()=>{
 const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),headless:true,args:['--no-sandbox']});activeBrowser=b;const ctx=await b.newContext({viewport:{width:390,height:844},...(process.env.RECORD_PLAYTHROUGH ? { recordVideo: { dir: '.local/playthrough-video', size: { width:390,height:844 } } } : {})});const p=await ctx.newPage();p.setDefaultTimeout(20000);const errors=[];p.on('pageerror',e=>{errors.push(e.message);console.log('BROWSER ERROR',e.message)});
 await p.goto(process.env.PLAYTEST_URL || 'http://127.0.0.1:4173/?day=90');await p.locator('#opening').click();await p.waitForTimeout(2800);
 assert.equal(await p.locator('.drawing-paper.show').count(),0);await p.screenshot({path:'.local/rev-01-intro.png'});
 const start=await p.evaluate(()=>window.__game.player.x);await p.keyboard.down('d');await p.waitForTimeout(1000);await p.keyboard.up('d');assert.equal(await p.evaluate(()=>window.__game.player.x),start);console.log('intro waits for reader at',start);
 await p.locator('.street-guide').click();
 async function walkTo(x,y,{inside,timeout=30000}={}){
  const begun=Date.now();let held=new Set();
  while(Date.now()-begun<timeout){const state=await p.evaluate(()=>{const g=window.__game;return{x:g.player.x,y:g.player.y,inside:g.inside,mode:g.story.mode,lock:!!g.home.lock}});if(inside!==undefined&&state.inside===inside){for(const k of held)await p.keyboard.up(k);return}
   if(inside===undefined&&Math.abs(state.x-x)<3&&Math.abs(state.y-y)<2){for(const k of held)await p.keyboard.up(k);return}
   const wanted=new Set();if(state.mode==='walk'){if(state.x<x-2)wanted.add('d');if(state.x>x+2)wanted.add('a');if(state.y<y-1)wanted.add('s');if(state.y>y+1)wanted.add('w');}
   for(const k of held)if(!wanted.has(k))await p.keyboard.up(k);for(const k of wanted)if(!held.has(k))await p.keyboard.down(k);held=wanted;await p.waitForTimeout(80);
  }throw Error('walk timeout '+JSON.stringify(await p.evaluate(()=>({x:window.__game.player.x,y:window.__game.player.y,mode:window.__game.story.mode}))));
 }
 // Actual movement to the encounter; no world-position changes or state mutation.
 await p.keyboard.down('d');await p.waitForFunction(()=>window.__game.story.mode==='cine',{timeout:20000});await p.keyboard.up('d');console.log('walked into Kenta',await p.evaluate(()=>window.__game.player.x));
 await p.waitForFunction(()=>window.__game.story.mode==='brush');await p.waitForTimeout(1200);await p.screenshot({path:'.local/rev-02-world-drawing.png'});
 const pts=await p.evaluate(()=>{const svg=document.querySelector('svg.village'),at=window.__game.story._dbg.drawingAt(),m=svg.getScreenCTM();return Array.from({length:65},(_,i)=>{const a=i/64*Math.PI*2,q=svg.createSVGPoint();q.x=at[0]+Math.cos(a)*24;q.y=at[1]+Math.sin(a)*29;const c=q.matrixTransform(m);return[c.x,c.y]})});
 await p.mouse.move(...pts[0]);await p.mouse.down();for(const pt of pts){await p.mouse.move(...pt);await p.waitForTimeout(15)}await p.mouse.up();
 await p.waitForFunction(()=>!![...document.querySelectorAll('text')].find(n=>n.textContent.includes('Akşam yemeğe sana')),{timeout:15000});
 assert.equal(await p.locator('.choices.show').count(),0);await p.waitForSelector('.choices.show');await p.screenshot({path:'.local/rev-03-invitation.png'});await p.locator('.choices.show button').first().click();
 await p.waitForFunction(()=>window.__game.story.mode==='walk'&&window.__game.story._dbg.q.homeShown,{timeout:20000});assert.equal(await p.evaluate(()=>window.__game.story._dbg.kenta.g.style.display),'none');console.log('Kenta hopped away; home revealed');
 await p.screenshot({path:'.local/rev-04-home-reveal.png'});
 await walkTo(457,365);await walkTo(457,327,{inside:true});console.log('entered home');
 await walkTo(1372,356);await p.waitForFunction(()=>window.__game.home.bagHung);assert.equal(await p.evaluate(()=>window.__game.player.carryBundle),false);await p.screenshot({path:'.local/rev-05-bag.png'});
 // Door must part, close if we retreat, then open fully as we actually walk out.
 await walkTo(1340,352);await p.waitForTimeout(800);let open=await p.evaluate(()=>window.__game.home.doorOpen);assert(open>.25&&open<.7,open);await p.screenshot({path:'.local/rev-06-door-parted.png'});
 await walkTo(1340,374);await p.waitForTimeout(700);assert((await p.evaluate(()=>window.__game.home.doorOpen))<.08);await walkTo(1340,327,{inside:false});console.log('door reverse and exit work');
 await walkTo(457,327,{inside:true});await walkTo(1654,356);await p.waitForFunction(()=>document.querySelector('#act').textContent==='Dolabı aç');await p.locator('#act').click();await p.waitForFunction(()=>window.__game.home.prep===1);await p.waitForTimeout(2200);
 await walkTo(1562,356);await p.waitForFunction(()=>window.__game.home.prep===2);assert.equal(await p.locator('#act').innerText(),'Suşi hazırla');await p.locator('#act').click();await p.waitForSelector('.closeup.show');await p.waitForTimeout(1400);console.log('auto bag/fish, explicit fridge/cooking');
 const close=()=>p.evaluate(()=>window.__game.story._dbg.closeup._step);
 let circle=await p.evaluate(()=>{const c=window.__game.story._dbg.closeup;return Array.from({length:121},(_,i)=>c._client([120+Math.cos(i/40*Math.PI*2)*44,192+Math.sin(i/40*Math.PI*2)*17]))});
 await p.mouse.move(...circle[0]);await p.mouse.down();for(const pt of circle){await p.mouse.move(...pt);await p.waitForTimeout(35)}await p.mouse.up();await p.waitForFunction(()=>window.__game.story._dbg.closeup._step===1,{timeout:6000});console.log('stirred real rice circles');
 for(let i=0;i<3;i++){await p.mouse.move(90,535);await p.mouse.down();for(let y=535;y<=715;y+=12){await p.mouse.move(90,y);await p.waitForTimeout(25)}await p.mouse.up();await p.waitForTimeout(500)}
 await p.waitForFunction(()=>window.__game.story._dbg.closeup._step===2,{timeout:6000});
 await p.mouse.move(65,680);await p.mouse.down();await p.waitForTimeout(4700);await p.mouse.up();await p.waitForFunction(()=>window.__game.story._dbg.closeup._step===3,{timeout:6000});await p.screenshot({path:'.local/rev-07-shaped-from-bottom.png'});console.log('shaped rice while finger stayed away from food');
 for(let i=0;i<3;i++){await p.mouse.click(65,680);await p.waitForTimeout(700)}await p.waitForFunction(()=>!window.__game.story._dbg.closeup.isOpen,{timeout:9000});assert.equal(await p.evaluate(()=>window.__game.home.step),5);console.log('plated by tapping away, tray taken automatically');
 await walkTo(1486,356);await p.waitForFunction(()=>window.__game.home.step===6);await p.screenshot({path:'.local/rev-08-table.png'});assert.equal(await p.getByText('Tabağı al',{exact:true}).count(),0);assert.equal(await p.getByText('Masaya koy',{exact:true}).count(),0);
 // Wait naturally for the invited guest, without a skip-time menu.
 await p.waitForFunction(()=>window.__game.home.canEat,{timeout:45000});for(let i=0;i<3;i++){await p.waitForFunction(()=>!window.__game.home.busy);await p.locator('#act').click();await p.waitForTimeout(2000)}
 await p.waitForFunction(()=>window.__game.story._dbg.q.sushi,{timeout:30000});assert.equal(await p.evaluate(()=>window.__game.story._dbg.q.visit),'done');assert.deepEqual(errors,[]);console.log('PASS complete real-input opening → invitation → home → reversing door → fridge → stirring → slicing → remote shaping/plating → shared dinner');await ctx.close();await b.close();
})().catch(async e => { console.error(e); await activeBrowser?.close(); process.exitCode = 1; });
