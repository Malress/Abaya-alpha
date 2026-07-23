// Shared ordable/ data models. These describe the *verified* shapes returned by the
// target store (https://ress.ordable.com/public). Fields the API may omit are optional.

export type Locale = "en" | "ar";

export interface Currency {
  iso: string;
  symbol: string;
  symbol_ar?: string;
  decimals: number;
  rate?: number;
  is_base?: boolean;
}

export interface StoreConfig {
  name: string;
  ar_name?: string;
  slogan?: string;
  ar_slogan?: string;
  logo?: string;
  logo_ar?: string;
  logo_thumb?: string;
  cover?: string;
  cover_medium?: string;
  cover_large?: string;
  favicon?: string;
  domain?: string;
  meta_name?: string;
  meta_description?: string;
  gallery?: string[];

  theme_color?: string;
  theme_color_light?: string;
  discount_tag_color?: string;

  base_currency?: Currency;
  enable_currency_converter?: boolean;

  minimum_order?: number;
  minimum_order_pickup?: number;
  enable_international_delivery?: boolean;
  allow_preordering?: boolean;

  enable_loyalty_points?: boolean;
  enable_loyalty_points_payment?: boolean;
  loyalty_points_conversion_rate?: number;
  loyalty_points_to_money_conversion_rate?: number;
  loyalty_points_to_money_threshold?: number;
  enable_wallet?: boolean;
  enable_wallet_staff?: boolean;

  enable_gifts?: boolean;
  enable_gifts_message_form?: boolean;
  enable_force_gift_name_number?: boolean;
  gift_message_character_limit?: number;
  enable_unknown_gift_recipient_location?: boolean;
  enable_gift_links?: boolean;
  enable_send_gift_anonymously?: boolean;
  disable_cash_for_gift?: boolean;
  enable_gift_wrapping?: boolean;
  gift_wrapping_price?: number;

  enable_feedback?: boolean;
  enable_product_feedback?: boolean;
  enable_filter_and_sort?: boolean;
  enable_product_recommendations?: boolean;
  enable_product_cross_sell_items?: boolean;
  enable_popup_banner?: boolean;
  popup_banner?: PopupBanner[] | PopupBanner | null;
  enable_phone_login?: boolean;

  instagram_link?: string;
  whatsapp_link?: string;
  tiktok_link?: string;
  snapchat_link?: string;
  facebook_link?: string;
  twitter_link?: string;
  youtube_link?: string;

  contact_number?: string;
  email?: string;
}

export interface PopupBanner {
  id: number | string;
  type?: string;
  image?: string;
  title?: string;
  title_ar?: string;
  content?: string;
  content_ar?: string;
  redirect_link?: string;
  window_mode?: number; // 0 modal, 1 full-screen
  autoclose?: boolean;
  autoclose_timer?: number;
}

export interface WorkingHour {
  day: number; // 0 = Sunday
  start: string;
  end: string;
}

export interface Branch {
  id: number;
  name: string;
  ar_name?: string;
  lat?: string;
  lng?: string;
  enable_delivery?: boolean;
  enable_pickup?: boolean;
  enable_on_demand_delivery?: boolean;
  enable_on_demand_pickup?: boolean;
  enable_scheduled_delivery?: boolean;
  enable_scheduled_pickup?: boolean;
  on_demand_delivery_minutes?: number;
  on_demand_pickup_minutes?: number;
  enable_on_demand_custom_string?: boolean;
  on_demand_custom_string?: string;
  on_demand_custom_string_ar?: string;
  minimum_lead_time?: number;
  pickup_interval?: number;
  enable_same_day_delivery?: boolean;
  delivery_working_hours?: WorkingHour[];
  pickup_working_hours?: WorkingHour[];
  scheduled_delivery_slots?: WorkingHour[];
  enable_vat?: boolean;
  vat_rate?: number;
  remove_delivery_charge_from_vat?: boolean;
  disable_cash?: boolean;
  minimum_order_pickup?: number;
  country?: string | { name?: string; ar_name?: string };
  area?: string | { name?: string; ar_name?: string };
  sort_order?: number;
}

export interface Area {
  id: number; // THE area_id for orders (branch-delivery-charge id)
  branch_id?: number;
  name: string;
  ar_name?: string;
  country?: { name?: string; ar_name?: string };
  province?: { name?: string; ar_name?: string };
  delivery_rate?: number;
  minimum_order_value?: number;
  delivery_minutes?: number;
}

export interface Country {
  id: number;
  name: string;
  ar_name?: string;
  alpha_2_code?: string;
  dial_code?: string;
  flag?: string;
  currency_iso?: string;
}

export interface Category {
  id: number;
  name: string;
  ar_name?: string;
  slug?: string | null;
  is_child?: boolean;
  no_mingling?: boolean;
  sort_order?: number;
  photo?: string | null;
  sub_categories?: number[];
  products?: ProductShort[];
}

export interface SmartCategory {
  key: "most_selling" | "newest" | "discounted";
  name: string;
  ar_name?: string;
  sort_order?: number;
  photo?: string | null;
  show_cover?: boolean;
  products_count?: number;
  products?: ProductShort[];
  gallery?: string[];
}

export type ProductType =
  | "produced"
  | "stocked"
  | "bookable"
  | "digital"
  | "composite";

export interface ProductShort {
  id: number;
  category_id?: number;
  category_name?: string;
  category_ar_name?: string;
  name: string;
  ar_name?: string;
  slug?: string | null;
  price: number;
  striked_price?: number | null;
  least_price?: number;
  photo?: string | null;
  photo_thumb?: string | null;
  photo_small?: string | null;
  photo_medium?: string | null;
  type_of_product?: ProductType;
  product_type?: ProductType;
  inventory_on_hand?: number | null;
  buyable?: boolean;
  has_variants?: boolean;
  is_variant?: boolean;
  has_required_options?: boolean;
  allow_preordering?: boolean;
  min_addable_quantity?: number;
  sort_order?: number;
}

export interface VariantKey {
  variant_key: string;
  variant_key_ar?: string;
}

export interface VariantValue {
  variant_key: string;
  variant_value: string;
  variant_value_ar?: string;
}

export interface OptionChoice {
  id: number;
  name?: string | null;
  ar_name?: string | null;
  price?: number;
  striked_price?: number | null;
  maximum?: number | null;
  preselected?: number;
  inventory?: number | null;
  sort_order?: number;
}

export interface ProductOption {
  id: number;
  name?: string | null;
  ar_name?: string | null;
  option_name?: string | null;
  option_ar_name?: string | null;
  multiple?: boolean;
  is_required?: boolean;
  minimum?: number;
  maximum?: number;
  sort_order?: number;
  choices?: OptionChoice[];
}

export interface GalleryImage {
  photo?: string;
  photo_medium?: string;
  photo_thumb?: string;
}

export interface ProductVariant {
  id: number;
  name: string;
  ar_name?: string;
  price: number;
  striked_price?: number | null;
  buyable?: boolean;
  type_of_product?: ProductType;
  inventory_on_hand?: number | null;
  photo?: string | null;
  photo_medium?: string | null;
  photo_small?: string | null;
  variant_values?: VariantValue[];
}

export interface ExtraField {
  id: number;
  name?: string;
  ar_name?: string;
  type: "text" | "file" | "checkbox";
  required?: boolean;
  sort_order?: number;
}

export interface BookingSlot {
  id: number;
  date: string;
  start: string;
  end: string;
  inventory?: number;
}

export interface ProductDetail extends ProductShort {
  description?: string;
  ar_description?: string;
  short_description?: string;
  ar_short_description?: string;
  meta_name?: string;
  meta_description?: string;
  variant_keys?: VariantKey[];
  variant_values?: VariantValue[];
  variants?: ProductVariant[];
  parent_product_id?: number | null;
  options?: ProductOption[];
  extra_fields?: ExtraField[];
  booking_slots?: BookingSlot[];
  gallery?: GalleryImage[];
  min_addable_quantity?: number;
  max_addable_quantity?: number;
  increments?: number;
  no_mingling?: boolean;
  allow_special_remarks?: boolean;
  cash_only?: boolean;
  credit_only?: boolean;
  show_quick_add_to_cart?: boolean;
}

export interface PaymentMethod {
  value: string;
  label: string;
  ar_label?: string;
  icon?: string;
}

export interface StorePage {
  title: string;
  title_ar?: string;
  content?: string;
  content_ar?: string;
  placement?: number | string; // 0 footer, 1 nav, 2 checkout-agreement
  window_type?: string;
  checkable?: boolean;
  custom_text?: string;
  custom_text_ar?: string;
}

export interface Promotion {
  id: number;
  name: string;
  ar_name?: string;
  discount_description?: string;
  discount_description_ar?: string;
  code?: string | null;
  conditions?: { type: string; value: unknown }[];
  discounts?: { id: number; type: string; value: number }[];
  banner?: string;
  banner_small?: string;
  background_color?: string;
  expiry?: string;
  show_expiry?: boolean;
  remaining?: number;
  show_remaining?: boolean;
  hide_promotion?: boolean;
  bypass_minimum_order?: boolean;
  max_discount_amount?: number;
}

export interface Review {
  rating: number | null;
  comment?: string;
  name?: string;
}

// ---- Cart / order ----

export interface SelectedOption {
  id: number; // choice id
  quantity: number;
  name?: string;
  price?: number;
}

export interface CartLine {
  lineId: string;
  productId: number; // child/standalone id sent to the API
  parentId?: number;
  name: string;
  ar_name?: string;
  image?: string | null;
  unitPrice: number; // resolved product/variant price
  quantity: number;
  options: SelectedOption[];
  extraFields?: { id: number; value: string; name?: string }[];
  bookingSlotId?: number | null;
  specialRequests?: string;
  variantLabel?: string;
  categoryId?: number;
  noMingling?: boolean;
  maxQuantity?: number;
}
