// Press 's' to save a badge!

p5.disableFriendlyErrors = true;

/* ===== Config ===== */
const CANVAS_MAX=400, GRID_MIN=4, GRID_MAX=76;
const PHRASES=[
  '100% Inhuman','100% Inhuman Made','100% Inhuman Made Art',
  '100% Inhuman Made: AI Used','100% Inhuman Made: Some AI Used','100% Inhuman: Made With AI'
];
const LEADING_RATIO=0.9, MIN_FONT_SIZE=8, ALIGN_OPTS=['left','center','right','justify'];

// Only "100%" may rotate/scale
const ROTATE_100_PROB=0.75, LARGE_100_PROB=0.65, LARGE_100_RANGE=[1.2,1.8];

/* ===== State ===== */
let S, FONT, cols=4, rows=4, grid=[], palette=[], phrase='', seed=0;
let layout=null; // {lines, rots, scales, widths, heights, aligns, size}

/* ===== Setup ===== */
function preload() {
  FONT = loadFont('assets/SpaceGrotesk-Medium.ttf');
}
function setup(){
  S=min(CANVAS_MAX, min(windowWidth,windowHeight));
  createCanvas(S,S); pixelDensity(2); noStroke(); textFont(FONT); rectMode(CORNERS);
  noLoop(); regen(); redraw();
}

/* ===== Frame ===== */
function draw(){
  background(255);
  // Background grid
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
    fill(palette[r*cols+c]); 
    const x0=(c*width)/cols, y0=(r*height)/rows;
    rect(Math.round(x0),Math.round(y0),Math.round(x0+width/cols),Math.round(y0+height/rows));
  }
  // Text
  drawPhrase(phrase);
}

function mousePressed(){ regen(); redraw(); }
function keyPressed(){ if(key==='s'||key==='S'){ const t=nf(year(),4)+nf(month(),2)+nf(day(),2)+'_'+nf(hour(),2)+nf(minute(),2)+nf(second(),2); saveCanvas(`inhuman_badge_${t}`,'jpg'); }}

/* ===== Regenerate ===== */
function regen(){
  // grid dims (compact “pick factors”)
  const N=int(random(GRID_MIN,GRID_MAX+1)); const fs=[];
  for(let i=GRID_MIN;i*i<=N;i++) if(N%i===0 && N/i>=GRID_MIN){ fs.push([i,N/i],[N/i,i]); }
  [cols,rows]=(fs.length? random(fs):[4,4]).map(v=>int(v));
  // grid colors (ensure both exist)
  grid=Array.from({length:rows*cols},()=>int(random(2)));
  if(!grid.includes(0)||!grid.includes(1)){ const a=int(random(grid.length)), b=(a+1)%grid.length; grid[a]=0; grid[b]=1; }
  // new palette from generator
  const pair = makeTwoColorPalette();
  palette=grid.map(v=> pair[v]);
  seed=int(random(1e9));
  phrase=random(PHRASES);
  layout=null;
}

/* ===== Text engine (with fit fix) ===== */
function drawPhrase(str){
  if(layout){ render(layout); return; }
  const maxW=width, maxH=height, toks=str.trim().split(/\s+/).filter(Boolean);
  const base=min(maxW,maxH);
  let bias=(toks.length<=2)? rnd(seed,0.70,1.15) : (toks.length<=4? rnd(seed+1,0.55,1.00): rnd(seed+2,0.42,0.90));
  let size=max(base*bias,MIN_FONT_SIZE), L=null;

  for(let tries=0; tries<70 && !L; tries++){
    textSize(size); textLeading(size*LEADING_RATIO);
    const asc=textAscent(), dsc=textDescent(), lh=textLeading();

    // greedy line break
    const lines=[]; { let line=[], w0=0, sp=textWidth(' ');
      for(const t of toks){ const w=textWidth(t);
        if(!line.length||w0+sp+w<=maxW){ line.push(t); w0=(line.length===1?w:w0+sp+w); }
        else{ lines.push(line); line=[t]; w0=w; }
      }
      if(line.length) lines.push(line);
    }

    const rots=[], scales=[], widths=[], heights=[];
    const sp=textWidth(' ');
    for(let i=0;i<lines.length;i++){
      const W=lines[i], rs=[], ss=[], ws=[];
      for(let j=0;j<W.length;j++){
        let rot=0, s=1;
        if(W[j]==='100%'){
          if(rnd(seed+8000+i*97+j*131)<LARGE_100_PROB) s=rnd(seed+8100+i*71+j*157,LARGE_100_RANGE[0],LARGE_100_RANGE[1]);
          if(rnd(seed+8200+i*53+j*241)<ROTATE_100_PROB) rot=(rnd(seed+8300+i*59+j*199)<.5)?90:-90;
        }
        rs.push(rot); ss.push(s); ws.push(inlineW(W[j],rot,s,asc,dsc));
      }
      let lineW=sum(ws)+sp*max(0,W.length-1);

      // 🔒 clamp line width
      if(lineW>maxW){
        const scaleDown=maxW/lineW;
        for(let j=0;j<ss.length;j++){ ss[j]*=scaleDown; ws[j]=inlineW(W[j],rs[j],ss[j],asc,dsc); }
        lineW=sum(ws)+sp*max(0,W.length-1);
      }

      rots.push(rs); scales.push(ss); widths.push(lineW);
      let h=0; for(let j=0;j<W.length;j++){ h=max(h, rs[j]==0? ss[j]*(asc+dsc) : ss[j]*textWidth(W[j]) ); }
      heights.push(max(lh,h));
    }

    let totalH=sum(heights);

    // 🔒 clamp total block height
    if(totalH>maxH){
      const scaleDown=maxH/totalH;
      size*=scaleDown;
      continue; // retry with smaller base size
    }

    const aligns=lines.map((_,i)=> (i===lines.length-1? pick(['left','center','right'],seed+1000+i) : pick(ALIGN_OPTS,seed+1000+i)));
    L={lines, rots, scales, widths, heights, aligns, size};
  }

  layout=L||layout;
  render(layout);
}

function render(L){
  textSize(L.size); 
  textLeading(L.size*LEADING_RATIO);
  fill('#FFFFFF'); 
  blendMode(DIFFERENCE);

  const cellW = width / cols;
  const cellH = height / rows;

  let yTop = 0;
  let prevBottom = 0;

  for (let i = 0; i < L.lines.length; i++) {
    const W = L.lines[i], R = L.rots[i], S = L.scales[i];
    const lineW = L.widths[i], h = L.heights[i];

    // ---- X alignment, snapped to grid ----
    let x = 0;
    if (L.aligns[i] === 'center') {
      x = Math.round(((width - lineW) / 2) / cellW) * cellW;
    } else if (L.aligns[i] === 'right') {
      x = Math.round((width - lineW) / cellW) * cellW;
    } else {
      x = 0; // left-align
    }

    // Clamp horizontally
    if (x < 0) x = 0;
    if (x + lineW > width) x = width - lineW;

    // ---- Y alignment, snapped to grid, avoiding overlap ----
    let ySnap = Math.round(yTop / cellH) * cellH;
    if (i > 0 && ySnap < prevBottom) {
      ySnap = Math.ceil(prevBottom / cellH) * cellH;
    }
    if (ySnap + h > height) ySnap = height - h;

    // ---- Draw ----
    if (L.aligns[i] === 'justify' && W.length > 1 && i < L.lines.length - 1) {
      drawJustifyRS(W, R, S, 0, ySnap, width);
    } else {
      drawLineRS(W, R, S, x, ySnap);
    }

    prevBottom = ySnap + h;
    yTop += h;
  }

  blendMode(BLEND);
}


/* ===== Drawing helpers ===== */
function drawLineRS(W,R,S,x,yTop){
  let cur=x, sp=textWidth(' '), asc=textAscent(), dsc=textDescent();
  for(let i=0;i<W.length;i++){
    drawWordRS(W[i],R[i],S[i],cur,yTop,asc,dsc);
    cur+=inlineW(W[i],R[i],S[i],asc,dsc); if(i<W.length-1) cur+=sp;
  }
}
function drawJustifyRS(W,R,S,x,yTop,tw){
  const asc=textAscent(), dsc=textDescent(), base=sum(W.map((w,i)=>inlineW(w,R[i],S[i],asc,dsc)));
  const gaps=W.length-1, gap=(tw-base)/gaps; let cur=x;
  for(let i=0;i<W.length;i++){
    drawWordRS(W[i],R[i],S[i],cur,yTop,asc,dsc);
    cur+=inlineW(W[i],R[i],S[i],asc,dsc); if(i<W.length-1) cur+=gap;
  }
}
function drawWordRS(w,rot,s,x,yTop,asc,dsc){
  const adv=s*(asc+dsc); push();
  if(rot===0){ translate(x, yTop+s*asc); scale(s); text(w,0,0); }
  else if(rot===90){ translate(x, yTop); rotate(HALF_PI); scale(s); text(w,0,0); }
  else { translate(x+adv, yTop); rotate(-HALF_PI); scale(s); text(w,0,0); }
  pop();
}
const inlineW=(w,rot,s,asc,dsc)=> s*(rot===0? textWidth(w) : (asc+dsc));
const sum=arr=>arr.reduce((a,b)=>a+b,0);

/* ===== Palette generator (from first sketch) ===== */
function makeTwoColorPalette() {
  const band = random([
    [50, 95],   // olives / mustard
    [10, 35],   // rust / brown
    [320, 350], // maroon-ish
    [95, 160],  // military greens
    [200, 230]  // muted blue-greys
  ]);
  const base = {
    h: random(band[0], band[1]),
    s: random(30, 60),
    l: random(28, 48)
  };
  let acc, tries = 0;
  do {
    const scheme = random(['complement', 'split', 'offset']);
    let h = base.h;
    if (scheme === 'complement') h += random([178, 180, 182]);
    else if (scheme === 'split')  h += random([150, 210]);
    else                          h += random([110,120,240,250]);
    acc = { h, s: random(85, 100), l: random(55, 72) };
    tries++;
  } while (hueGap(base.h, acc.h) < 110 && tries < 32);

  const c0 = hsl255(base.h, base.s, base.l);
  const c1 = hsl255(acc.h,  acc.s,  acc.l);
  return random() < 0.5 ? [c0, c1] : [c1, c0];
}

const wrap360 = h => ((h % 360) + 360) % 360;
const hueGap = (a, b) => {
  const d = Math.abs(wrap360(a) - wrap360(b));
  return d > 180 ? 360 - d : d;
};
function hsl255(h, s, l) {
  h = wrap360(h) / 360; s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const k = (n + h * 12) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
  };
  return color(f(0) * 255, f(8) * 255, f(4) * 255);
}

/* ===== Utils ===== */
function rnd(s,a=0,b=1){ // Mulberry32
  let t=(s+0x6D2B79F5)>>>0; t=Math.imul(t^(t>>>15),1|t); t^=t+Math.imul(t^(t>>>7),61|t);
  const r=((t^(t>>>14))>>>0)/4294967296; return a+r*(b-a);
}
function pick(arr,s){ return arr[int(rnd(s,0,arr.length))]; }
