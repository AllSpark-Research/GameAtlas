async function loadReplay() {
  const reference = 'assets/replay/reference.webp';
  for (const href of [reference, 'assets/replay/submission-1.webp']) {
    if (document.head.querySelector(`link[rel="preload"][href="${href}"]`)) continue;
    const hint = document.createElement('link');
    hint.rel = 'preload';
    hint.as = 'image';
    hint.href = href;
    document.head.append(hint);
  }
  const [replay, camera] = await Promise.all([
    import('./replay.js?v=stream2'),
    fetch('assets/replay/submissions.json').then(response => {
      if (!response.ok) throw new Error('Could not load replay scores');
      return response.json();
    })
  ]);
  replay.mountReplay(camera, reference);
}

// These independent sections can initialize when a reader approaches them.
const sections = new Map([
  [document.getElementById('evaluation'), () => import('./evidence.js')],
  [document.getElementById('agent-behavior'), loadReplay],
  [document.getElementById('model-notes'), () => import('./model-notes.js')]
]);
const loading = new Set();
const near = new Set();

function loadSection(target) {
  if (document.hidden || loading.has(target)) return;
  loading.add(target);
  sections.get(target)()
    .then(() => {
      near.delete(target);
      observer.unobserve(target);
    })
    .catch(error => {
      console.error('Could not load section', target.id, error);
      if (target.id === 'agent-behavior') {
        const panel = target.querySelector('#behavior-panel');
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.textContent = 'Retry loading replay';
        retry.onclick = () => loadSection(target);
        panel.replaceChildren(retry);
      }
    })
    .finally(() => loading.delete(target));
}
const observer = new IntersectionObserver(entries => {
  for (const {target, isIntersecting} of entries) {
    if (isIntersecting) {
      near.add(target);
      loadSection(target);
    } else {
      near.delete(target);
    }
  }
}, {rootMargin: '300px 0px'});
for (const section of sections.keys()) observer.observe(section);
window.addEventListener('online', () => near.forEach(loadSection));
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) near.forEach(loadSection);
});
