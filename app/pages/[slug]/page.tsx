import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { loadBoot, getLocale } from "@/lib/ordable/boot";
import { pick } from "@/lib/i18n";
import { slugify } from "@/lib/slug";
import { sanitize } from "@/lib/sanitize";

async function resolve(slug: string) {
  const [boot, locale] = await Promise.all([loadBoot(), getLocale()]);
  if (!boot) return null;
  const page = boot.pages.find((p) => slugify(p.title) === slug);
  return page ? { page, locale } : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const r = await resolve(slug);
  if (!r) return {};
  return { title: pick(r.locale, r.page.title, r.page.title_ar) };
}

export default async function StaticPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const r = await resolve(slug);
  if (!r) notFound();
  const { page, locale } = r;
  const title = pick(locale, page.title, page.title_ar);
  const html = sanitize(locale === "ar" ? page.content_ar || page.content : page.content || page.content_ar);

  return (
    <div className="container container-narrow section-tight">
      <div className="section-head">
        <h1 className="section-title">{title}</h1>
      </div>
      <div className="prose" style={{ maxWidth: 720, margin: "0 auto" }} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
