import { type Prop } from 'lib';
import { type ChatPlugin } from 'lib/chat/interfaces';
import { fenColor, uciToMove } from 'lib/game/chess';
import { storedBooleanPropWithEffect } from 'lib/storage';
import { mainlineNodeList } from 'lib/tree/ops';
import { hl, type VNode, getChessground, initMiniBoardWith, spinnerVdom } from 'lib/view';
import { cmnToggleWrapProp } from 'lib/view/cmn-toggle';

import type AnalyseCtrl from '@/ctrl';

import { type ChapterId, type ChapterPreview } from '../interfaces';
import type { MultiCloudEval } from '../multiCloudEval';
import { verticalEvalGauge } from '../multiBoard';

type BoardConfig = CgConfig & { lastUci?: Uci };

export class LiveboardPlugin implements ChatPlugin {
  private animate = false;
  private board: BoardConfig | undefined;
  private boardFen: FEN | undefined;
  private showEval: Prop<boolean> | undefined;
  key = 'liveboard';
  name = i18n.broadcast.liveboard;
  kidSafe = true;
  redraw: Redraw;

  constructor(
    readonly ctrl: AnalyseCtrl,
    readonly isDisabled: () => boolean,
    private chapter: ChapterId | undefined,
    private readonly cloudEval?: MultiCloudEval,
  ) {
    if (cloudEval) {
      this.showEval = storedBooleanPropWithEffect('analyse.liveboard.showEval', true, () => {
        this.redraw?.();
        cloudEval.requestNewEvals();
      });
      cloudEval.addShowEvalSource(() => this.showEval!());
    }
  }

  reset = () => {
    this.chapter = undefined;
    this.board = undefined;
    this.boardFen = undefined;
    this.animate = false;
  };

  setChapterId(id: ChapterId) {
    if (id === this.chapter) return;
    this.reset();
    this.chapter = id;
  }

  /** Compute board state from current data. Returns false if data isn't ready (show spinner). */
  private setBoardState(): boolean {
    const study = this.ctrl.study;
    const path = study?.data.chapter.relayPath;
    const tree = this.ctrl.tree;

    if (path) {
      const node = tree.nodeAtPath(path);
      this.board = { fen: node.fen, check: !!node.check() && fenColor(node.fen), lastUci: node.uci };
    } else if (this.chapter && !this.board) {
      const preview = study?.chapters.list.get(this.chapter);
      if (!preview) return false;
      this.board = {
        fen: preview.fen,
        lastUci: preview.lastMove,
        check: !!preview.check && fenColor(preview.fen),
      };
    }

    if (!this.board) {
      const localMainline = mainlineNodeList(tree.root);
      const node = localMainline[localMainline.length - 1];
      this.board = { fen: node.fen, lastUci: node.uci, check: !!node.check() && fenColor(node.fen) };
    }

    this.board.animation = { enabled: this.animate };
    this.board.lastMove = uciToMove(this.board.lastUci);
    this.board.orientation = this.ctrl.bottomColor();
    this.boardFen = this.board.fen;
    this.animate = true;
    return true;
  }

  private currentPreview(): ChapterPreview | undefined {
    return this.chapter ? this.ctrl.study?.chapters.list.get(this.chapter) : undefined;
  }

  /** Build a ChapterPreview-like object for the gauge, using the same FEN as the board. */
  private gaugePreview(): ChapterPreview | undefined {
    if (!this.boardFen || !this.chapter) return undefined;
    const preview = this.currentPreview();
    const orientation = this.board?.orientation || preview?.orientation || 'white';
    // Determine check status: use preview if FEN matches, otherwise detect from board config
    const isMate = preview?.fen === this.boardFen ? preview?.check === '#' : false;
    return {
      id: this.chapter,
      name: '',
      fen: this.boardFen,
      orientation,
      playing: !!preview?.playing,
      check: isMate ? '#' : undefined,
    };
  }

  view(): VNode {
    if (!this.setBoardState()) return spinnerVdom();

    const showEval = this.showEval?.() && !!this.cloudEval;
    const gaugePreview = showEval ? this.gaugePreview() : undefined;

    return hl('div.chat-liveboard', [
      this.showEval &&
        this.cloudEval &&
        cmnToggleWrapProp({
          id: 'liveboard-eval',
          name: i18n.study.showEvalBar,
          prop: this.showEval,
        }),
      hl('div.chat-liveboard__board-wrap', [
        gaugePreview && this.cloudEval ? verticalEvalGauge(gaugePreview, this.cloudEval) : undefined,
        hl('div.chat-liveboard__board.is2d', {
          hook: {
            insert: (vn: VNode) => {
              const el = vn.elm as HTMLElement;
              if (el && this.board) initMiniBoardWith(el, this.board);
            },
            update: (_, vn: VNode) => {
              const el = vn.elm as HTMLElement;
              if (el && this.board) getChessground(el)?.set(this.board);
              this.animate = true;
            },
          },
        }),
      ]),
    ]);
  }
}
