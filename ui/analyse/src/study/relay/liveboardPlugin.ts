import { type ChatPlugin } from 'lib/chat/interfaces';
import { fenColor, uciToMove } from 'lib/game/chess';
import { mainlineNodeList } from 'lib/tree/ops';
import { storedBooleanPropWithEffect } from 'lib/storage';
import { type MaybeVNode, type VNode, hl, getChessground, initMiniBoardWith, spinnerVdom } from 'lib/view';
import { cmnToggleWrapProp } from 'lib/view/cmn-toggle';

import type AnalyseCtrl from '@/ctrl';

import { type ChapterId, type ChapterPreview } from '../interfaces';
import { type MultiCloudEval } from '../multiCloudEval';
import { verticalEvalGauge } from '../multiBoard';

type BoardConfig = CgConfig & { lastUci?: Uci };

export class LiveboardPlugin implements ChatPlugin {
  private animate = false;
  private board: BoardConfig | undefined;
  private showEval;
  key = 'liveboard';
  name = i18n.broadcast.liveboard;
  kidSafe = true;
  redraw: Redraw;

  constructor(
    readonly ctrl: AnalyseCtrl,
    readonly isDisabled: () => boolean,
    private chapter: ChapterId | undefined,
    private readonly multiCloudEval: MultiCloudEval | undefined,
  ) {
    this.showEval = storedBooleanPropWithEffect('analyse.liveboard.showEval', true, () => {
      this.redraw?.();
    });
  }

  reset = () => {
    this.chapter = undefined;
    this.board = undefined;
    this.animate = false;
  };

  setChapterId(id: ChapterId) {
    if (id === this.chapter) return;
    this.reset();
    this.chapter = id;
  }

  private currentFen(): string | undefined {
    return this.board?.fen as string | undefined;
  }

  private currentPreview(): ChapterPreview | undefined {
    if (!this.chapter) return undefined;
    return this.ctrl.study?.chapters.list.get(this.chapter);
  }

  private renderEvalGauge(): MaybeVNode {
    if (!this.showEval() || !this.multiCloudEval) return undefined;

    const preview = this.currentPreview();
    if (preview) return verticalEvalGauge(preview, this.multiCloudEval);

    // Fallback: construct a minimal preview-like object from the board state
    const fen = this.currentFen();
    if (!fen) return undefined;

    // Check if it's checkmate by looking at the path node
    const path = this.ctrl.study?.data.chapter.relayPath;
    let check: '+' | '#' | undefined;
    if (path) {
      const node = this.ctrl.tree.nodeAtPath(path);
      if (node.check()) {
        const outcome = node.outcome();
        check = outcome ? '#' : '+';
      }
    }

    const pseudoPreview: ChapterPreview = {
      id: this.chapter || ('' as ChapterId),
      name: '',
      fen,
      orientation: this.ctrl.bottomColor(),
      playing: true,
      check,
    };
    return verticalEvalGauge(pseudoPreview, this.multiCloudEval);
  }

  view(): VNode {
    const path = this.ctrl.study?.data.chapter.relayPath;
    const tree = this.ctrl.tree;
    const localMainline = mainlineNodeList(tree.root);
    const node = localMainline[localMainline.length - 1];
    if (path) {
      const node = tree.nodeAtPath(path);
      this.board = { fen: node.fen, check: !!node.check() && fenColor(node.fen), lastUci: node.uci };
    } else if (this.chapter && !this.board) {
      const preview = this.ctrl.study?.chapters.list.get(this.chapter);
      if (!preview) return spinnerVdom();
      this.board = {
        fen: preview.fen,
        lastUci: preview.lastMove,
        check: !!preview.check && fenColor(preview.fen),
      };
    }
    this.board ??= { fen: node.fen, lastUci: node.uci, check: !!node.check() && fenColor(node.fen) };
    this.board.animation = { enabled: this.animate };
    this.board.lastMove = uciToMove(this.board.lastUci);
    this.board.orientation = this.ctrl.bottomColor();
    this.animate = true;

    const evalGauge = this.renderEvalGauge();

    return hl('div.chat-liveboard-wrap', [
      this.multiCloudEval
        ? hl('div.chat-liveboard-controls', [
            cmnToggleWrapProp({
              id: 'liveboard-eval',
              name: i18n.study.showEvalBar,
              prop: this.showEval,
            }),
          ])
        : undefined,
      hl('div.chat-liveboard-board.is2d', { class: { 'chat-liveboard-board--eval': !!evalGauge } }, [
        hl('div.chat-liveboard.is2d', {
          hook: {
            insert: (vn: VNode) => initMiniBoardWith(vn.elm as HTMLElement, this.board!),
            update: (_, vn: VNode) => {
              getChessground(vn.elm as HTMLElement)?.set(this.board!);
              this.animate = true;
            },
          },
        }),
        evalGauge,
      ]),
    ]);
  }
}
