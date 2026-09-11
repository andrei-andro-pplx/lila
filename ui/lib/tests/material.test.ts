import { parseFen } from 'chessops/fen';
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import type { CheckState, MaterialDiff } from '../src/game/interfaces';
import { countChecks, getMaterialDiff, getScore, NO_CHECKS } from '../src/game/material';

const noMaterial = (): MaterialDiff => ({
  white: { king: 0, queen: 0, rook: 0, bishop: 0, knight: 0, pawn: 0 },
  black: { king: 0, queen: 0, rook: 0, bishop: 0, knight: 0, pawn: 0 },
});

describe('getMaterialDiff', () => {
  test('returns no differences for balanced material', () => {
    assert.deepEqual(
      getMaterialDiff('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' as FEN),
      noMaterial(),
    );
  });

  test('reports only the surplus pieces for each color', () => {
    const fen = 'q2qkbnr/ppp1n3/8/8/8/8/PPPP4/RNBQKBR1 b - - 12 34' as FEN;
    const expected: MaterialDiff = {
      white: { king: 0, queen: 0, rook: 1, bishop: 1, knight: 0, pawn: 1 },
      black: { king: 0, queen: 1, rook: 0, bishop: 0, knight: 1, pawn: 0 },
    };

    assert.deepEqual(getMaterialDiff(fen), expected);
    assert.deepEqual(getMaterialDiff(parseFen(fen).unwrap().board), expected);
  });

  test('ignores crazyhouse pockets and other FEN fields', () => {
    assert.deepEqual(getMaterialDiff('7k/8/8/8/8/8/8/K7[QQrrpppp] b - - 42 99' as FEN), noMaterial());
  });
});

describe('getScore', () => {
  test('uses standard piece values with the correct sign and excludes kings', () => {
    const values: Array<[Role, number]> = [
      ['queen', 9],
      ['rook', 5],
      ['bishop', 3],
      ['knight', 3],
      ['pawn', 1],
      ['king', 0],
    ];

    for (const [role, value] of values) {
      const whiteAhead = noMaterial();
      whiteAhead.white[role] = 1;
      assert.equal(getScore(whiteAhead), value, `white ${role}`);

      const blackAhead = noMaterial();
      blackAhead.black[role] = 1;
      assert.equal(getScore(blackAhead), value === 0 ? 0 : -value, `black ${role}`);
    }
  });
});

describe('countChecks', () => {
  test('counts booleans and callbacks through the requested ply without evaluating later steps', () => {
    const evaluated: Ply[] = [];
    const steps: CheckState[] = [
      { ply: 1, check: true },
      { ply: 2, check: false },
      {
        ply: 3,
        check: () => {
          evaluated.push(3);
          return true;
        },
      },
      { ply: 4 },
      {
        ply: 5,
        check: () => {
          evaluated.push(5);
          return false;
        },
      },
      { ply: 6, check: true },
      {
        ply: 7,
        check: () => {
          throw new Error('steps after the requested ply must remain lazy');
        },
      },
    ];
    const originalSteps = steps.map(step => ({ ...step }));

    assert.deepEqual(countChecks(steps, 6), { white: 2, black: 1 });
    assert.deepEqual(evaluated, [3, 5]);
    assert.deepEqual(steps, originalSteps);
  });

  test('returns a fresh zero count without mutating NO_CHECKS', () => {
    const checks = countChecks([], 0);

    assert.deepEqual(checks, { white: 0, black: 0 });
    assert.notStrictEqual(checks, NO_CHECKS);
    checks.white = 1;
    assert.deepEqual(NO_CHECKS, { white: 0, black: 0 });
  });
});
