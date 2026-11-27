import './opiniones.js?v=3';
import {createVideoController} from './lib/video-portada.mjs';

const video = document.getElementById('portada-video');
const button = document.getElementById('portada-video-control');
const hero = document.querySelector('.portada-hero');
if (video && button && hero) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = matchMedia('(max-width: 767px)');
  const connection = navigator.connection;
  const allowAutoplay = () => !reduced.matches && !mobile.matches && !connection?.saveData;
  const status = document.getElementById('portada-video-status');
  let failureAnnounced = false;
  const controller = createVideoController(video, {
    src:video.dataset.src,
    autoPlay:allowAutoplay(),
    onState(state) {
      const active = state.playing || state.loading;
      const label = active ? button.dataset.pause : state.failed ? button.dataset.retry : button.dataset.play;
      button.querySelector('[data-video-label]').textContent = label;
      button.querySelector('.video-symbol').textContent = active ? 'Ⅱ' : '▶';
      hero.classList.toggle('has-video', video.readyState >= 2 && !state.failed);
      if (state.failed && !failureAnnounced) {
        status.textContent = status.dataset.error;
        failureAnnounced = true;
      }
      if (!state.failed) failureAnnounced = false;
    }
  });
  button.hidden = false;
  button.addEventListener('click', () => {
    const state = controller.getState();
    if (state.playing || state.loading) {
      controller.pause();
      status.textContent = status.dataset.paused;
    } else {
      status.textContent = status.dataset.playing;
      controller.play();
    }
  });
  controller.setPageVisible(document.visibilityState !== 'hidden');
  document.addEventListener('visibilitychange', () => controller.setPageVisible(document.visibilityState !== 'hidden'));
  const updatePolicy = () => controller.setAutoPlay(allowAutoplay());
  reduced.addEventListener('change', updatePolicy);
  mobile.addEventListener('change', updatePolicy);
  connection?.addEventListener('change', updatePolicy);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => controller.setVisible(entries[0].isIntersecting), {threshold:0}).observe(hero);
  } else {
    controller.setVisible(true);
  }
}
