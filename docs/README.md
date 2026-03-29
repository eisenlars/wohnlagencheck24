# Projektdokumentation

Diese Dokumentation bildet den aktuellen Projektstand aus der Quellcode- und Architekturanalyse ab.
Sie ist kein Archiv alter Konzepte. Massgeblich sind die im Repository implementierten Laufzeitpfade,
API-Routen, Datenfluesse und Workflows.

## Doku-Index

- `architecture.md`
  Systemueberblick, Modulgrenzen und zentrale Laufzeitfluesse.
- `public-portal.md`
  Oeffentliche Route-Struktur, Sichtbarkeit, SEO-/Locale-Flaechen und Seitenaufbau.
- `admin-partner-workflows.md`
  Partner- und Admin-Workflows von Preview ueber Review bis Livegang.
- `data-text-pipeline.md`
  Report-Laden, Text-Overlay-Reihenfolge, Rebuild-/Textgen-Pipeline und Runtime-State.
- `integrations-local-site.md`
  CRM-Integrationen, Local-Site-Paket, i18n-Automation und externe Datenwege.
- `security-auth.md`
  Authentifizierung, Rollen, Rate Limits, Audit Log, Secret-Handling und Token-Flows.

## Operative Spezialdokumente

- `AGENTS.md`
  Arbeitsregeln fuer Codex im Repository.
- `github_ssh_setup.md`
  Operatives Git-/SSH-Setup.
- `textgen_automation_rules.md`
  Sonderregel fuer den Textgen-Automations-Workflow.
- `sql/`
  Migrations- und SQL-Begleitdateien.

## Lesereihenfolge

1. `architecture.md`
2. je nach Thema die Domainedoku
3. danach erst operative Spezialdokumente

## Pflegeprinzip

- Doku wird aus implementiertem Code abgeleitet.
- Nicht belegte oder historisch ueberholte Annahmen werden entfernt statt weitergeschleppt.
- Neue Systembereiche bekommen eine stabile Hauptdoku, nicht nur eine einmalige Notizdatei.
