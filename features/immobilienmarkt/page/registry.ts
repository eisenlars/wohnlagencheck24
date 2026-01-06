// features/immobilienmarkt/page/registry.ts

import type { RouteLevel, ReportSection } from "../types/route";
import type { Report } from "@/lib/data";
import type { ComponentType } from "react";

// Shared Builders
import { buildUebersichtVM } from "../selectors/shared/builders/uebersicht";
import { buildImmobilienpreiseVM } from "../selectors/shared/builders/immobilienpreise";
import { buildMietpreiseVM } from "../selectors/shared/builders/mietpreise";
import { buildPlaceholderVM } from "../selectors/shared/builders/placeholder";

// Shared Sections
import { UebersichtSection } from "../sections/UebersichtSection";
import { ImmobilienpreiseSection } from "../sections/ImmobilienpreiseSection";
import { MietpreiseSection } from "../sections/MietpreiseSection";
import { TabPlaceholderSection } from "../sections/TabPlaceholderSection";

export type RegistryBuildArgs = {
  report: Report;
  bundeslandSlug?: string;
  kreisSlug?: string;
  ortSlug?: string;
  mietpreisMapSvg?: string | null;
  immobilienpreisMapSvg?: string | null;
  heroImageSrc?: string | null;
};

export type RegistryEntry = {
  buildVM: (args: RegistryBuildArgs) => unknown;
  Component: ComponentType<Record<string, unknown>>;
};

export type Registry = Record<RouteLevel, Partial<Record<ReportSection, RegistryEntry>>>;

function placeholderEntry(level: RouteLevel): RegistryEntry {
  return {
    buildVM: (args: RegistryBuildArgs) =>
      buildPlaceholderVM({
        report: args.report,
        level,
        bundeslandSlug: String(args.bundeslandSlug ?? ""),
        kreisSlug: String(args.kreisSlug ?? ""),
        ortSlug: String(args.ortSlug ?? ""),
      }),
    Component: TabPlaceholderSection,
  };
}

export const IMMOBILIENMARKT_REGISTRY: Registry = {
  deutschland: {
    uebersicht: {
      buildVM: (args: RegistryBuildArgs) =>
        buildUebersichtVM({
          report: args.report,
          level: "deutschland",
          bundeslandSlug: String(args.bundeslandSlug ?? ""),
          kreisSlug: String(args.kreisSlug ?? ""),
        }),
      Component: UebersichtSection,
    },
    immobilienpreise: placeholderEntry("deutschland"),
    mietpreise: placeholderEntry("deutschland"),
    mietrendite: placeholderEntry("deutschland"),
    wohnmarktsituation: placeholderEntry("deutschland"),
    grundstueckspreise: placeholderEntry("deutschland"),
    wohnlagencheck: placeholderEntry("deutschland"),
    wirtschaft: placeholderEntry("deutschland"),
  },

  bundesland: {
    uebersicht: {
      buildVM: (args: RegistryBuildArgs) =>
        buildUebersichtVM({
          report: args.report,
          level: "bundesland",
          bundeslandSlug: String(args.bundeslandSlug ?? ""),
          kreisSlug: String(args.kreisSlug ?? ""),
        }),
      Component: UebersichtSection,
    },
    immobilienpreise: placeholderEntry("bundesland"),
    mietpreise: placeholderEntry("bundesland"),
    mietrendite: placeholderEntry("bundesland"),
    wohnmarktsituation: placeholderEntry("bundesland"),
    grundstueckspreise: placeholderEntry("bundesland"),
    wohnlagencheck: placeholderEntry("bundesland"),
    wirtschaft: placeholderEntry("bundesland"),
  },

  kreis: {
    uebersicht: {
      buildVM: (args: RegistryBuildArgs) =>
        buildUebersichtVM({
          report: args.report,
          level: "kreis",
          bundeslandSlug: String(args.bundeslandSlug ?? ""),
          kreisSlug: String(args.kreisSlug ?? ""),
        }),
      Component: UebersichtSection,
    },

    immobilienpreise: {
      buildVM: (args: RegistryBuildArgs) =>
        buildImmobilienpreiseVM({
          report: args.report,
          level: "kreis",
          bundeslandSlug: String(args.bundeslandSlug ?? ""),
          kreisSlug: String(args.kreisSlug ?? ""),
        }),
      Component: ImmobilienpreiseSection,
    },
    mietpreise: {
      buildVM: (args: RegistryBuildArgs) =>
        buildMietpreiseVM({
          report: args.report,
          level: "kreis",
          bundeslandSlug: String(args.bundeslandSlug ?? ""),
          kreisSlug: String(args.kreisSlug ?? ""),
        }),
      Component: MietpreiseSection,
    },
    mietrendite: placeholderEntry("kreis"),
    wohnmarktsituation: placeholderEntry("kreis"),
    grundstueckspreise: placeholderEntry("kreis"),
    wohnlagencheck: placeholderEntry("kreis"),
    wirtschaft: placeholderEntry("kreis"),
  },

  ort: {
    // Ort hat keine Übersicht (Regel + Theme), daher kein uebersicht-Eintrag.

    immobilienpreise: {
      buildVM: (args: RegistryBuildArgs) =>
        buildImmobilienpreiseVM({
          report: args.report,
          level: "ort",
          bundeslandSlug: String(args.bundeslandSlug ?? ""),
          kreisSlug: String(args.kreisSlug ?? ""),
          ortSlug: String(args.ortSlug ?? ""),
        }),
      Component: ImmobilienpreiseSection,
    },
    mietpreise: placeholderEntry("ort"),
    mietrendite: placeholderEntry("ort"),
    wohnmarktsituation: placeholderEntry("ort"),
    grundstueckspreise: placeholderEntry("ort"),
    wohnlagencheck: placeholderEntry("ort"),
    wirtschaft: placeholderEntry("ort"),
  },
};
