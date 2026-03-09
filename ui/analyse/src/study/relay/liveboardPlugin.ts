import type { Color } from 'chessops';

import { type ChatPlugin } from 'lib/chat/interfaces';
import { fenColor, uciToMove } from 'lib/game/chess';
import { storedBooleanPropWithEffect } from 'lib/storage';
import { mainlineNodeList } from 'lib/tree/ops';
import { cmnToggleWrapProp } from 'lib/view/cmn-toggle';
import { hl, type VNode, getChessground, initMiniBoardWith, onInsert, spinnerVdom } from 'lib/view';

import type AnalyseCtrl from '@/ctrl';

import { type CloudEval, type MultiCloudEval, renderScore } from '../multiCloudEval';
import { type ChapterId } from '../interfaces';

type BoardConfig = CgConfig & { lastUci?: Uci };

export class LiveboardPlugin implements ChatPlugin {
  private animate = false;
  private board: BoardConfig | undefined;
  private boardFen: FEN | undefined;
  private boardChapter: ChapterId | undefined;
  private checkmateWinner: Color | undefined;
  private showEval = storedBooleanPropWithEffect('analyse.liveboard.showEval', true, () => this.redraw?.());

  key = 'liveboard';
  name = i18n.broadcast.liveboard;
  kidSafe = true;
  redraw: Redraw;

  constructor(
    readonly ctrl: AnalyseCtrl,
    readonly isDisabled: () => boolean,
    private chapter: ChapterId | undefined,
    private cloudEval: MultiCloudEval | undefined,
  ) {}

  reset = () => {
    this.chapter = undefined;
    this.board = undefined;
    this.boardFen = undefined;
    this.boardChapter = undefined;
    this.checkmateWinner = undefined;
    this.animate = false;
  };

  setChapterId(id: ChapterId) {
    if (id === this.chapter) return;
    this.reset();
    this.chapter = id;
  }

  private setBoardState(): boolean {
    const study = this.ctrl.study;
    const path = study?.data.chapter.relayPath;
    const tree = this.ctrl.tree;
    const localMainline = mainlineNodeList(tree.root);
    const fallbackNode = localMainline[localMainline.length - 1];

    let fen = fallbackNode.fen;
    let lastUci = fallbackNode.uci;
    let check = fallbackNode.check() ? fenColor(fen) : undefined;
    let checkmateWinner = fallbackNode.outcome()?.winner;
    let chapterId = study?.data.chapter.id || this.chapter;

    const liveNode = path ? tree.nodeAtPath(path) : undefined;
    if (liveNode) {
      fen = liveNode.fen;
      lastUci = liveNode.uci;
      check = liveNode.check() ? fenColor(fen) : undefined;
      checkmateWinner = liveNode.outcome()?.winner;
      chapterId = study?.data.chapter.id || chapterId;
    } else if (this.chapter) {
      const preview = study?.chapters.list.get(this.chapter);
      if (!preview) return false;
      fen = preview.fen;
      lastUci = preview.lastMove;
      check = preview.check ? fenColor(fen) : undefined;
      checkmateWinner =
        preview.check === '#' ? (fenColor(preview.fen) === 'white' ? 'black' : 'white') : undefined;
      chapterId = this.chapter;
    }

    this.board = {
      fen,
      check,
      lastUci,
      animation: { enabled: this.animate },
      lastMove: uciToMove(lastUci),
      orientation: this.ctrl.bottomColor(),
    };
    this.boardFen = fen;
    this.boardChapter = chapterId;
    this.checkmateWinner = checkmateWinner;
    this.animate = true;
    return true;
  }

  private renderEvalGauge() {
    if (!this.showEval()) return;

    const cloudEval = this.cloudEval;
    const fen = this.boardFen;
    const chapterId = this.boardChapter;
    const board = this.board;
    if (!cloudEval || !fen || !chapterId || !board) return;

    const isMate = this.checkmateWinner !== undefined;
    const tag = `span.mini-game__gauge${board.orientation === 'black' ? ' mini-game__gauge--flip' : ''}${
      isMate ? ' mini-game__gauge--set' : ''
    }`;

    if (isMate) {
      return hl(tag, { attrs: { title: 'Checkmate' } }, [
        hl('span.mini-game__gauge__black', {
          attrs: { style: `height: ${this.checkmateWinner === 'black' ? 100 : 0}%` },
        }),
        hl('tick'),
      ]);
    }

    return hl(
      tag,
      {
        attrs: { 'data-id': chapterId },
        hook: {
          ...onInsert(cloudEval.observe),
          postpatch(old, vnode) {
            const elm = vnode.elm as HTMLElement;
            const prevNodeCloud = old.data?.cloud as CloudEval | undefined;
            const cev = cloudEval.getCloudEval(fen) || prevNodeCloud;
            if (cev?.chances !== prevNodeCloud?.chances) {
              const blackGauge = elm.querySelector<HTMLElement>('.mini-game__gauge__black');
              if (blackGauge)
                blackGauge.style.height = `${Math.round(((1 - (cev?.chances || 0)) / 2) * 100)}%`;
              if (cev) {
                elm.title = renderScore(cev);
                elm.classList.add('mini-game__gauge--set');
              }
            }
            if (vnode.data) vnode.data.cloud = cev;
          },
        },
      },
      [hl('span.mini-game__gauge__black'), hl('tick')],
    );
  }

  view(): VNode {
    if (!this.setBoardState()) return spinnerVdom();

    return hl('div.chat-liveboard', [
      this.cloudEval &&
        hl('div.chat-liveboard__controls', [
          cmnToggleWrapProp({
            id: 'liveboard-eval',
            name: i18n.study.showEvalBar,
            prop: this.showEval,
            redraw: this.redraw,
          }),
        ]),
      hl(
        'div.chat-liveboard__board-wrap',
        {
          hook: {
            insert: (vn: VNode) => {
              const boardEl = (vn.elm as HTMLElement).querySelector<HTMLElement>('.chat-liveboard__board');
              if (boardEl && this.board) initMiniBoardWith(boardEl, this.board);
            },
            update: (_, vn: VNode) => {
              const boardEl = (vn.elm as HTMLElement).querySelector<HTMLElement>('.chat-liveboard__board');
              if (boardEl && this.board) {
                getChessground(boardEl)?.set(this.board);
                this.animate = true;
              }
            },
          },
        },
        [this.renderEvalGauge(), hl('div.chat-liveboard__board.is2d')],
      ),
    ]);
  }
}
