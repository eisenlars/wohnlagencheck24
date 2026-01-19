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
import type { GrundstueckspreiseVM } from "@/features/immobilienmarkt/selectors/shared/types/grundstueckspreise";
import type { WirtschaftVM } from "@/features/immobilienmarkt/selectors/shared/types/wirtschaft";
import type { WohnlagencheckVM } from "@/features/immobilienmarkt/selectors/shared/types/wohnlagencheck";
import type {
  UebersichtReportData,
  ImmobilienpreiseReportData,
  MietpreiseReportData,
  MietrenditeReportData,
  GrundstueckspreiseReportData,
  WohnmarktsituationReportData,
  WirtschaftReportData,
} from "@/types/reports";

// Shared Builders
import { buildUebersichtVM } from "../selectors/shared/builders/uebersicht";
import { buildImmobilienpreiseVM } from "../selectors/shared/builders/immobilienpreise";
import { buildMietpreiseVM } from "../selectors/shared/builders/mietpreise";
import { buildPlaceholderVM } from "../selectors/shared/builders/placeholder";
import { buildMietrenditeVM } from "../selectors/shared/builders/mietrendite";
import { buildWohnmarktsituationVM } from "../selectors/shared/builders/wohnmarktsituation";
import { buildGrundstueckspreiseVM } from "../selectors/shared/builders/grundstueckspreise";
import { buildWirtschaftVM } from "../selectors/shared/builders/wirtschaft";
import { buildWohnlagencheckVM } from "../selectors/shared/builders/wohnlagencheck";

// Shared Sections
import { UebersichtSection } from "../sections/UebersichtSection";
import { ImmobilienpreiseSection } from "../sections/ImmobilienpreiseSection";
import { MietpreiseSection } from "../sections/MietpreiseSection";
import { TabPlaceholderSection } from "../sections/TabPlaceholderSection";
import { MietrenditeSection } from "../sections/MietrenditeSection";
import { WohnmarktsituationSection } from "../sections/WohnmarktsituationSection";
import { GrundstueckspreiseSection } from "../sections/GrundstueckspreiseSection";
import { WirtschaftSection } from "../sections/WirtschaftSection";
import { WohnlagencheckSection } from "../sections/WohnlagencheckSection";

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
    grundstueckspreise: GrundstueckspreiseVM;
    wohnlagencheck: WohnlagencheckVM;
    wirtschaft: WirtschaftVM;
  };
  ort: {
    uebersicht: never;
    immobilienpreise: ImmobilienpreiseVM;
    mietpreise: MietpreiseVM;
    mietrendite: MietrenditeVM;
    wohnmarktsituation: WohnmarktsituationVM;
    grundstueckspreise: GrundstueckspreiseVM;
    wohnlagencheck: WohnlagencheckVM;
    wirtschaft: WirtschaftVM;
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
    grundstueckspreise: {
      buildVM: (args: RegistryBuildArgs) =>
        buildGrundstueckspreiseVM({
          report: args.report as Report<GrundstueckspreiseReportData>,
          level: "kreis",
          bundeslandSlug: String(args.bundeslandSlug ?? ""),
          kreisSlug: String(args.kreisSlug ?? ""),
        }),
      Component: GrundstueckspreiseSection,
    },
    wohnlagencheck: {
      buildVM: (args: RegistryBuildArgs) =>
        buildWohnlagencheckVM({
          report: args.report,
          level: "kreis",
          bundeslandSlug: String(args.bundeslandSlug ?? ""),
          kreisSlug: String(args.kreisSlug ?? ""),
        }),
      Component: WohnlagencheckSection,
    },
    wirtschaft: {
      buildVM: (args: RegistryBuildArgs) =>
        buildWirtschaftVM({
          report: args.report as Report<WirtschaftReportData>,
          level: "kreis",
          bundeslandSlug: String(args.bundeslandSlug ?? ""),
          kreisSlug: String(args.kreisSlug ?? ""),
        }),
      Component: WirtschaftSection,
    },
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
    mietpreise: {
      buildVM: (args: RegistryBuildArgs) =>
        buildMietpreiseVM({
          report: args.report as Report<MietpreiseReportData>,
          level: "ort",
          bundeslandSlug: String(args.bundeslandSlug ?? ""),
          kreisSlug: String(args.kreisSlug ?? ""),
          ortSlug: String(args.ortSlug ?? ""),
        }),
      Component: MietpreiseSection,
    },
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
    grundstueckspreise: {
      buildVM: (args: RegistryBuildArgs) =>
        buildGrundstueckspreiseVM({
          report: args.report as Report<GrundstueckspreiseReportData>,
          level: "ort",
          bundeslandSlug: String(args.bundeslandSlug ?? ""),
          kreisSlug: String(args.kreisSlug ?? ""),
          ortSlug: String(args.ortSlug ?? ""),
        }),
      Component: GrundstueckspreiseSection,
    },
    wohnlagencheck: {
      buildVM: (args: RegistryBuildArgs) =>
        buildWohnlagencheckVM({
          report: args.report,
          level: "ort",
          bundeslandSlug: String(args.bundeslandSlug ?? ""),
          kreisSlug: String(args.kreisSlug ?? ""),
          ortSlug: String(args.ortSlug ?? ""),
        }),
      Component: WohnlagencheckSection,
    },
    wirtschaft: {
      buildVM: (args: RegistryBuildArgs) =>
        buildWirtschaftVM({
          report: args.report as Report<WirtschaftReportData>,
          level: "ort",
          bundeslandSlug: String(args.bundeslandSlug ?? ""),
          kreisSlug: String(args.kreisSlug ?? ""),
          ortSlug: String(args.ortSlug ?? ""),
        }),
      Component: WirtschaftSection,
    },
  },
};
