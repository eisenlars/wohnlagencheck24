import { Fragment } from "react";

type ParagraphBlock = {
  kind: "paragraph";
  lines: string[];
};

type ListBlock = {
  kind: "ordered-list" | "unordered-list";
  items: string[];
};

type FormattedTextBlock = ParagraphBlock | ListBlock;

type FormattedOfferTextProps = {
  text: string;
};

const HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  auml: "\u00e4",
  Auml: "\u00c4",
  bull: "\u2022",
  euro: "\u20ac",
  gt: ">",
  laquo: "\u00ab",
  ldquo: "\u201c",
  lsquo: "\u2018",
  lt: "<",
  nbsp: " ",
  ndash: "\u2013",
  mdash: "\u2014",
  oelig: "\u0153",
  ouml: "\u00f6",
  Ouml: "\u00d6",
  quot: "\"",
  raquo: "\u00bb",
  rdquo: "\u201d",
  rsquo: "\u2019",
  szlig: "\u00df",
  uuml: "\u00fc",
  Uuml: "\u00dc",
};

function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|[a-z][a-z0-9]+);/gi, (match, entity: string) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      const codePoint = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    if (entity.startsWith("#")) {
      const codePoint = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    return HTML_ENTITIES[entity] ?? match;
  });
}

function normalizeSourceText(value: string): string {
  return decodeHtmlEntities(value)
    .replace(/\r\n?/g, "\n")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*li(?:\s[^>]*)?>/gi, "\n- ")
    .replace(/<\s*\/\s*li\s*>/gi, "\n")
    .replace(/<\s*\/\s*(p|div|section|article|h[1-6])\s*>/gi, "\n\n")
    .replace(/<\s*(p|div|section|article|h[1-6])(?:\s[^>]*)?>/gi, "")
    .replace(/<\s*\/?\s*(ul|ol)(?:\s[^>]*)?>/gi, "\n")
    .replace(/<\s*\/?\s*[a-z][a-z0-9:-]*(?:\s[^>\n]*)?\s*\/?\s*>/gi, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseFormattedText(value: string): FormattedTextBlock[] {
  const normalized = normalizeSourceText(value);
  if (!normalized) return [];

  const blocks: FormattedTextBlock[] = [];
  let paragraphLines: string[] = [];
  let listKind: ListBlock["kind"] | null = null;
  let listItems: string[] = [];

  const flushParagraph = () => {
    const lines = paragraphLines.map((line) => line.trim()).filter(Boolean);
    if (lines.length > 0) {
      blocks.push({ kind: "paragraph", lines });
    }
    paragraphLines = [];
  };

  const flushList = () => {
    const items = listItems.map((item) => item.trim()).filter(Boolean);
    if (listKind && items.length > 0) {
      blocks.push({ kind: listKind, items });
    }
    listKind = null;
    listItems = [];
  };

  for (const rawLine of normalized.split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    const bulletMatch = line.match(/^(?:[-*\u2022\u2013\u2014]\s+)(.+)$/);
    if (bulletMatch) {
      flushParagraph();
      if (listKind !== "unordered-list") {
        flushList();
        listKind = "unordered-list";
      }
      listItems.push(bulletMatch[1].trim());
      continue;
    }

    const orderedMatch = line.match(/^\d+[\.)]\s+(.+)$/);
    if (orderedMatch) {
      flushParagraph();
      if (listKind !== "ordered-list") {
        flushList();
        listKind = "ordered-list";
      }
      listItems.push(orderedMatch[1].trim());
      continue;
    }

    if (listKind && listItems.length > 0) {
      listItems[listItems.length - 1] = `${listItems[listItems.length - 1]} ${line}`;
      continue;
    }

    paragraphLines.push(line);
  }

  flushParagraph();
  flushList();
  return blocks;
}

export function FormattedOfferText({ text }: FormattedOfferTextProps) {
  const blocks = parseFormattedText(text);
  if (blocks.length === 0) return null;

  return (
    <div className="offer-detail-formatted-text">
      {blocks.map((block, blockIndex) => {
        if (block.kind === "paragraph") {
          return (
            <p key={`paragraph-${blockIndex}`} className="offer-detail-panel-copy">
              {block.lines.map((line, lineIndex) => (
                <Fragment key={`${line}-${lineIndex}`}>
                  {line}
                  {lineIndex < block.lines.length - 1 ? <br /> : null}
                </Fragment>
              ))}
            </p>
          );
        }

        const ListTag = block.kind === "ordered-list" ? "ol" : "ul";
        return (
          <ListTag key={`${block.kind}-${blockIndex}`} className="offer-detail-list offer-detail-formatted-list">
            {block.items.map((item, itemIndex) => (
              <li key={`${item}-${itemIndex}`}>{item}</li>
            ))}
          </ListTag>
        );
      })}
    </div>
  );
}
