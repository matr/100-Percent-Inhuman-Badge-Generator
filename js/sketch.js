// Press 's' to save a badge!

p5.disableFriendlyErrors = true;

/* ===== Config ===== */
const CANVAS_MAX=400, GRID_MIN=4, GRID_MAX=76;
const PHRASES=[
  '100% Inhuman','100% Inhuman Made','100% Inhuman Made Art',
  '100% Inhuman Made: AI Used','100% Inhuman Made: Some AI Used','100% Inhuman: Made With AI'
];
const LEADING_RATIO=0.35, MIN_FONT_SIZE=12, ALIGN_OPTS=['left','center','right'];
const LETTER_SPACING='-0.05em'; // Adjust this to control letter spacing

const LARGE_100_PROB=0, LARGE_100_RANGE=[1.2,1.8]; // Disabled varying sizes

/* ===== State ===== */
let S, FONT, cols=4, rows=4, grid=[], palette=[], phrase='', seed=0;
let layout=null;

/* ===== Setup ===== */
function preload(){ FONT=loadFont('assets/SpaceGrotesk-Medium.ttf'); }
function setup(){
  S=min(CANVAS_MAX, min(windowWidth,windowHeight));
  createCanvas(S,S); pixelDensity(2); noStroke(); textFont(FONT); rectMode(CORNERS);
  textStyle(NORMAL);
  noLoop(); regen(); redraw();
}

/* ===== Frame ===== */
function draw(){
  background(255);
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
    fill(palette[r*cols+c]); 
    const x0=(c*width)/cols, y0=(r*height)/rows;
    rect(Math.round(x0),Math.round(y0),Math.round(x0+width/cols),Math.round(y0+height/rows));
  }
  drawPhrase(phrase);
  
  // Instructions text below canvas
  push();
  fill(100);
  noStroke();
  textSize(10);
  textAlign(CENTER);
  drawingContext.letterSpacing = '0em';
  text('press s to save a badge', width/2, height + 15);
  pop();
}

function mousePressed(){ regen(); redraw(); }
function keyPressed(){ 
  if(key==='s'||key==='S'){ 
    const t=nf(year(),4)+nf(month(),2)+nf(day(),2)+'_'+nf(hour(),2)+nf(minute(),2)+nf(second(),2); 
    saveCanvas(`inhuman_badge_${t}`,'jpg'); 
  }
}

/* ===== Regenerate ===== */
function regen(){
  const N=int(random(GRID_MIN,GRID_MAX+1)); const fs=[];
  for(let i=GRID_MIN;i*i<=N;i++) if(N%i===0 && N/i>=GRID_MIN){ fs.push([i,N/i],[N/i,i]); }
  [cols,rows]=(fs.length? random(fs):[4,4]).map(v=>int(v));
  
  grid=Array.from({length:rows*cols},()=>int(random(2)));
  if(!grid.includes(0)||!grid.includes(1)){ const a=int(random(grid.length)), b=(a+1)%grid.length; grid[a]=0; grid[b]=1; }
  
  const pair = makeTwoColorPalette();
  palette=grid.map(v=> pair[v]);
  seed=int(random(1e9));
  phrase=random(PHRASES);
  layout=null;
}

/* ===== Text engine with grid-aware placement ===== */
function drawPhrase(str){
  if(layout){ render(layout); return; }
  
  const maxW=width, maxH=height, toks=str.trim().split(/\s+/).filter(Boolean);
  const cellW = width / cols, cellH = height / rows;
  
  // Find longest word to size text so it fills width
  push();
  drawingContext.letterSpacing = LETTER_SPACING;
  
  let longestWord = toks[0];
  for(const tok of toks){
    if(tok.length > longestWord.length) longestWord = tok;
  }
  
  // Size text so longest word is close to full width
  let size = MIN_FONT_SIZE;
  let testSize = maxW * 0.5; // Start with reasonable guess
  
  for(let iter=0; iter<20; iter++){
    textSize(testSize);
    const w = textWidth(longestWord);
    if(abs(w - maxW * 0.95) < 5) break; // Close enough
    testSize *= (maxW * 0.95) / w;
  }
  
  size = max(testSize, MIN_FONT_SIZE);
  pop();
  
  let L=null;

  for(let tries=0; tries<70 && !L; tries++){
    textSize(size); 
    textLeading(size*LEADING_RATIO);
    
    push();
    drawingContext.letterSpacing = LETTER_SPACING;
    const asc=textAscent(), dsc=textDescent(), lh=textLeading();
    const sp=textWidth(' ');

    // Greedy line break
    const lines=[]; { 
      let line=[], w0=0;
      for(const t of toks){ 
        const w=textWidth(t);
        if(!line.length||w0+sp+w<=maxW){ line.push(t); w0=(line.length===1?w:w0+sp+w); }
        else{ lines.push(line); line=[t]; w0=w; }
      }
      if(line.length) lines.push(line);
    }

    const rots=[], scales=[], widths=[], heights=[];
    
    for(let i=0;i<lines.length;i++){
      const W=lines[i], rs=[], ss=[], ws=[];
      for(let j=0;j<W.length;j++){
        rs.push(0); ss.push(1); ws.push(textWidth(W[j]));
      }
      let lineW=sum(ws)+sp*max(0,W.length-1);

      if(lineW>maxW){
        const scaleDown=maxW/lineW;
        for(let j=0;j<ss.length;j++){ ss[j]*=scaleDown; ws[j]=textWidth(W[j])*ss[j]; }
        lineW=sum(ws)+sp*max(0,W.length-1);
      }

      rots.push(rs); scales.push(ss); widths.push(lineW);
      let h=0; 
      for(let j=0;j<W.length;j++){ 
        h=max(h, ss[j]*(asc+dsc)); 
      }
      heights.push(max(lh,h));
    }
    
    pop();

    let totalH=sum(heights);

    if(totalH>maxH){
      size*=maxH/totalH;
      continue;
    }

    // Grid-aware alignment choices
    const aligns=lines.map((_,i)=> pick(ALIGN_OPTS,seed+1000+i));
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
  
  // Calculate total block height with tighter spacing
  const totalH = sum(L.heights);
  
  // Choose a random vertical starting position aligned to grid
  const maxStartRow = max(0, rows - Math.ceil(totalH / cellH));
  const startRow = int(rnd(seed + 5000, 0, maxStartRow + 1));
  let yCur = startRow * cellH;

  for (let i = 0; i < L.lines.length; i++) {
    const W = L.lines[i], R = L.rots[i], S = L.scales[i];
    const lineW = L.widths[i], h = L.heights[i];

    // Horizontal alignment to grid with more variety
    let x = 0;
    if (L.aligns[i] === 'center') {
      const idealX = (width - lineW) / 2;
      const offset = int(rnd(seed + 6000 + i, -1, 2)) * cellW;
      x = Math.round((idealX + offset) / cellW) * cellW;
    } else if (L.aligns[i] === 'right') {
      const idealX = width - lineW;
      const offset = int(rnd(seed + 6100 + i, -1, 2)) * cellW;
      x = Math.round((idealX + offset) / cellW) * cellW;
    } else {
      const offset = int(rnd(seed + 6200 + i, 0, 3)) * cellW;
      x = offset;
    }

    // Clamp horizontally
    if (x < 0) x = 0;
    if (x + lineW > width) x = width - lineW;

    // Draw line with tighter letter spacing
    push();
    drawingContext.letterSpacing = LETTER_SPACING;
    drawLineRS(W, R, S, x, yCur);
    pop();

    // Use much tighter vertical spacing
    yCur += h * 0.75;
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

function drawWordRS(w,rot,s,x,yTop,asc,dsc){
  push();
  translate(x, yTop+s*asc); 
  scale(s); 
  text(w,0,0);
  pop();
}

const inlineW=(w,rot,s,asc,dsc)=> s*textWidth(w);
const sum=arr=>arr.reduce((a,b)=>a+b,0);

/* ===== Palette generator ===== */
function makeTwoColorPalette() {
  const band = random([
    [50, 95],   [10, 35],   [320, 350], 
    [95, 160],  [200, 230]
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
function rnd(s,a=0,b=1){
  let t=(s+0x6D2B79F5)>>>0; t=Math.imul(t^(t>>>15),1|t); t^=t+Math.imul(t^(t>>>7),61|t);
  const r=((t^(t>>>14))>>>0)/4294967296; return a+r*(b-a);
}
function pick(arr,s){ return arr[int(rnd(s,0,arr.length))]; }
