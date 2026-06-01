/**
 * Integration tests (SPECS §8.2): the canned examples solved end-to-end through
 * the full pipeline + explanation, asserting that every step's citedClues /
 * citedSteps references resolve correctly, and checking step-count targets.
 */
import { describe, it, expect } from 'vitest';
import { EXAMPLES } from '@/examples';
import { buildReport } from '@/core/report';
import { cellKey } from '@/core/types';

describe('canned examples (integration)', () => {
  const byId = Object.fromEntries(EXAMPLES.map((e) => [e.id, e]));

  it('zebra / easy / medium are uniquely solvable with resolvable citations', () => {
    for (const id of ['zebra', 'easy', 'medium']) {
      const report = buildReport(byId[id].puzzle);
      expect(report.status).toBe('unique');
      if (report.status !== 'unique') continue;
      const { steps, snapshots } = report.explanation;
      const clueIds = new Set(byId[id].puzzle.clues.map((c) => c.id));

      for (const step of steps) {
        for (const c of step.citedClues) expect(clueIds.has(c)).toBe(true);
        for (const s of step.citedSteps) expect(s).toBeLessThan(step.stepNumber);
      }
      // Snapshots: initial + one per step.
      expect(snapshots.length).toBe(steps.length + 1);

      // Final snapshot equals the solution (all cells pinned to assignment).
      const final = snapshots[snapshots.length - 1];
      for (const cat of byId[id].puzzle.categories) {
        if (cat.name === byId[id].puzzle.positionCategory) continue;
        for (const v of cat.values) {
          expect(final[cellKey({ category: cat.name, value: v })]).toEqual([
            report.assignment[cat.name][v],
          ]);
        }
      }
    }
  });

  it('small puzzles keep the chain within the §8.2 ≤30-step target', () => {
    for (const id of ['easy', 'medium']) {
      const report = buildReport(byId[id].puzzle);
      if (report.status === 'unique') {
        expect(report.explanation.steps.length).toBeLessThanOrEqual(30);
      }
    }
  });

  it('the under-constrained example reports multiple solutions', () => {
    const report = buildReport(byId['ambiguous'].puzzle);
    expect(report.status).toBe('multiple');
    if (report.status === 'multiple') expect(report.ambiguous.length).toBeGreaterThan(0);
  });

  it('the over-constrained example returns a MUS and conflict text', () => {
    const report = buildReport(byId['contradictory'].puzzle);
    expect(report.status).toBe('unsat');
    if (report.status === 'unsat') {
      expect(report.mus.length).toBeGreaterThan(0);
      expect(report.conflictText).toMatch(/contradictory/i);
    }
  });
});
