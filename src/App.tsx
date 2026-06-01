/**
 * App shell. The three-pane layout (§6.1) is assembled here from independent
 * pane components — composition, not a monolithic inherited page class.
 * Full pane wiring lands with the UI task; this is the structural skeleton.
 */
export default function App() {
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2">
        <h1 className="text-lg font-semibold">Logic-Grid Puzzle Solver</h1>
        <span className="text-sm text-slate-500">
          define · solve · explain
        </span>
      </header>
      <main className="flex min-h-0 flex-1">
        <aside
          className="w-[300px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-3"
          aria-label="Puzzle setup"
        >
          <p className="text-sm text-slate-500">Setup pane</p>
        </aside>
        <section
          className="min-w-0 flex-1 overflow-auto p-3"
          aria-label="Grid view"
        >
          <p className="text-sm text-slate-500">Grid pane</p>
        </section>
        <aside
          className="w-[400px] shrink-0 overflow-y-auto border-l border-slate-200 bg-white p-3"
          aria-label="Deduction chain"
        >
          <p className="text-sm text-slate-500">Deduction pane</p>
        </aside>
      </main>
    </div>
  );
}
