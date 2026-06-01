/// <reference lib="webworker" />
/**
 * Solver Web Worker (SPECS §5.5). All encoding, solving, MUS extraction and
 * explanation run here, off the main thread, keeping the UI responsive.
 */
import { buildReport } from '../core/report';
import type { SolveReport, SolveRequest } from './protocol';

self.onmessage = (event: MessageEvent<SolveRequest>) => {
  try {
    const report: SolveReport = buildReport(event.data.puzzle);
    (self as DedicatedWorkerGlobalScope).postMessage(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    (self as DedicatedWorkerGlobalScope).postMessage({
      status: 'error',
      message,
    } satisfies SolveReport);
  }
};
