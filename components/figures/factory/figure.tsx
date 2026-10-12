import "./factory.css";
import { FactoryLive } from "./live";

export function FactoryFigure() {
  return (
    <section className="mb-12" aria-labelledby="factory-title">
      <h2
        id="factory-title"
        className="mb-3 text-sm font-normal text-muted-foreground"
      >
        Screw factory
      </h2>
      <p className="mb-4 max-w-2xl text-pretty text-sm leading-6 text-muted-foreground">
        A Satisfactory build at real recipe rates: one miner feeds two smelters,
        and five constructors cast their ingots into 240 screws a minute for the
        Dimensional Depot. Scroll past the bottom to power it.
      </p>
      <FactoryLive />
      <p className="mt-3 font-mono text-[11px] text-subtle">
        Drawn from Coffee Stain Studios&apos; models, used non-commercially. Not
        affiliated.
      </p>
    </section>
  );
}
