// These independent sections can initialize when a reader approaches them.
const sections = new Map([
  [document.getElementById('evaluation'), () => import('./evidence.js')],
  [document.getElementById('agent-behavior'), () => import('./replay.js?v=webp1')],
  [document.getElementById('model-notes'), () => import('./model-notes.js')]
]);
const loading = new Set();
const observer = new IntersectionObserver(entries => {
  for (const {target, isIntersecting} of entries) {
    if (!isIntersecting || loading.has(target)) continue;
    loading.add(target);
    sections.get(target)()
      .then(() => observer.unobserve(target))
      .catch(error => console.error('Could not load section', target.id, error))
      .finally(() => loading.delete(target));
  }
}, {rootMargin: '300px 0px'});
for (const section of sections.keys()) observer.observe(section);
