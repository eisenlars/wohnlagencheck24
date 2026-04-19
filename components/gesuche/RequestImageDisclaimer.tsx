"use client";

type Props = {
  locale?: string;
};

export function RequestImageDisclaimer({ locale = "de" }: Props) {
  const isGerman = locale !== "en";
  const label = isGerman ? "Symbolbild" : "Representative image";
  const tooltip = isGerman
    ? "Das Bild ist ein Symbolbild. Aus Diskretionsgründen werden keine vertraulichen Interessenteninformationen öffentlich dargestellt."
    : "This is a representative image. Confidential interested-party information is not shown publicly for discretion reasons.";

  return (
    <span className="request-image-disclaimer" tabIndex={0} aria-label={tooltip} title={tooltip}>
      <span>{label}</span>
      <span className="request-image-disclaimer__icon" aria-hidden="true">
        i
      </span>
      <span className="request-image-disclaimer__tooltip" role="tooltip">
        {tooltip}
      </span>
      <style jsx>{`
        .request-image-disclaimer {
          position: absolute;
          top: 12px;
          right: 12px;
          z-index: 2;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          max-width: calc(100% - 24px);
          padding: 7px 10px;
          border: 1px solid rgba(255, 255, 255, 0.72);
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.72);
          color: #fff;
          font-size: 12px;
          font-weight: 800;
          line-height: 1;
          cursor: help;
          backdrop-filter: blur(10px);
          box-shadow: 0 10px 28px rgba(15, 23, 42, 0.22);
          outline: none;
        }

        .request-image-disclaimer:focus-visible {
          box-shadow: 0 0 0 3px rgba(72, 107, 122, 0.32), 0 10px 28px rgba(15, 23, 42, 0.22);
        }

        .request-image-disclaimer__icon {
          display: inline-flex;
          width: 17px;
          height: 17px;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(255, 255, 255, 0.78);
          border-radius: 999px;
          font-size: 11px;
          font-weight: 900;
          font-style: normal;
          line-height: 1;
        }

        .request-image-disclaimer__tooltip {
          position: absolute;
          top: calc(100% + 10px);
          right: 0;
          width: min(280px, calc(100vw - 40px));
          padding: 12px 13px;
          border-radius: 14px;
          background: #0f172a;
          color: #fff;
          font-size: 12px;
          font-weight: 600;
          line-height: 1.45;
          text-align: left;
          white-space: normal;
          opacity: 0;
          pointer-events: none;
          transform: translateY(-4px);
          transition: opacity 160ms ease, transform 160ms ease;
          box-shadow: 0 16px 34px rgba(15, 23, 42, 0.28);
        }

        .request-image-disclaimer:hover .request-image-disclaimer__tooltip,
        .request-image-disclaimer:focus-visible .request-image-disclaimer__tooltip {
          opacity: 1;
          transform: translateY(0);
        }

        @media (max-width: 575px) {
          .request-image-disclaimer {
            top: 10px;
            right: 10px;
            padding: 7px 9px;
            font-size: 11px;
          }
        }
      `}</style>
    </span>
  );
}
