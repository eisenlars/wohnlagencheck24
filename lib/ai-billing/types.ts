export type AiBillingScope = "portal_partner" | "network_partner";

export type AiBillingMode = "included" | "credit_based" | "blocked";

export type AiUsageFeature =
  | "content_optimize"
  | "content_translate"
  | "seo_meta_generate"
  | "blog_generate"
  | "portal_cms_translate"
  | "portal_cms_rewrite"
  | "i18n_auto_sync";

export type AiBillingContext = {
  billing_scope: AiBillingScope;
  billing_mode: AiBillingMode;
  billing_owner_partner_id: string | null;
  billing_subject_partner_id: string | null;
  network_partner_id: string | null;
  feature: AiUsageFeature;
};
