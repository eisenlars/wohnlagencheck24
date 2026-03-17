// features/valuation/components/ValuationWizard.tsx

"use client";

import type { ResolvedLeadGeneratorConfig } from "@/features/lead-generators/core/types";
import { ValuationLeadFlow } from "@/features/lead-generators/valuation/ValuationLeadFlow";
import type { ValuationPriceContext } from "@/features/lead-generators/valuation/pricing";

interface ValuationWizardProps {
  ctx?: Record<string, string | undefined>;
  basePrice?: number;
  level: 'kreis' | 'ort' | 'global';
  locale?: string | null;
  pagePath?: string;
  generatorConfig?: ResolvedLeadGeneratorConfig | null;
  priceContext?: ValuationPriceContext | null;
  previewMode?: boolean;
}

export function ValuationWizard({
  locale,
  pagePath = "/immobilienmarkt",
  generatorConfig,
  priceContext,
  previewMode = false,
}: ValuationWizardProps) {
  if (!generatorConfig || !priceContext) {
    return null;
  }

  return (
    <ValuationLeadFlow
      locale={locale}
      pagePath={pagePath}
      config={generatorConfig}
      priceContext={priceContext}
      previewMode={previewMode}
    />
  );
}
