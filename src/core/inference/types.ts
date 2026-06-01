/**
 * Public shapes for the explanation (SPECS §5.6).
 */
import type { Cell } from '../types';

export type RuleId = 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6';

export interface Fact {
  readonly category: string;
  readonly value: string;
  readonly position: number;
}

/** A single step of the deduction chain (§5.6). */
export interface DeductionStep {
  readonly stepNumber: number;
  readonly rule: RuleId;
  readonly englishSentence: string;
  readonly citedClues: number[];
  readonly citedSteps: number[];
  readonly affectedCells: Cell[];
  readonly newFacts: Fact[];
}

/** Possible positions per cell key, captured after a given step (for playback). */
export type PositionSnapshot = Record<string, number[]>;

export interface Explanation {
  readonly steps: DeductionStep[];
  /**
   * `snapshots[0]` is the initial state; `snapshots[i]` is the knowledge state
   * after step `i`. Used by the playback bar (§6.2) to render the grid as of a
   * selected step.
   */
  readonly snapshots: PositionSnapshot[];
}
