/**
 * Site-wide constants: this site's URL, its companion sites, the author's
 * simulator and slide series it links into, and its own repository.
 */

/** This site (production). */
export const SITE_URL = "https://inference-tradeoffs-explained.vercel.app";

/** The companion sites. */
export const DECODER_URL = "https://transformer-decoder-explained.vercel.app";
export const INFERENCE_URL = "https://llm-inference-explained.vercel.app";
export const ARCHITECTURES_URL =
  "https://llm-architectures-explained.vercel.app";
export const KERNELS_URL = "https://gpu-kernels-explained.vercel.app";
export const NUMERICS_URL = "https://numerics-explained.vercel.app";
export const SILICON_URL = "https://systolic-arrays-explained.vercel.app";

export const GITHUB_URL =
  "https://github.com/BrendanJamesLynskey/inference-tradeoffs-explained";

/** The simulator whose sweep and engine this site is built on. */
export const SIM_REPO =
  "https://github.com/BrendanJamesLynskey/Disaggregated_Inference_Sim";

/** A file in the simulator's repository at a commit. */
export function simFile(commit: string, path: string): string {
  return `${SIM_REPO}/blob/${commit}/${path}`;
}

/** The Inference Simulators slide series (hub). */
export const INFSIM_HUB =
  "https://brendanjameslynskey.github.io/LLM_Hub_Inference_Simulators/";

/** A slide in one of the author's decks (anchors are #slide-NN). */
export function deck(repo: string, slide?: number): string {
  const base = `https://brendanjameslynskey.github.io/${repo}/`;
  return slide === undefined
    ? base
    : `${base}#slide-${String(slide).padStart(2, "0")}`;
}

/** A file in this site's repository on GitHub. */
export function repoFile(path: string): string {
  return `${GITHUB_URL}/blob/main/${path}`;
}

/** A chapter of one of the companion sites. */
export const kernelsCh = (slug: string): string =>
  `${KERNELS_URL}/learn/${slug}`;
export const numericsCh = (slug: string): string =>
  `${NUMERICS_URL}/learn/${slug}`;
export const siliconCh = (slug: string): string =>
  `${SILICON_URL}/learn/${slug}`;
export const inferenceCh = (slug: string): string =>
  `${INFERENCE_URL}/learn/${slug}`;
export const architecturesCh = (slug: string): string =>
  `${ARCHITECTURES_URL}/learn/${slug}`;
