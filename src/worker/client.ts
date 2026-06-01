/**
 * Main-thread client for the solver worker (SPECS §5.5).
 *
 * Enforces the 10-second wall-time timeout by terminating the worker, and
 * resolves with a `SolveReport`. A fresh worker is spawned per solve so a
 * timed-out/terminated worker never leaks into the next run.
 */
import type { Puzzle } from '../core/types';
import type { SolveReport, SolveRequest } from './protocol';

export const SOLVE_TIMEOUT_MS = 10_000;

export type SolveOutcome = SolveReport | { status: 'timeout' };

export function solveInWorker(
  puzzle: Puzzle,
  timeoutMs: number = SOLVE_TIMEOUT_MS,
): Promise<SolveOutcome> {
  return new Promise((resolve) => {
    const worker = new Worker(new URL('./solver.worker.ts', import.meta.url), {
      type: 'module',
    });
    let settled = false;
    const finish = (outcome: SolveOutcome) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate();
      resolve(outcome);
    };

    const timer = setTimeout(() => finish({ status: 'timeout' }), timeoutMs);

    worker.onmessage = (event: MessageEvent<SolveReport>) => finish(event.data);
    worker.onerror = (event) =>
      finish({ status: 'error', message: event.message || 'Worker error' });

    worker.postMessage({ puzzle } satisfies SolveRequest);
  });
}
