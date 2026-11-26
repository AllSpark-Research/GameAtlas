export function mountReplay(camera, cameraReference) {
const panel = document.querySelector('#behavior-panel');
const tabs = document.querySelector('#behavior-tabs');
const fishRoot = 'assets/replay/fish/';
const b2Root = 'assets/replay/b2/';
const cases = [
  {
    label: 'Camera · Sol', title: 'Living & dining room', model: 'GPT-6.1-Sol', brand: 'openai',
    reference: cameraReference, submissions: camera,
    notes: ['Match shelf corners and chair feet','Use chair silhouettes to refine the fit','Align the shelf edges','Adjust the pose using chair feet','Set camera height and remove roll'],
    regions: [[.16,.27,.76,.60],[.50,.49,.45,.38],[.15,.35,.21,.38],[.55,.73,.20,.12],[.15,.35,.21,.38]],
    positions: [[115,180],[360,335],[278,265],[300,510],[278,265]]
  },
  {
    label: 'Image-to-mesh · Kimi', title: 'Fish reconstruction', model: 'Kimi-K3.1-Pro', brand: 'kimi',
    reference: fishRoot + 'reference-side.webp',
    viewBox: [900, 620],
    inspections: [
      'Trace the reference silhouette',
      'Inspect the ridges along the flank',
      'Inspect · The body still breaks into flat bands',
      'Inspect · Compare the head and gill outline',
      'Inspect · Check where the fins meet the body'
    ],
    submissions: [49.30,54.41,61.50,64.88,65.04].map((score, i) => ({score, image: fishRoot + (i + 1) + '.webp?v=side1'})),
    notes: ['Build the first mesh from the reference views','Relax the ridges along the body','Remesh and check the silhouette','Refine the head and gill contour','Check the final fin and body profiles'],
    regions: [[.07,.20,.86,.60],[.33,.43,.34,.20],[.09,.21,.82,.58],[.09,.41,.29,.27],[.42,.20,.42,.50]]
  },
  {
    label: 'Animation · Astra', title: 'B2 battle droid', model: 'GPT-6-Astra', brand: 'openai',
    reference: b2Root + 'reference.webp', referenceMotion: b2Root + '0.webp',
    viewBox: [600, 600], inspectTime: 6000, duration: 12000,
    submissions: [61.49,70.00,81.94,87.48,87.92].map((score, i) => ({score, image: b2Root + (i + 1) + '.webp'})),
    inspections: [
      'Watch one full stride in the reference',
      'Compare the legs\nthrough the stride',
      'Check each\nhand angle',
      'Check the pose against individual frames',
      'Compare the two\nstride cycles'
    ],
    notes: [
      'Fit the first stride to tracked landmarks',
      'Fit and smooth\nthe silhouette',
      'Refine the wrists\nand hand poses',
      'Refit joint angles frame by frame',
      'Smooth corrections\nacross both cycles'
    ],
    regions: [[.26,.12,.48,.79],[.32,.54,.38,.36],[.30,.42,.36,.20],[.28,.14,.44,.73],[.32,.53,.38,.37]],
    positions: [[36,54],[182,336],[170,264],[32,68],[182,330]]
  }
];
const q = selector => panel.querySelector(selector);
const drawTime = 1400;
let duration, inspectTime, peekTime = 0;
let active, data, pts, step = 0, elapsed = 0, playing = !matchMedia('(prefers-reduced-motion: reduce)').matches, visible = false, last = 0, peek = false;
tabs.innerHTML = cases.map(item => `<button type="button">${item.label}</button>`).join('');
const frameSize = 300;
const sheetFrames = 12;
const motionFrames = 72;
// A one-second sheet can be decoded while the preceding 12 frames play.
// Keep decoded images for the current layers and their adjacent seconds.
const sheets = new Map();
const stills = new Map();
function stillImage(url) {
  if (!stills.has(url)) {
    const image = new Image();
    image.src = url;
    stills.set(url, image);
  }
  return stills.get(url);
}
function motionSheet(source, slot) {
  const name = source.split('/').pop().replace('.webp', '');
  const url = b2Root + 'frames/' + name + '-' + slot + '.webp';
  let image = sheets.get(url);
  if (!image) {
    image = new Image();
    image.decoding = 'async';
    image.src = url;
    // A paused replay has no animation tick to draw an image that arrives later.
    image.ready = image.decode().catch(() => {
      // Keep the original full animation as a fallback if a segment cannot be read.
      image.dataset.fullSheet = 'true';
      image.src = source;
      return image.decode();
    }).then(() => {
      if (active.referenceMotion && visible && !document.hidden) paint();
      return true;
    }, () => false);
    if (sheets.size >= 12) sheets.delete(sheets.keys().next().value);
  } else {
    sheets.delete(url);
  }
  sheets.set(url, image);
  return image;
}
// Keep the time cursor on the last displayed frame while a visible layer buffers.
function visibleMedia(item, index, time, referenceOnly = false, withOutline = true) {
  const inspect = item.inspectTime || 3000;
  const previous = referenceOnly || index === 0
    ? (item.referenceMotion || item.reference)
    : item.submissions[index - 1].image;
  const sources = [];
  if (referenceOnly || time < inspect + drawTime) sources.push(previous);
  if (!referenceOnly && time > inspect) sources.push(item.submissions[index].image);
  if (!item.referenceMotion) return sources.map(stillImage);
  if (withOutline && !referenceOnly && (index > 0 || time > inspect)) {
    sources.push(b2Root + 'gt-outline.webp');
  }
  const frame = Math.floor(time * 12 / 1000) % motionFrames;
  return sources.map(source => motionSheet(source, Math.floor(frame / sheetFrames)));
}
let intent = 0;
let awaitingMedia = false;
function clearBufferWait() {
  ++intent;
  awaitingMedia = false;
  panel.removeAttribute('aria-busy');
}
function whenReady(images, show) {
  const version = ++intent;
  const waiting = images.filter(image => !image.complete || !image.naturalWidth);
  if (!waiting.length) {
    awaitingMedia = false;
    panel.removeAttribute('aria-busy');
    show();
    return;
  }
  awaitingMedia = true;
  panel.setAttribute('aria-busy', 'true');
  scheduleTick();
  Promise.all(waiting.map(image => image.ready || image.decode().then(() => true, () => false)))
    .then(results => {
      if (version !== intent) return;
      awaitingMedia = false;
      panel.removeAttribute('aria-busy');
      if (results.every(Boolean)) show();
      else {
        // Explicit replay controls can retry even if the browser stays online.
        for (const [key, image] of sheets) if (!image.naturalWidth) sheets.delete(key);
        for (const [key, image] of stills) if (!image.naturalWidth) stills.delete(key);
        playing = false;
        syncPlayButton();
      }
      last = 0;
      scheduleTick();
    });
}
function seek(index, pause = false) {
  index = (index + data.length) % data.length;
  const time = pause || !playing ? inspectTime + drawTime : 0;
  const outline = q('.motion-gt-control input')?.checked;
  whenReady(visibleMedia(active, index, time, false, outline), () => {
    if (pause) playing = false;
    setup(index);
    syncPlayButton();
    scheduleTick();
  });
}
function motionLayer(id, label) {
  return `<canvas id="${id}" class="motion-layer" width="300" height="300" role="img" aria-label="${label}"></canvas>`;
}
function showMotion(layer, source, frame) {
  const slot = Math.floor(frame / sheetFrames);
  const image = motionSheet(source, slot);
  const cell = frame % sheetFrames;
  if (image.complete && image.naturalWidth && (layer.frame !== frame || layer.source !== source)) {
    const ctx = layer.getContext('2d');
    ctx.clearRect(0, 0, frameSize, frameSize);
    const sourceCell = image.dataset.fullSheet ? frame : cell;
    const columns = image.dataset.fullSheet ? 8 : 4;
    ctx.drawImage(image, (sourceCell % columns) * frameSize, Math.floor(sourceCell / columns) * frameSize,
      frameSize, frameSize, 0, 0, frameSize, frameSize);
    layer.frame = frame;
    layer.source = source;
  }
  if (playing && visible && !document.hidden && cell >= 4) {
    motionSheet(source, (slot + 1) % (motionFrames / sheetFrames));
  }
}
function selectCase(index) {
  active = cases[index];
  data = active.submissions;
  duration = active.duration || 7200;
  inspectTime = active.inspectTime || 3000;
  pts = data.map((d,i) => [40+i*93,235-d.score*2.35]);
  peek = false;
  last = 0;
  panel.dataset.case = active.referenceMotion ? 'b2' : active.brand;
  Array.from(tabs.children).forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
panel.innerHTML=`<div class="replay-chart"><div class="replay-heading"><h3>${active.title}</h3><span class="replay-agent"><img src="brand/${active.brand}.svg" alt="">${active.model}</span></div><div class="replay-score"><strong id="replay-score">0.00</strong><span>/ 100</span></div><svg class="replay-plot" viewBox="0 0 452 280" aria-label="Five online submission scores"><path d="M40 235H412" class="plot-baseline"/><path id="replay-line"/><circle id="replay-cursor" r="5"/>${pts.map((p,i)=>`<g class="replay-point" data-step="${i}" role="button" tabindex="0" aria-label="Submission ${i+1}, score ${data[i].score.toFixed(2)}"><circle cx="${p[0]}" cy="${p[1]}" r="17" fill="transparent"/><circle class="plot-dot" cx="${p[0]}" cy="${p[1]}" r="4"/><text class="dot-score" x="${p[0]}" y="${p[1]-16}" text-anchor="middle">${data[i].score.toFixed(2)}</text><text class="dot-index" x="${p[0]}" y="264" text-anchor="middle">${i+1}</text></g>`).join('')}</svg><div class="replay-navigation"><button id="replay-prev" aria-label="Previous submission">←</button><button id="replay-play" aria-label="Pause replay">Ⅱ</button><button id="replay-next" aria-label="Next submission">→</button><span id="replay-counter">01 / 05</span></div><div class="replay-progress"><i></i></div></div><div class="replay-film"><div class="replay-frame">${active.referenceMotion ? motionLayer('replay-before', 'Previous motion or reference') + motionLayer('replay-image', 'Current submission motion') + motionLayer('replay-gt', 'Ground truth outline') : '<img id="replay-before" alt="Previous submission"><img id="replay-image" alt="Current submission">'}<svg class="replay-overlay" viewBox="0 0 ${(active.viewBox || [720,720]).join(' ')}" preserveAspectRatio="${active.viewBox ? 'xMidYMid meet' : 'xMidYMid slice'}" aria-hidden="true"><rect id="replay-region" rx="4"/><path id="replay-guides"/><text id="replay-note"></text></svg><button class="reference-peek" aria-label="Show reference"><img src="${active.reference}" alt="Reference view"><span>Reference ↗</span></button>${active.referenceMotion ? '<label class="motion-gt-control"><input type="checkbox" checked> Cyan GT</label>' : ''}</div></div>`;
  bindControls();
  setup(0);
  syncPlayButton();
  scheduleTick();
}
function setup(i) {
  step = (i + data.length) % data.length;
  elapsed = playing ? 0 : inspectTime + drawTime;
  if (!active.referenceMotion) q('#replay-image').src = data[step].image;
  q('#replay-counter').textContent = `0${step + 1} / 05`;
  const region = q('#replay-region');
  active.regions[step].forEach((v, j) => region.setAttribute(['x','y','width','height'][j], v * (active.viewBox?.[j % 2] || 720)));
  q('#replay-guides').setAttribute('d', active === cases[0] && (step === 2 || step === 4) ? 'M112 300H252M112 350H252M112 400H252M112 450H252' : '');
  const note = q('#replay-note');
  note.textContent = active.notes[step];
  delete note.dataset.message;
  const [x, y] = active.positions?.[step] || [
    Number(region.getAttribute('x')),
    Number(region.getAttribute('y')) - 12
  ];
  note.setAttribute('x', x);
  note.setAttribute('y', y);
  panel.dataset.step = step;
  paint();
  warmNextStill();
}
function paint() {
  const progress = Math.max(0, Math.min(1, (elapsed - inspectTime) / drawTime));
  const t = 1 - Math.pow(1 - progress, 3);
  const previous = step ? pts[step - 1] : [pts[0][0], 235];
  const now = previous.map((v, axis) => v + (pts[step][axis] - v) * t);
  const chain = pts.slice(0, step).concat([now]);
  q('#replay-line').setAttribute('d', chain.map((p,i) => (i ? 'L' : 'M') + p.join(' ')).join(' '));
  q('#replay-cursor').setAttribute('cx', now[0]);
  q('#replay-cursor').setAttribute('cy', now[1]);
  const inspecting = elapsed < inspectTime;
  const previousScore = step ? data[step - 1].score : 0;
  const score = (previousScore + (data[step].score - previousScore) * t).toFixed(2);
  if (active.inspections) {
    const caption = q('#replay-note');
    const message = peek ? 'Reference' : inspecting ? active.inspections[step] : active.notes[step];
    if (caption.dataset.message !== message) {
      caption.dataset.message = message;
      const lines = message.split('\n');
      caption.setAttribute('text-anchor', lines.length > 1 ? 'end' : 'start');
      caption.replaceChildren(...lines.map((line, i) => {
        const span = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
        span.setAttribute('x', caption.getAttribute('x'));
        span.setAttribute('dy', i ? '1.2em' : '0');
        span.textContent = line;
        return span;
      }));
    }
  }
  q('#replay-score').textContent = score;
  q('#replay-image').style.opacity = peek ? 0 : t;
  const source = peek || !step ? (active.referenceMotion || active.reference) : data[step - 1].image;
  const before = q('#replay-before');
  if (active.referenceMotion) {
    const frame = Math.floor((peek ? peekTime : elapsed) * 12 / 1000) % 72;
    if (peek || t < 1) showMotion(before, source, frame);
    if (!peek && t > 0) showMotion(q('#replay-image'), data[step].image, frame);
    if (playing && visible && !document.hidden && !peek && inspecting && elapsed >= inspectTime - 1000) {
      motionSheet(data[step].image, Math.floor((Math.floor(inspectTime * 12 / 1000) % motionFrames) / sheetFrames));
      if (q('.motion-gt-control input').checked) motionSheet(b2Root + 'gt-outline.webp', 0);
    }
    const outline = q('#replay-gt');
    const showOutline = !peek && (step > 0 || t > 0) && q('.motion-gt-control input').checked;
    outline.style.visibility = showOutline ? 'visible' : 'hidden';
    if (showOutline) showMotion(outline, b2Root + 'gt-outline.webp', frame);
  } else if ((peek || t < 1) && before.getAttribute('src') !== source) {
    before.src = source;
  }
  before.style.visibility = !peek && t === 1 ? 'hidden' : 'visible';
  const openingReference = active.inspections && !step && progress < 1;
  if (active.inspections) {
    before.style.opacity = peek ? 1 : 1 - t;
    q('#replay-region').style.visibility = openingReference ? 'hidden' : 'visible';
  }
  q('.replay-overlay').style.opacity = peek ? 0 : 1;
  q('.replay-progress i').style.width = (elapsed / duration * 100) + '%';
  panel.querySelectorAll('.replay-point').forEach((point, i) => {
    point.classList.toggle('reached', i < step || (i === step && progress === 1));
    point.classList.toggle('selected', i === step);
  });
  panel.dataset.phase = inspecting ? 'inspect' : 'submit';
}
function syncPlayButton(){q('#replay-play').textContent=playing?'Ⅱ':'▶';q('#replay-play').setAttribute('aria-label',playing?'Pause replay':'Play replay');}
function bindControls(){
  for (const button of panel.querySelectorAll('[data-step],#replay-prev,#replay-next')) {
    const warm = () => {
      const index = button.hasAttribute('data-step') ? Number(button.dataset.step) :
        (step + (button.id === 'replay-prev' ? -1 : 1) + data.length) % data.length;
      const jump = button.hasAttribute('data-step') || !playing;
      warmIntent(active, index, jump ? inspectTime + drawTime : 0);
    };
    button.onpointerenter = warm;
    button.onfocus = warm;
  }
  if (active.referenceMotion) q('.motion-gt-control input').onchange = paint;
q('#replay-play').onclick=()=>{clearBufferWait();playing=!playing;syncPlayButton();scheduleTick()};q('#replay-prev').onclick=()=>seek(step-1);q('#replay-next').onclick=()=>seek(step+1);
panel.querySelectorAll('[data-step]').forEach(b=>{const go=()=>seek(+b.dataset.step, true);b.onclick=go;b.onkeydown=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();go()}}});
q('.reference-peek').onclick=()=>{
  const showReference = !peek;
  const outline = q('.motion-gt-control input')?.checked;
  whenReady(visibleMedia(active, step, elapsed, showReference, outline), () => {
    peek = showReference;
    peekTime = elapsed;
    q('.reference-peek').classList.toggle('active',peek);
    q('.reference-peek').setAttribute('aria-pressed',peek);
    scheduleTick();
    paint();
  });
};
}
// Prepare only the next small still, after the selected delivery has decoded.
function warmNextStill() {
  if (!visible || document.hidden || active.referenceMotion || navigator.connection?.saveData) return;
  const item = active;
  const current = step;
  q('#replay-image').decode().then(() => {
    if (!visible || document.hidden || active !== item || step !== current) return;
    stillImage(data[(current + 1) % data.length].image).fetchPriority = 'low';
  }).catch(() => {});
}
function warmIntent(item, index, time) {
  if (document.hidden || navigator.connection?.saveData) return;
  if (item !== active) stillImage(item.reference);
  visibleMedia(item, index, time);
}
Array.from(tabs.children).forEach((button, index) => {
  const item = cases[index];
  button.onclick = () => {
    stillImage(item.reference);
    const time = playing ? 0 : (item.inspectTime || 3000) + drawTime;
    whenReady(visibleMedia(item, 0, time), () => selectCase(index));
  };
  const warm = () => {
    if (item !== active) warmIntent(item, 0, playing ? 0 : (item.inspectTime || 3000) + drawTime);
  };
  button.onpointerenter = warm;
  button.onfocus = warm;
});
let frameRequest = 0;
function scheduleTick() {
  if (visible && playing && !awaitingMedia && !document.hidden && (!peek || active.referenceMotion)) {
    if (!frameRequest) frameRequest = requestAnimationFrame(tick);
  } else {
    cancelAnimationFrame(frameRequest);
    frameRequest = 0;
    last = 0;
  }
}
new IntersectionObserver(([entry]) => {
  visible = entry.isIntersecting;
  if (visible && !document.hidden) { paint(); warmNextStill(); }
  last = 0;
  scheduleTick();
}, {threshold: .2}).observe(panel);
document.addEventListener('visibilitychange', () => {
  last = 0;
  if (visible && !document.hidden) paint();
  scheduleTick();
});
function tick(ts) {
  frameRequest = 0;
  if (last && playing && visible && !document.hidden) {
    const delta = Math.min(ts - last, 100);
    const time = (peek ? peekTime : elapsed) + delta;
    const advanceStep = !peek && time >= duration;
    const nextStep = advanceStep ? (step + 1) % data.length : step;
    const nextTime = advanceStep ? 0 : time;
    const outline = q('.motion-gt-control input')?.checked;
    const frames = visibleMedia(active, nextStep, nextTime, peek, outline);
    if (frames.some(image => !image.complete || !image.naturalWidth)) {
      whenReady(frames, () => {});
      return;
    }
    if (advanceStep) setup(nextStep);
    else {
      if (peek) peekTime = nextTime;
      else elapsed = nextTime;
      paint();
    }
  }
  last = ts;
  scheduleTick();
}
selectCase(0);
}
