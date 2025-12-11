// components/main-nav.tsx

import Link from "next/link";

type BundeslandNavItem = {
  slug: string;
  name: string;
};

type MainNavProps = {
  bundeslaender: BundeslandNavItem[];
};

export function MainNav({ bundeslaender }: MainNavProps) {
  return (
    <ul className="navbar-nav">
      {/* Einstieg zu den Standortprofilen (Einstiegsseite Immobilienmarkt) */}
      <li className="nav-item mb-2">
        <Link href="/immobilienmarkt" className="nav-link px-0">
          Immobilienmarkt &amp; Standortprofile
        </Link>
      </li>

      {/* Bundesländer als Unterpunkte */}
      {bundeslaender.map((bl) => (
        <li className="nav-item mb-1 ms-3" key={bl.slug}>
          <Link
            href={`/immobilienmarkt/${bl.slug}`}
            className="nav-link px-0 small"
          >
            {bl.name}
          </Link>
        </li>
      ))}

      <li className="nav-item mt-3">
        <a href="/#konzept" className="nav-link px-0">
          Konzept
        </a>
      </li>
      <li className="nav-item">
        <a href="/#inhalte" className="nav-link px-0">
          Weitere Inhalte
        </a>
      </li>
      <li className="nav-item">
        <Link href="/musterseite" className="nav-link px-0">
          Musterseite
        </Link>
      </li>
    </ul>
  );
}

