type MainNavProps = {
  bundeslaender: string[];
};

export function MainNav({ bundeslaender }: MainNavProps) {
  return (
    <ul className="navbar-nav">
      {/* Dropdown: Immobilienmarkt & Standortprofile */}
      <li className="nav-item dropdown">
        <button
          className="nav-link dropdown-toggle btn btn-link px-2 px-md-3 text-decoration-none"
          id="marktDropdown"
          data-bs-toggle="dropdown"
          aria-expanded="false"
          type="button"
        >
          Immobilienmarkt &amp; Standortprofile
        </button>
        <ul
          className="dropdown-menu"
          aria-labelledby="marktDropdown"
        >
          {bundeslaender.map((bl) => {
            const anchorId =
              "#bundeslaender-" +
              bl.toLowerCase().replace(/\s+/g, "-");
            return (
              <li key={bl}>
                <a className="dropdown-item" href={anchorId}>
                  {bl}
                </a>
              </li>
            );
          })}
        </ul>
      </li>

      {/* Konzepte / Inhalte / Musterseite */}
      <li className="nav-item">
        <a href="/#konzept" className="nav-link px-2 px-md-3">
          Konzept
        </a>
      </li>
      <li className="nav-item">
        <a href="/#inhalte" className="nav-link px-2 px-md-3">
          Weitere Inhalte
        </a>
      </li>
      <li className="nav-item">
        <a href="/musterseite" className="nav-link px-2 px-md-3">
          Musterseite
        </a>
      </li>
    </ul>
  );
}
