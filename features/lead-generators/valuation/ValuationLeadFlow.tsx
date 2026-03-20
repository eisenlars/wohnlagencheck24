"use client";

import { useMemo, useState } from "react";

import { submitLeadGenerator } from "@/features/lead-generators/core/submission";
import type { LeadGeneratorSubmissionPayload, ResolvedLeadGeneratorConfig } from "@/features/lead-generators/core/types";
import { getValuationCopy } from "./copy";
import {
  computeValuationRange,
  type ValuationCondition,
  type ValuationPriceContext,
  type ValuationPropertyType,
} from "./pricing";

type StepKey = "mode" | "location" | "object" | "estimate" | "contact";
type ExperienceMode = "data_range" | "digital_assistant" | "advisor_direct";

type FormState = {
  experienceMode: ExperienceMode;
  entryMode: "soft" | "address";
  postalOrCity: string;
  address: string;
  targetAreaId: string;
  propertyType: ValuationPropertyType;
  livingArea: string;
  rooms: string;
  yearBuilt: string;
  condition: ValuationCondition;
  features: string;
  name: string;
  email: string;
  phone: string;
  consent: boolean;
};

type Props = {
  locale?: string | null;
  pagePath: string;
  config: ResolvedLeadGeneratorConfig;
  priceContext: ValuationPriceContext;
  previewMode?: boolean;
};

const STEPS: StepKey[] = ["mode", "location", "object", "estimate", "contact"];

function formatCurrency(value: number, locale: string): string {
  return new Intl.NumberFormat(locale === "en" ? "en-US" : "de-DE").format(value) + " EUR";
}

function formatStepCounter(template: string, current: number, total: number): string {
  return template.replace("{current}", String(current)).replace("{total}", String(total));
}

export function ValuationLeadFlow({
  locale,
  pagePath,
  config,
  priceContext,
  previewMode = false,
}: Props) {
  const copy = getValuationCopy(locale);
  const [stepIndex, setStepIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState<FormState>({
    experienceMode: "data_range",
    entryMode: "soft",
    postalOrCity: "",
    address: "",
    targetAreaId: config.allowedAreaOptions[0]?.areaId ?? config.sourceAreaId,
    propertyType: "wohnung",
    livingArea: "",
    rooms: "",
    yearBuilt: "",
    condition: "durchschnitt",
    features: "",
    name: "",
    email: "",
    phone: "",
    consent: false,
  });

  const numericLivingArea = Number(form.livingArea);
  const numericRooms = form.rooms.trim().length > 0 ? Number(form.rooms) : null;
  const numericYearBuilt = form.yearBuilt.trim().length > 0 ? Number(form.yearBuilt) : null;

  const valuation = useMemo(
    () => computeValuationRange(priceContext, {
      propertyType: form.propertyType,
      livingArea: numericLivingArea,
      rooms: numericRooms,
      yearBuilt: numericYearBuilt,
      condition: form.condition,
    }),
    [priceContext, form.propertyType, numericLivingArea, numericRooms, numericYearBuilt, form.condition],
  );

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function canContinueFromLocation() {
    if (config.scopeMode === "partner_areas_only" && !form.targetAreaId) return false;
    if (form.entryMode === "address") {
      return form.address.trim().length >= 5;
    }
    return true;
  }

  function canContinueFromObject() {
    return Number.isFinite(numericLivingArea) && numericLivingArea > 15;
  }

  function getNextStepAfterLocation(): number {
    return form.experienceMode === "advisor_direct" ? 4 : 2;
  }

  function canSubmit() {
    return form.name.trim().length > 1
      && form.email.trim().includes("@")
      && form.consent
      && (previewMode || config.canSubmit);
  }

  async function handleSubmit() {
    if (!canSubmit() || submitting) return;
    setSubmitting(true);
    setError(null);

    if (previewMode || !config.canSubmit) {
      setSuccess(true);
      setSubmitting(false);
      return;
    }

    const payload: LeadGeneratorSubmissionPayload = {
      generatorType: config.generatorType,
      flowKey: config.flowKey,
      variantKey: config.variantKey,
      locale: config.locale,
      audience: config.audience,
      placementKey: config.placementKey,
      scopeMode: config.scopeMode,
      sourceAreaId: config.sourceAreaId,
      targetAreaId: form.targetAreaId || config.sourceAreaId,
      partnerId: config.partnerId,
      pagePath,
      regionLabel: config.regionLabel,
      leadRecipientLabel: config.leadRecipientLabel,
      contact: {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
      },
      answers: {
        entryMode: form.entryMode,
        experienceMode: form.experienceMode,
        postalOrCity: form.postalOrCity.trim() || null,
        address: form.entryMode === "address" ? form.address.trim() : null,
        propertyType: form.propertyType,
        livingArea: numericLivingArea,
        rooms: numericRooms,
        yearBuilt: numericYearBuilt,
        condition: form.condition,
        features: form.features.trim() || null,
      },
      derivedData: valuation ? {
        estimated_min_price: valuation.totalPrice.min,
        estimated_avg_price: valuation.totalPrice.avg,
        estimated_max_price: valuation.totalPrice.max,
        estimated_min_price_per_sqm: valuation.pricePerSqm.min,
        estimated_avg_price_per_sqm: valuation.pricePerSqm.avg,
        estimated_max_price_per_sqm: valuation.pricePerSqm.max,
        average_area_price_per_sqm: priceContext.averagePricePerSqm,
      } : null,
    };

    const result = await submitLeadGenerator(payload);
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error === "RATE_LIMIT" ? copy.retryLater : copy.genericError);
      return;
    }

    setSuccess(true);
  }

  const step = STEPS[stepIndex];
  const visibleSteps: StepKey[] = form.experienceMode === "advisor_direct"
    ? ["mode", "location", "contact"]
    : STEPS;
  const visibleStepIndex = Math.max(0, visibleSteps.indexOf(step));
  const stepCounter = formatStepCounter(copy.stepCounter, visibleStepIndex + 1, visibleSteps.length);
  const areaSelectVisible = config.allowedAreaOptions.length > 1;

  if (success) {
    return (
      <div className="card border-0 shadow-lg text-dark overflow-hidden">
        <div className="card-body p-4 p-md-5">
          <span className="badge text-bg-warning mb-3">{copy.badge}</span>
          <h3 className="fw-bold mb-3">{copy.successTitle}</h3>
          <p className="mb-0">
            {previewMode ? copy.previewSuccessBody : copy.successBody}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card border-0 shadow-lg text-dark overflow-hidden">
      <div className="card-header bg-warning py-2 border-0">
        <div className="d-flex justify-content-between align-items-center gap-3">
          <div className="progress flex-grow-1" style={{ height: "4px" }}>
            <div
              className="progress-bar bg-dark"
              style={{ width: `${((visibleStepIndex + 1) / visibleSteps.length) * 100}%` }}
            />
          </div>
          <span className="small fw-semibold text-dark">{stepCounter}</span>
        </div>
      </div>

      <div className="card-body p-4 p-md-5">
        <div className="mb-3">
          <span className="badge text-bg-dark mb-2">{copy.badge}</span>
          <h3 className="fw-bold mb-1">{copy.title}</h3>
          <p className="text-muted mb-0">{copy.intro}</p>
        </div>

        {step === "mode" ? (
          <div className="animate-fade-in">
            <h4 className="fw-bold mb-3">{copy.modeIntro}</h4>

            <div className="row g-3">
              <div className="col-md-4">
                <button
                  type="button"
                  className={`btn text-start border w-100 h-100 p-3 ${form.experienceMode === "data_range" ? "btn-dark" : "btn-outline-dark"}`}
                  onClick={() => updateField("experienceMode", "data_range")}
                >
                  <span className="fw-semibold d-block mb-1">{copy.modeDataTitle}</span>
                  <span className={form.experienceMode === "data_range" ? "small text-white-50" : "small text-muted"}>
                    {copy.modeDataHint}
                  </span>
                </button>
              </div>
              <div className="col-md-4">
                <button
                  type="button"
                  className={`btn text-start border w-100 h-100 p-3 ${form.experienceMode === "digital_assistant" ? "btn-dark" : "btn-outline-dark"}`}
                  onClick={() => updateField("experienceMode", "digital_assistant")}
                >
                  <span className="fw-semibold d-block mb-1">{copy.modeAssistantTitle}</span>
                  <span className={form.experienceMode === "digital_assistant" ? "small text-white-50" : "small text-muted"}>
                    {copy.modeAssistantHint}
                  </span>
                </button>
              </div>
              <div className="col-md-4">
                <button
                  type="button"
                  className={`btn text-start border w-100 h-100 p-3 ${form.experienceMode === "advisor_direct" ? "btn-dark" : "btn-outline-dark"}`}
                  onClick={() => updateField("experienceMode", "advisor_direct")}
                >
                  <span className="fw-semibold d-block mb-1">{copy.modeAdvisorTitle}</span>
                  <span className={form.experienceMode === "advisor_direct" ? "small text-white-50" : "small text-muted"}>
                    {copy.modeAdvisorHint}
                  </span>
                </button>
              </div>
            </div>

            <button
              className="btn btn-dark w-100 py-3 fw-bold mt-4"
              onClick={() => setStepIndex(1)}
              type="button"
            >
              {copy.continue}
            </button>
          </div>
        ) : null}

        {step === "location" ? (
          <div className="animate-fade-in">
            <h4 className="fw-bold mb-3">{copy.stepLocation}</h4>

            {areaSelectVisible ? (
              <div className="mb-4">
                <label className="form-label" htmlFor="valuation_area_select">
                  {copy.multiAreaLabel}
                </label>
                <select
                  id="valuation_area_select"
                  className="form-select"
                  value={form.targetAreaId}
                  onChange={(event) => updateField("targetAreaId", event.target.value)}
                >
                  <option value="" disabled>{copy.multiAreaPlaceholder}</option>
                  {config.allowedAreaOptions.map((option) => (
                    <option key={option.areaId} value={option.areaId}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <fieldset className="mb-4">
              <legend className="form-label">{copy.entryModeLabel}</legend>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="card border h-100 p-3 cursor-pointer">
                    <input
                      className="form-check-input me-2"
                      type="radio"
                      name="valuation_entry_mode"
                      checked={form.entryMode === "soft"}
                      onChange={() => updateField("entryMode", "soft")}
                    />
                    <span className="fw-semibold d-block">{copy.entryModeSoft}</span>
                    <span className="small text-muted">{copy.entryModeSoftHint}</span>
                  </label>
                </div>
                <div className="col-md-6">
                  <label className="card border h-100 p-3 cursor-pointer">
                    <input
                      className="form-check-input me-2"
                      type="radio"
                      name="valuation_entry_mode"
                      checked={form.entryMode === "address"}
                      onChange={() => updateField("entryMode", "address")}
                    />
                    <span className="fw-semibold d-block">{copy.entryModeAddress}</span>
                    <span className="small text-muted">{copy.entryModeAddressHint}</span>
                  </label>
                </div>
              </div>
            </fieldset>

            {form.entryMode === "address" ? (
              <div className="form-floating mb-4">
                <input
                  id="valuation_address"
                  className="form-control"
                  placeholder={copy.addressPlaceholder}
                  value={form.address}
                  onChange={(event) => updateField("address", event.target.value)}
                />
                <label htmlFor="valuation_address">{copy.addressLabel}</label>
              </div>
            ) : (
              <div className="form-floating mb-4">
                <input
                  id="valuation_postal_city"
                  className="form-control"
                  placeholder={copy.postalCityPlaceholder}
                  value={form.postalOrCity}
                  onChange={(event) => updateField("postalOrCity", event.target.value)}
                />
                <label htmlFor="valuation_postal_city">{copy.postalCityLabel}</label>
              </div>
            )}

            <button
              className="btn btn-dark w-100 py-3 fw-bold"
              onClick={() => canContinueFromLocation() && setStepIndex(getNextStepAfterLocation())}
              disabled={!canContinueFromLocation()}
              type="button"
            >
              {copy.continue}
            </button>
          </div>
        ) : null}

        {step === "object" ? (
          <div className="animate-fade-in">
            <h4 className="fw-bold mb-3">{copy.stepObject}</h4>

            <div className="mb-3">
              <label className="form-label">{copy.propertyTypeLabel}</label>
              <div className="row g-3">
                <div className="col-md-6">
                  <button
                    type="button"
                    className={`btn w-100 py-3 ${form.propertyType === "wohnung" ? "btn-dark" : "btn-outline-dark"}`}
                    onClick={() => updateField("propertyType", "wohnung")}
                  >
                    {copy.propertyTypeApartment}
                  </button>
                </div>
                <div className="col-md-6">
                  <button
                    type="button"
                    className={`btn w-100 py-3 ${form.propertyType === "haus" ? "btn-dark" : "btn-outline-dark"}`}
                    onClick={() => updateField("propertyType", "haus")}
                  >
                    {copy.propertyTypeHouse}
                  </button>
                </div>
              </div>
            </div>

            <div className="row g-3 mb-4">
              <div className="col-md-4">
                <label className="form-label" htmlFor="valuation_living_area">{copy.livingAreaLabel}</label>
                <input
                  id="valuation_living_area"
                  className="form-control"
                  inputMode="numeric"
                  value={form.livingArea}
                  onChange={(event) => updateField("livingArea", event.target.value)}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label" htmlFor="valuation_rooms">{copy.roomsLabel}</label>
                <input
                  id="valuation_rooms"
                  className="form-control"
                  inputMode="decimal"
                  value={form.rooms}
                  onChange={(event) => updateField("rooms", event.target.value)}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label" htmlFor="valuation_year">{copy.yearBuiltLabel}</label>
                <input
                  id="valuation_year"
                  className="form-control"
                  inputMode="numeric"
                  value={form.yearBuilt}
                  onChange={(event) => updateField("yearBuilt", event.target.value)}
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="form-label" htmlFor="valuation_condition">{copy.conditionLabel}</label>
              <select
                id="valuation_condition"
                className="form-select"
                value={form.condition}
                onChange={(event) => updateField("condition", event.target.value as ValuationCondition)}
              >
                <option value="renovierungsbeduerftig">{copy.conditionRenovation}</option>
                <option value="durchschnitt">{copy.conditionAverage}</option>
                <option value="gepflegt">{copy.conditionGood}</option>
                <option value="modernisiert">{copy.conditionModernized}</option>
              </select>
            </div>

            <div className="d-flex gap-3">
              <button className="btn btn-outline-dark flex-fill" onClick={() => setStepIndex(1)} type="button">
                {copy.back}
              </button>
              <button
                className="btn btn-dark flex-fill"
                onClick={() => canContinueFromObject() && setStepIndex(3)}
                disabled={!canContinueFromObject()}
                type="button"
              >
                {copy.continue}
              </button>
            </div>
          </div>
        ) : null}

        {step === "estimate" ? (
          <div className="animate-fade-in">
            <h4 className="fw-bold mb-3">{copy.stepEstimate}</h4>

            <div className="alert alert-light border mb-4">
              <div className="small text-uppercase text-muted fw-semibold mb-1">{copy.estimateRangeLabel}</div>
              {valuation ? (
                <>
                  <div className="display-6 fw-bold mb-2">
                    {formatCurrency(valuation.totalPrice.min, config.locale)} - {formatCurrency(valuation.totalPrice.max, config.locale)}
                  </div>
                  <div className="text-muted">
                    {copy.estimateSqmLabel}: {formatCurrency(valuation.pricePerSqm.min, config.locale)} - {formatCurrency(valuation.pricePerSqm.max, config.locale)}
                  </div>
                </>
              ) : (
                <div className="text-muted">{copy.estimateUnavailable}</div>
              )}
            </div>

            <p className="text-muted">{copy.estimateHint}</p>

            <div className="form-floating mb-4">
              <textarea
                id="valuation_features"
                className="form-control"
                style={{ height: "120px" }}
                placeholder={copy.detailsPlaceholder}
                value={form.features}
                onChange={(event) => updateField("features", event.target.value)}
              />
              <label htmlFor="valuation_features">{copy.detailsLabel}</label>
            </div>

            <div className="d-flex gap-3">
              <button className="btn btn-outline-dark flex-fill" onClick={() => setStepIndex(2)} type="button">
                {copy.back}
              </button>
              <button className="btn btn-dark flex-fill" onClick={() => setStepIndex(4)} type="button">
                {copy.continue}
              </button>
            </div>
          </div>
        ) : null}

        {step === "contact" ? (
          <div className="animate-fade-in">
            <h4 className="fw-bold mb-2">{copy.contactTitle}</h4>
            <p className="text-muted mb-4">{copy.contactHint}</p>

            <div className="row g-3 mb-3">
              <div className="col-md-6">
                <label className="form-label" htmlFor="valuation_name">{copy.nameLabel}</label>
                <input
                  id="valuation_name"
                  className="form-control"
                  autoComplete="name"
                  value={form.name}
                  onChange={(event) => updateField("name", event.target.value)}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="valuation_email">{copy.emailLabel}</label>
                <input
                  id="valuation_email"
                  className="form-control"
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(event) => updateField("email", event.target.value)}
                />
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label" htmlFor="valuation_phone">{copy.phoneLabel}</label>
              <input
                id="valuation_phone"
                className="form-control"
                autoComplete="tel"
                value={form.phone}
                onChange={(event) => updateField("phone", event.target.value)}
              />
            </div>

            <div className="form-check mb-4">
              <input
                id="valuation_consent"
                className="form-check-input"
                type="checkbox"
                checked={form.consent}
                onChange={(event) => updateField("consent", event.target.checked)}
              />
              <label className="form-check-label" htmlFor="valuation_consent">
                {copy.consentLabel}
              </label>
            </div>

            {error ? (
              <div className="alert alert-danger" role="alert">
                {error}
              </div>
            ) : null}

            <div className="d-flex gap-3">
              <button
                className="btn btn-outline-dark flex-fill"
                onClick={() => setStepIndex(form.experienceMode === "advisor_direct" ? 1 : 3)}
                type="button"
              >
                {copy.back}
              </button>
              <button
                className="btn btn-success flex-fill"
                onClick={() => void handleSubmit()}
                disabled={!canSubmit() || submitting}
                type="button"
              >
                {submitting ? copy.submitting : copy.submit}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
