// A frontal courtyard: depth comes from passing behind stalls, never from perspective scaling.
import { el, f, PAPER, type Vec } from '../lib/ink.ts';
import { createResident } from '../story/resident.ts';
import { createPaper, fitDrawing, linePath } from '../story/paper.ts';
import { MOTIFS } from '../story/motifs.ts';
import { createHandwork } from '../story/handwork.ts';
import { sfx } from '../story/fx.ts';
import type { Entry } from '../story/notebook.ts';
export const MX = 2600;
const STALLS = [
  { id:'tea', name:'Nori', title:'Yaprak Çayı', x:125, y:438, color:'#78866a', w:130 },
  { id:'dango', name:'Momo', title:'Üç Küçük Lokma', x:395, y:558, color:'#b96c65', w:140 },
  { id:'paper', name:'Rei', title:'Kâğıt & İz', x:124, y:678, color:'#536c8b', w:138 },
  { id:'clay', name:'Sora', title:'Topraktan Fincan', x:392, y:798, color:'#ad835b', w:146 },
  { id:'manav', name:'Ume', title:'Taze Manav', x:125, y:918, color:'#7d9a5a', w:140 },
];
export function buildMarket(svg: SVGSVGElement, card: HTMLElement, options: {
  saved?: Record<string, any>; homeSurface: Element;
  hint: (text:string|null, sticky?:boolean)=>void;
  memory:(id:string)=>void;
  guide:(at:(()=>Vec)|null)=>void;
  /** Ume's stall: the story opens the greengrocer close-up */
  shop?:()=>void;
}) {
  const root = el('g', {'data-scene':'market', style:'display:none;color:#34322c'}, svg);
  const bg = el('g', {transform:`translate(${MX} 0)`}, root);
  const depth = el('g', {'data-market-depth':''}, root);
  const path=(g:Element,d:string,c='none',w=1)=>el('path',{d,fill:c,stroke:'currentColor','stroke-width':w,'stroke-linecap':'round','stroke-linejoin':'round'},g);
  el('rect',{x:0,y:0,width:520,height:1050,fill:PAPER},bg);
  // All horizontals stay horizontal; paving, eaves and stalls share one scale.
  path(bg,'M0 264H520V1050H0Z','#f4efe4',.6);
  path(bg,'M0 90H520V287H0Z','#f3eddf');
  path(bg,'M0 83Q260 103 520 83L520 108H0Z','#c2a27d');
  for(let x=0;x<520;x+=10) path(bg,`M${x} 83l-17 -37M${x} 108v-9`,'none',.55);
  path(bg,'M0 46Q260 68 520 46M0 75Q260 94 520 75','none',1.4);
  for(let x=34;x<520;x+=104){
    path(bg,`M${x} 132h74v95h-74ZM${x+37} 132v95M${x} 179h74`,'#e7dcc7',.8);
    for(let j=1;j<6;j++) path(bg,`M${x+j*12} 133v94`,'none',.35);
  }
  path(bg,'M217 155H303V298H217Z','#a88c6e');
  path(bg,'M224 161H296V298H224Z',PAPER);
  path(bg,'M224 161H296V211H224Z','#768469');
  el('text',{x:260,y:190,'text-anchor':'middle','font-size':10,fill:PAPER},bg).textContent='路 地';
  path(bg,'M210 298H310M204 305H316','none',1);
  el('text',{x:260,y:129,'text-anchor':'middle','font-size':15,'font-family':'serif','letter-spacing':3},bg).textContent='柳の市';
  el('text',{x:260,y:330,'text-anchor':'middle','font-size':9,fill:'#866b51'},bg).textContent='Mürekkep Sokağı ↑';
  // A broad, flat lane descends between alternating stall pockets.
  path(bg,'M28 324H492M28 339H492M30 339V1012M490 339V1012','none',.65);
  for(let y=375;y<1030;y+=49){
    path(bg,`M31 ${y}H489`,'none',.25);
    for(let x=62+(Math.round(y/49)%2)*48;x<490;x+=96) path(bg,`M${x} ${y-48}v48`,'none',.23);
  }
  for(let i=0;i<26;i++)path(bg,`M${46+(i*137)%422} ${362+(i*83)%510}q4 -2 8 0`,'none',.45);
  // A willow anchors the courtyard rather than hiding the playable depth.
  path(bg,'M46 332Q40 244 56 158Q62 138 68 124L74 127Q53 213 59 332Z','#d7cbb5',.8);
  const willow=el('g',{},bg);
  for(let i=0;i<13;i++){ const x=10+i*9;path(willow,`M64 129Q${x} 118 ${x-13} ${200+i%4*16}`,'none',.55);for(let j=0;j<5;j++)path(willow,`M${x-5-j*.7} ${146+j*12}l-5 6`,'none',.55); }
  path(bg,'M435 306h28v22h-28Z','#e2c4a2');
  for(let i=0;i<5;i++)path(bg,`M${440+i*4} 307q-12 -17 -4 -22q4 9 3 15q12-17 15-7`,'none',.8);
  const flags = el('g',{},bg);
  path(flags,'M66 139Q340 187 474 139','none',.65);
  for(let i=0;i<8;i++){const x=70+i*52,y=149+Math.sin(i/7*Math.PI)*16;path(flags,`M${x} ${y}h17v22l-8-4l-9 4Z`,['#a86153','#637e87','#abb087'][i%3],.5);}
  const state = {seen:false,tea:false,dango:false,clay:false,postcard:[] as Vec[][],...options.saved};
  let pour = Math.max(0,Math.min(.94,+options.saved?.pour||0)), held=false, teaOpen=false, guideT=0, teaTimer=-1;
  let paper:ReturnType<typeof createPaper>|null=null;
  let work:ReturnType<typeof createHandwork>|null=null;
  const postcard=el('g',{'data-market-postcard':'stall',transform:`translate(${MX+124} 648)`},depth);
  // This second copy belongs to the wall's surface layer, underneath the traveller.
  const homeCard=el('g',{'data-market-postcard':'home',transform:'translate(83 272) rotate(-7)'},options.homeSurface);
  function renderCard(){
    for(const [g,size] of [[postcard,18],[homeCard,12]] as const){g.replaceChildren();g.style.display=state.postcard.length?'':'none';path(g,`M-${size/2+2} -${size/2+2}h${size+4}v${size+4}h-${size+4}Z`,PAPER,.6);for(const line of fitDrawing(state.postcard,0,0,size))path(g,linePath(line),'none',.65);el('circle',{cx:0,cy:-size/2-1,r:.7,fill:'#b8594b'},g);}
  }
  renderCard();
  const booths=STALLS.map((s,i)=>{
    const vendor=createResident(depth,s.name,MX+s.x,s.y-19,s.color);
    // Different working silhouettes: apron + headband, elder's glasses, short hair, potter's smock.
    if(i===0)vendor.g.querySelector('[data-hair]')?.setAttribute('fill','#8b877c');
    else{vendor.g.querySelector('[data-bun]')?.remove();vendor.g.querySelector('[data-hair]')?.setAttribute('d',i===2?'M-5 -42Q-7-52 0-51Q6-50 5-43L2-45L0-43L-2-45Z':'M-5 -46Q0-53 5-46L4-43L1-46L-4-43Z');}
    const detail=el('g',{},vendor.g);
    if(i===0){path(detail,'M-4 -45h3v3h-3Zm6 0h3v3H2ZM-1 -44H2','none',.55);path(detail,'M-2 -39q3 7 6 0','none',.6);}
    if(i===1){path(detail,'M-5 -48H5L5 -45H-5Z','#f0e4cb',.5);path(detail,'M-5 -32H5L6 -16H-6Z','#f0e4cb',.6);}
    if(i===2)path(detail,'M-5 -48q5-7 10 0l-2 2l-2-2l-3 2Z','#332e2c',.6);
    if(i===3){path(detail,'M-7 -34H7L6 -15H-6Z','#c9bca1',.6);path(detail,'M-3 -31v12M2 -25h3','none',.5);}
    if(i===4){path(detail,'M-6 -47Q0 -54 6 -47L5 -44Q0 -48 -5 -44Z','#c8423a',.55);path(detail,'M-6 -33H6L6 -17H-6Z','#e9dcc0',.6);}
    const booth=el('g',{'data-stall':s.id,transform:`translate(${MX+s.x} ${s.y})`},depth),hw=s.w/2;
    path(booth,`M-${hw} -30H${hw}V-14H-${hw}ZM-${hw-2} -33H${hw+2}V-26H-${hw-2}Z`,'#c49c70',.9);
    path(booth,`M-${hw-5} -14V5h6v-19M${hw-5} -14V5h-6v-19`,'#ae8e68',.75);
    path(booth,`M-${hw-8} -31V-102M${hw-8} -31V-102`,'none',1.5);
    const awning=path(booth,`M-${hw+6} -100Q0 -111 ${hw+6} -100L${hw+10} -76Q0 -70 -${hw+10} -76Z`,s.color,.9);
    for(let j=0;j<7;j++)path(booth,`M${-hw+j*s.w/6} -101l-3 27`,'none',.4);
    el('text',{x:0,y:-83,'text-anchor':'middle','font-size':8,fill:PAPER,'font-family':'serif'},booth).textContent=s.title;
    const goods=el('g',{},booth);
    if(i===0){path(goods,'M-18 -35q-3 -23 15-23q15 0 12 23ZM-15 -47q-15 -11-19-4l15 13M8 -51q16-7 13 8q-1 7-12 6','#bf9066',.8);for(const x of[27,43])path(goods,`M${x-5} -41h10l-2 9h-6Z`,'#eee1c4',.6);}
    if(i===1)for(let k=0;k<3;k++){path(goods,`M${-31+k*28} -34v-25`,'none',.6);for(let j=0;j<3;j++)el('circle',{cx:-31+k*28,cy:-40-j*9,r:4.7,fill:['#b5be8b','#f4e9d3','#dca6a0'][j],stroke:'currentColor','stroke-width':.45},goods);}
    if(i===2){path(goods,'M-54 -34v-19h27v19Z',PAPER,.65);path(goods,'M-48 -39l6-9l6 9l-5-3Z','none',.6);for(let k=0;k<4;k++)path(goods,`M${19+k*6} -34l7-24`,'none',1);path(goods,'M21 -35h24l-3 10H24Z','#ae8a64',.6);}
    if(i===4){path(goods,'M-56 -34h30v-12h-30Z','#d9b380',.7);for(let k=0;k<3;k++)el('circle',{cx:-49+k*8,cy:-50,r:4,fill:'#f0a046',stroke:'currentColor','stroke-width':.45},goods);path(goods,'M-18 -34h30v-12h-30Z','#d9b380',.7);for(let k=0;k<3;k++)path(goods,`M${-15+k*1} ${-49+k*3}h24`,'#6f9d45',.5);path(goods,'M20 -34h30v-12h-30Z','#d9b380',.7);for(let k=0;k<4;k++)el('ellipse',{cx:25+k*7,cy:-50,rx:3,ry:4,fill:'#fbf6ea',stroke:'currentColor','stroke-width':.45},goods);}
    if(i===3)for(let k=0;k<4;k++){const x=-43+k*27;path(goods,`M${x-8} -44q8-4 16 0l-2 12q-6 4-12 0Z`,['#c3cdbb','#d8c3a0','#b8c7d1','#d2b9ad'][k],.7);path(goods,`M${x-6} -42q6-2 12 0`,'none',.4);}
    const steam=el('path',{fill:'none',stroke:'currentColor','stroke-width':.6,opacity:.25},booth);
    return{...s,vendor,g:booth,awning,steam,sortY:s.y};
  });
  // Card is visibly on Rei's counter, but never gets sorted above the player.
  booths[2].g.appendChild(postcard);postcard.setAttribute('transform','translate(0 -43)');
  const tea=document.createElement('section');tea.className='market-tea';tea.setAttribute('aria-label','Nori ile çay');
  tea.innerHTML='<header><small>Söğüt Pazarı · Nori</small><h1>Bir fincan sakinlik.</h1><p>Basılı tut; çay fincanı yavaşça doldursun.</p></header><svg viewBox="0 0 320 400" aria-label="Çayı doldur"><path d="M40 296H280M62 305H258" fill="none" stroke="currentColor"/><g data-teapot><path d="M94 128Q89 74 135 75Q179 75 172 128ZM99 95L73 87L89 111M169 87Q210 74 202 108Q199 120 173 116M119 75V67H146V75" fill="#bd936a" stroke="currentColor" stroke-width="1.6"/></g><path data-stream fill="none" stroke="#9e7749" stroke-width="3" stroke-linecap="round"/><path d="M173 232Q200 218 227 232L220 282Q200 292 180 282Z" fill="#f4e9d5" stroke="currentColor" stroke-width="1.5"/><path data-tea fill="#a48050" opacity=".7"/><path data-tea-steam fill="none" stroke="currentColor" stroke-width="1" opacity=".22"/></svg><button type="button">Sonra içerim</button>';
  card.appendChild(tea);
  const teaSVG=tea.querySelector('svg')!,teapot=tea.querySelector('[data-teapot]')!,stream=tea.querySelector('[data-stream]')!,teaFill=tea.querySelector('[data-tea]')!,teaSteam=tea.querySelector('[data-tea-steam]')!;
  teaSVG.addEventListener('pointerdown',e=>{if(!teaOpen||teaTimer>=0)return;e.preventDefault();teaSVG.setPointerCapture(e.pointerId);held=true;sfx.tap();});
  const release=()=>held=false;teaSVG.addEventListener('pointerup',release);teaSVG.addEventListener('pointercancel',release);addEventListener('blur',release);
  tea.querySelector('button')!.addEventListener('click',()=>{held=false;teaOpen=false;tea.classList.remove('show');options.hint('Fincan Nori’nin tezgâhında duruyor.');});
  const near=(pl:{x:number;y:number})=>booths.find(s=>Math.abs(pl.x-MX-s.x)<s.w/2+8&&pl.y>s.y+7&&pl.y<s.y+43);
  const api={
    root,depth, bounds:{x0:MX+32,x1:MX+488,y0:322,y1:990,depthSpeed:.86},view:{x0:MX,x1:MX+520},spawn:{x:MX+260,y:350},
    get busy(){return teaOpen||!!paper?.isOpen||!!work?.isOpen;},
    get canExit(){return !api.busy;},
    snapshot(){return {...state,pour};},
    entries():Entry[]{return[
      {id:'market-tea',title:'Nori’nin ilk çayı',hint:'',sketch:'M12 23H48L43 44Q30 51 17 44ZM25 15q8-8 1-13',done:state.tea},
      {id:'market-dango',title:'Momo’nun üç rengi',hint:'',sketch:'M30 12V53M23 14a7 7 0 1 0 14 0a7 7 0 1 0-14 0M23 30a7 7 0 1 0 14 0a7 7 0 1 0-14 0',done:state.dango},
      {id:'market-clay',title:'Sora’nın fincanları',hint:'',sketch:'M10 20H30L27 41H13ZM31 14H51L48 35H34Z',done:state.clay},
      {id:'market-paper',title:'Pazardan evime bir iz',hint:'',sketch:fitDrawing(state.postcard,30,30,40).map(l=>linePath(l)).join(' '),done:state.postcard.length>0},
    ].filter(e=>e.done);},
    // the first visit shows a title card; the walking tip waits until it has gone, so the two never sit on top of each other
    onEnter(){ const first=!state.seen; if(first){state.seen=true;setTimeout(()=>options.hint('Söğüt Pazarı. Tezgâhların arasından aşağıya doğru gezebilirsin.',false),3500);} return first; },
    help(pl:{x:number;y:number}){const s=booths.reduce((a,b)=>Math.hypot(pl.x-MX-a.x,pl.y-a.y)<Math.hypot(pl.x-MX-b.x,pl.y-b.y)?a:b);options.guide(()=>[MX+s.x,s.y-22]);guideT=5;options.hint(`${s.name}, “${s.title}” tezgâhının önünde. Sokak çıkışı avlunun en üstünde.`);},
    prompt(pl:{x:number;y:number}){if(api.busy)return null;const s=near(pl);return s?({tea:'Nori ile çay doldur',dango:'Momo ile dango diz',paper:'Rei ile kart çiz',clay:'Sora ile fincan yerleştir',manav:'Ume’den alışveriş'}[s.id]??null):null;},
    act(pl:{x:number;y:number}){
      const s=near(pl);if(!s||api.busy)return false;options.hint(null);
      if(s.id==='manav'){options.shop?.();return true;}
      if(s.id==='tea'){teaOpen=true;held=false;pour=Math.min(pour,.94);teaTimer=-1;tea.classList.add('show');}
      if(s.id==='paper'){paper??=createPaper(card,()=>options.hint('Çizgin burada seni bekler.'));paper.open({kicker:'Söğüt Pazarı · Rei',title:'Evine bir kart: söğüt.',tip:'Soluk çizgilerin üstünden geç. Kart hem Rei’nin tezgâhında hem evinin duvarında kalır.',trace:MOTIFS.willow.strokes,done:'Kartımı asalım',then:lines=>{state.postcard=lines;renderCard();options.memory('market-paper');options.hint('Bir kopyası Rei’de. Bir kopyası evindeki duvarda.');}});}
      if(s.id==='dango'||s.id==='clay'){work??=createHandwork(card,()=>options.hint('Tezgâh kapanmadı. İstediğin zaman devam edebilirsin.'));const kind=s.id==='dango'?'dango':'cups';work.open(kind,{then:()=>{state[s.id]=true;options.memory('market-'+s.id);options.hint(s.id==='dango'?'Momo: “Renkleri senin gibi dizdim. Tezgâhta kalsın.”':'Sora: “Fincanların arasındaki boşluk da çizginin parçası.”');}});}
      return true;
    },
    draw(t:number,dt:number,pl:{x:number;y:number;g:SVGGElement}){
      work?.draw(dt);
      if(guideT>0){guideT-=dt;if(guideT<=0)options.guide(null);}
      if(teaOpen){
        if(held&&teaTimer<0){pour=Math.min(1,pour+dt/3.2);if(pour>=1){held=false;teaTimer=1.3;sfx.chime();}}
        teapot.setAttribute('transform',`rotate(${f(held?-24:-4)} 133 123)`);stream.setAttribute('d',held?'M84 112Q160 137 196 235':'');
        const y=280-pour*40;teaFill.setAttribute('d',`M181 ${f(y)}Q200 ${f(y-6)} 219 ${f(y)}L217 280Q200 287 183 280Z`);
        teaSteam.setAttribute('d',`M192 ${f(y-10)}q${f(5+Math.sin(t*2)*3)} -10 0 -20M207 ${f(y-7)}q-6 -12 0 -22`);
        if(teaTimer>=0){teaTimer-=dt;if(teaTimer<=0){teaTimer=-1;teaOpen=false;tea.classList.remove('show');state.tea=true;options.memory('market-tea');options.hint('Nori: “İlk fincan komşudan. Yine gel.”');}}
      }
      willow.setAttribute('transform',`rotate(${f(Math.sin(t*.6)*.7)} 64 129)`);flags.setAttribute('transform',`translate(0 ${f(Math.sin(t*.8)*.65)})`);
      booths.forEach((s,i)=>{s.vendor.faceTarget=pl.x;s.vendor.talking=Math.abs(pl.x-MX-s.x)<70&&Math.abs(pl.y-s.y)<60;s.vendor.draw(t,dt);s.awning.setAttribute('transform',`translate(0 ${f(Math.sin(t*.9+i)*.5)})`);s.steam.setAttribute('d',i<2?`M-4 -59q${f(4+Math.sin(t+i)*2)} -8 0 -16q-5 -7 1 -13`:'');});
      // Solid front edges stop the body crossing counters; corridors above, below and at either side stay open.
      for(const s of booths){const lx=pl.x-MX-s.x;if(Math.abs(lx)<s.w/2+3&&pl.y>s.y-29&&pl.y<s.y+7){const d=[Math.abs(lx+s.w/2+3),Math.abs(lx-s.w/2-3),Math.abs(pl.y-(s.y-29)),Math.abs(pl.y-(s.y+7))];const m=d.indexOf(Math.min(...d));if(m===0)pl.x=MX+s.x-s.w/2-3;else if(m===1)pl.x=MX+s.x+s.w/2+3;else pl.y=m===2?s.y-29:s.y+7;}}
      const sorted=[{g:pl.g,y:pl.y},...booths.flatMap(s=>[{g:s.g,y:s.sortY},{g:s.vendor.g,y:s.vendor.y}])].sort((a,b)=>a.y-b.y);
      let prev:Element|null=null;for(const v of sorted){if(v.g.previousElementSibling!==prev)depth.insertBefore(v.g,prev?prev.nextSibling:depth.firstChild);prev=v.g;}
    },
  };
  return api;
}
