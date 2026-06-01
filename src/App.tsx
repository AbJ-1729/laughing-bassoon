/**
 * App shell. The three-pane layout (§6.1) is assembled from independent pane
 * components — composition, not a monolithic page.
 */
import TopBar from './ui/TopBar';
import SetupPane from './ui/SetupPane';
import GridPane from './ui/GridPane';
import DeductionPane from './ui/DeductionPane';

export default function App() {
  return (
    <div className="flex h-full flex-col">
      <TopBar />
      <main className="flex min-h-0 flex-1">
        <aside
          className="w-[300px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-3"
          aria-label="Puzzle setup"
        >
          <SetupPane />
        </aside>
        <section className="min-w-0 flex-1 overflow-auto p-3" aria-label="Grid view">
          <GridPane />
        </section>
        <aside
          className="w-[400px] shrink-0 overflow-y-auto border-l border-slate-200 bg-white p-3"
          aria-label="Deduction chain"
        >
          <DeductionPane />
        </aside>
      </main>
    </div>
  );
}
