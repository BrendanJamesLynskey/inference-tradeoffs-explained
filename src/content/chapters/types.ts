import type { RefKey } from "../refs";

/** One chapter's content: its animated mechanism, its prose and its sources. */
export type ChapterContent = {
  /** The hero: the mechanism, animated from the simulator's records. */
  Hero: () => JSX.Element;
  /** For chapters with no sweep family: the recorded results in matrix form. */
  Row?: () => JSX.Element;
  /** Why it behaves as measured. */
  Body: () => JSX.Element;
  refs: readonly RefKey[];
};
