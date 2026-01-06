// features/immobilienmarkt/page/registry.ts

import type { RouteLevel, ReportSection } from "../types/route";
import type { Report } from "@/lib/data";
import type { SectionComponent } from "@/features/immobilienmarkt/sections/types";
import type { PlaceholderVM } from "@/features/immobilienmarkt/selectors/shared/types/placeholder";
import type { UebersichtVM } from "@/features/immobilienmarkt/selectors/shared/types/uebersicht";
import type { ImmobilienpreiseVM } from "@/features/immobilienmarkt/selectors/shared/types/immobilienpreise";
import type { MietpreiseVM } from "@/features/immobilienmarkt/selectors/shared/types/mietpreise";
import type { MietrenditeVM } from "@/features/immobilienmarkt/selectors/shared/types/mietrendite";
import type { WohnmarktsituationVM } from "@/features/immobilienmarkt/selectors/shared/types/wohnmarktsituation";
import type {
  UebersichtReportData,
  ImmobilienpreiseReportData,
  MietpreiseReportData,
  MietrenditeReportData,
  WohnmarktsituationReportData,
} from "@/types/reports";

// Shared Builders
import { buildUebersichtVM } from "../selectors/shared/builders/uebersicht";
import { buildImmobilienpreiseVM } from "../selectors/shared/builders/immobilienpreise";
import { buildMietpreiseVM } from "../selectors/shared/builders/mietpreise";
import { buildPlaceholderVM } from "../selectors/shared/builders/placeholder";
import { buildMietrenditeVM } from "../selectors/shared/builders/mietrendite";
import { buildWohnmarktsituationVM } from "../selectors/shared/builders/wohnmarktsituation";

// Shared Sections
import { UebersichtSection } from "../sections/UebersichtSection";
import { ImmobilienpreiseSection } from "../sections/ImmobilienpreiseSection";
import { MietpreiseSection } from "../sections/MietpreiseSection";
import { TabPlaceholderSection } from "../sections/TabPlaceholderSection";
import { MietrenditeSection } from "../sections/MietrenditeSection";
import { WohnmarktsituationSection } from "../sections/WohnmarktsituationSection";

export type RegistryBuildArgs = {
  report: Report;
  bundeslandSlug?: string;
  kreisSlug?: string;
  ortSlug?: string;
  mietpreisMapSvg?: string | null;
  immobilienpreisMapSvg?: string | null;
  heroImageSrc?: string | null;
};

type SectionVMMap = {
  deutschland: {
    uebersicht: UebersichtVM;
    immobilienpreise: PlaceholderVM;
    mietpreise: PlaceholderVM;
    mietrendite: PlaceholderVM;
    wohnmarktsituation: PlaceholderVM;
    grundstueckspreise: PlaceholderVM;
    wohnlagencheck: PlaceholderVM;
    wirtschaft: PlaceholderVM;
  };
  bundesland: {
    uebersicht: UebersichtVM;
    immobilienpreise: PlaceholderVM;
    mietpreise: PlaceholderVM;
    mietrendite: PlaceholderVM;
    wohnmarktsituation: PlaceholderVM;
    grundstueckspreise: PlaceholderVM;
    wohnlagencheck: PlaceholderVM;
    wirtschaft: PlaceholderVM;
  };
  kreis: {
    uebersicht: UebersichtVM;
    immobilienpreise: ImmobilienpreiseVM;
    mietpreise: MietpreiseVM;
    mietrendite: MietrenditeVM;
    wohnmarktsituation: WohnmarktsituationVM;
    grundstueckspreise: PlaceholderVM;
    wohnlagencheck: PlaceholderVM;
    wirtschaft: PlaceholderVM;
  };
  ort: {
    uebersicht: never;
    immobilienpreise: ImmobilienpreiseVM;
    mietpreise: PlaceholderVM;
    mietrendite: MietrenditeVM;
    wohnmarktsituation: WohnmarktsituationVM;
    grundstueckspreise: PlaceholderVM;
    wohnlagencheck: PlaceholderVM;
    wirtschaft: PlaceholderVM;
  };
};

export type RegistryEntry<VM> = {
  buildVM: (args: RegistryBuildArgs) => VM;
  Component: SectionComponent<VM>;
};

export type Registry = {
  [L in RouteLevel]: Partial<{ [S in ReportSection]: RegistryEntry<SectionVMMap[L][S]> }>;
};

function placeholderEntry(level: RouteLevel): RegistryEntry<PlaceholderVM> {
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
          report: args.report as Report<UebersichtReportData>,
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
          report: args.report as Report<UebersichtReportData>,
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
          report: args.report as Report<UebersichtReportData>,
          level: "kreis",
          bundeslandSlug: String(args.bundeslandSlug ?? ""),
          kreisSlug: String(args.kreisSlug ?? ""),
        }),
      Component: UebersichtSection,
    },

    immobilienpreise: {
      buildVM: (args: RegistryBuildArgs) =>
        buildImmobilienpreiseVM({
          report: args.report as Report<ImmobilienpreiseReportData>,
          level: "kreis",
          bundeslandSlug: String(args.bundeslandSlug ?? ""),
          kreisSlug: String(args.kreisSlug ?? ""),
        }),
      Component: ImmobilienpreiseSection,
    },
    mietpreise: {
      buildVM: (args: RegistryBuildArgs) =>
        buildMietpreiseVM({
          report: args.report as Report<MietpreiseReportData>,
          level: "kreis",
          bundeslandSlug: String(args.bundeslandSlug ?? ""),
          kreisSlug: String(args.kreisSlug ?? ""),
        }),
      Component: MietpreiseSection,
    },
    mietrendite: {
      buildVM: (args: RegistryBuildArgs) =>
        buildMietrenditeVM({
          report: args.report as Report<MietrenditeReportData>,
          level: "kreis",
          bundeslandSlug: String(args.bundeslandSlug ?? ""),
          kreisSlug: String(args.kreisSlug ?? ""),
        }),
      Component: MietrenditeSection,
    },
    wohnmarktsituation: {
      buildVM: (args: RegistryBuildArgs) =>
        buildWohnmarktsituationVM({
          report: args.report as Report<WohnmarktsituationReportData>,
          level: "kreis",
          bundeslandSlug: String(args.bundeslandSlug ?? ""),
          kreisSlug: String(args.kreisSlug ?? ""),
        }),
      Component: WohnmarktsituationSection,
    },
    grundstueckspreise: placeholderEntry("kreis"),
    wohnlagencheck: placeholderEntry("kreis"),
    wirtschaft: placeholderEntry("kreis"),
  },

  ort: {
    // Ort hat keine Übersicht (Regel + Theme), daher kein uebersicht-Eintrag.

    immobilienpreise: {
      buildVM: (args: RegistryBuildArgs) =>
        buildImmobilienpreiseVM({
          report: args.report as Report<ImmobilienpreiseReportData>,
          level: "ort",
          bundeslandSlug: String(args.bundeslandSlug ?? ""),
          kreisSlug: String(args.kreisSlug ?? ""),
          ortSlug: String(args.ortSlug ?? ""),
        }),
      Component: ImmobilienpreiseSection,
    },
    mietpreise: placeholderEntry("ort"),
    mietrendite: {
      buildVM: (args: RegistryBuildArgs) =>
        buildMietrenditeVM({
          report: args.report as Report<MietrenditeReportData>,
          level: "ort",
          bundeslandSlug: String(args.bundeslandSlug ?? ""),
          kreisSlug: String(args.kreisSlug ?? ""),
          ortSlug: String(args.ortSlug ?? ""),
        }),
      Component: MietrenditeSection,
    },
    wohnmarktsituation: {
      buildVM: (args: RegistryBuildArgs) =>
        buildWohnmarktsituationVM({
          report: args.report as Report<WohnmarktsituationReportData>,
          level: "ort",
          bundeslandSlug: String(args.bundeslandSlug ?? ""),
          kreisSlug: String(args.kreisSlug ?? ""),
          ortSlug: String(args.ortSlug ?? ""),
        }),
      Component: WohnmarktsituationSection,
    },
    grundstueckspreise: placeholderEntry("ort"),
    wohnlagencheck: placeholderEntry("ort"),
    wirtschaft: placeholderEntry("ort"),
  },
};
