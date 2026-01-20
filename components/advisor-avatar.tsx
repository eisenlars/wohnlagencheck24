// --- BeraterBlock ---

import Image from "next/image";

type BeraterProps = {
  name: string;
  taetigkeit: string;
  imageSrc: string;
  kontaktHref: string;
};

export function BeraterBlock({
  name,
  taetigkeit,
  imageSrc,
  kontaktHref,
}: BeraterProps) {
  return (
    <div className="berater-section">
      <div className="berater-wrapper">
        <div className="berater-inner">
          
          {/* Rundes Bild */}
          <div className="berater-avatar">
            <Image
              src={imageSrc}
              alt={`Berater: ${name}`}
              width={140}
              height={140}
              className="w-100 h-100 object-fit-cover"
            />
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
