export type ValuationPropertyType = "haus" | "wohnung";

export type ValuationCondition =
  | "renovierungsbeduerftig"
  | "durchschnitt"
  | "gepflegt"
  | "modernisiert";

export type ValuationRange = {
  min: number;
  avg: number;
  max: number;
};

export type ValuationPriceContext = {
  averagePricePerSqm: number | null;
  housePriceRange: ValuationRange | null;
  apartmentPriceRange: ValuationRange | null;
};

export type ValuationComputationInput = {
  propertyType: ValuationPropertyType;
  livingArea: number;
  rooms?: number | null;
  yearBuilt?: number | null;
  condition: ValuationCondition;
};

export type ValuationComputationResult = {
  pricePerSqm: ValuationRange;
  totalPrice: ValuationRange;
  factor: number;
};

function clampFactor(value: number): number {
  return Math.max(0.8, Math.min(1.25, value));
}

function resolveConditionFactor(condition: ValuationCondition): number {
  switch (condition) {
    case "renovierungsbeduerftig":
      return 0.92;
    case "gepflegt":
      return 1.04;
    case "modernisiert":
      return 1.09;
    default:
      return 1;
  }
}

function resolveYearFactor(yearBuilt?: number | null): number {
  if (!yearBuilt || !Number.isFinite(yearBuilt)) return 1;
  if (yearBuilt >= 2015) return 1.08;
  if (yearBuilt >= 2000) return 1.04;
  if (yearBuilt < 1950) return 0.96;
  return 1;
}

function resolveRoomFactor(propertyType: ValuationPropertyType, rooms?: number | null): number {
  if (propertyType !== "wohnung" || !rooms || !Number.isFinite(rooms)) return 1;
  if (rooms <= 1) return 0.97;
  if (rooms >= 4) return 1.03;
  return 1;
}

function roundPrice(value: number): number {
  return Math.round(value);
}

export function computeValuationRange(
  context: ValuationPriceContext,
  input: ValuationComputationInput,
): ValuationComputationResult | null {
  const baseRange = input.propertyType === "haus"
    ? context.housePriceRange
    : context.apartmentPriceRange;

  if (!baseRange) return null;
  if (!Number.isFinite(input.livingArea) || input.livingArea <= 10) return null;

  const factor = clampFactor(
    resolveConditionFactor(input.condition)
      * resolveYearFactor(input.yearBuilt)
      * resolveRoomFactor(input.propertyType, input.rooms),
  );

  const pricePerSqm: ValuationRange = {
    min: roundPrice(baseRange.min * factor),
    avg: roundPrice(baseRange.avg * factor),
    max: roundPrice(baseRange.max * factor),
  };

  const totalPrice: ValuationRange = {
    min: roundPrice(pricePerSqm.min * input.livingArea),
    avg: roundPrice(pricePerSqm.avg * input.livingArea),
    max: roundPrice(pricePerSqm.max * input.livingArea),
  };

  return {
    pricePerSqm,
    totalPrice,
    factor,
  };
}
