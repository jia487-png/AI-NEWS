import type { NewsItem } from "./types";

const SOURCE_PRIORITY = new Map<string, number>([
  ["TechCrunch", 0],
  ["The Verge", 1],
  ["Hacker News", 2],
]);

function normalizedKey(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.search = "";
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const pathname = parsed.pathname.replace(/\/+$/, "") || "/";
    return `${hostname}${pathname}`;
  } catch {
    return url.trim().toLowerCase();
  }
}

export function aggregateArticles(
  items: NewsItem[],
  since: Date,
): NewsItem[] {
  const byKey = new Map<string, NewsItem>();

  for (const item of items) {
    if (item.publishedAt.getTime() < since.getTime()) {
      continue;
    }

    const key = normalizedKey(item.url);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, item);
      continue;
    }

    const currentRank = SOURCE_PRIORITY.get(item.source) ?? 99;
    const existingRank = SOURCE_PRIORITY.get(existing.source) ?? 99;
    if (currentRank < existingRank) {
      byKey.set(key, item);
    }
  }

  return [...byKey.values()].sort((left, right) => {
    const timeDiff = right.publishedAt.getTime() - left.publishedAt.getTime();
    if (timeDiff !== 0) {
      return timeDiff;
    }
    return left.source.localeCompare(right.source);
  });
}
