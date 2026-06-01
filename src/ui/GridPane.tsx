/**
 * Center pane (SPECS §6.1): the logic grid, the step-playback bar (§6.2) and
 * status banners (§6.3). Color is never the sole signal — every cell also
 * carries a ✓/✗/? glyph and an ARIA label (§6.4).
 */
import { useRef, useCallback } from 'react';
import { useStore } from '../store/store';
import { cellKey } from '../core/types';
import { markFor, snapshotForStep, snapshotFromAssignment } from './grid-model';
import type { CellMark } from './grid-model';
import type { PositionSnapshot } from '../core/inference/types';
import type { Puzzle } from '../core/types';
import { exportGridPng } from './export';

const GLYPH: Record<CellMark, string> = { true: '✓', false: '✗', unknown: '?' };
const MARK_CLASS: Record<CellMark, string> = {
  true: 'bg-emerald-100 text-emerald-700 font-bold',
  false: 'bg-slate-50 text-slate-300',
  unknown: 'bg-white text-slate-400',
};

export default function GridPane() {
  const puzzle = useStore((s) => s.puzzle);
  const report = useStore((s) => s.report);
  const solving = useStore((s) => s.solving);
  const stepIndex = useStore((s) => s.stepIndex);
  const highlighted = useStore((s) => s.highlightedCells);
  const gridRef = useRef<HTMLDivElement>(null);

  const snapshot = snapshotForStep(puzzle, report, stepIndex);
  const highlightSet = new Set(highlighted.map(cellKey));

  return (
    <div className="flex h-full flex-col gap-3">
      <StatusBanner />
      {solving && (
        <div role="status" className="rounded bg-sky-50 p-2 text-sm text-sky-700">
          Solving…
        </div>
      )}

      <PlaybackBar />

      <div ref={gridRef} className="overflow-auto">
        <Grid puzzle={puzzle} snapshot={snapshot} highlightSet={highlightSet} />
      </div>

      {report?.status === 'multiple' && (
        <SideBySide puzzle={puzzle} />
      )}

      <div className="flex gap-2">
        <button
          className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
          onClick={() => gridRef.current && exportGridPng(gridRef.current, puzzle.title ?? 'grid')}
        >
          Export grid PNG
        </button>
      </div>
    </div>
  );
}

function Grid({
  puzzle,
  snapshot,
  highlightSet,
}: {
  puzzle: Puzzle;
  snapshot: PositionSnapshot;
  highlightSet: Set<string>;
}) {
  const n =
    puzzle.categories.find((c) => c.name === puzzle.positionCategory)?.values
      .length ?? 0;
  const attrCats = puzzle.categories.filter(
    (c) => c.name !== puzzle.positionCategory,
  );
  const positions = Array.from({ length: n }, (_, i) => i + 1);

  return (
    <table className="border-collapse text-sm" role="grid" aria-label="Logic grid">
      <thead>
        <tr>
          <th className="sticky left-0 bg-slate-100 p-1 text-left">{puzzle.positionCategory}</th>
          {attrCats.map((cat) => (
            <th
              key={cat.name}
              colSpan={cat.values.length}
              className="border border-slate-200 bg-slate-100 p-1 text-center"
            >
              {cat.name}
            </th>
          ))}
        </tr>
        <tr>
          <th className="sticky left-0 bg-slate-50 p-1" />
          {attrCats.flatMap((cat) =>
            cat.values.map((v) => (
              <th
                key={`${cat.name}.${v}`}
                className="border border-slate-200 bg-slate-50 p-1 text-center text-xs font-medium"
                title={`${cat.name}: ${v}`}
              >
                {v}
              </th>
            )),
          )}
        </tr>
      </thead>
      <tbody>
        {positions.map((p) => (
          <tr key={p}>
            <th className="sticky left-0 bg-slate-100 p-1 text-center font-semibold">{p}</th>
            {attrCats.flatMap((cat) =>
              cat.values.map((v) => {
                const mark = markFor(snapshot, cat.name, v, p);
                const key = cellKey({ category: cat.name, value: v });
                const hl = highlightSet.has(key);
                return (
                  <td
                    key={`${cat.name}.${v}.${p}`}
                    role="gridcell"
                    aria-label={`${cat.name} ${v} at position ${p}: ${mark}`}
                    className={`h-8 w-8 border border-slate-200 text-center ${MARK_CLASS[mark]} ${
                      hl ? 'outline outline-2 outline-amber-400' : ''
                    }`}
                  >
                    {GLYPH[mark]}
                  </td>
                );
              }),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SideBySide({ puzzle }: { puzzle: Puzzle }) {
  const report = useStore((s) => s.report);
  if (report?.status !== 'multiple') return null;
  const a = snapshotFromAssignment(puzzle, report.assignmentA);
  const b = snapshotFromAssignment(puzzle, report.assignmentB);
  const ambiguousSet = new Set(report.ambiguous.map(cellKey));
  return (
    <div className="flex flex-wrap gap-6">
      <div>
        <p className="mb-1 text-xs font-semibold text-slate-600">Solution A</p>
        <Grid puzzle={puzzle} snapshot={a} highlightSet={ambiguousSet} />
      </div>
      <div>
        <p className="mb-1 text-xs font-semibold text-slate-600">Solution B</p>
        <Grid puzzle={puzzle} snapshot={b} highlightSet={ambiguousSet} />
      </div>
    </div>
  );
}

function StatusBanner() {
  const report = useStore((s) => s.report);
  if (!report) return null;
  switch (report.status) {
    case 'unique':
      return (
        <div className="rounded bg-emerald-50 p-2 text-sm text-emerald-700">
          ✓ Unique solution found — {report.explanation.steps.length} deduction steps.
        </div>
      );
    case 'multiple':
      return (
        <div className="rounded bg-amber-50 p-2 text-sm text-amber-800">
          ⚠ Under-constrained: multiple solutions. Add a clue to disambiguate.{' '}
          {report.ambiguous.length} cell(s) ambiguous.
        </div>
      );
    case 'unsat':
      return (
        <div className="rounded bg-rose-50 p-2 text-sm text-rose-700">
          ✗ Over-constrained: clues {report.mus.join(', ')} are contradictory.
        </div>
      );
    case 'invalid':
      return (
        <div className="rounded bg-rose-50 p-2 text-sm text-rose-700">
          Puzzle is not well-formed ({report.errors.length} issue(s)) — see setup pane.
        </div>
      );
    case 'timeout':
      return (
        <div className="rounded bg-rose-50 p-2 text-sm text-rose-700">
          Solving timed out after 10 seconds.
        </div>
      );
    case 'error':
      return (
        <div className="rounded bg-rose-50 p-2 text-sm text-rose-700">
          Error: {report.message}
        </div>
      );
  }
}

function PlaybackBar() {
  const report = useStore((s) => s.report);
  const stepIndex = useStore((s) => s.stepIndex);
  const setStepIndex = useStore((s) => s.setStepIndex);
  const total = report?.status === 'unique' ? report.explanation.steps.length : 0;

  const onKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setStepIndex(stepIndex - 1);
      if (e.key === 'ArrowRight') setStepIndex(stepIndex + 1);
    },
    [stepIndex, setStepIndex],
  );

  const disabled = total === 0;
  return (
    <div
      className="flex items-center gap-2"
      role="group"
      aria-label="Step playback"
      onKeyDown={onKey}
    >
      <PlayBtn label="First step" disabled={disabled} onClick={() => setStepIndex(0)}>⏮</PlayBtn>
      <PlayBtn label="Previous step" disabled={disabled} onClick={() => setStepIndex(stepIndex - 1)}>◀</PlayBtn>
      <PlayBtn label="Next step" disabled={disabled} onClick={() => setStepIndex(stepIndex + 1)}>▶</PlayBtn>
      <PlayBtn label="Last step" disabled={disabled} onClick={() => setStepIndex(total)}>⏭</PlayBtn>
      <input
        type="range"
        min={0}
        max={total}
        value={stepIndex}
        disabled={disabled}
        aria-label="Deduction step"
        onChange={(e) => setStepIndex(Number(e.target.value))}
        className="flex-1"
      />
      <span className="w-16 text-right text-xs text-slate-500">
        {stepIndex} / {total}
      </span>
    </div>
  );
}

function PlayBtn({
  children,
  label,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="rounded border border-slate-300 px-2 py-1 text-sm disabled:opacity-40 hover:bg-slate-50"
    >
      {children}
    </button>
  );
}
