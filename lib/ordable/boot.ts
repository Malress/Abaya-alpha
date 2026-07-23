import "server-only";
import { cookies } from "next/headers";
import {
  getBranches,
  getCategories,
  getConfig,
  getPages,
} from "./endpoints";
import type { Branch, Category, StoreConfig, StorePage } from "./types";
import type { Locale } from "../i18n";

export interface BootData {
  config: StoreConfig;
  branches: Branch[];
  branchId: number;
  categories: Category[];
  pages: StorePage[];
}

// Fetch the SEO-critical shell once on the server. Categories are seeded here so the
// client provider never re-fetches them after hydration.
export async function loadBoot(): Promise<BootData | null> {
  try {
    const [config, branches, pages] = await Promise.all([
      getConfig(),
      getBranches(),
      getPages().catch(() => [] as StorePage[]),
    ]);
    const branchId = branches[0]?.id ?? 0;
    const categories = branchId ? await getCategories(branchId, 8) : [];
    return { config, branches, branchId, categories, pages };
  } catch (err) {
    // Re-throw Next.js control-flow signals (dynamic rendering, redirect, notFound)
    // so the route is correctly treated as dynamic instead of showing a fallback.
    if (typeof (err as { digest?: string })?.digest === "string") throw err;
    console.error("[ordable] boot failed:", (err as Error).message);
    return null;
  }
}

export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  return store.get("locale")?.value === "ar" ? "ar" : "en";
}
