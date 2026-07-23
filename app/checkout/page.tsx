import { loadBoot, getLocale } from "@/lib/ordable/boot";
import {
  getAreas,
  getPaymentMethods,
  getPromotions,
} from "@/lib/ordable/endpoints";
import { getCountries } from "@/lib/ordable/endpoints";
import CheckoutView from "@/components/checkout/CheckoutView";
import { pick } from "@/lib/i18n";

export const metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const [boot, locale] = await Promise.all([loadBoot(), getLocale()]);
  if (!boot) return null;

  const [areas, payments, promotions, countries] = await Promise.all([
    getAreas(boot.branches.map((b) => b.id)).catch(() => []),
    getPaymentMethods().catch(() => []),
    getPromotions(boot.branchId).catch(() => []),
    getCountries().catch(() => []),
  ]);

  // Checkout-agreement pages (placement 2, checkable).
  const agreements = boot.pages.filter(
    (p) => String(p.placement) === "2" || p.placement === 2,
  );

  return (
    <div className="container container-narrow section-tight">
      <h1 className="section-title" style={{ marginBottom: 32 }}>
        {pick(locale, "Checkout", "الدفع")}
      </h1>
      <CheckoutView
        branches={boot.branches}
        areas={areas}
        payments={payments}
        promotions={promotions.filter((p) => !p.code)}
        countries={countries}
        agreements={agreements}
      />
    </div>
  );
}
