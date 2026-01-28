import React from "react";

export type FaqItem = { q: string; a: string };

type Props = {
  title?: string;
  items: FaqItem[];
  id?: string;
};

export function FaqSection({
  title = "Häufige Fragen",
  items,
  id = "faq",
}: Props) {
  const cleaned = (items ?? [])
    .map((x) => ({
      q: String(x?.q ?? "").trim(),
      a: String(x?.a ?? "").trim(),
    }))
    .filter((x) => x.q && x.a);

  if (!cleaned.length) return null;

  const jsonLd = buildFaqJsonLd(cleaned);

  return (
    <section className="mb-5" id={id}>
      {/* JSON-LD: maximiert maschinelle Extraktion */}
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}

      <div className="card border-0 shadow-sm">
        <div className="card-body">
          {/* Accordion (Bootstrap) */}
          <div className="accordion" id={`${id}-accordion`}>
            {cleaned.map((it, idx) => {
              const headingId = `${id}-h-${idx}`;
              const collapseId = `${id}-c-${idx}`;

              return (
                <div className="accordion-item" key={`${it.q}-${idx}`}>
                  <h3 className="accordion-header" id={headingId}>
                    <button
                      className={`accordion-button ${idx === 0 ? "" : "collapsed"}`}
                      type="button"
                      data-bs-toggle="collapse"
                      data-bs-target={`#${collapseId}`}
                      aria-expanded={idx === 0 ? "true" : "false"}
                      aria-controls={collapseId}
                    >
                      {it.q}
                    </button>
                  </h3>

                  <div
                    id={collapseId}
                    className={`accordion-collapse collapse ${idx === 0 ? "show" : ""}`}
                    aria-labelledby={headingId}
                    data-bs-parent={`#${id}-accordion`}
                  >
                    <div className="accordion-body">
                      <p className="mb-0">{it.a}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </section>
  );
}

function buildFaqJsonLd(items: FaqItem[]) {
  const mainEntity = items.map((x) => ({
    "@type": "Question",
    name: x.q,
    acceptedAnswer: {
      "@type": "Answer",
      text: x.a,
    },
  }));

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity,
  };
}
