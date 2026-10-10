/* Guoguo fruit tree: presentation only. All mutations are confirmed by the server. */
(function(global){
  'use strict';
  const TEMPLATE = `
  <main class="gt-window" aria-labelledby="gt-title">
    <header class="gt-head"><a id="gt-home" class="gt-back" href="guoguo-points-bank.html" aria-label="返回首页：积分银行"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg><span>返回首页</span></a><h1 id="gt-title">我的果树</h1></header>
    <div class="gt-scene">
      <div class="gt-message" id="gt-message" role="status" aria-live="polite">每一次努力，都长在了树上。</div>
      <div class="gt-map-toolbar"><span id="gt-crown" hidden></span><button type="button" id="gt-return" class="cursor-interaction" hidden>回到当前树冠 ↑</button><button type="button" id="gt-newer" class="gt-history-page" hidden>返回上一段 ↑</button></div>
      <div id="gt-viewport" class="gt-map-viewport" role="region" aria-label="果树成长长卷，可上下滑动回看">
        <div class="gt-map-content"><button type="button" id="gt-older" class="gt-history-page" hidden>继续回看更早的成长 ↓</button>
          <canvas id="gt-tree" role="img" aria-label="一条连续树干连接七层树冠，向下可回看早期枝冠和种子起点"></canvas>
          <div id="gt-layer-labels" class="gt-layer-labels"></div>
          <div id="gt-fruit-targets" class="gt-fruit-targets" aria-label="树上成熟的果实"></div>
          <div id="gt-pick-effects" class="gt-pick-effects" aria-hidden="true"></div>
        </div>
      </div>
      <div class="gt-side-dock" aria-label="果树功能">
        <button type="button" class="gt-quick-button cursor-interaction" data-open-panel="growth" aria-label="查看成长值" aria-expanded="false" aria-controls="gt-details"><span class="gt-dock-icon gt-leaf-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21v-9M12 15C5 15 3 10 3 5c6 0 9 3 9 7M12 12c0-6 3-9 9-9 0 6-3 9-9 9"/></svg></span><span>成长</span><strong id="gt-growth-short">750</strong></button>
        <button type="button" class="gt-quick-button cursor-interaction" data-open-panel="harvest" aria-label="查看累计收成" aria-expanded="false" aria-controls="gt-details"><span class="gt-dock-icon gt-basket-color" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 10 4-6m10 6-4-6M3 10h18l-2 10H5L3 10Zm6 4v3m6-3v3"/></svg></span><span>收成</span><strong id="gt-picked-short">28 颗</strong></button>
        <button type="button" class="gt-quick-button cursor-interaction" data-open-panel="shop" aria-label="照料果树" aria-expanded="false" aria-controls="gt-details"><span class="gt-dock-icon gt-water-color" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3C9 7 6 10 6 14a6 6 0 0 0 12 0c0-4-3-7-6-11Z"/><path d="M9 14a3 3 0 0 0 3 3"/></svg></span><span>照料</span><strong id="gt-shop-short">0 / 3</strong></button>
      </div>
      <button type="button" class="gt-harvest cursor-interaction" id="gt-harvest"><span id="gt-harvest-label">一键采摘 · 3 颗</span><small id="gt-harvest-progress">再赚 20 分，下一颗果实成熟</small></button>
    </div>
    <div class="gt-status" id="gt-status" hidden><span id="gt-status-text" role="status" aria-live="polite"></span><div class="gt-status-actions"><button type="button" id="gt-login" hidden>请家长登录</button><button type="button" id="gt-retry" hidden>重新同步</button></div></div>
    <div class="gt-initialize" id="gt-initialize" hidden><section class="gt-floating-panel"><h3>让果树记住以前的努力</h3><p id="gt-initialize-note">早期积分记录可能不完整，请家长确认累计获得的奖励积分。兑换和扣分不需要减去。</p><label for="gt-initial-earned">累计奖励积分</label><input id="gt-initial-earned" type="number" min="0" max="1000000000" step="1" inputmode="numeric"><p id="gt-initialize-error" role="alert" hidden></p><button type="button" id="gt-initialize-confirm" class="gt-panel-action">确认并种下果树</button></section></div>
    <div class="gt-panel-layer" id="gt-panel-layer" hidden>
      <section class="gt-floating-panel" id="gt-details" role="dialog" aria-modal="true" aria-labelledby="gt-panel-title">
        <div class="gt-panel-heading"><h3 id="gt-panel-title">成长记录</h3><button type="button" id="gt-close-panel" class="gt-close-panel cursor-interaction" aria-label="关闭详情">×</button></div>
        <div data-panel-content="growth" hidden>
          <div class="gt-growth-total"><span>果树成长值</span><strong id="gt-growth">750</strong><p id="gt-growth-source">累计奖励 750 ＋ 照料助长 0</p></div>
          <div class="gt-progress-label"><span id="gt-next">再赚 20 分，下一颗果实成熟</span></div>
          <div class="gt-track"><div id="gt-fill"></div></div>
          <p class="gt-keep">兑换和扣分，都不会带走已经长大的部分</p>
        </div>
        <div data-panel-content="harvest" hidden>
          <div class="gt-basket"><span class="gt-basket-icon gt-dock-icon gt-basket-color" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 10 4-6m10 6-4-6M3 10h18l-2 10H5L3 10Zm6 4v3m6-3v3"/></svg></span><div><span class="gt-muted">累计收成</span><strong><span id="gt-picked">28</span> 颗果实</strong></div><div class="gt-best"><span class="gt-muted">最佳收成</span><strong id="gt-best">6 星彩虹果</strong></div></div>
          <p class="gt-keep">成熟的果实会一直等你，慢慢采也没关系。</p>
          <button type="button" class="gt-panel-action cursor-interaction" id="gt-harvest-panel">一键采摘 · 3 颗</button>
        </div>
        <div data-panel-content="shop" hidden>
          <div class="gt-shop-summary"><span>可用积分 <strong id="gt-wallet">126</strong></span><span id="gt-used">今日照料 0 / 3</span></div>
          <div class="gt-shop-items">
            <button type="button" class="gt-shop-item cursor-interaction" data-supply="water"><span class="gt-supply-icon gt-water-color" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3C9 7 6 10 6 14a6 6 0 0 0 12 0c0-4-3-7-6-11Z"/><path d="M9 14a3 3 0 0 0 3 3"/></svg></span><span><strong>浇水</strong><small>成长 +1</small></span><b>1 积分</b></button>
            <button type="button" class="gt-shop-item cursor-interaction" data-supply="sun"><span class="gt-supply-icon gt-sun-color" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg></span><span><strong>阳光</strong><small>成长 +2</small></span><b>2 积分</b></button>
            <button type="button" class="gt-shop-item cursor-interaction" data-supply="food"><span class="gt-supply-icon gt-leaf-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21v-9M12 15C5 15 3 10 3 5c6 0 9 3 9 7M12 12c0-6 3-9 9-9 0 6-3 9-9 9"/></svg></span><span><strong>肥料</strong><small>成长 +3</small></span><b>3 积分</b></button>
          </div>
          <p class="gt-shop-note" id="gt-shop-note">每种每天 1 次，合计最多 6 积分。</p>
          <div class="gt-care" id="gt-care" hidden><div><strong>🐛 小虫趴在一颗果实上</strong><span>再赚一次积分，瓢虫就来帮忙</span></div><button type="button" class="gt-small-action cursor-interaction" id="gt-spray">喷雾 · 2 分</button></div>
        </div>
      </section>
    </div>
  </main>
`;
  function create(config={}) {
    const root=document.createElement('div');root.id='guoguo-fruit-tree';root.hidden=true;root.innerHTML=TEMPLATE;document.body.append(root);
    const el=id=>root.querySelector('#gt-'+id);
    const viewport=el('viewport'),canvas=el('tree'),ctx=canvas.getContext('2d');
    const firstFruitGrowth=150,crownStep=100,fruitStep=20;
    const milestones=[0,5,15,30,60,100,firstFruitGrowth],names=['种子','新芽','小苗','小树','大树','开花','结果啦'];
    const settings={crown:'round'},fruitPositions=[[-76,22],[2,-15],[74,29]];
    const supplies={water:{name:'浇水',value:1},sun:{name:'阳光',value:2},food:{name:'肥料',value:3}};
    let snapshot=null,options={loading:false,offline:false,readOnly:false,busy:false,retry:false,retrying:false,error:''};
    let growth=0,earned=0,boost=0,wallet=0,picked=0,best=0,ready=0,bug=false,used=[],remainingBoost=0;
    let visibleFruits=[],fruitSlots=[],note='',openPanel=null,panelTrigger=null;
    let localBusy=false,destroyed=false,pageOffset=0,messageTimer,drawFrame=0,initialInputTouched=false;
    const MAX_CROWNS=60;
    function level(){return growth<firstFruitGrowth?0:Math.floor((growth-firstFruitGrowth)/crownStep)+1;}
    function stage(){return milestones.reduce((a,v,i)=>growth>=v?i:a,0);}
    function fruitName(l){return l<1?'等待第一颗':l===1?'★ 红苹果':l===2?'★★ 蜜桃果':l===3?'★★★ 金苹果':l+' 星彩虹果';}
    function number(value,fallback=0){const n=Number(value);return Number.isFinite(n)?Math.max(0,n):fallback;}
    function writesBlocked(){return options.loading||options.offline||options.readOnly||options.busy||localBusy||!snapshot?.initialized;}
    function mapHeight(lv){const count=Math.min(MAX_CROWNS,Math.max(0,lv-pageOffset));return 160+Math.max(0,count-1)*255+410;}
  function circle(x,y,r,c){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=c;ctx.fill();}
  function ellipse(x,y,rx,ry,c){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=c;ctx.fill();}
  function stroke(points,color,width){ctx.beginPath();ctx.moveTo(points[0],points[1]);ctx.bezierCurveTo(...points.slice(2));ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.stroke();}
  function gradient(x1,y1,x2,y2,stops){const g=ctx.createLinearGradient(x1,y1,x2,y2);stops.forEach(([at,c])=>g.addColorStop(at,c));return g;}
  function leaf(x,y,s,rot,c){
    ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.beginPath();ctx.moveTo(0,0);ctx.bezierCurveTo(s*.25,-s*.72,s*1.55,-s*.94,s*2,0);ctx.bezierCurveTo(s*1.55,s*.7,s*.42,s*.62,0,0);ctx.fillStyle=c;ctx.fill();
    stroke([s*.18,0,s*.72,-s*.12,s*1.37,-s*.08,s*1.78,0],'#fffbd134',Math.max(.7,s*.05));ctx.restore();
  }
  function cloud(x,y,s){
    ctx.save();ctx.translate(x,y);ctx.scale(s/24,s/24);ctx.beginPath();ctx.moveTo(-39,12);ctx.bezierCurveTo(-58,4,-42,-15,-28,-10);ctx.bezierCurveTo(-30,-35,11,-38,16,-13);ctx.bezierCurveTo(41,-25,55,8,36,14);ctx.bezierCurveTo(16,20,-16,18,-39,12);ctx.fillStyle='#fffef7ba';ctx.fill();ctx.restore();
  }
  function flower(x,y,size=1,pink=false,angle=0){
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(size,size);
    for(let k=0;k<5;k++){
      ctx.save();ctx.rotate(k*Math.PI*2/5);ctx.scale(k%2?1:.95,k===2?.9:1);
      ctx.beginPath();ctx.moveTo(-.6,-.8);ctx.bezierCurveTo(-3.5,-2,-5.4,-5.5,-3.5,-7.7);ctx.quadraticCurveTo(-2.1,-9.3,.1,-8.1);ctx.quadraticCurveTo(2.7,-9,4,-6.8);ctx.bezierCurveTo(5.2,-4.4,2.5,-1.2,.5,-.7);ctx.closePath();
      ctx.fillStyle=gradient(0,-8.5,0,0,[[0,pink?'#f9e4df':'#fff7ed'],[.42,'#fffdf2'],[1,'#f2d8c9']]);ctx.fill();
      stroke([-.4,-2,-1.3,-3.6,-1.6,-5,-1.2,-6.2],'#ecc9c336',.45);ctx.restore();
    }
    circle(0,0,1.6,'#d9bb68');
    for(let k=0;k<9;k++){const a=k*Math.PI*2/9+.2,r=k%2?3.1:2.6,tx=Math.cos(a)*r,ty=Math.sin(a)*r;stroke([0,0,tx*.35,ty*.35,tx*.7,ty*.7,tx,ty],'#c5a357',.42);circle(tx,ty,.62,'#e6be55');}
    circle(-.3,-.4,.7,'#fff4ca');ctx.restore();
  }
  function blossomCluster(x,y,size,angle,variant){
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(size,size);
    stroke([0,15,-3,7,-2,-4,1,-12],'#90a064',1.6);leaf(-1,10,5.8,-2.7,'#b1c979');leaf(1,12,5.5,-.62,'#95b566');
    const blooms=variant?[[-10,-2,.83,-.32],[4,-15,1.05,.18],[13,2,.77,.52]]:[[-12,-8,.92,-.2],[8,-12,.85,.42],[1,5,1.04,-.5]];
    for(const [fx,fy,fs,fa] of blooms){stroke([0,9,fx*.2,5,fx*.8,fy+5,fx,fy],'#94a16b',1.05);flower(fx,fy,fs,true,fa);}
    const bx=variant?-5:18,by=variant?-22:5;stroke([0,7,bx*.4,3,bx,by+6,bx,by],'#9ca46d',1);ctx.save();ctx.translate(bx,by);ctx.rotate(variant?-.35:.45);ellipse(0,-1,2.4,3.6,'#e6a8b4');ellipse(-.7,-1.8,.85,2.1,'#f5c9ce');ctx.beginPath();ctx.moveTo(-2.4,1);ctx.quadraticCurveTo(0,5.7,2.5,1);ctx.lineTo(0,2);ctx.closePath();ctx.fillStyle='#8ca35f';ctx.fill();ctx.restore();
    ctx.restore();
  }
  function glint(x,y,size,color='#fffbd8'){
    ctx.save();ctx.translate(x,y);ctx.beginPath();ctx.moveTo(0,-size);ctx.quadraticCurveTo(size*.18,-size*.15,size,0);ctx.quadraticCurveTo(size*.18,size*.15,0,size);ctx.quadraticCurveTo(-size*.18,size*.15,-size,0);ctx.quadraticCurveTo(-size*.18,-size*.15,0,-size);ctx.fillStyle=color;ctx.fill();ctx.restore();
  }
  function fruit(x,y,l,locked){
    ctx.save();ctx.translate(x,y);ctx.rotate(l===2?-.13:.09);
    stroke([0,-15,-3,-23,0,-27,4,-30],'#8a6544',3.8);leaf(1,-25,10,-.26,'#79a955');
    const fill=l===1?[[0,'#ffbb83'],[.4,'#f68966'],[1,'#d95646']]:l===2?[[0,'#ffdec0'],[.45,'#f6aaa0'],[1,'#e27b92']]:l===3?[[0,'#fff2a6'],[.5,'#f8c958'],[1,'#dba238']]:[[0,'#ffd79e'],[.3,'#efa3ba'],[.62,'#c1a4de'],[1,'#86c8ca']];
    ctx.shadowColor=l>=3?'#edc16955':'#47643926';ctx.shadowBlur=l>=3?14:5;ctx.shadowOffsetY=4;
    ctx.beginPath();ctx.moveTo(0,-15);
    if(l===2){ctx.bezierCurveTo(-23,-30,-35,-1,-18,16);ctx.bezierCurveTo(-9,24,-1,24,3,29);ctx.bezierCurveTo(9,23,23,16,25,4);ctx.bezierCurveTo(30,-18,13,-28,0,-15);}
    else{ctx.bezierCurveTo(-22,-30,-32,-8,-25,8);ctx.bezierCurveTo(-20,28,-7,29,0,23);ctx.bezierCurveTo(9,31,23,24,27,7);ctx.bezierCurveTo(32,-15,14,-29,0,-15);}
    ctx.fillStyle=gradient(-14,-25,19,30,fill);ctx.fill();ctx.shadowColor='transparent';
    stroke([-16,-11,-22,-5,-22,0,-20,4],'#fff8df99',4);
    if(l===2)stroke([1,-13,-6,-4,5,9,3,22],'#d67f8a75',1.6);
    if(l>=3){glint(20,-27,5);glint(-28,13,3.5,'#fff7d8ba');}
    if(l>=4){stroke([-12,9,-5,14,7,15,15,9],'#fffbea66',2);circle(12,-10,2,'#fff7d8bc');}
    if(locked){ellipse(1,5,20,4,'#79532b20');caterpillar(-15,0);}
    ctx.restore();
  }
  function addLabel(y,title,detail,kind){
    const label=document.createElement('div');
    label.className='gt-layer-label'+(kind==='memory'?' gt-memory':'');
    label.style.top=Math.round(y*viewport.clientWidth/460)+'px';
    if(kind==='current')label.dataset.current='true';
    const heading=document.createElement('strong');heading.textContent=title;
    const subtitle=document.createElement('span');subtitle.textContent=detail;
    label.append(heading,subtitle);el('layer-labels').append(label);
  }
  function foliage(x,y,sx,sy,tilt,tone){
    ctx.save();ctx.translate(x,y);ctx.rotate(tilt);ctx.scale(sx,sy);
    ctx.beginPath();ctx.moveTo(-63,17);ctx.bezierCurveTo(-90,2,-72,-31,-53,-31);ctx.bezierCurveTo(-57,-53,-27,-67,-9,-53);ctx.bezierCurveTo(10,-79,45,-62,43,-39);ctx.bezierCurveTo(71,-42,90,-11,67,7);ctx.bezierCurveTo(76,30,51,42,31,34);ctx.bezierCurveTo(11,53,-17,42,-27,31);ctx.bezierCurveTo(-50,48,-74,35,-63,17);ctx.closePath();
    const colors=tone==='back'?[[0,'#9fbf61'],[.5,'#6c9d51'],[1,'#477c4a']]:tone==='light'?[[0,'#d7e696'],[.42,'#a6cd69'],[1,'#76a851']]:[[0,'#bddb7c'],[.48,'#8ebd5d'],[1,'#588f4c']];
    ctx.fillStyle=gradient(-30,-64,18,44,colors);ctx.shadowColor='#315b331f';ctx.shadowBlur=8;ctx.shadowOffsetY=6;ctx.fill();ctx.shadowColor='transparent';
    ctx.beginPath();ctx.moveTo(-56,-23);ctx.bezierCurveTo(-51,-43,-35,-50,-18,-41);ctx.bezierCurveTo(-5,-58,17,-60,32,-43);ctx.strokeStyle='#eff1b944';ctx.lineWidth=5;ctx.lineCap='round';ctx.stroke();
    for(const [lx,ly,angle] of [[-45,0,-.7],[-26,-28,-2.7],[3,-36,-.3],[37,-14,-1.2],[31,16,-2.7],[-5,19,-.3]])leaf(lx,ly,5.5,angle,'#dcebae36');
    ctx.restore();
  }
  function caterpillar(x,y){
    for(let k=0;k<4;k++)circle(x+k*7,y-Math.sin(k)*3,5.8,k%2?'#c7d977':'#acc564');circle(x+27,y-6,7,'#d6e39b');circle(x+29,y-7,1.4,'#576940');ellipse(x+32,y-3,2,1.3,'#e0ad8e');stroke([x+27,y-11,x+25,y-15,x+26,y-16,x+28,y-16],'#889948',1.2);
  }
  function drawCrown(x,y,current,lv,bloom=true,anchor=[x,y+105]){
    ctx.save();ctx.translate(x,y);const size=current?1:.84+(lv%3)*.025;ctx.scale(size,size);
    const spread=settings.crown==='airy'?1.1:1,ax=(anchor[0]-x)/size,ay=(anchor[1]-y)/size;
    foliage(-15,8,1.51,.96,-.05,'back');
    stroke([ax,ay,ax,ay-20,0,86,0,67],'#a18155',14/size);
    stroke([0,67,-22,45,-55,25,-92,7],'#a18155',11);stroke([0,67,26,41,63,28,96,-9],'#a18155',10);
    stroke([ax-2,ay,ax-2,ay-20,-2,86,-2,69],'#d3b17d80',3/size);
    foliage(-77*spread,3,.74,.85,-.27,lv%2?'light':'green');
    foliage(67*spread,-7,.81,.86,.18,'green');
    foliage(-6,-43,1.07,1.05,lv%2?-.13:.1,'light');
    foliage(-27,27,.77,.66,.14,'green');
    foliage(53,30,.53,.5,-.2,'light');
    if(current&&lv>0){for(const slot of fruitSlots){const item=visibleFruits[slot];fruit(...fruitPositions[slot],item.level,item.locked);}}
    if(bloom){
      if(stage()===5){
        blossomCluster(-70,-6,1.05,-.35,0);blossomCluster(-22,-56,1.02,.28,1);
        blossomCluster(57,-23,1.1,.25,0);blossomCluster(-23,28,.9,-.22,1);
        blossomCluster(49,30,.83,.44,1);
      }else{flower(-107,-18,.88);flower(48,-69,.78);flower(-25,57,.7);}
    }
    ctx.restore();
  }
  function face(x,y,s=1){
    ctx.save();ctx.translate(x,y);ctx.scale(s,s);circle(-7,0,2.2,'#785b42');circle(7,0,2.2,'#785b42');ellipse(-13,5,4,2,'#dcaa80');ellipse(13,5,4,2,'#dcaa80');stroke([-4,7,-2,11,2,11,4,7],'#785b42',1.8);ctx.restore();
  }
  function groundScene(y,width=460){
    ctx.beginPath();ctx.moveTo(0,y+9);ctx.bezierCurveTo(95,y-53,177,y-12,249,y-17);ctx.bezierCurveTo(344,y-59,414,y-30,width,y-3);ctx.lineTo(width,y+130);ctx.lineTo(0,y+130);ctx.fillStyle='#dce8bf';ctx.fill();
    ctx.beginPath();ctx.moveTo(0,y+29);ctx.bezierCurveTo(81,y+6,175,y+37,263,y+15);ctx.bezierCurveTo(347,y-2,408,y+20,width,y+8);ctx.lineTo(width,y+130);ctx.lineTo(0,y+130);ctx.fillStyle='#e3eccb';ctx.fill();
    for(const [gx,gy,s] of [[45,7,7],[82,27,5],[319,3,7],[351,32,5],[131,31,4],[410,18,8]]){leaf(gx,y+gy,s,-2.3,'#a2bc77');leaf(gx+1,y+gy,s,-.65,'#b0c987');}
    flower(70,y+4,.6);flower(325,y+19,.5);ellipse(204,y+4,74,11,'#79925026');
  }

    function drawEarly(width,height,s){
    const sceneHeight=height*460/width,ground=sceneHeight*.76;
    ctx.fillStyle=gradient(0,0,0,sceneHeight,[[0,'#edf7f2'],[.65,'#f4f8e8'],[1,'#e3eccb']]);ctx.fillRect(0,0,460,sceneHeight);
    cloud(47,75,25);cloud(359,sceneHeight*.48,20);circle(335,50,23,'#f8e8b6');
    groundScene(ground);
    if(s===0){
      const soil=ctx.createRadialGradient(202,ground+12,5,202,ground+12,58);
      soil.addColorStop(0,'#c6ab80dc');soil.addColorStop(.55,'#d1ba91bc');soil.addColorStop(1,'#e3eccb00');
      ctx.beginPath();ctx.moveTo(134,ground+2);ctx.bezierCurveTo(163,ground-8,237,ground-10,268,ground+3);ctx.bezierCurveTo(267,ground+43,236,ground+72,201,ground+69);ctx.bezierCurveTo(160,ground+66,136,ground+38,134,ground+2);ctx.fillStyle=soil;ctx.fill();
      ctx.beginPath();ctx.moveTo(135,ground+3);ctx.bezierCurveTo(164,ground-17,235,ground-17,266,ground+3);ctx.bezierCurveTo(235,ground+11,169,ground+9,135,ground+3);ctx.fillStyle=gradient(0,ground-12,0,ground+10,[[0,'#c6cf9c'],[.62,'#b8bf8c'],[1,'#aaaf7d80']]);ctx.fill();
      for(const [gx,gy,r] of [[150,2,1.3],[176,-3,1.5],[224,-2,1.2],[252,4,1.6],[158,28,1.1],[241,35,1.5],[222,55,1.1]])ellipse(gx,ground+gy,r*1.6,r,'#a5906666');
      leaf(142,ground+2,6,-2.3,'#9ab572');leaf(261,ground+2,7,-.65,'#a7bc80');
      ctx.save();ctx.translate(202,ground+29);ctx.rotate(-.38);
      ctx.beginPath();ctx.moveTo(-18,0);ctx.bezierCurveTo(-8,-18,15,-18,21,-5);ctx.bezierCurveTo(22,10,-4,21,-18,0);ctx.fillStyle=gradient(-12,-15,15,17,[[0,'#b08653'],[.48,'#98703f'],[1,'#7d5d35']]);ctx.fill();
      stroke([-11,-1,-3,-8,6,-10,13,-5],'#d1b17c78',1.5);stroke([-12,1,-1,-1,6,4,16,0],'#7455325c',1.2);ctx.restore();
      canvas.setAttribute('aria-label','一颗小种子埋在松软土丘下，安静等待发芽');return;
    }
    if(s<3){
      const h=sceneHeight*(s===1?.36:.46),base=ground-7,top=base-h;
      ellipse(201,ground,43,11,'#c3aa80');ellipse(199,ground-3,33,8,'#d9c099');
      stroke([201,base,183,base-h*.4,218,top+34,202,top],'#81a652',11);
      stroke([198,base-3,184,base-h*.4,212,top+30,199,top],'#b7cb7c',3);
      leaf(202,top+27,36,-2.78,gradient(0,-30,0,40,[[0,'#c7df89'],[1,'#7faa54']]));
      leaf(204,top+12,39,-.55,gradient(0,-30,0,40,[[0,'#d4e794'],[1,'#8aba5c']]));
      if(s===2){leaf(196,base-48,27,-2.9,'#93b567');leaf(196,base-40,24,-.45,'#afca78');}
      face(201,base-31,.76);ellipse(252,top-8,2.2,3.5,'#fffbe6ad');return;
    }
    const treeScale=s===3?.68:s===4?.86:.93,base=ground-2;
    ctx.save();ctx.translate(202,base);ctx.scale(treeScale,treeScale);
    ctx.beginPath();ctx.moveTo(-27,2);ctx.bezierCurveTo(1,-31,-22,-85,-8,-126);ctx.bezierCurveTo(0,-155,3,-187,0,-208);ctx.lineTo(12,-208);ctx.bezierCurveTo(18,-165,8,-136,9,-109);ctx.bezierCurveTo(11,-66,18,-36,18,-12);ctx.quadraticCurveTo(24,1,38,4);ctx.quadraticCurveTo(9,10,3,1);ctx.quadraticCurveTo(-7,10,-27,2);ctx.fillStyle=gradient(-17,0,23,0,[[0,'#9c7e54'],[.4,'#c8a577'],[1,'#a78554']]);ctx.fill();
    stroke([-3,-9,5,-61,-14,-95,5,-145],'#e2c7997a',3);leaf(0,-63,19,-2.75,'#94b76a');leaf(10,-78,17,-.55,'#a5c273');face(4,-37,.85);
    drawCrown(0,-213,false,s,s===5,[3,-108]);ctx.restore();

    }
    // Keep the bitmap the size of the viewport; even years of growth cost only a few crowns per frame.
    function drawMap(lv,viewTop,viewBottom){
      const height=mapHeight(lv),ground=height-62,count=Math.min(MAX_CROWNS,lv-pageOffset),atRoot=pageOffset+count>=lv;
      ctx.fillStyle=gradient(0,0,0,height,[[0,'#edf7f2'],[.42,'#eff7ea'],[.8,'#f0f6e2'],[1,'#e7efcf']]);ctx.fillRect(0,viewTop,460,viewBottom-viewTop);
      if(viewTop<140){const glow=ctx.createRadialGradient(341,42,8,341,42,77);glow.addColorStop(0,'#ffefb673');glow.addColorStop(1,'#fff0bc00');ctx.fillStyle=glow;ctx.fillRect(260,0,160,130);circle(341,42,22,'#f9e7af');ellipse(335,36,9,5,'#fff5d34d');}
      const first=Math.max(0,Math.floor((viewTop-310)/255)),last=Math.min(count-1,Math.ceil((viewBottom+120)/255));
      for(let i=first;i<=last;i++){const y=160+i*255;cloud(i%2?349:46,y+83,23);cloud(i%2?54:386,y-44,16);}
      if(atRoot&&viewBottom>ground-70)groundScene(ground);
      const trunkX=y=>204+Math.sin((y+pageOffset*255-130)/128)*16;
      const halfWidth=y=>7+Math.min(17,((y+pageOffset*255)/(160+(lv-1)*255+348))*17);
      const trunkTop=Math.max(pageOffset?0:80,viewTop-20),trunkBottom=Math.min(atRoot?ground:height,viewBottom+20);
      ctx.beginPath();ctx.moveTo(trunkX(trunkTop)-halfWidth(trunkTop),trunkTop);
      for(let y=trunkTop+7;y<trunkBottom;y+=7)ctx.lineTo(trunkX(y)-halfWidth(y),y);
      ctx.lineTo(trunkX(trunkBottom)-halfWidth(trunkBottom),trunkBottom);
      if(atRoot&&trunkBottom===ground){ctx.quadraticCurveTo(177,ground+8,159,ground+9);ctx.quadraticCurveTo(199,ground+13,207,ground+4);ctx.quadraticCurveTo(224,ground+14,255,ground+10);ctx.quadraticCurveTo(235,ground+1,trunkX(ground)+halfWidth(ground),ground);}
      else ctx.lineTo(trunkX(trunkBottom)+halfWidth(trunkBottom),trunkBottom);
      for(let y=trunkBottom;y>trunkTop;y-=7)ctx.lineTo(trunkX(y)+halfWidth(y),y);
      ctx.lineTo(trunkX(trunkTop)+halfWidth(trunkTop),trunkTop);ctx.closePath();ctx.fillStyle=gradient(175,0,238,0,[[0,'#94764e'],[.37,'#c4a171'],[.62,'#bb9664'],[1,'#8f704b']]);ctx.fill();
      ctx.beginPath();ctx.moveTo(trunkX(trunkTop)-halfWidth(trunkTop)*.37,trunkTop);for(let y=trunkTop+7;y<trunkBottom-5;y+=7)ctx.lineTo(trunkX(y)-halfWidth(y)*.37,y);ctx.strokeStyle='#e4c79965';ctx.lineWidth=3.8;ctx.lineCap='round';ctx.stroke();
      for(let i=first;i<=last;i++){
        const layer=lv-pageOffset-i,y=160+i*255,current=pageOffset+i===0,x=current?202:layer%2?174:226;
        leaf(trunkX(y+144)-6,y+144,17,-2.75,'#9aba70');leaf(trunkX(y+120)+8,y+120,14,-.58,'#79a559');
        drawCrown(x,y,current,layer,true,[trunkX(y+105),y+105]);
        if(i>0&&y-122>viewTop-60&&y-122<viewBottom)addLabel(y-122,'第 '+layer+' 层枝冠',(firstFruitGrowth+(layer-1)*crownStep)+' 成长 · 成长足迹','history');
      }
      if(!pageOffset&&viewTop<300)face(trunkX(273),273,.78);
      if(atRoot){const base=160+(count-1)*255;
        if(base+157>viewTop-60&&base+157<viewBottom)addLabel(base+157,'第一次开花','100 成长 · 努力开出了花','memory');
        if(base+185>viewTop-25&&base+185<viewBottom+25)flower(trunkX(base+185)-15,base+185,1.1);
        if(base+244>viewTop-60&&base+244<viewBottom)addLabel(base+244,'从小苗开始','15 成长 · 每一步都算数','history');
        if(base+341>viewTop-60&&base+341<viewBottom)addLabel(base+341,'种子起点','0 成长 · 故事从这里开始','memory');
      }
    }
    function syncFruitTargets(){
      const targetLayer=el('fruit-targets'),scale=viewport.clientWidth/460,items=pageOffset===0&&level()>0?fruitSlots:[],focused=document.activeElement,hadFruitFocus=targetLayer.contains(focused);
      for(const button of targetLayer.querySelectorAll('button'))if(!items.some(slot=>String(visibleFruits[slot].id)===button.dataset.fruitId))button.remove();
      for(const slot of items){const item=visibleFruits[slot],key=String(item.id);
        let button=[...targetLayer.children].find(node=>node.dataset.fruitId===key);
        if(!button){button=document.createElement('button');button.type='button';button.className='gt-fruit-target';button.dataset.fruitId=key;button.addEventListener('click',()=>{const current=visibleFruits.find(f=>f&&String(f.id)===key);if(!current)return;if(current.locked)setPanel('shop',button);else runAction({action:'harvest',fruitId:current.id});});targetLayer.append(button);}
        const [x,y]=fruitPositions[slot],size=Math.max(44,61*scale),label=item.name||fruitName(item.level).replace(/★/g,'').trim();
        button.style.left=(202+x)*scale+'px';button.style.top=(160+y)*scale+'px';button.style.width=size+'px';button.style.height=size+'px';
        button.disabled=!item.locked&&writesBlocked();button.setAttribute('aria-label',(item.locked?'照料':'采摘')+label+(item.locked?'，果实上有小虫':''));
      }
      if(hadFruitFocus&&!focused.isConnected){const next=targetLayer.querySelector('button:not(:disabled)')||root.querySelector('[data-open-panel="harvest"]');next.focus({preventScroll:true});}
    }
    function draw(){
      drawFrame=0;if(root.hidden||destroyed||!ctx)return;
      const width=viewport.clientWidth,viewportHeight=viewport.clientHeight;if(width<=0||viewportHeight<=0)return;
      const s=stage(),lv=level(),scale=width/460,dpr=Math.min(global.devicePixelRatio||1,2);
      root.classList.toggle('gt-has-map',lv>0);root.classList.toggle('gt-early',lv===0);
      const height=lv?mapHeight(lv)*scale:Math.max(260,viewportHeight-194),offset=Math.max(0,Math.min(height,viewport.scrollTop-104));
      root.querySelector('.gt-map-content').style.height=(height+194)+'px';
      const bitmapHeight=Math.max(1,Math.min(viewportHeight+24,height-offset));
      canvas.style.top=(104+offset)+'px';canvas.style.height=bitmapHeight+'px';
      const bitmapWidth=Math.round(width*dpr),pixelHeight=Math.round(bitmapHeight*dpr);
      if(canvas.width!==bitmapWidth)canvas.width=bitmapWidth;if(canvas.height!==pixelHeight)canvas.height=pixelHeight;
      ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,bitmapHeight);ctx.translate(0,-offset);ctx.scale(scale,scale);
      el('layer-labels').replaceChildren();syncFruitTargets();
      canvas.setAttribute('aria-label',lv?'一棵果树的枝冠，沿同一条树干向下延伸，可以回看成长足迹':'果树目前处于'+names[s]+'阶段');
      el('return').hidden=!lv||(!pageOffset&&viewport.scrollTop<35);
      el('newer').hidden=!pageOffset;el('older').hidden=!lv||pageOffset+MAX_CROWNS>=lv;
      // Keep page navigation above the fixed harvest button and transient feedback.
      el('older').style.top=Math.max(104,height-24)+'px';
      if(lv)drawMap(lv,offset/scale,(offset+bitmapHeight)/scale);else drawEarly(width,height,s);
    }
    function scheduleDraw(){if(!drawFrame&&!root.hidden&&!destroyed)drawFrame=global.requestAnimationFrame(draw);}
    function compact(value){return value>=10000?new Intl.NumberFormat('zh-CN',{notation:'compact',maximumFractionDigits:1}).format(value):String(value);}
    function render(){
      if(destroyed)return;
      const s=stage(),blocked=writesBlocked(),available=ready;
      el('growth').textContent=growth;el('growth-short').textContent=compact(growth);el('picked-short').textContent=compact(picked)+' 颗';el('shop-short').textContent=bug?'有小虫':used.length+' / 3';
      el('growth-source').textContent='累计奖励 '+earned+' ＋ 照料助长 '+boost;el('wallet').textContent=wallet;el('used').textContent='今日照料 '+used.length+' / 3';
      el('spray').disabled=blocked||wallet<2||!bug;
      el('shop-note').textContent=s<2?'长成小苗后，就可以开始照料啦。':'每种每天 1 次，合计最多 6 积分。照料总加成不超过累计奖励的 10%。';
      root.querySelectorAll('[data-supply]').forEach(button=>{const kind=button.dataset.supply,item=supplies[kind];const reason=used.includes(kind)?'今日已用':s<2?'小苗解锁':remainingBoost<item.value?'额度不足':wallet<item.value?'积分不足':'';button.disabled=blocked||!!reason;button.querySelector('b').textContent=reason||item.value+' 积分';});
      const remaining=s===6?fruitStep-(growth-firstFruitGrowth)%fruitStep:milestones[s+1]-growth;
      const nextStep=s===6?'下一颗果实成熟':s===0?'长出新芽':s===4?'果树就开花':s===5?'结出第一颗果实':'成长为'+names[s+1];
      const progressText='再赚 '+remaining+' 分，'+nextStep;
      el('next').textContent=progressText;el('fill').style.width=(s===6?((growth-firstFruitGrowth)%fruitStep/fruitStep*100):((growth-milestones[s])/(milestones[s+1]-milestones[s])*100))+'%';
      el('picked').textContent=picked;el('best').textContent=fruitName(best);el('care').hidden=!bug;
      const harvestText=available?'一键采摘 · '+available+' 颗':bug?'照料一下，就能采摘啦':s===6?'收好啦，期待下一颗！':'第一颗果实，在 150 分等你';
      el('harvest-label').textContent=localBusy?'正在照顾果树…':s===6?harvestText:progressText;el('harvest-progress').textContent=progressText;el('harvest-progress').hidden=s!==6;
      el('harvest').disabled=blocked||!available;el('harvest-panel').textContent=localBusy?'正在收进篮子…':harvestText;el('harvest-panel').disabled=blocked||!available;
      el('message').textContent=note||(bug?'小虫来做客，长大的努力还在。':'');el('message').hidden=!note&&!bug;
      const status=options.error||(options.loading?'正在打开果树…':options.offline?'连接暂时中断，联网后就能继续照料和采摘。':options.readOnly?'请家长登录后照料和采摘果树。':options.busy?'积分正在同步，请稍等片刻。':'');
      el('status-text').textContent=status;el('status').hidden=!status&&!options.retry;el('login').hidden=!options.readOnly||typeof config.onLogin!=='function';
      el('retry').hidden=!options.retry||typeof config.onRetry!=='function';el('retry').disabled=options.loading||options.retrying||localBusy;
      el('retry').textContent=options.loading||options.retrying?'正在同步…':'重新同步';
      const needsInitialization=!!snapshot&&!snapshot.initialized&&!options.loading;
      el('initialize').hidden=!needsInitialization;
      el('initial-earned').disabled=options.readOnly||options.offline||options.busy||localBusy;
      el('initialize-confirm').disabled=options.readOnly||options.offline||options.busy||localBusy;
      el('initialize-confirm').textContent=localBusy?'正在种下果树…':'确认并种下果树';
      if(needsInitialization&&!initialInputTouched)el('initial-earned').value=String(number(snapshot.initialization?.suggestedEarned));
      if(needsInitialization)el('initialize-note').textContent=snapshot.initialization?.historyIncomplete?'早期积分记录可能不完整，请家长确认累计获得的奖励积分。兑换和扣分不需要减去。':'已根据现有记录填入累计奖励积分，请家长确认后种下果树。兑换和扣分不需要减去。';
      root.querySelector('.gt-scene').inert=!!openPanel||needsInitialization;
      scheduleDraw();
    }
    function update(next,patch={}){
      if(destroyed)return;
      const previousLevel=level();
      options={...options,...patch};
      if(next){snapshot=next;growth=number(next.growth);earned=number(next.earned);boost=number(next.boost);wallet=number(next.balance);picked=number(next.harvestedCount);best=number(next.bestHarvestLevel);used=Array.isArray(next.care?.usedKinds)?next.care.usedKinds:[];remainingBoost=number(next.care?.remainingBoost);
        const old=visibleFruits,updated=new Array(3),items=Array.isArray(next.fruits)?next.fruits.slice(0,3):[];
        const pestId=next.pest?.fruitId;
        const normalized=items.map(item=>({...item,level:Math.max(1,number(item.level,1)),locked:!!item.locked||(pestId!=null&&String(item.id)===String(pestId))}));
        // Keep remaining fruits on the same branches when the server fills an empty slot.
        for(const item of normalized){const retained=old.findIndex(f=>f&&String(f.id)===String(item.id));if(retained>=0)updated[retained]=item;}
        for(const item of normalized)if(!updated.some(f=>f&&String(f.id)===String(item.id)))updated[updated.findIndex(f=>!f)]=item;
        visibleFruits=updated;fruitSlots=updated.map((f,i)=>f?i:null).filter(i=>i!==null);bug=pestId!=null||items.some(f=>f.locked);ready=number(next.readyCount,items.filter(f=>!f.locked).length);
        if(previousLevel!==level()){pageOffset=0;viewport.scrollTop=0;}if(next.initialized)initialInputTouched=false;
      }
      render();
    }
    function showPickEffect(slot){
      if(root.hidden||pageOffset)return;const [x,y]=fruitPositions[slot],scale=viewport.clientWidth/460,pop=document.createElement('span');pop.className='gt-picked-pop';pop.textContent='+1';pop.style.left=(202+x)*scale+'px';pop.style.top=(160+y)*scale+'px';el('pick-effects').append(pop);global.setTimeout(()=>pop.remove(),720);
    }
    function feedback(kind){
      global.clearTimeout(messageTimer);const message=note;
      messageTimer=global.setTimeout(()=>{if(!destroyed&&note===message){note='';render();}},3500);
      const target=kind==='harvest'?root.querySelector('[data-open-panel="harvest"]'):canvas,animation=kind==='harvest'?'gt-feedback':'gt-care-feedback';target.classList.remove(animation);void target.offsetWidth;target.classList.add(animation);target.addEventListener('animationend',()=>target.classList.remove(animation),{once:true});
    }
    async function runAction(payload){
      const initializing=payload.action==='initialize';
      if(localBusy||options.busy||options.loading||options.offline||options.readOnly||(!initializing&&!snapshot?.initialized)||typeof config.onAction!=='function')return;
      const before=visibleFruits.map(f=>f&&{...f}),beforePicked=picked,previousGrowth=growth,focused=document.activeElement;
      localBusy=true;options.error='';el('initialize-error').hidden=true;render();
      try{
        const result=await config.onAction(payload);
        if(destroyed)return;
        if(result?.snapshot)update(result.snapshot);else if(result&&typeof result.initialized==='boolean')update(result);
        // Feedback is based on the returned authoritative state, never optimistic wallet or fruit changes.
        if(payload.action==='harvest'&&picked>beforePicked){note=result?.message||'收获 '+(picked-beforePicked)+' 颗果实，都收进篮子啦！';if(openPanel)setPanel(null);before.forEach((item,slot)=>{if(item&&!visibleFruits.some(f=>f&&String(f.id)===String(item.id)))showPickEffect(slot);});feedback('harvest');}
        else if(payload.action==='care'&&growth>previousGrowth){note=result?.message||supplies[payload.kind].name+'完成，果树长大了 '+(growth-previousGrowth)+' 点！';setPanel(null);feedback('care');}
        else if(payload.action==='spray'&&!bug){note=result?.message||'小虫搬走啦，果实一颗也没少。';setPanel(null);feedback('care');}
        else if(initializing&&snapshot?.initialized){note='果树种好啦，每一次努力都会留下来。';el('home').focus({preventScroll:true});feedback('care');}
      }catch(error){
        if(destroyed)return;const message=error?.message||'这次没有完成，请稍后再试。';options.error=message;
        if(initializing){el('initialize-error').textContent=message;el('initialize-error').hidden=false;}
      }finally{
        localBusy=false;if(!destroyed){render();if(!root.hidden&&focused?.classList.contains('gt-fruit-target')&&!focused.isConnected){const next=el('fruit-targets').querySelector('button:not(:disabled)')||root.querySelector('[data-open-panel="harvest"]');next.focus({preventScroll:true});}}
      }
    }
    function setPanel(name,trigger){
      openPanel=name;if(trigger)panelTrigger=trigger;el('panel-layer').hidden=!name;root.querySelector('.gt-head').inert=!!name;
      root.querySelectorAll('[data-panel-content]').forEach(part=>part.hidden=part.dataset.panelContent!==name);
      root.querySelectorAll('[data-open-panel]').forEach(button=>button.setAttribute('aria-expanded',String(button.dataset.openPanel===name)));
      render();
      if(name){el('panel-title').textContent={growth:'成长记录',harvest:'我的收成',shop:'照料果树'}[name];el('close-panel').focus({preventScroll:true});}
      else if(!root.hidden){const target=panelTrigger?.isConnected?panelTrigger:el('home');target.focus({preventScroll:true});panelTrigger=null;}
    }
    function focusable(scope){return [...scope.querySelectorAll('a[href],button:not(:disabled),input:not(:disabled),[tabindex="0"]')].filter(node=>node.getClientRects().length&&!node.closest('[inert]'));}
    function keydown(event){
      // Only the detail sheet is modal. The page keeps normal browser navigation.
      if(root.hidden||!openPanel)return;
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setPanel(null);return;}
      if(event.key==='Tab'){const scope=el('details'),nodes=focusable(scope),first=nodes[0],last=nodes[nodes.length-1];if(!first){event.preventDefault();return;}if(event.shiftKey&&(document.activeElement===first||!scope.contains(document.activeElement))){event.preventDefault();last.focus();}else if(!event.shiftKey&&(document.activeElement===last||!scope.contains(document.activeElement))){event.preventDefault();first.focus();}}
    }
    function open(next,patch={}){
      if(destroyed)return;
      root.hidden=false;update(next,patch);scheduleDraw();
    }
    function close(){
      if(root.hidden||destroyed)return;
      openPanel=null;panelTrigger=null;el('panel-layer').hidden=true;root.querySelector('.gt-head').inert=false;root.querySelectorAll('[data-open-panel]').forEach(button=>button.setAttribute('aria-expanded','false'));root.hidden=true;
      if(typeof config.onClose==='function')config.onClose();
    }
    root.querySelectorAll('[data-open-panel]').forEach(button=>button.addEventListener('click',()=>setPanel(button.dataset.openPanel,button)));
    root.querySelectorAll('[data-supply]').forEach(button=>button.addEventListener('click',()=>runAction({action:'care',kind:button.dataset.supply})));
    el('spray').addEventListener('click',()=>runAction({action:'spray'}));el('harvest').addEventListener('click',()=>runAction({action:'harvest'}));el('harvest-panel').addEventListener('click',()=>runAction({action:'harvest'}));
    el('login').addEventListener('click',()=>{if(typeof config.onLogin==='function')config.onLogin();});el('close-panel').addEventListener('click',()=>setPanel(null));
    el('retry').addEventListener('click',async()=>{if(typeof config.onRetry!=='function'||options.loading||options.retrying||localBusy)return;try{await config.onRetry();}catch(error){if(!destroyed){options.error=error?.message||'暂时无法同步，请稍后再试。';render();}}});
    el('panel-layer').addEventListener('click',event=>{if(event.target===el('panel-layer'))setPanel(null);});
    el('initial-earned').addEventListener('input',()=>{initialInputTouched=true;});
    el('initialize-confirm').addEventListener('click',()=>{const raw=el('initial-earned').value,value=Number(raw);if(!raw.trim()||!Number.isSafeInteger(value)||value<0||value>1000000000){el('initialize-error').textContent='请填写 0 到 10 亿之间的整数积分。';el('initialize-error').hidden=false;el('initial-earned').focus();return;}runAction({action:'initialize',earned:value});});
    el('return').addEventListener('click',()=>{pageOffset=0;viewport.scrollTop=0;scheduleDraw();});
    el('older').addEventListener('click',()=>{pageOffset=Math.min(pageOffset+MAX_CROWNS,Math.max(0,level()-1));viewport.scrollTop=0;scheduleDraw();el('return').hidden=false;el('return').focus({preventScroll:true});});
    el('newer').addEventListener('click',()=>{pageOffset=Math.max(0,pageOffset-MAX_CROWNS);viewport.scrollTop=0;scheduleDraw();el('home').focus({preventScroll:true});});
    viewport.tabIndex=0;viewport.addEventListener('scroll',scheduleDraw,{passive:true});root.addEventListener('keydown',keydown);
    const resizeObserver=typeof ResizeObserver==='function'?new ResizeObserver(scheduleDraw):null;resizeObserver?.observe(viewport);global.addEventListener('resize',scheduleDraw);
    function destroy(){if(destroyed)return;close();destroyed=true;resizeObserver?.disconnect();global.removeEventListener('resize',scheduleDraw);global.cancelAnimationFrame(drawFrame);global.clearTimeout(messageTimer);root.remove();}
    return {open,update,close,destroy};
  }
  global.GuoguoFruitTree={create};
})(window);
