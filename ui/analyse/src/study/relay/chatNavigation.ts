import type { VNode } from 'snabbdom';

import type RelayCtrl from './relayCtrl';
import type StudyCtrl from '../studyCtrl';

const looksLikeChapterId = (id: string): boolean => /^[a-zA-Z0-9]{8}$/.test(id);

const navigateToMessage = async (el: HTMLElement, relay: RelayCtrl, study: StudyCtrl) => {
  const roundId = el.dataset['relayRoundId'];
  const gameId = el.dataset['relayGameId'];
  const ply = parseInt(el.dataset['relayPly'] || '', 10);

  if (!roundId || !gameId || !looksLikeChapterId(gameId) || !Number.isInteger(ply) || ply < 0) return;

  if (roundId !== relay.round.id) {
    const targetRound = relay.data.rounds.find(round => round.id === roundId);
    if (!targetRound) return;
    const href = study.embeddablePath(relay.roundUrlWithHash(targetRound));
    window.location.href = href;
    return;
  }

  const wasSet = await study.chapterSelect.set(gameId);
  if (wasSet) {
    study.ctrl.jumpToMain(ply);
    study.ctrl.redraw();
  }
};

export const relayChatMessageListener = (relay: RelayCtrl, study: StudyCtrl) => (vnode: VNode) =>
  (vnode.elm as HTMLElement).addEventListener('click', async e => {
    if ((e.target as HTMLElement).closest('a,button,action')) return;
    const line = (e.target as HTMLElement).closest<HTMLElement>('li.relay-nav');
    if (line) await navigateToMessage(line, relay, study);
  });
