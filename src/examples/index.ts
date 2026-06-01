/**
 * Canned example puzzles for the Examples menu (SPECS §6.2): Einstein's classic
 * zebra puzzle plus four of varying difficulty. Each is verified
 * uniquely-solvable by a test (see tests/core/examples.test.ts).
 */
import type { Puzzle } from '../core/types';

export interface Example {
  readonly id: string;
  readonly name: string;
  readonly difficulty: 'easy' | 'medium' | 'hard';
  readonly puzzle: Puzzle;
}

// --- Einstein's Zebra Puzzle (the canonical 5×5) ----------------------------
const zebra: Puzzle = {
  version: 1,
  title: "Einstein's Riddle (Zebra Puzzle)",
  description: 'The classic: who owns the zebra, and who drinks water?',
  positionCategory: 'House',
  categories: [
    { name: 'House', values: ['1', '2', '3', '4', '5'], isPosition: true },
    { name: 'Nationality', values: ['Brit', 'Swede', 'Dane', 'Norwegian', 'German'] },
    { name: 'Color', values: ['Red', 'Green', 'White', 'Yellow', 'Blue'] },
    { name: 'Drink', values: ['Tea', 'Coffee', 'Milk', 'Beer', 'Water'] },
    { name: 'Smoke', values: ['PallMall', 'Dunhill', 'Blends', 'BlueMaster', 'Prince'] },
    { name: 'Pet', values: ['Dog', 'Birds', 'Cats', 'Horse', 'Zebra'] },
  ],
  clues: [
    { id: 1, type: 'C1', x: { category: 'Nationality', value: 'Brit' }, y: { category: 'Color', value: 'Red' }, naturalLanguage: 'The Brit lives in the red house.' },
    { id: 2, type: 'C1', x: { category: 'Nationality', value: 'Swede' }, y: { category: 'Pet', value: 'Dog' }, naturalLanguage: 'The Swede keeps dogs.' },
    { id: 3, type: 'C1', x: { category: 'Nationality', value: 'Dane' }, y: { category: 'Drink', value: 'Tea' }, naturalLanguage: 'The Dane drinks tea.' },
    { id: 4, type: 'C5', x: { category: 'Color', value: 'Green' }, y: { category: 'Color', value: 'White' }, naturalLanguage: 'The green house is immediately left of the white house.' },
    { id: 5, type: 'C1', x: { category: 'Color', value: 'Green' }, y: { category: 'Drink', value: 'Coffee' }, naturalLanguage: 'The green house owner drinks coffee.' },
    { id: 6, type: 'C1', x: { category: 'Smoke', value: 'PallMall' }, y: { category: 'Pet', value: 'Birds' }, naturalLanguage: 'The Pall Mall smoker keeps birds.' },
    { id: 7, type: 'C1', x: { category: 'Color', value: 'Yellow' }, y: { category: 'Smoke', value: 'Dunhill' }, naturalLanguage: 'The yellow house owner smokes Dunhill.' },
    { id: 8, type: 'C3', x: { category: 'Drink', value: 'Milk' }, k: 3, naturalLanguage: 'The middle house drinks milk.' },
    { id: 9, type: 'C3', x: { category: 'Nationality', value: 'Norwegian' }, k: 1, naturalLanguage: 'The Norwegian lives in the first house.' },
    { id: 10, type: 'C7', x: { category: 'Smoke', value: 'Blends' }, y: { category: 'Pet', value: 'Cats' }, naturalLanguage: 'The Blends smoker lives next to the cat owner.' },
    { id: 11, type: 'C7', x: { category: 'Pet', value: 'Horse' }, y: { category: 'Smoke', value: 'Dunhill' }, naturalLanguage: 'The horse owner lives next to the Dunhill smoker.' },
    { id: 12, type: 'C1', x: { category: 'Smoke', value: 'BlueMaster' }, y: { category: 'Drink', value: 'Beer' }, naturalLanguage: 'The Bluemaster smoker drinks beer.' },
    { id: 13, type: 'C1', x: { category: 'Nationality', value: 'German' }, y: { category: 'Smoke', value: 'Prince' }, naturalLanguage: 'The German smokes Prince.' },
    { id: 14, type: 'C7', x: { category: 'Nationality', value: 'Norwegian' }, y: { category: 'Color', value: 'Blue' }, naturalLanguage: 'The Norwegian lives next to the blue house.' },
    { id: 15, type: 'C7', x: { category: 'Smoke', value: 'Blends' }, y: { category: 'Drink', value: 'Water' }, naturalLanguage: 'The Blends smoker has a neighbor who drinks water.' },
  ],
};

// --- Easy 3×3 ---------------------------------------------------------------
const easy: Puzzle = {
  version: 1,
  title: 'Coffee Shop (Easy 3×3)',
  description: 'Three friends, three seats.',
  positionCategory: 'Seat',
  categories: [
    { name: 'Seat', values: ['1', '2', '3'], isPosition: true },
    { name: 'Person', values: ['Ann', 'Bob', 'Cara'] },
    { name: 'Drink', values: ['Latte', 'Mocha', 'Tea'] },
  ],
  clues: [
    { id: 1, type: 'C3', x: { category: 'Person', value: 'Ann' }, k: 1 },
    { id: 2, type: 'C1', x: { category: 'Person', value: 'Ann' }, y: { category: 'Drink', value: 'Latte' } },
    { id: 3, type: 'C5', x: { category: 'Person', value: 'Bob' }, y: { category: 'Person', value: 'Cara' } },
    { id: 4, type: 'C2', x: { category: 'Person', value: 'Bob' }, y: { category: 'Drink', value: 'Tea' } },
  ],
};

// --- Medium 4×4 -------------------------------------------------------------
const medium: Puzzle = {
  version: 1,
  title: 'Race Day (Medium 4×4)',
  description: 'Four runners finish in order.',
  positionCategory: 'Place',
  categories: [
    { name: 'Place', values: ['1', '2', '3', '4'], isPosition: true },
    { name: 'Runner', values: ['Max', 'Nia', 'Omar', 'Pia'] },
    { name: 'Shirt', values: ['Red', 'Blue', 'Green', 'Gold'] },
  ],
  clues: [
    { id: 1, type: 'C8', x: { category: 'Runner', value: 'Max' }, y: { category: 'Runner', value: 'Nia' } },
    { id: 2, type: 'C1', x: { category: 'Runner', value: 'Nia' }, y: { category: 'Shirt', value: 'Gold' } },
    { id: 3, type: 'C3', x: { category: 'Runner', value: 'Omar' }, k: 1 },
    { id: 4, type: 'C5', x: { category: 'Shirt', value: 'Red' }, y: { category: 'Shirt', value: 'Blue' } },
    { id: 5, type: 'C1', x: { category: 'Runner', value: 'Omar' }, y: { category: 'Shirt', value: 'Red' } },
    { id: 6, type: 'C7', x: { category: 'Runner', value: 'Pia' }, y: { category: 'Shirt', value: 'Gold' } },
    { id: 7, type: 'C8', x: { category: 'Runner', value: 'Pia' }, y: { category: 'Runner', value: 'Nia' } },
  ],
};

// --- Under-constrained demo (§5.7) ------------------------------------------
const ambiguous: Puzzle = {
  version: 1,
  title: 'Ambiguous (Under-constrained)',
  description: 'Demonstrates two valid solutions — needs another clue.',
  positionCategory: 'Slot',
  categories: [
    { name: 'Slot', values: ['1', '2', '3'], isPosition: true },
    { name: 'Fruit', values: ['Apple', 'Berry', 'Cherry'] },
    { name: 'Box', values: ['Tin', 'Jar', 'Bag'] },
  ],
  clues: [
    { id: 1, type: 'C3', x: { category: 'Fruit', value: 'Apple' }, k: 1 },
    { id: 2, type: 'C1', x: { category: 'Fruit', value: 'Apple' }, y: { category: 'Box', value: 'Tin' } },
  ],
};

// --- Over-constrained demo (§5.8 / MUS) -------------------------------------
const contradictory: Puzzle = {
  version: 1,
  title: 'Contradiction (Over-constrained)',
  description: 'Demonstrates a minimal unsatisfiable subset.',
  positionCategory: 'Spot',
  categories: [
    { name: 'Spot', values: ['1', '2', '3'], isPosition: true },
    { name: 'Animal', values: ['Fox', 'Owl', 'Bat'] },
    { name: 'Tag', values: ['A', 'B', 'C'] },
  ],
  clues: [
    { id: 1, type: 'C3', x: { category: 'Animal', value: 'Fox' }, k: 1 },
    { id: 2, type: 'C8', x: { category: 'Animal', value: 'Owl' }, y: { category: 'Animal', value: 'Fox' } },
    { id: 3, type: 'C1', x: { category: 'Animal', value: 'Bat' }, y: { category: 'Tag', value: 'A' } },
  ],
};

export const EXAMPLES: Example[] = [
  { id: 'zebra', name: "Einstein's Zebra", difficulty: 'hard', puzzle: zebra },
  { id: 'easy', name: 'Coffee Shop', difficulty: 'easy', puzzle: easy },
  { id: 'medium', name: 'Race Day', difficulty: 'medium', puzzle: medium },
  { id: 'ambiguous', name: 'Ambiguous', difficulty: 'easy', puzzle: ambiguous },
  { id: 'contradictory', name: 'Contradiction', difficulty: 'easy', puzzle: contradictory },
];
