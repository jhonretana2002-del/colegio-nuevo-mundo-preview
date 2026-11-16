/* El controlador no depende del DOM global: se prueba también con reproducción asíncrona. */
export function createVideoController(video, {src, autoPlay = false, onState = () => {}}) {
  let intent = 'auto';
  let visible = false;
  let pageVisible = true;
  let failed = false;
  let loaded = false;
  let pending = null;
  let destroyed = false;
  const desired = () => !destroyed && !failed && visible && pageVisible &&
    (intent === 'play' || (intent === 'auto' && autoPlay));
  const state = () => ({intent, failed, loading:!!pending && desired(), playing:!video.paused && desired(), loaded});
  const notify = () => { if (!destroyed) onState(state()); };
  function sync() {
    if (destroyed) return;
    if (!desired()) {
      if (pending) pending.cancelled = true;
      video.pause();
      notify();
      return;
    }
    if (pending || !video.paused) { notify(); return; }
    if (!loaded) { video.src = src; loaded = true; }
    video.muted = true;
    const request = {cancelled:false};
    pending = request;
    let result;
    try { result = video.play(); } catch (error) { result = Promise.reject(error); }
    notify();
    Promise.resolve(result).then(() => {
      pending = null;
      if (!desired()) video.pause();
      notify();
    }, () => {
      pending = null;
      if (destroyed) return;
      if (request.cancelled) { sync(); return; }
      if (desired()) failed = true;
      video.pause();
      notify();
    });
  }
  const onPlaying = () => { if (!desired()) video.pause(); notify(); };
  const onPause = () => notify();
  const onError = () => { failed = true; video.pause(); notify(); };
  video.addEventListener('playing', onPlaying);
  video.addEventListener('pause', onPause);
  video.addEventListener('error', onError);
  notify();
  return {
    getState:state,
    setVisible(value) { visible = value; sync(); },
    setPageVisible(value) { pageVisible = value; sync(); },
    setAutoPlay(value) {
      autoPlay = value;
      if (intent !== 'pause') intent = 'auto';
      sync();
    },
    play() {
      intent = 'play';
      if (failed && loaded) video.load();
      failed = false;
      sync();
    },
    pause() { intent = 'pause'; sync(); },
    destroy() {
      destroyed = true;
      video.pause();
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('error', onError);
    }
  };
}
