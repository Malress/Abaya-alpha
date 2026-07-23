import type { Category, ProductShort } from "./ordable/types";

// The target store returns null slugs, so slugs are derived and always carry the numeric
// id as a suffix. This keeps routes stable/readable while remaining reversible to an id.

export function slugify(input: string): string {
  return (input || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function categorySlug(c: Pick<Category, "slug" | "name" | "id">): string {
  const base = c.slug || slugify(c.name) || "category";
  return `${base}-${c.id}`;
}

export function productSlug(p: Pick<ProductShort, "slug" | "name" | "id">): string {
  const base = p.slug || slugify(p.name) || "product";
  return `${base}-${p.id}`;
}

// Recover the trailing numeric id from a derived slug.
export function idFromSlug(slug: string): number | null {
  const m = /(\d+)$/.exec(slug);
  return m ? Number(m[1]) : null;
}
