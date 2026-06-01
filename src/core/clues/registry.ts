/**
 * Clue-handler registry (SPECS §5.3). Maps a clue's `type` tag to its handler.
 *
 * This is the composition seam that replaces a `Clue` class hierarchy: callers
 * (validator, encoder, inference engine, UI) ask the registry for the handler
 * and invoke the behaviour they need. New clue types — were the spec ever to
 * grow — register here without any caller needing to change.
 */
import type { ClueType } from '../types';
import type { ClueHandler } from './handlers';
import { ALL_HANDLERS } from './handlers';

const REGISTRY: ReadonlyMap<ClueType, ClueHandler> = new Map(
  ALL_HANDLERS.map((h) => [h.type as ClueType, h]),
);

export function getClueHandler(type: ClueType): ClueHandler {
  const handler = REGISTRY.get(type);
  if (!handler) {
    // Unreachable for well-typed clues; guards against malformed JSON imports.
    throw new Error(`Unsupported clue type: ${type}`);
  }
  return handler;
}

export function clueTypes(): ClueType[] {
  return ALL_HANDLERS.map((h) => h.type as ClueType);
}

export type { ClueHandler } from './handlers';
