import assert from 'node:assert/strict';
import { test } from 'node:test';

import { attachRelayChatData, parseRelayChatData, stripRelayChatData } from '../src/chat/relayData';

test('attach and parse relay chat metadata', () => {
  const encoded = attachRelayChatData('Good move', {
    roundId: 'Round001',
    gameId: 'AbCd1234',
    ply: 57,
  });

  assert.equal(encoded, 'Good move\x01Round001/AbCd1234/57\x01');
  assert.deepStrictEqual(parseRelayChatData(encoded), {
    roundId: 'Round001',
    gameId: 'AbCd1234',
    ply: 57,
  });
  assert.equal(stripRelayChatData(encoded), 'Good move');
});

test('ignore malformed relay chat metadata', () => {
  assert.equal(parseRelayChatData('hello\x01missing\x01'), undefined);
  assert.equal(parseRelayChatData('hello\x01round/game/notanumber\x01'), undefined);
  assert.equal(parseRelayChatData('hello\x01round/ga/me/12\x01'), undefined);
});

test('do not attach invalid metadata', () => {
  assert.equal(attachRelayChatData('text', undefined), 'text');
  assert.equal(
    attachRelayChatData('text', { roundId: 'ok', gameId: 'slash/id', ply: 1 }),
    'text',
  );
  assert.equal(attachRelayChatData('text', { roundId: 'ok', gameId: 'abcd1234', ply: -1 }), 'text');
});
