import type { OpenImmoAttachment, OpenImmoListing, OpenImmoParseResult } from "@/lib/openimmo/types";

type XmlNode = {
  name: string;
  attrs: Record<string, string>;
  children: XmlNode[];
  text: string[];
};

function decodeXmlEntities(input: string): string {
  return input
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function normalizeName(input: string): string {
  return String(input ?? "").trim().replace(/^.*:/, "").toLowerCase();
}

function parseTag(content: string) {
  const trimmed = content.trim();
  const nameMatch = trimmed.match(/^([^\s/>]+)/);
  const rawName = nameMatch?.[1] ?? "";
  const attrs: Record<string, string> = {};
  const attrRe = /([A-Za-z_][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let match: RegExpExecArray | null = null;
  while ((match = attrRe.exec(trimmed))) {
    const key = normalizeName(match[1]);
    const value = decodeXmlEntities(match[3] ?? match[4] ?? "");
    attrs[key] = value;
  }
  return { name: normalizeName(rawName), attrs };
}

function parseXmlTree(xml: string): XmlNode {
  const root: XmlNode = { name: "root", attrs: {}, children: [], text: [] };
  const stack: XmlNode[] = [root];
  const tokenRe = /<!\[CDATA\[([\s\S]*?)\]\]>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<\/?[^>]+>|[^<]+/g;
  let match: RegExpExecArray | null = null;

  while ((match = tokenRe.exec(xml))) {
    const token = match[0];
    if (!token) continue;

    if (token.startsWith("<![CDATA[")) {
      const content = decodeXmlEntities(match[1] ?? "");
      if (content.trim()) stack[stack.length - 1]?.text.push(content.trim());
      continue;
    }
    if (token.startsWith("<!--") || token.startsWith("<?")) continue;

    if (token.startsWith("</")) {
      const closeName = normalizeName(token.slice(2, -1));
      while (stack.length > 1 && stack[stack.length - 1]?.name !== closeName) {
        stack.pop();
      }
      if (stack.length > 1) stack.pop();
      continue;
    }

    if (token.startsWith("<")) {
      const selfClosing = token.endsWith("/>");
      const content = token.slice(1, token.length - (selfClosing ? 2 : 1)).trim();
      if (!content || content.startsWith("!")) continue;
      const node: XmlNode = { ...parseTag(content), children: [], text: [] };
      stack[stack.length - 1]?.children.push(node);
      if (!selfClosing) stack.push(node);
      continue;
    }

    const text = decodeXmlEntities(token).replace(/\s+/g, " ").trim();
    if (text) stack[stack.length - 1]?.text.push(text);
  }

  return root;
}

function getChildren(node: XmlNode | null | undefined, name: string): XmlNode[] {
  if (!node) return [];
  const normalized = normalizeName(name);
  return node.children.filter((child) => child.name === normalized);
}

function getChild(node: XmlNode | null | undefined, name: string): XmlNode | null {
  return getChildren(node, name)[0] ?? null;
}

function getText(node: XmlNode | null | undefined): string | null {
  if (!node) return null;
  const own = node.text.join(" ").trim();
  if (own) return own;
  const descendantText = node.children
    .map((child) => getText(child))
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .trim();
  return descendantText || null;
}

function getTextAt(node: XmlNode | null | undefined, path: string[]): string | null {
  let current = node ?? null;
  for (const segment of path) {
    current = getChild(current, segment);
    if (!current) return null;
  }
  return getText(current);
}

function getDescendants(node: XmlNode | null | undefined, name: string): XmlNode[] {
  if (!node) return [];
  const normalized = normalizeName(name);
  const out: XmlNode[] = [];
  for (const child of node.children) {
    if (child.name === normalized) out.push(child);
    out.push(...getDescendants(child, normalized));
  }
  return out;
}

function toNumber(value: string | null): number | null {
  const normalized = String(value ?? "")
    .trim()
    .replace(/\./g, "")
    .replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildAddress(node: XmlNode): string | null {
  const parts = [
    getTextAt(node, ["geo", "strasse"]),
    getTextAt(node, ["geo", "hausnummer"]),
    getTextAt(node, ["geo", "plz"]),
    getTextAt(node, ["geo", "ort"]),
  ]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}

function inferOfferType(node: XmlNode): "kauf" | "miete" {
  const vermarktungsart = getChild(
    getChild(getChild(node, "verwaltung_objekt"), "objektkategorie"),
    "vermarktungsart",
  );
  const descendantNames = getDescendants(vermarktungsart, "miete_pacht").length > 0
    || getDescendants(vermarktungsart, "miete").length > 0
    || getDescendants(vermarktungsart, "pacht").length > 0;
  return descendantNames ? "miete" : "kauf";
}

function inferObjectType(node: XmlNode): string {
  const objectArt = getChild(
    getChild(getChild(node, "verwaltung_objekt"), "objektkategorie"),
    "objektart",
  );
  if (!objectArt) return "immobilie";
  const firstGroup = objectArt.children[0];
  if (!firstGroup) return "immobilie";
  const leafText = getText(firstGroup);
  if (leafText) {
    const normalizedLeaf = leafText.trim().toLowerCase();
    return normalizedLeaf ? `${firstGroup.name}:${normalizedLeaf}` : firstGroup.name;
  }
  return firstGroup.name || "immobilie";
}

function extractAttachments(node: XmlNode): OpenImmoAttachment[] {
  return getDescendants(getChild(node, "anhaenge"), "anhang")
    .map((attachmentNode) => {
      const url = String(attachmentNode.attrs.location ?? "").trim();
      if (!url) return null;
      return {
        url,
        title: String(attachmentNode.attrs.titel ?? "").trim() || null,
        group: String(attachmentNode.attrs.gruppe ?? "").trim() || null,
      } satisfies OpenImmoAttachment;
    })
    .filter((attachment): attachment is OpenImmoAttachment => Boolean(attachment));
}

function pickPrimaryImage(attachments: OpenImmoAttachment[]): string | null {
  const image = attachments.find((attachment) => {
    const haystack = `${attachment.group ?? ""} ${attachment.url}`.toLowerCase();
    return haystack.includes("bild")
      || /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(attachment.url);
  });
  return image?.url ?? null;
}

function buildListing(node: XmlNode, index: number): OpenImmoListing | null {
  const externalId =
    getTextAt(node, ["verwaltung_techn", "objektnr_extern"])
    ?? getTextAt(node, ["verwaltung_techn", "openimmo_obid"])
    ?? `openimmo-${index + 1}`;
  const title = getTextAt(node, ["freitexte", "objekttitel"]);
  const description = getTextAt(node, ["freitexte", "objektbeschreibung"]);
  const locationNote = getTextAt(node, ["freitexte", "lage"]);
  const furnishingNote = getTextAt(node, ["freitexte", "ausstatt_beschr"]);
  const attachments = extractAttachments(node);

  return {
    external_id: externalId,
    offer_type: inferOfferType(node),
    object_type: inferObjectType(node),
    title,
    description,
    location_note: locationNote,
    furnishing_note: furnishingNote,
    price: toNumber(getTextAt(node, ["preise", "kaufpreis"])),
    rent:
      toNumber(getTextAt(node, ["preise", "warmmiete"]))
      ?? toNumber(getTextAt(node, ["preise", "kaltmiete"]))
      ?? toNumber(getTextAt(node, ["preise", "nettokaltmiete"])),
    area_sqm:
      toNumber(getTextAt(node, ["flaechen", "wohnflaeche"]))
      ?? toNumber(getTextAt(node, ["flaechen", "gesamtflaeche"])),
    rooms:
      toNumber(getTextAt(node, ["flaechen", "anzahl_zimmer"]))
      ?? toNumber(getTextAt(node, ["ausstattung", "zimmer"])),
    address: buildAddress(node),
    image_url: pickPrimaryImage(attachments),
    updated_at: getTextAt(node, ["verwaltung_techn", "stand_vom"]),
    attachments,
    raw: {
      external_id: externalId,
      object_type: inferObjectType(node),
      offer_type: inferOfferType(node),
      geo: {
        plz: getTextAt(node, ["geo", "plz"]),
        ort: getTextAt(node, ["geo", "ort"]),
        strasse: getTextAt(node, ["geo", "strasse"]),
        hausnummer: getTextAt(node, ["geo", "hausnummer"]),
      },
      prices: {
        kaufpreis: getTextAt(node, ["preise", "kaufpreis"]),
        warmmiete: getTextAt(node, ["preise", "warmmiete"]),
        kaltmiete: getTextAt(node, ["preise", "kaltmiete"]),
      },
      updated_at: getTextAt(node, ["verwaltung_techn", "stand_vom"]),
      attachments,
    },
  };
}

export function parseOpenImmoDocument(xml: string): OpenImmoParseResult {
  const trimmed = String(xml ?? "").trim();
  if (!trimmed) {
    return { listings: [], notes: ["OpenImmo-Feed ist leer."] };
  }

  const tree = parseXmlTree(trimmed);
  const propertyNodes = getDescendants(tree, "immobilie");
  if (propertyNodes.length === 0) {
    return { listings: [], notes: ["Keine <immobilie>-Einträge im OpenImmo-Feed gefunden."] };
  }

  const listings = propertyNodes
    .map((node, index) => buildListing(node, index))
    .filter((listing): listing is OpenImmoListing => Boolean(listing));

  return {
    listings,
    notes: [],
  };
}
