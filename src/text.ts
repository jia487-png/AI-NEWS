const htmlEntityPattern = /&(?:#x([\da-f]+)|#(\d+)|([a-z]+));/gi;

const namedEntities: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
};

function decodeEntities(value: string): string {
  return value.replace(htmlEntityPattern, (match, hex, decimal, name) => {
    if (hex) {
      return String.fromCodePoint(Number.parseInt(hex, 16));
    }
    if (decimal) {
      return String.fromCodePoint(Number.parseInt(decimal, 10));
    }
    return namedEntities[name.toLowerCase()] ?? match;
  });
}

export function cleanText(value: string): string {
  const withoutMarkup = value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");

  return decodeEntities(withoutMarkup).replace(/\s+/g, " ").trim();
}

export function firstSentence(value: string): string {
  const clean = cleanText(value);
  if (!clean) {
    return "";
  }

  const sentenceEnd = clean.search(/[.!?。！？](?:\s|$)/);
  if (sentenceEnd >= 0) {
    return clean.slice(0, sentenceEnd + 1).trim();
  }

  return clean;
}

export function escapeMarkdownLinkText(value: string): string {
  return value.replace(/([[\]])/g, "\\$1");
}
