/**
 * Right pane (SPECS §6.1): the deduction chain — a scrollable list of steps with
 * "from clue X" / "from step Y" pills. Clicking a step scrubs the grid to it and
 * highlights its affected cells. Also surfaces MUS / ambiguity / validation text.
 */
import { useStore } from '../store/store';
import { exportDeductionMarkdown } from './export';

export default function DeductionPane() {
  const report = useStore((s) => s.report);
  const puzzle = useStore((s) => s.puzzle);
  const stepIndex = useStore((s) => s.stepIndex);
  const setStepIndex = useStore((s) => s.setStepIndex);

  if (!report) {
    return <p className="text-sm text-slate-500">Solve the puzzle to see the deduction chain.</p>;
  }

  if (report.status === 'unsat') {
    return (
      <div className="space-y-2">
        <h2 className="font-semibold text-rose-700">Contradiction (MUS)</h2>
        <p className="text-sm text-slate-700">{report.conflictText}</p>
      </div>
    );
  }

  if (report.status === 'multiple') {
    return (
      <div className="space-y-2">
        <h2 className="font-semibold text-amber-800">Under-constrained</h2>
        <p className="text-sm text-slate-700">
          The puzzle has multiple solutions. Add a clue to disambiguate. The
          following cells are not uniquely determined:
        </p>
        <ul className="list-disc pl-5 text-sm text-slate-700">
          {report.ambiguous.map((c) => (
            <li key={`${c.category}.${c.value}`}>
              {c.category}: {c.value}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (report.status === 'invalid') {
    return (
      <div className="space-y-2">
        <h2 className="font-semibold text-rose-700">Not well-formed</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-rose-700">
          {report.errors.map((e, i) => (
            <li key={i}>{e.message}</li>
          ))}
        </ul>
      </div>
    );
  }

  if (report.status === 'timeout' || report.status === 'error') return null;

  const steps = report.explanation.steps;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Deduction chain</h2>
        <button
          className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
          onClick={() => exportDeductionMarkdown(puzzle, report.explanation)}
        >
          Export .md
        </button>
      </div>
      <ol className="space-y-1">
        {steps.map((step) => {
          const active = stepIndex === step.stepNumber;
          return (
            <li key={step.stepNumber}>
              <button
                onClick={() => setStepIndex(step.stepNumber)}
                className={`w-full rounded border p-2 text-left text-sm ${
                  active
                    ? 'border-amber-400 bg-amber-50'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold text-slate-500">#{step.stepNumber}</span>
                  <span className="rounded bg-slate-200 px-1 text-[10px] font-medium text-slate-600">
                    {step.rule}
                  </span>
                </div>
                <p className="mt-1">{step.englishSentence}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {step.citedClues.map((c) => (
                    <Pill key={`c${c}`} kind="clue">from clue {c}</Pill>
                  ))}
                  {step.citedSteps.map((s) => (
                    <Pill key={`s${s}`} kind="step">from step {s}</Pill>
                  ))}
                </div>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Pill({ children, kind }: { children: React.ReactNode; kind: 'clue' | 'step' }) {
  const cls =
    kind === 'clue'
      ? 'bg-sky-100 text-sky-700'
      : 'bg-violet-100 text-violet-700';
  return <span className={`rounded px-1.5 py-0.5 text-[10px] ${cls}`}>{children}</span>;
}
