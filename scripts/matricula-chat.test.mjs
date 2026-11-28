import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const script = await readFile(new URL('../matricula-chat.js', import.meta.url), 'utf8');

test('Lumi permanece oculto si faltan los datos o las preguntas generadas', () => {
  let listeners = 0;
  const launcher = { hidden: true, addEventListener() { listeners += 1; } };
  const dialog = {
    showModal() {},
    querySelector() { return {}; },
    addEventListener() { listeners += 1; }
  };
  const document = {
    querySelector(selector) {
      return selector === '#matricula-chat-launcher' ? launcher : selector === '#matricula-chat' ? dialog : null;
    },
    addEventListener() { listeners += 1; }
  };
  for (const content of [undefined, { lumiCopy: {}, faqs: [] }]) {
    runInNewContext(script, { document, window: { colegioContent: content } });
  }
  assert.equal(launcher.hidden, true);
  assert.equal(listeners, 0);
});
