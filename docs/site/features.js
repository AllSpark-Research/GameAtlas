const cases=window.GAMEATLAS_TOUR;
const deckIds={
 animation:['animation-expert-13-v1','animation-expert-10-v1','animation-expert-01-v1','animation-ronin-stow-v1'],
 mesh:['mesh-i2m-expert-03-v1','mesh-i2m-expert-59-v1','mesh-i2m-nailong-v1','mesh-i2m-expert-60-v1'],
 uv:['008','010','002','006'].map(n=>'mesh-uv-'+n+'-r04')
};
const decks=Object.fromEntries(Object.entries(deckIds).map(([kind,ids])=>[kind,ids.map(id=>[id,cases.find(item=>item.id===id).case])]));
let viewer;
let viewerPromise;
function loadViewer() {
 return viewerPromise ??= import('./vendor/public-viewer.js?v=live2').then(module => viewer = module).catch(error => {
  viewerPromise = null;
  throw error;
 });
}
const ROTATION_MS=5000;
const meshReferences={"mesh-i2m-nailong-v1":"nailong","mesh-i2m-expert-03-v1":"ironman","mesh-i2m-expert-59-v1":"nier","mesh-i2m-expert-60-v1":"silksong"};
function reference(id) {
 const name = meshReferences[id] + '-reference.glb';
 return viewer.loadGLB((id === 'mesh-i2m-expert-03-v1' ? 'assets/fast/showcase/' : 'assets/fast/') + name);
}
function uvReference(id){return viewer.loadGLB(id === 'mesh-uv-008-r04' ? 'assets/fast/showcase/helmet-reference.glb' : 'assets/fast/'+id+'-textured.glb')}
async function prepareUV(id){
 const selected=cases.find(c=>c.id===id).display;
 const canvas=new Image();canvas.src=`case-assets/${selected.model}/${id}/${selected.showcaseUvImage || selected.uvImage}`;
 const [model]=await Promise.all([uvReference(id),canvas.decode()]);return {model,canvas};
}
function scoreCard(card,id){
 const i=cases.findIndex(c=>c.id===id),item=cases[i],model=item.display.model;
 const r=window.GAMEATLAS_CASE_DATA.tasks[id][model],name=window.GAMEATLAS_CASE_DATA.models.find(m=>m.id===model).name;
 card.dataset.previewCase=id;card.querySelector('.feature-model').innerHTML=modelIdentity(name);
 card.querySelector('.feature-score').innerHTML=`${item.display.submission ? r.examples[0].score.toFixed(1) : Number.isFinite(r.score)?r.score.toFixed(1):'—'} <small>/ 100${item.display.submission ? " · Submission 1" : ""}</small>`;card.querySelectorAll('.inspect-case').forEach(b=>{b.setAttribute('aria-label',`Inspect ${item.case}: ${name}`);b.onclick=()=>{card.dataset.inspecting='true';window.openAtlasCase(i,b,decks[card.querySelector('[data-carousel]').dataset.carousel].map(([id])=>cases.findIndex(c=>c.id===id)))}})}
// Only warm the files for a visible card, using the same URLs and request modes as the viewer.
const warmed = new Set();
function warmFirstSlide(kind, task) {
 const {display} = cases.find(item => item.id === task);
 const root = 'case-assets/' + display.model + '/' + task + '/';
 const files = {
  animation: [root + display.showcaseModelFile, 'assets/fast/showcase/' + task + '/reference.glb.gz'],
  mesh: ['assets/fast/showcase/ironman-reference.glb.gz', root + display.heatModelFile],
  uv: ['assets/fast/showcase/helmet-reference.glb.gz', root + display.showcaseUvImage]
 };
 for (const href of files[kind]) {
  if (warmed.has(href)) continue;
  warmed.add(href);
  const link = document.createElement('link');
  link.rel = 'preload';
  link.href = href;
  link.as = href.endsWith('.webp') ? 'image' : 'fetch';
  if (link.as === 'fetch') link.crossOrigin = 'anonymous';
  document.head.append(link);
 }
}
function carousel(kind){const host=document.querySelector(kind==='animation'?'#feature-animation':kind==='mesh'?'#feature-heat':'#feature-uv'),controls=document.querySelector(`[data-carousel="${kind}"]`),card=host.closest('article'),status=card.querySelector('.switch-status');let index=-1,request=0,busy=false,paused=matchMedia('(prefers-reduced-motion: reduce)').matches,visible=false,nextAt=Infinity;const pointers=new Set(),keys=new Set();scoreCard(card,decks[kind][0][0]);document.querySelector(`#${kind}-name`).textContent=decks[kind][0][1];const restart=()=>{nextAt=performance.now()+ROTATION_MS};const stage = card.querySelector('.feature-stage');
 let stageInView = false;
 function startLiveView() {
  if (index === -1) load(0);
 }
 // Start the live scene when its card enters view. Only advance a mostly visible carousel.
 new IntersectionObserver(([entry]) => {
  const viewportHeight = entry.rootBounds?.height || window.innerHeight;
  const height = Math.min(entry.boundingClientRect.height, viewportHeight);
  visible = entry.isIntersecting && entry.intersectionRect.height >= height * .75;
  stageInView = entry.isIntersecting;
  if (stageInView && !document.hidden) startLiveView();
  restart();
 }, {threshold: [0, .75, 1]}).observe(stage);
 stage.addEventListener('pointerdown', startLiveView);
 stage.addEventListener('focusin', startLiveView);
 let ctx, gtCtx;
 function initialize() {
  ctx ??= viewer.stage(host);
  if(kind==='mesh' && !gtCtx) {
   gtCtx=viewer.stage(document.querySelector('#feature-mesh-gt'));
   gtCtx.linkControls(ctx);
   ctx.linked=true;
   gtCtx.autoRotate=ctx.autoRotate=true;
  }
 }
 const pending=new Map();function prepare(i){i=(i+decks[kind].length)%decks[kind].length;if(!pending.has(i))pending.set(i,(kind==='animation'?viewer.prepareAnimation(decks[kind][i][0]):kind==='uv'?prepareUV(decks[kind][i][0]):Promise.all([viewer.prepareHeat(decks[kind][i][0]),reference(decks[kind][i][0])])).catch(e=>{pending.delete(i);throw e}));return pending.get(i)}
 async function load(target) {
  target = (target + decks[kind].length) % decks[kind].length;
  const [id, name] = decks[kind][target];
  const mine = ++request;
  const stale = () => mine !== request;
  index = target;
  busy = true;
  nextAt = Infinity;
  card.setAttribute('aria-busy', 'true');
  status.hidden = true;
  if (target === 0) warmFirstSlide(kind, id);
  try {
   await loadViewer();
   if (stale()) return;
   const assets = await prepare(target);
   if (stale()) return;

   // Keep the displayed model and its score together until the replacement is ready.
   initialize();
   if (kind === 'uv') {
    const {model, canvas} = assets;
    ctx.set([viewer.cloneModel(model.scene)], null, {fill: .93, yaw: -.28});
    ctx.autoRotate = true;
    const dest = document.querySelector('#uv-islands');
    dest.width = canvas.width;
    dest.height = canvas.height;
    dest.getContext('2d').drawImage(canvas, 0, 0);
   } else if (kind === 'animation') {
    await viewer.mountAnimation(host, id, {ctx, stale});
    if (stale()) return;
    const toggle = card.querySelector('.gt-switch');
    toggle.checked = true;
    toggle.onchange = () => ctx.ghost(toggle.checked);
   } else {
    await viewer.mountHeat(host, id, {ctx, stale});
    if (stale()) return;
    const referenceModel = assets[1];
    const fill = {'mesh-i2m-expert-59-v1': 1.4, 'mesh-i2m-nailong-v1': 1.12, 'mesh-i2m-expert-60-v1': 1.5};
    gtCtx.set([viewer.cloneModel(referenceModel.scene)], null, {fill: fill[id] ?? .94});
    gtCtx.paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
   }
   ctx.paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
   card.dataset.index = String(target);
   document.querySelector('#' + kind + '-name').textContent = name;
   scoreCard(card, id);
   card.querySelectorAll('.case-dot').forEach((dot, i) => dot.setAttribute('aria-current', String(i === target)));
   card.dataset.interactive = 'true';
  } catch (error) {
   if (!stale()) {
    status.textContent = 'Could not load this model. Select its dot to retry.';
    status.hidden = false;
    console.warn(error);
   }
  } finally {
   if (!stale()) {
    busy = false;
    card.setAttribute('aria-busy', 'false');
    restart();
   }
  }
 }
 controls.querySelectorAll('[data-dir]').forEach(b=>b.onclick=()=>load(Math.max(index,0)+ +b.dataset.dir));const dots=card.querySelector('.case-dots');dots.innerHTML=decks[kind].map(([,n],i)=>`<button class="case-dot" aria-label="Show ${n}" aria-current="${i===0}" data-index="${i}"></button>`).join('');dots.querySelectorAll('button').forEach(b=>b.onclick=()=>load(+b.dataset.index));
 const pause=controls.querySelector('.carousel-pause');function sync(){pause.textContent=paused?'▷':'Ⅱ';pause.setAttribute('aria-pressed',String(paused));pause.setAttribute('aria-label',`${paused?'Play':'Pause'} ${kind} carousel`)}pause.onclick=()=>{paused=!paused;restart();sync()};sync();
 card.addEventListener('pointerdown',e=>{pointers.add(e.pointerId);nextAt=Infinity});
 const release=e=>{if(pointers.delete(e.pointerId))restart()};
 window.addEventListener('pointerup',release);window.addEventListener('pointercancel',release);card.addEventListener('lostpointercapture',release);
 card.addEventListener('wheel',restart,{passive:true});
 card.addEventListener('keydown',e=>{if(['Enter',' ','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','='].includes(e.key)){keys.add(e.key);nextAt=Infinity}});
 window.addEventListener('keyup',e=>{if(keys.delete(e.key))restart()});
 window.addEventListener('blur',()=>{pointers.clear();keys.clear();restart()});
 document.addEventListener('visibilitychange', () => {
  if (stageInView && !document.hidden) startLiveView();
  restart();
 });
 document.querySelector('#case-dialog').addEventListener('close',()=>{if(card.dataset.inspecting==='true'){delete card.dataset.inspecting;restart()}});
 setInterval(()=>{if(!visible||document.hidden||document.getElementById('case-dialog').open||busy||paused||pointers.size||keys.size||card.dataset.inspecting==='true')return;
 if(performance.now()>=nextAt)load(index+1);
 },100);
 card.querySelectorAll('[data-zoom]').forEach(b=>b.onclick=()=>{ctx?.zoom(+b.dataset.zoom)})
}
for (const kind of Object.keys(decks)) carousel(kind);
