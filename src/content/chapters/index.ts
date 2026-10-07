/** Every chapter's content, by slug (src/lib/tradeoffs/chapters.ts lists them). */
import { C01 } from "./c01";
import { C02 } from "./c02";
import { C03 } from "./c03";
import { C04 } from "./c04";
import { C05 } from "./c05";
import { C06 } from "./c06";
import { C07 } from "./c07";
import { C08 } from "./c08";
import { C09 } from "./c09";
import { C10 } from "./c10";
import { C11 } from "./c11";
import { C12 } from "./c12";
import { C13 } from "./c13";
import type { ChapterContent } from "./types";

export const CONTENT: Record<string, ChapterContent> = {
  "01-batching-and-chunked-prefill": C01,
  "02-paged-kv-and-preemption": C02,
  "03-prefix-caching": C03,
  "04-disaggregation": C04,
  "05-heterogeneous-and-optical-pools": C05,
  "06-kv-handoff-and-compression": C06,
  "07-encoder-only-prefill": C07,
  "08-tp-pp-ep": C08,
  "09-quantisation": C09,
  "10-speculative-decoding": C10,
  "11-power-and-energy": C11,
  "12-hardware-and-cost": C12,
  "13-combining-levers": C13,
};
