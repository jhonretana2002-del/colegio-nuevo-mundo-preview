import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createVideoController} from '../lib/video-portada.mjs';

class Video extends EventTarget {
  paused = true;
  src = '';
  calls = 0;
  retries = 0;
  queue = [];
  play() {
    this.calls++;
    return new Promise((resolve,reject) => this.queue.push({resolve:() => {
      this.paused = false;
      this.dispatchEvent(new Event('playing'));
      resolve();
    },reject}));
  }
  pause() { this.paused = true; this.dispatchEvent(new Event('pause')); }
  load() { this.retries++; }
}
const tick = () => new Promise(resolve => setImmediate(resolve));
const setup = autoPlay => {
  const video = new Video();
  const control = createVideoController(video, {src:'/portada.mp4',autoPlay});
  return {video,control};
};

test('móvil, movimiento reducido o ahorro de datos no descargan video hasta la elección manual', async () => {
  const {video,control} = setup(false);
  control.setVisible(true);
  assert.equal(video.src, '');
  assert.equal(video.calls, 0);
  control.play();
  assert.equal(video.src, '/portada.mp4');
  assert.equal(video.muted, true);
  video.queue.shift().resolve(); await tick();
  assert.equal(control.getState().playing,true);
});

test('no reproduce ni carga fuera de la vista; evita llamadas de play duplicadas', () => {
  const {video,control} = setup(true);
  assert.equal(video.calls,0);
  control.setVisible(true);
  control.setVisible(true);
  control.setPageVisible(true);
  assert.equal(video.calls,1);
});

test('una promesa de play tardía no revoca la pausa del visitante', async () => {
  const {video,control} = setup(true);
  control.setVisible(true);
  control.pause();
  video.queue.shift().resolve(); await tick();
  assert.equal(video.paused,true);
  control.setVisible(false); control.setVisible(true);
  control.setPageVisible(false); control.setPageVisible(true);
  assert.equal(video.calls,1);
  assert.equal(control.getState().intent,'pause');
});

test('ocultar la pestaña pausa y regresar reanuda solo cuando se conserva la intención', async () => {
  const {video,control} = setup(true);
  control.setVisible(true); video.queue.shift().resolve(); await tick();
  control.setPageVisible(false);
  assert.equal(video.paused,true);
  control.setPageVisible(true);
  assert.equal(video.calls,2);
  video.queue.shift().resolve(); await tick();
  assert.equal(video.paused,false);
});

test('un bloqueo de autoplay no crea un bucle y permite reintentar manualmente', async () => {
  const {video,control} = setup(true);
  control.setVisible(true); video.queue.shift().reject(new Error('NotAllowed')); await tick();
  assert.equal(control.getState().failed,true);
  control.setVisible(false); control.setVisible(true);
  assert.equal(video.calls,1);
  control.play();
  assert.equal(video.retries,1);
  video.queue.shift().resolve(); await tick();
  assert.equal(control.getState().playing,true);
});

test('abortar play al salir y regresar antes del rechazo permite un nuevo intento', async () => {
  const {video,control} = setup(true);
  control.setVisible(true); control.setVisible(false); control.setVisible(true);
  video.queue.shift().reject(new Error('AbortError')); await tick();
  assert.equal(video.calls,2);
  assert.equal(control.getState().failed,false);
  video.queue.shift().resolve(); await tick();
  assert.equal(control.getState().playing,true);
});

test('cambiar a movimiento reducido pausa incluso una reproducción manual anterior', async () => {
  const {video,control} = setup(false);
  control.setVisible(true); control.play(); video.queue.shift().resolve(); await tick();
  control.setAutoPlay(false);
  assert.equal(video.paused,true);
  assert.equal(video.calls,1);
});

test('error del archivo y destrucción durante play conservan la pausa', async () => {
  const {video,control} = setup(true);
  control.setVisible(true);
  video.dispatchEvent(new Event('error'));
  assert.equal(control.getState().failed,true);
  control.destroy(); video.queue.shift().resolve(); await tick();
  assert.equal(video.paused,true);
});
