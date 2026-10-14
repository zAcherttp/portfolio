import "./factory.css";
import { FactoryLive } from "./live";

/**
 * The screw factory as a figure in the reading column. It is built in the
 * game's order the first time it scrolls into view; its switch powers it.
 */
export function FactoryFigure() {
  return (
    <section className="mb-12" aria-labelledby="factory-title">
      <h2 id="factory-title" className="sr-only">
        Screw factory
      </h2>
      <FactoryLive reveal="place" />
      <p className="mt-3 font-mono text-[11px] text-subtle">
        Drawn from Coffee Stain Studios&apos; Satisfactory models, used
        non-commercially. Not affiliated.
      </p>
    </section>
  );
}
