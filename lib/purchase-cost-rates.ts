export type PurchaseCostRates = {
  realEstateTransferTaxRate: number;
  notaryRate: number;
  landRegistryRate: number;
  buyerCommissionDefaultRate: number;
};

const DEFAULT_PURCHASE_COST_RATES: PurchaseCostRates = {
  realEstateTransferTaxRate: 5.5,
  notaryRate: 1.5,
  landRegistryRate: 0.5,
  buyerCommissionDefaultRate: 3.57,
};

const PURCHASE_COST_RATES_BY_BUNDESLAND: Record<string, PurchaseCostRates> = {
  "baden-wuerttemberg": { ...DEFAULT_PURCHASE_COST_RATES, realEstateTransferTaxRate: 5.0 },
  bayern: { ...DEFAULT_PURCHASE_COST_RATES, realEstateTransferTaxRate: 3.5 },
  berlin: { ...DEFAULT_PURCHASE_COST_RATES, realEstateTransferTaxRate: 6.0 },
  brandenburg: { ...DEFAULT_PURCHASE_COST_RATES, realEstateTransferTaxRate: 6.5 },
  bremen: { ...DEFAULT_PURCHASE_COST_RATES, realEstateTransferTaxRate: 5.5 },
  hamburg: { ...DEFAULT_PURCHASE_COST_RATES, realEstateTransferTaxRate: 5.5 },
  hessen: { ...DEFAULT_PURCHASE_COST_RATES, realEstateTransferTaxRate: 6.0 },
  "mecklenburg-vorpommern": { ...DEFAULT_PURCHASE_COST_RATES, realEstateTransferTaxRate: 6.0 },
  niedersachsen: { ...DEFAULT_PURCHASE_COST_RATES, realEstateTransferTaxRate: 5.0 },
  "nordrhein-westfalen": { ...DEFAULT_PURCHASE_COST_RATES, realEstateTransferTaxRate: 6.5 },
  "rheinland-pfalz": { ...DEFAULT_PURCHASE_COST_RATES, realEstateTransferTaxRate: 5.0 },
  saarland: { ...DEFAULT_PURCHASE_COST_RATES, realEstateTransferTaxRate: 6.5 },
  sachsen: { ...DEFAULT_PURCHASE_COST_RATES, realEstateTransferTaxRate: 5.5 },
  "sachsen-anhalt": { ...DEFAULT_PURCHASE_COST_RATES, realEstateTransferTaxRate: 5.0 },
  "schleswig-holstein": { ...DEFAULT_PURCHASE_COST_RATES, realEstateTransferTaxRate: 6.5 },
  thueringen: { ...DEFAULT_PURCHASE_COST_RATES, realEstateTransferTaxRate: 5.0 },
};

export function getPurchaseCostRates(bundeslandSlug?: string | null): PurchaseCostRates {
  const key = String(bundeslandSlug ?? "").trim().toLowerCase();
  return PURCHASE_COST_RATES_BY_BUNDESLAND[key] ?? DEFAULT_PURCHASE_COST_RATES;
}
