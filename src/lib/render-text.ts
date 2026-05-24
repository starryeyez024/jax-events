import React from "react";

// Minimal markdown-ish renderer used for event descriptions. Handles the
// patterns we actually see in the wild (Meetup descriptions, Cummer iCal):
//
//   ![alt](url)     → just "alt" (Meetup embeds Facebook emoji as md images;
//                     the URLs are flaky, the alt is the actual emoji)
//   [text](url)     → clickable link
//   bare URLs       → clickable link
//   \n              → real line break
//
// Returns an array of React nodes — safe by default since text content is
// escaped by React; we never use dangerouslySetInnerHTML here.

const IMAGE_RE = /!\[([^\]]*)\]\(([^)]+)\)/;
const LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/;
const URL_RE = /\bhttps?:\/\/[^\s<>"')]+/;

export function renderDescription(text: string): React.ReactNode[] {
  const lines = text.split(/\r?\n/);
  const out: React.ReactNode[] = [];
  lines.forEach((line, idx) => {
    if (idx > 0) out.push(React.createElement("br", { key: `br-${idx}` }));
    out.push(...renderLine(line, idx));
  });
  return out;
}

function renderLine(line: string, lineIdx: number): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let rest = line;
  let token = 0;

  while (rest.length > 0) {
    const img = IMAGE_RE.exec(rest);
    const link = LINK_RE.exec(rest);
    const url = URL_RE.exec(rest);

    // Find which token comes first
    const cands = [
      img && { kind: "image" as const, m: img, idx: img.index },
      link && { kind: "link" as const, m: link, idx: link.index },
      url && { kind: "url" as const, m: url, idx: url.index },
    ].filter(Boolean) as Array<{ kind: string; m: RegExpExecArray; idx: number }>;

    if (cands.length === 0) {
      out.push(rest);
      break;
    }

    const next = cands.reduce((a, b) => (a.idx <= b.idx ? a : b));
    if (next.idx > 0) out.push(rest.slice(0, next.idx));

    const key = `t-${lineIdx}-${token++}`;
    if (next.kind === "image") {
      // Just emit the alt text (it's an emoji in practice).
      out.push(React.createElement(React.Fragment, { key }, next.m[1]));
    } else if (next.kind === "link") {
      out.push(
        React.createElement(
          "a",
          {
            key,
            href: next.m[2],
            target: "_blank",
            rel: "noopener noreferrer",
            className: "text-ocean-700 underline hover:text-ocean-900",
          },
          next.m[1]
        )
      );
    } else {
      out.push(
        React.createElement(
          "a",
          {
            key,
            href: next.m[0],
            target: "_blank",
            rel: "noopener noreferrer",
            className: "text-ocean-700 underline hover:text-ocean-900 break-all",
          },
          next.m[0]
        )
      );
    }

    rest = rest.slice(next.idx + next.m[0].length);
  }

  return out;
}
