export type ReferenceChallengeCategory =
  | "sensible_abstimmung"
  | "komplexe_eigentuemersituation"
  | "diskretion"
  | "modernisierungsbedarf";

type ReferenceChallengeRule = {
  category: ReferenceChallengeCategory;
  patterns: RegExp[];
};

const REFERENCE_CHALLENGE_RULES: ReferenceChallengeRule[] = [
  {
    category: "sensible_abstimmung",
    patterns: [/\bscheid\w*/i, /\btrenn\w*/i],
  },
  {
    category: "komplexe_eigentuemersituation",
    patterns: [/\berb\w*/i, /\bnachlass\w*/i],
  },
  {
    category: "diskretion",
    patterns: [/\bdiskret\w*/i, /\bvertraulich\w*/i, /\bstille?\s+vermarkt/i],
  },
  {
    category: "modernisierungsbedarf",
    patterns: [/\bsanierungs\w*/i, /\bmodernisierungs\w*/i, /\brenovierungs\w*/i],
  },
];

export function extractReferenceChallengeCategories(input: string | null | undefined): ReferenceChallengeCategory[] {
  const source = String(input ?? "").trim();
  if (!source) return [];
  const categories: ReferenceChallengeCategory[] = [];
  for (const rule of REFERENCE_CHALLENGE_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(source))) {
      categories.push(rule.category);
    }
  }
  return categories;
}

export function formatReferenceChallengeCategory(category: ReferenceChallengeCategory): string {
  if (category === "sensible_abstimmung") return "sensible Abstimmung";
  if (category === "komplexe_eigentuemersituation") return "komplexe Eigentümersituation";
  if (category === "diskretion") return "Diskretion";
  return "Modernisierungsbedarf";
}
