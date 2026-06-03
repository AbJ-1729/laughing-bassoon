/**
 * Export helpers (SPECS §6.2): puzzle → JSON, deduction chain → Markdown,
 * grid → PNG. All client-side, no server.
 */
import type { Puzzle } from '../core/types';
import type { Explanation } from '../core/inference/types';

function download(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportPuzzleJson(puzzle: Puzzle): void {
  download(
    `${slug(puzzle.title)}.json`,
    new Blob([JSON.stringify(puzzle, null, 2)], { type: 'application/json' }),
  );
}

export function deductionToMarkdown(
  puzzle: Puzzle,
  explanation: Explanation,
): string {
  const lines: string[] = [];
  lines.push(`# ${puzzle.title ?? 'Logic-grid puzzle'} — Deduction Chain`, '');
  if (puzzle.description) lines.push(puzzle.description, '');
  lines.push('## Clues', '');
  puzzle.clues.forEach((c) => {
    lines.push(`${c.id}. ${c.naturalLanguage ?? ''}`.trimEnd());
  });
  lines.push('', '## Steps', '');
  for (const step of explanation.steps) {
    const cites: string[] = [];
    if (step.citedClues.length) cites.push(`clues ${step.citedClues.join(', ')}`);
    if (step.citedSteps.length) cites.push(`steps ${step.citedSteps.join(', ')}`);
    const suffix = cites.length ? ` _(${cites.join('; ')})_` : '';
    lines.push(`${step.stepNumber}. **[${step.rule}]** ${step.englishSentence}${suffix}`);
  }
  return lines.join('\n');
}

export function exportDeductionMarkdown(
  puzzle: Puzzle,
  explanation: Explanation,
): void {
  download(
    `${slug(puzzle.title)}-deduction.md`,
    new Blob([deductionToMarkdown(puzzle, explanation)], { type: 'text/markdown' }),
  );
}

/** Rasterise a DOM node (the grid) to PNG via SVG foreignObject. */
export async function exportGridPng(node: HTMLElement, title: string): Promise<void> {
  const rect = node.getBoundingClientRect();
  const width = Math.ceil(rect.width);
  const height = Math.ceil(rect.height);
  const clone = node.cloneNode(true) as HTMLElement;
  inlineStyles(node, clone);
  const xml = new XMLSerializer().serializeToString(clone);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml">${xml}</div></foreignObject></svg>`;
  const img = new Image();
  const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('PNG render failed'));
    img.src = svgUrl;
  });
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error('toBlob returned null — canvas may be tainted by cross-origin content'));
    });
  });
  download(`${slug(title)}-grid.png`, blob);
}

/** Copy computed styles from the live tree onto the clone (recursively). */
function inlineStyles(source: Element, target: Element): void {
  const computed = window.getComputedStyle(source);
  let css = '';
  for (const prop of computed) css += `${prop}:${computed.getPropertyValue(prop)};`;
  target.setAttribute('style', css);
  for (let i = 0; i < source.children.length; i++) {
    inlineStyles(source.children[i], target.children[i]);
  }
}

function slug(title?: string): string {
  return (title ?? 'puzzle').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'puzzle';
}
