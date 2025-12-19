// --- BeraterBlock ---

type BeraterProps = {
  name: string;
  taetigkeit: string;
  imageSrc: string;
  kontaktHref?: string;
};

export function BeraterBlock({
  name,
  taetigkeit,
  imageSrc,
  kontaktHref = "/berater/kontakt",
}: BeraterProps) {
  return (
    <div className="berater-section">
      <div className="berater-wrapper">
        <div className="berater-inner">
          
          {/* Rundes Bild */}
          <div className="berater-avatar">
            <img src={imageSrc} alt={`Berater: ${name}`} />
          </div>

          {/* Textblock */}
          <div className="berater-text">
            <h3>{name}</h3>
            <p>{taetigkeit}</p>

            <a href={kontaktHref} className="berater-button">
              Kontakt aufnehmen
            </a>
          </div>

        </div>
      </div>
    </div>
  );
}