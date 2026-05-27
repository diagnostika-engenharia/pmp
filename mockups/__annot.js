/* ═══════════════════════════════════════════════════════════════════════
   FERRAMENTA DE ANOTAÇÃO — caneta + caixa de texto sobre mockups
   Inclua via: <script src="__annot.js"></script> no final do <body>
   ═══════════════════════════════════════════════════════════════════════ */
(function(){
  // ────────────────────────────────────────────────────────────────────
  // CSS injetado
  // ────────────────────────────────────────────────────────────────────
  const css = `
#annot-canvas{position:absolute;top:0;left:0;pointer-events:none;z-index:9000}
#annot-canvas.active{pointer-events:auto;cursor:crosshair}
#annot-toolbar{position:fixed;bottom:18px;right:18px;z-index:9999;background:#1a1a1a;border-radius:12px;padding:7px;display:flex;gap:4px;box-shadow:0 6px 24px rgba(0,0,0,.4);align-items:center;font-family:'Segoe UI',system-ui,sans-serif;user-select:none}
#annot-toolbar button{width:36px;height:36px;border-radius:8px;background:transparent;border:none;color:#fff;cursor:pointer;font-size:15px;display:flex;align-items:center;justify-content:center;transition:background .12s;font-family:inherit}
#annot-toolbar button:hover{background:rgba(255,255,255,.12)}
#annot-toolbar button.active{background:#00B4AC;color:#fff;box-shadow:0 0 0 2px rgba(0,180,172,.4)}
#annot-toolbar .sw{width:24px;height:24px;border-radius:50%;border:2px solid rgba(255,255,255,.25);cursor:pointer;transition:transform .12s,border-color .12s;flex-shrink:0}
#annot-toolbar .sw:hover{transform:scale(1.1)}
#annot-toolbar .sw.active{border-color:#fff;transform:scale(1.15);box-shadow:0 0 8px rgba(255,255,255,.5)}
#annot-toolbar .sep{width:1px;height:24px;background:rgba(255,255,255,.2);margin:0 3px;flex-shrink:0}
#annot-indicator{position:fixed;top:18px;left:50%;transform:translateX(-50%);z-index:9999;background:rgba(0,180,172,.95);color:#fff;font-size:11.5px;font-weight:700;padding:7px 14px;border-radius:20px;box-shadow:0 4px 12px rgba(0,0,0,.2);display:none;font-family:'Segoe UI',system-ui,sans-serif;letter-spacing:.3px;text-transform:uppercase}
#annot-indicator.show{display:block}
.annot-box{position:absolute;background:linear-gradient(180deg,#FFEB3B,#FFD54F);color:#3B2A0A;border:2px solid #F9A825;border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,.28);z-index:8999;min-width:160px;min-height:70px;font-family:'Segoe UI',system-ui,sans-serif;display:flex;flex-direction:column;overflow:hidden}
.annot-box.color-blue{background:linear-gradient(180deg,#BBDEFB,#90CAF9);border-color:#1976D2;color:#0D47A1}
.annot-box.color-green{background:linear-gradient(180deg,#C8E6C9,#A5D6A7);border-color:#388E3C;color:#1B5E20}
.annot-box.color-red{background:linear-gradient(180deg,#FFCDD2,#EF9A9A);border-color:#C00000;color:#7B0000}
.annot-box.color-white{background:#fff;border-color:#888;color:#1A2E31}
.annot-handle{background:rgba(0,0,0,.12);padding:5px 8px;font-size:11px;font-weight:700;cursor:move;display:flex;align-items:center;gap:6px;user-select:none;text-transform:uppercase;letter-spacing:.3px}
.annot-handle .ttl{flex:1;font-size:10px}
.annot-handle .colors{display:flex;gap:3px}
.annot-handle .csw{width:14px;height:14px;border-radius:50%;cursor:pointer;border:1.5px solid rgba(0,0,0,.2);transition:transform .1s}
.annot-handle .csw:hover{transform:scale(1.15)}
.annot-handle .csw.active{border-color:rgba(0,0,0,.6);box-shadow:0 0 0 2px rgba(255,255,255,.5)}
.annot-handle .close{cursor:pointer;width:18px;height:18px;background:rgba(0,0,0,.2);color:#fff;border-radius:50%;text-align:center;line-height:18px;font-size:12px;font-weight:800;flex-shrink:0;display:flex;align-items:center;justify-content:center}
.annot-handle .close:hover{background:#C00000}
.annot-text{flex:1;border:none;background:transparent;padding:8px 10px;font-family:inherit;font-size:13px;color:inherit;resize:none;outline:none;line-height:1.4;font-weight:500}
.annot-text::placeholder{color:rgba(0,0,0,.35);font-style:italic;font-weight:400}
.annot-resize{position:absolute;bottom:0;right:0;width:14px;height:14px;cursor:nwse-resize;background:linear-gradient(135deg,transparent 50%,rgba(0,0,0,.25) 50%);border-radius:0 0 6px 0}
.text-mode-cursor{cursor:text!important}
.text-mode-cursor *{cursor:text!important}
`;
  const style=document.createElement('style');
  style.textContent=css;
  document.head.appendChild(style);

  // ────────────────────────────────────────────────────────────────────
  // HTML: toolbar + canvas
  // ────────────────────────────────────────────────────────────────────
  const canvas=document.createElement('canvas');
  canvas.id='annot-canvas';
  document.body.appendChild(canvas);

  const indicator=document.createElement('div');
  indicator.id='annot-indicator';
  indicator.textContent='✏️ Modo desenho ativo · ESC ou D para sair';
  document.body.appendChild(indicator);

  const toolbar=document.createElement('div');
  toolbar.id='annot-toolbar';
  toolbar.innerHTML=`
    <button id="dt-pen" title="Caneta (D)">✏️</button>
    <button id="dt-text" title="Nova caixa de texto (T)">📝</button>
    <span class="sep"></span>
    <div class="sw active" data-color="#ff2020" style="background:#ff2020" title="Vermelho"></div>
    <div class="sw" data-color="#0066ff" style="background:#0066ff" title="Azul"></div>
    <div class="sw" data-color="#00aa44" style="background:#00aa44" title="Verde"></div>
    <div class="sw" data-color="#ffcc00" style="background:#ffcc00" title="Amarelo"></div>
    <div class="sw" data-color="#000000" style="background:#000000" title="Preto"></div>
    <span class="sep"></span>
    <button id="dt-thin" title="Fina (1)" style="font-size:22px;line-height:1">·</button>
    <button id="dt-mid" class="active" title="Média (2)" style="font-size:18px;line-height:1">•</button>
    <button id="dt-thick" title="Grossa (3)" style="font-size:20px;line-height:1">⬤</button>
    <span class="sep"></span>
    <button id="dt-eraser" title="Borracha (E)">⌫</button>
    <button id="dt-undo" title="Desfazer (Ctrl+Z)">↶</button>
    <button id="dt-clear" title="Limpar tudo">🗑</button>
    <span class="sep"></span>
    <button id="dt-save" title="Salvar PNG">💾</button>
  `;
  document.body.appendChild(toolbar);

  const ctx=canvas.getContext('2d');
  let mode='none'; // 'none' | 'pen' | 'text'
  let isDrawing=false,color='#ff2020',lineWidth=4,isErasing=false;
  let strokes=[],currentStroke=null;

  function resize(){
    const dpr=window.devicePixelRatio||1;
    const w=document.documentElement.scrollWidth;
    const h=document.documentElement.scrollHeight;
    canvas.style.width=w+'px';
    canvas.style.height=h+'px';
    canvas.width=w*dpr;
    canvas.height=h*dpr;
    ctx.setTransform(1,0,0,1,0,0);
    ctx.scale(dpr,dpr);
    redraw();
  }
  function redraw(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    strokes.forEach(s=>{
      ctx.globalCompositeOperation=s.erase?'destination-out':'source-over';
      ctx.strokeStyle=s.color;
      ctx.lineWidth=s.width;
      ctx.lineCap='round';
      ctx.lineJoin='round';
      ctx.beginPath();
      s.points.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y));
      ctx.stroke();
    });
  }
  function getCanvasPos(e){
    const rect=canvas.getBoundingClientRect();
    const t=e.touches?e.touches[0]:e;
    return {x:t.clientX-rect.left,y:t.clientY-rect.top};
  }
  canvas.addEventListener('pointerdown',e=>{
    if(mode!=='pen')return;
    e.preventDefault();
    isDrawing=true;
    const p=getCanvasPos(e);
    currentStroke={color,width:lineWidth,erase:isErasing,points:[p]};
    strokes.push(currentStroke);
  });
  canvas.addEventListener('pointermove',e=>{
    if(!isDrawing)return;
    e.preventDefault();
    const p=getCanvasPos(e);
    currentStroke.points.push(p);
    ctx.globalCompositeOperation=isErasing?'destination-out':'source-over';
    ctx.strokeStyle=color;
    ctx.lineWidth=lineWidth;
    ctx.lineCap='round';
    ctx.lineJoin='round';
    const prev=currentStroke.points[currentStroke.points.length-2];
    ctx.beginPath();
    ctx.moveTo(prev.x,prev.y);
    ctx.lineTo(p.x,p.y);
    ctx.stroke();
  });
  function endStroke(){isDrawing=false;currentStroke=null;}
  canvas.addEventListener('pointerup',endStroke);
  canvas.addEventListener('pointerleave',endStroke);
  canvas.addEventListener('pointercancel',endStroke);

  // ────────────────────────────────────────────────────────────────────
  // Modes
  // ────────────────────────────────────────────────────────────────────
  function setMode(m){
    mode=m;
    canvas.classList.toggle('active',m==='pen');
    document.body.classList.toggle('text-mode-cursor',m==='text');
    document.getElementById('dt-pen').classList.toggle('active',m==='pen');
    document.getElementById('dt-text').classList.toggle('active',m==='text');
    indicator.classList.toggle('show',m==='pen'||m==='text');
    if(m==='pen') indicator.textContent='✏️ Modo desenho · ESC ou D para sair';
    else if(m==='text') indicator.textContent='📝 Modo texto · clique onde quer adicionar nota';
  }
  document.getElementById('dt-pen').addEventListener('click',()=>setMode(mode==='pen'?'none':'pen'));
  document.getElementById('dt-text').addEventListener('click',()=>setMode(mode==='text'?'none':'text'));

  // Click no body em modo texto → cria caixa
  document.addEventListener('click',e=>{
    if(mode!=='text')return;
    if(e.target.closest('#annot-toolbar'))return;
    if(e.target.closest('.annot-box'))return;
    if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.target.tagName==='BUTTON')return;
    e.preventDefault();
    e.stopPropagation();
    createTextBox(e.clientX,e.clientY+window.scrollY);
    setMode('none');
  },true);

  // ────────────────────────────────────────────────────────────────────
  // Text boxes
  // ────────────────────────────────────────────────────────────────────
  let boxCounter=0;
  function createTextBox(x,y,text='',w=240,h=110,colorCls=''){
    const box=document.createElement('div');
    box.className='annot-box '+(colorCls||'');
    box.style.left=(x-10)+'px';
    box.style.top=(y-10)+'px';
    box.style.width=w+'px';
    box.style.height=h+'px';
    const id='nb-'+(++boxCounter);
    box.dataset.id=id;
    box.innerHTML=`
      <div class="annot-handle">
        <span class="ttl">📝 Nota</span>
        <div class="colors">
          <div class="csw active" data-cls="" style="background:#FFD54F" title="Amarelo"></div>
          <div class="csw" data-cls="color-blue" style="background:#90CAF9" title="Azul"></div>
          <div class="csw" data-cls="color-green" style="background:#A5D6A7" title="Verde"></div>
          <div class="csw" data-cls="color-red" style="background:#EF9A9A" title="Vermelho"></div>
          <div class="csw" data-cls="color-white" style="background:#fff;border-color:#888" title="Branco"></div>
        </div>
        <div class="close" title="Excluir nota">×</div>
      </div>
      <textarea class="annot-text" placeholder="Digite aqui sua sugestão..."></textarea>
      <div class="annot-resize" title="Arrastar para redimensionar">↘</div>
    `;
    document.body.appendChild(box);

    // Auto-focus textarea
    const ta=box.querySelector('.annot-text');
    if(text) ta.value=text;
    setTimeout(()=>ta.focus(),50);

    // Drag pelo handle
    const handle=box.querySelector('.annot-handle');
    let dragging=false,dragOffX=0,dragOffY=0;
    handle.addEventListener('pointerdown',e=>{
      if(e.target.closest('.close')||e.target.closest('.csw'))return;
      dragging=true;
      dragOffX=e.clientX-box.offsetLeft;
      dragOffY=e.clientY-(box.offsetTop-window.scrollY);
      handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener('pointermove',e=>{
      if(!dragging)return;
      box.style.left=(e.clientX-dragOffX)+'px';
      box.style.top=(e.clientY-dragOffY+window.scrollY)+'px';
    });
    handle.addEventListener('pointerup',e=>{dragging=false;handle.releasePointerCapture(e.pointerId);});

    // Resize
    const rh=box.querySelector('.annot-resize');
    let resizing=false,resOrigX=0,resOrigY=0,resOrigW=0,resOrigH=0;
    rh.addEventListener('pointerdown',e=>{
      resizing=true;
      resOrigX=e.clientX;resOrigY=e.clientY;
      resOrigW=box.offsetWidth;resOrigH=box.offsetHeight;
      rh.setPointerCapture(e.pointerId);
      e.stopPropagation();
    });
    rh.addEventListener('pointermove',e=>{
      if(!resizing)return;
      const dx=e.clientX-resOrigX;
      const dy=e.clientY-resOrigY;
      box.style.width=Math.max(140,resOrigW+dx)+'px';
      box.style.height=Math.max(60,resOrigH+dy)+'px';
    });
    rh.addEventListener('pointerup',e=>{resizing=false;rh.releasePointerCapture(e.pointerId);});

    // Color swatches
    box.querySelectorAll('.csw').forEach(s=>{
      s.addEventListener('click',()=>{
        box.classList.remove('color-blue','color-green','color-red','color-white');
        if(s.dataset.cls) box.classList.add(s.dataset.cls);
        box.querySelectorAll('.csw').forEach(o=>o.classList.remove('active'));
        s.classList.add('active');
      });
    });

    // Close
    box.querySelector('.close').addEventListener('click',()=>{
      if(ta.value.trim()&&!confirm('Excluir esta nota com texto?'))return;
      box.remove();
    });

    return box;
  }

  // Color swatches da toolbar
  document.querySelectorAll('#annot-toolbar .sw').forEach(s=>{
    s.addEventListener('click',()=>{
      color=s.dataset.color;
      isErasing=false;
      document.querySelectorAll('#annot-toolbar .sw').forEach(o=>o.classList.remove('active'));
      s.classList.add('active');
      document.getElementById('dt-eraser').classList.remove('active');
      if(mode!=='pen') setMode('pen');
    });
  });

  function setSize(w,id){
    lineWidth=w;
    ['dt-thin','dt-mid','dt-thick'].forEach(i=>document.getElementById(i).classList.toggle('active',i===id));
  }
  document.getElementById('dt-thin').addEventListener('click',()=>setSize(2,'dt-thin'));
  document.getElementById('dt-mid').addEventListener('click',()=>setSize(4,'dt-mid'));
  document.getElementById('dt-thick').addEventListener('click',()=>setSize(8,'dt-thick'));

  document.getElementById('dt-eraser').addEventListener('click',()=>{
    isErasing=!isErasing;
    document.getElementById('dt-eraser').classList.toggle('active',isErasing);
    if(mode!=='pen') setMode('pen');
  });
  document.getElementById('dt-undo').addEventListener('click',()=>{strokes.pop();redraw();});
  document.getElementById('dt-clear').addEventListener('click',()=>{
    const hasBoxes=document.querySelectorAll('.annot-box').length>0;
    if(strokes.length===0&&!hasBoxes){alert('Nada para limpar.');return;}
    if(confirm('Limpar TODOS os rascunhos e notas?')){
      strokes=[];redraw();
      document.querySelectorAll('.annot-box').forEach(b=>b.remove());
    }
  });

  // Save PNG — usa html2canvas se disponível pra capturar TUDO (mockup + drawings + notas)
  // Senão, salva só os desenhos do canvas
  document.getElementById('dt-save').addEventListener('click',async()=>{
    const btn=document.getElementById('dt-save');
    const hasBoxes=document.querySelectorAll('.annot-box').length>0;

    if(typeof html2canvas==='function'){
      // Hide toolbar temporarily
      btn.disabled=true;
      btn.textContent='⏳';
      toolbar.style.display='none';
      indicator.style.display='none';
      try{
        const result=await html2canvas(document.body,{
          useCORS:true,scale:1,backgroundColor:'#F4F8F9',
          windowWidth:document.documentElement.scrollWidth,
          windowHeight:document.documentElement.scrollHeight
        });
        const link=document.createElement('a');
        const ts=new Date().toISOString().slice(0,16).replace(/[:T]/g,'-');
        link.download='rascunho-mockup-'+ts+'.png';
        link.href=result.toDataURL('image/png');
        link.click();
      }catch(err){
        console.error('html2canvas falhou:',err);
        alert('Captura falhou. Salvando só os desenhos.');
        const link=document.createElement('a');
        link.download='rascunho-'+Date.now()+'.png';
        link.href=canvas.toDataURL('image/png');
        link.click();
      }finally{
        toolbar.style.display='flex';
        if(mode==='pen'||mode==='text') indicator.style.display='block';
        btn.disabled=false;
        btn.textContent='💾';
      }
    } else {
      // Fallback: só desenhos
      if(strokes.length===0&&!hasBoxes){alert('Nada para salvar.');return;}
      if(hasBoxes){
        alert('html2canvas não carregou. Salvando só os desenhos (sem caixas de texto).\nUse Print Screen do Windows pra captura completa.');
      }
      const link=document.createElement('a');
      link.download='rascunho-'+Date.now()+'.png';
      link.href=canvas.toDataURL('image/png');
      link.click();
    }
  });

  // Keyboard
  document.addEventListener('keydown',e=>{
    if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA')return;
    if(e.key==='Escape'){setMode('none');}
    else if(e.key==='d'||e.key==='D'){setMode(mode==='pen'?'none':'pen');}
    else if(e.key==='t'||e.key==='T'){setMode(mode==='text'?'none':'text');}
    else if(e.key==='e'||e.key==='E'){document.getElementById('dt-eraser').click();}
    else if(e.key==='1'){setSize(2,'dt-thin');}
    else if(e.key==='2'){setSize(4,'dt-mid');}
    else if(e.key==='3'){setSize(8,'dt-thick');}
    else if((e.ctrlKey||e.metaKey)&&e.key==='z'){e.preventDefault();strokes.pop();redraw();}
  });

  window.addEventListener('resize',resize);
  setTimeout(resize,100);
  setTimeout(resize,1000);

  // Carrega html2canvas de CDN (assíncrono — pode estar disponível ao clicar Save)
  if(typeof html2canvas!=='function'){
    const s=document.createElement('script');
    s.src='https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    s.async=true;
    document.head.appendChild(s);
  }

  console.log('🖊 Ferramenta de anotação carregada. Atalhos: D=caneta · T=texto · E=borracha · Ctrl+Z=desfazer · ESC=sair');
})();
