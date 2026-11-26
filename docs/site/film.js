(() => {
  const frame = document.getElementById('benchmark-video');
  const launch = frame.querySelector('.film-launch');
  const image = launch.querySelector('img');
  const video = frame.querySelector('video');
  const status = frame.querySelector('[role="status"]');
  const url = frame.dataset.playlist;
  let stream = null;
  let attempt = 0;

  function loadCover() {
    if (!image.hasAttribute('src')) image.src = image.dataset.src;
  }

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        loadCover();
        observer.disconnect();
      }
    }, {rootMargin: '100px 0px'});
    observer.observe(frame);
  } else {
    image.loading = 'lazy';
    loadCover();
  }

  function retry(id) {
    if (id !== attempt) return;
    ++attempt;
    video.onerror = null;
    stream?.destroy();
    stream = null;
    video.removeAttribute('src');
    video.load();
    video.hidden = true;
    launch.hidden = false;
    status.textContent = 'The video could not load.';
    launch.querySelector('.film-action').textContent = 'Try again';
    launch.setAttribute('aria-label', 'Retry playing the GameAtlas overview video');
    launch.focus({preventScroll: true});
  }

  function play(id) {
    video.play().catch(error => {
      // If a browser requires a second gesture, its native play control is available.
      if (error.name !== 'NotAllowedError' && error.name !== 'AbortError') retry(id);
    });
  }

  async function attachStream(id) {
    video.onerror = null;
    try {
      const {default: Hls} = await import('./vendor/hls-light-1.7.4.min.mjs');
      if (id !== attempt) return;
      if (!Hls.isSupported()) return retry(id);
      stream = new Hls({capLevelToPlayerSize: true, startLevel: 0, maxBufferLength: 8, maxMaxBufferLength: 12});
      stream.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) retry(id);
      });
      stream.on(Hls.Events.MANIFEST_PARSED, () => play(id));
      stream.loadSource(url);
      stream.attachMedia(video);
    } catch {
      retry(id);
    }
  }

  launch.addEventListener('click', () => {
    const id = ++attempt;
    status.textContent = '';
    loadCover();
    video.poster = image.src;
    launch.hidden = true;
    video.hidden = false;
    video.focus({preventScroll: true});
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.onerror = () => {
        // Some browsers advertise native HLS but cannot play this playlist.
        if (id === attempt) attachStream(id);
      };
      video.src = url;
      video.play().catch(error => {
        if (id === attempt && error.name !== 'NotAllowedError' && error.name !== 'AbortError' && !video.error) retry(id);
      });
    } else {
      attachStream(id);
    }
  });
})();
