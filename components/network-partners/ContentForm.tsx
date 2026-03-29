'use client';

import type { CSSProperties, FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';

import type {
  NetworkContentRecord,
  NetworkPartnerBookingRecord,
  NetworkPartnerRecord,
} from '@/lib/network-partners/types';

type ContentFormValues = {
  booking_id: string;
  slug: string;
  title: string;
  summary: string | null;
  body_md: string | null;
  cta_label: string | null;
  cta_url: string | null;
  primary_locale: string;
  company_profile?: {
    company_name: string;
    industry_type: string | null;
    service_region: string | null;
  } | null;
  property_offer?: {
    external_id: string | null;
    marketing_type: string | null;
    property_type: string | null;
    location_label: string | null;
    price: number | null;
    living_area: number | null;
    plot_area: number | null;
    rooms: number | null;
  } | null;
  property_request?: {
    external_id: string | null;
    request_type: string | null;
    search_region: string | null;
    budget_min: number | null;
    budget_max: number | null;
    area_min: number | null;
    area_max: number | null;
  } | null;
};

type ContentFormProps = {
  bookings: NetworkPartnerBookingRecord[];
  networkPartners: NetworkPartnerRecord[];
  initialValue?: NetworkContentRecord | null;
  submitLabel: string;
  onSubmit: (values: ContentFormValues) => Promise<void>;
};

const inputStyle: CSSProperties = {
  width: '100%',
  border: '1px solid #cbd5e1',
  borderRadius: 10,
  padding: '10px 12px',
  fontSize: 14,
  color: '#0f172a',
  background: '#fff',
};

const labelStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  fontSize: 13,
  fontWeight: 600,
  color: '#334155',
};

function asNumberOrNull(value: string): number | null {
  const normalized = value.trim();
  if (!normalized) return null;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

export default function ContentForm({
  bookings,
  networkPartners,
  initialValue,
  submitLabel,
  onSubmit,
}: ContentFormProps) {
  const availableBookings = useMemo(
    () => initialValue
      ? bookings
      : bookings.filter((booking) => booking.status !== 'cancelled' && booking.status !== 'expired'),
    [bookings, initialValue],
  );
  const initialBookingId = initialValue?.booking_id ?? availableBookings[0]?.id ?? '';
  const [bookingId, setBookingId] = useState(initialBookingId);
  const [slug, setSlug] = useState(initialValue?.slug ?? '');
  const [title, setTitle] = useState(initialValue?.title ?? '');
  const [summary, setSummary] = useState(initialValue?.summary ?? '');
  const [bodyMd, setBodyMd] = useState(initialValue?.body_md ?? '');
  const [ctaLabel, setCtaLabel] = useState(initialValue?.cta_label ?? '');
  const [ctaUrl, setCtaUrl] = useState(initialValue?.cta_url ?? '');
  const [primaryLocale, setPrimaryLocale] = useState(initialValue?.primary_locale ?? 'de');
  const [companyName, setCompanyName] = useState(initialValue?.company_profile?.company_name ?? '');
  const [industryType, setIndustryType] = useState(initialValue?.company_profile?.industry_type ?? '');
  const [serviceRegion, setServiceRegion] = useState(initialValue?.company_profile?.service_region ?? '');
  const [offerExternalId, setOfferExternalId] = useState(initialValue?.property_offer?.external_id ?? '');
  const [offerMarketingType, setOfferMarketingType] = useState(initialValue?.property_offer?.marketing_type ?? '');
  const [offerPropertyType, setOfferPropertyType] = useState(initialValue?.property_offer?.property_type ?? '');
  const [offerLocationLabel, setOfferLocationLabel] = useState(initialValue?.property_offer?.location_label ?? '');
  const [offerPrice, setOfferPrice] = useState(initialValue?.property_offer?.price?.toString() ?? '');
  const [offerLivingArea, setOfferLivingArea] = useState(initialValue?.property_offer?.living_area?.toString() ?? '');
  const [offerPlotArea, setOfferPlotArea] = useState(initialValue?.property_offer?.plot_area?.toString() ?? '');
  const [offerRooms, setOfferRooms] = useState(initialValue?.property_offer?.rooms?.toString() ?? '');
  const [requestExternalId, setRequestExternalId] = useState(initialValue?.property_request?.external_id ?? '');
  const [requestType, setRequestType] = useState(initialValue?.property_request?.request_type ?? '');
  const [requestSearchRegion, setRequestSearchRegion] = useState(initialValue?.property_request?.search_region ?? '');
  const [requestBudgetMin, setRequestBudgetMin] = useState(initialValue?.property_request?.budget_min?.toString() ?? '');
  const [requestBudgetMax, setRequestBudgetMax] = useState(initialValue?.property_request?.budget_max?.toString() ?? '');
  const [requestAreaMin, setRequestAreaMin] = useState(initialValue?.property_request?.area_min?.toString() ?? '');
  const [requestAreaMax, setRequestAreaMax] = useState(initialValue?.property_request?.area_max?.toString() ?? '');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setBookingId(initialValue?.booking_id ?? availableBookings[0]?.id ?? '');
    setSlug(initialValue?.slug ?? '');
    setTitle(initialValue?.title ?? '');
    setSummary(initialValue?.summary ?? '');
    setBodyMd(initialValue?.body_md ?? '');
    setCtaLabel(initialValue?.cta_label ?? '');
    setCtaUrl(initialValue?.cta_url ?? '');
    setPrimaryLocale(initialValue?.primary_locale ?? 'de');
    setCompanyName(initialValue?.company_profile?.company_name ?? '');
    setIndustryType(initialValue?.company_profile?.industry_type ?? '');
    setServiceRegion(initialValue?.company_profile?.service_region ?? '');
    setOfferExternalId(initialValue?.property_offer?.external_id ?? '');
    setOfferMarketingType(initialValue?.property_offer?.marketing_type ?? '');
    setOfferPropertyType(initialValue?.property_offer?.property_type ?? '');
    setOfferLocationLabel(initialValue?.property_offer?.location_label ?? '');
    setOfferPrice(initialValue?.property_offer?.price?.toString() ?? '');
    setOfferLivingArea(initialValue?.property_offer?.living_area?.toString() ?? '');
    setOfferPlotArea(initialValue?.property_offer?.plot_area?.toString() ?? '');
    setOfferRooms(initialValue?.property_offer?.rooms?.toString() ?? '');
    setRequestExternalId(initialValue?.property_request?.external_id ?? '');
    setRequestType(initialValue?.property_request?.request_type ?? '');
    setRequestSearchRegion(initialValue?.property_request?.search_region ?? '');
    setRequestBudgetMin(initialValue?.property_request?.budget_min?.toString() ?? '');
    setRequestBudgetMax(initialValue?.property_request?.budget_max?.toString() ?? '');
    setRequestAreaMin(initialValue?.property_request?.area_min?.toString() ?? '');
    setRequestAreaMax(initialValue?.property_request?.area_max?.toString() ?? '');
  }, [availableBookings, initialValue]);

  const bookingOptions = useMemo(
    () => availableBookings.map((booking) => {
      const partnerLabel = networkPartners.find((entry) => entry.id === booking.network_partner_id)?.company_name ?? booking.network_partner_id;
      return {
        id: booking.id,
        label: `${partnerLabel} · ${booking.area_id} · ${booking.placement_code}`,
        contentType: booking.placement_code,
      };
    }),
    [availableBookings, networkPartners],
  );

  const selectedBooking = bookingOptions.find((entry) => entry.id === bookingId) ?? null;
  const selectedContentType = initialValue?.content_type ?? selectedBooking?.contentType ?? 'company_profile';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!bookingId) return;
    setSubmitting(true);
    try {
      await onSubmit({
        booking_id: bookingId,
        slug,
        title,
        summary: summary.trim() ? summary.trim() : null,
        body_md: bodyMd.trim() ? bodyMd.trim() : null,
        cta_label: ctaLabel.trim() ? ctaLabel.trim() : null,
        cta_url: ctaUrl.trim() ? ctaUrl.trim() : null,
        primary_locale: primaryLocale.trim() || 'de',
        company_profile: selectedContentType === 'company_profile'
          ? {
            company_name: companyName,
            industry_type: industryType.trim() ? industryType.trim() : null,
            service_region: serviceRegion.trim() ? serviceRegion.trim() : null,
          }
          : null,
        property_offer: selectedContentType === 'property_offer'
          ? {
            external_id: offerExternalId.trim() ? offerExternalId.trim() : null,
            marketing_type: offerMarketingType.trim() ? offerMarketingType.trim() : null,
            property_type: offerPropertyType.trim() ? offerPropertyType.trim() : null,
            location_label: offerLocationLabel.trim() ? offerLocationLabel.trim() : null,
            price: asNumberOrNull(offerPrice),
            living_area: asNumberOrNull(offerLivingArea),
            plot_area: asNumberOrNull(offerPlotArea),
            rooms: asNumberOrNull(offerRooms),
          }
          : null,
        property_request: selectedContentType === 'property_request'
          ? {
            external_id: requestExternalId.trim() ? requestExternalId.trim() : null,
            request_type: requestType.trim() ? requestType.trim() : null,
            search_region: requestSearchRegion.trim() ? requestSearchRegion.trim() : null,
            budget_min: asNumberOrNull(requestBudgetMin),
            budget_max: asNumberOrNull(requestBudgetMax),
            area_min: asNumberOrNull(requestAreaMin),
            area_max: asNumberOrNull(requestAreaMax),
          }
          : null,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <label style={labelStyle}>
          Buchung
          <select
            value={bookingId}
            onChange={(event) => setBookingId(event.target.value)}
            style={inputStyle}
            required
            disabled={Boolean(initialValue?.id)}
          >
            {bookingOptions.map((booking) => (
              <option key={booking.id} value={booking.id}>
                {booking.label}
              </option>
            ))}
          </select>
        </label>
        <label style={labelStyle}>
          Content-Typ
          <input value={selectedContentType} readOnly style={{ ...inputStyle, background: '#f8fafc' }} />
        </label>
        <label style={labelStyle}>
          Primärsprache
          <input value={primaryLocale} onChange={(event) => setPrimaryLocale(event.target.value)} style={inputStyle} required />
        </label>
        <label style={labelStyle}>
          Slug
          <input value={slug} onChange={(event) => setSlug(event.target.value)} style={inputStyle} required />
        </label>
        <label style={labelStyle}>
          Titel
          <input value={title} onChange={(event) => setTitle(event.target.value)} style={inputStyle} required />
        </label>
        <label style={labelStyle}>
          CTA-Label
          <input value={ctaLabel} onChange={(event) => setCtaLabel(event.target.value)} style={inputStyle} />
        </label>
        <label style={labelStyle}>
          CTA-URL
          <input value={ctaUrl} onChange={(event) => setCtaUrl(event.target.value)} style={inputStyle} />
        </label>
      </div>

      <label style={labelStyle}>
        Kurzbeschreibung
        <textarea value={summary} onChange={(event) => setSummary(event.target.value)} style={{ ...inputStyle, minHeight: 96 }} />
      </label>

      <label style={labelStyle}>
        Inhalt
        <textarea value={bodyMd} onChange={(event) => setBodyMd(event.target.value)} style={{ ...inputStyle, minHeight: 160 }} />
      </label>

      {selectedContentType === 'company_profile' ? (
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <label style={labelStyle}>
            Unternehmensname
            <input value={companyName} onChange={(event) => setCompanyName(event.target.value)} style={inputStyle} required />
          </label>
          <label style={labelStyle}>
            Branche
            <input value={industryType} onChange={(event) => setIndustryType(event.target.value)} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Service-Region
            <input value={serviceRegion} onChange={(event) => setServiceRegion(event.target.value)} style={inputStyle} />
          </label>
        </div>
      ) : null}

      {selectedContentType === 'property_offer' ? (
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <label style={labelStyle}>
            Externe ID
            <input value={offerExternalId} onChange={(event) => setOfferExternalId(event.target.value)} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Vermarktungsart
            <input value={offerMarketingType} onChange={(event) => setOfferMarketingType(event.target.value)} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Immobilienart
            <input value={offerPropertyType} onChange={(event) => setOfferPropertyType(event.target.value)} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Lagebezeichnung
            <input value={offerLocationLabel} onChange={(event) => setOfferLocationLabel(event.target.value)} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Preis
            <input type="number" min={0} step="0.01" value={offerPrice} onChange={(event) => setOfferPrice(event.target.value)} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Wohnfläche
            <input type="number" min={0} step="0.01" value={offerLivingArea} onChange={(event) => setOfferLivingArea(event.target.value)} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Grundstücksfläche
            <input type="number" min={0} step="0.01" value={offerPlotArea} onChange={(event) => setOfferPlotArea(event.target.value)} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Zimmer
            <input type="number" min={0} step="0.1" value={offerRooms} onChange={(event) => setOfferRooms(event.target.value)} style={inputStyle} />
          </label>
        </div>
      ) : null}

      {selectedContentType === 'property_request' ? (
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <label style={labelStyle}>
            Externe ID
            <input value={requestExternalId} onChange={(event) => setRequestExternalId(event.target.value)} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Gesuchtyp
            <input value={requestType} onChange={(event) => setRequestType(event.target.value)} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Suchregion
            <input value={requestSearchRegion} onChange={(event) => setRequestSearchRegion(event.target.value)} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Budget min
            <input type="number" min={0} step="0.01" value={requestBudgetMin} onChange={(event) => setRequestBudgetMin(event.target.value)} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Budget max
            <input type="number" min={0} step="0.01" value={requestBudgetMax} onChange={(event) => setRequestBudgetMax(event.target.value)} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Fläche min
            <input type="number" min={0} step="0.01" value={requestAreaMin} onChange={(event) => setRequestAreaMin(event.target.value)} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Fläche max
            <input type="number" min={0} step="0.01" value={requestAreaMax} onChange={(event) => setRequestAreaMax(event.target.value)} style={inputStyle} />
          </label>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={submitting || bookingOptions.length === 0}
        style={{
          width: 'fit-content',
          borderRadius: 10,
          border: '1px solid #0f766e',
          background: '#0f766e',
          color: '#fff',
          padding: '10px 14px',
          fontWeight: 700,
          cursor: submitting ? 'not-allowed' : 'pointer',
          opacity: submitting ? 0.65 : 1,
        }}
      >
        {submitting ? 'Speichert...' : submitLabel}
      </button>
    </form>
  );
}
