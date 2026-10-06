/** The site's pages, shared by the e2e specs. */
export const PAGES = [
  "/",
  "/explore",
  "/matrix",
  "/what-if",
  "/learn",
  "/method",
  "/about",
  "/learn/01-batching-and-chunked-prefill",
  "/learn/02-paged-kv-and-preemption",
  "/learn/03-prefix-caching",
  "/learn/04-disaggregation",
  "/learn/08-tp-pp-ep",
  "/learn/09-quantisation",
  "/learn/10-speculative-decoding",
  "/learn/13-combining-levers",
];

/** [page, test id] of every animation. */
export const ANIMATIONS = [
  ["/", "hero-home"],
  ["/explore", "explorer"],
  ["/matrix", "matrix"],
  ["/learn/01-batching-and-chunked-prefill", "lever-matrix"],
  ["/what-if", "timeline"],
] as const;
