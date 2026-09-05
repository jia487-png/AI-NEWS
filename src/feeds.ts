import Parser from "rss-parser";
import { cleanText, firstSentence } from "./text";
import type { FetchResult, NewsItem } from "./types";

const USER_AGENT = "ai-news-daily/0.1";
const FETCH_TIMEOUT_MS = 15_000;
const HN_MAX_PAGES = 15;

interface RssSource {
  name: string;
  feedUrl: string;
}

const RSS_SOURCES: RssSource[] = [
  {
    name: "TechCrunch",
    feedUrl: "https://techcrunch.com/category/artificial-intelligence/feed/",
  },
  {
    name: "The Verge",
    feedUrl: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml",
  },
];

interface RawRssItem {
  title?: string;
  link?: string;
  isoDate?: string;
  pubDate?: string;
  contentSnippet?: string;
  content?: string;
  description?: string;
}

interface AlgoliaHit {
  objectID?: string;
  title?: string | null;
  url?: string | null;
  story_text?: string | null;
  created_at?: string | null;
}

interface AlgoliaResponse {
  hits?: AlgoliaHit[];
  nbPages?: number;
}

const rssParser = new Parser({
  timeout: FETCH_TIMEOUT_MS,
  customFields: {
    item: [["description", "description"]],
  },
});

async function fetchText(url: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        accept: "*/*",
        "user-agent": USER_AGENT,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeoutId);
  }
}

function parseDate(value: string | undefined): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function makeSummary(candidates: Array<string | undefined>, title: string): string {
  const sourceText = candidates.find((candidate) => Boolean(candidate && cleanText(candidate)));
  if (!sourceText) {
    return title;
  }

  return firstSentence(sourceText) || title;
}

async function fetchRssSource(source: RssSource, since: Date): Promise<NewsItem[]> {
  const sinceMs = since.getTime();
  const xml = await fetchText(source.feedUrl);
  const feed = await rssParser.parseString(xml);
  const items: NewsItem[] = [];

  for (const rawItem of feed.items) {
    const item = rawItem as unknown as RawRssItem;
    const title = item.title?.trim();
    const url = item.link?.trim();
    const publishedAt = parseDate(item.isoDate ?? item.pubDate);

    if (!title || !url || !publishedAt || publishedAt.getTime() < sinceMs) {
      continue;
    }

    items.push({
      source: source.name,
      title,
      url,
      publishedAt,
      summary: makeSummary(
        [item.contentSnippet, item.description, item.content],
        title,
      ),
    });
  }

  return items;
}

const AI_CONTENT_PATTERN =
  /\b(?:ai|llm|gpt|chatgpt|openai|anthropic|claude|gemini|deepseek|mistral|llama|copilot|perplexity|midjourney|deepmind|sora|qwen|xai|hugging face)\b|artificial intelligence|machine learning|deep learning|large language model|language model|generative ai|neural network|natural language processing|stable diffusion|a\s*\/\s*i\b/i;

function isAiRelevant(hit: AlgoliaHit): boolean {
  const title = hit.title ?? "";
  const storyText = hit.story_text ?? "";
  const haystack = cleanText(`${title} ${storyText}`);
  return AI_CONTENT_PATTERN.test(haystack);
}

async function fetchHackerNewsAi(since: Date): Promise<NewsItem[]> {
  // HN exposes no official AI tag, so approximate it from the latest story stream.
  const sinceUnix = Math.floor(since.getTime() / 1000);
  const hits: AlgoliaHit[] = [];

  for (let page = 0; page < HN_MAX_PAGES; page += 1) {
    const apiUrl =
      "https://hn.algolia.com/api/v1/search_by_date?" +
      new URLSearchParams({
        tags: "story",
        hitsPerPage: "100",
        page: String(page),
        numericFilters: `created_at_i>${sinceUnix}`,
      });
    const data = JSON.parse(await fetchText(apiUrl)) as AlgoliaResponse;
    const pageHits = data.hits ?? [];
    hits.push(...pageHits);

    const lastPage = Math.max(0, (data.nbPages ?? 1) - 1);
    if (page >= lastPage || pageHits.length === 0) {
      break;
    }
  }

  const items: NewsItem[] = [];
  for (const hit of hits) {
    const title = hit.title?.trim();
    const publishedAt = parseDate(hit.created_at ?? undefined);
    if (
      !title ||
      !publishedAt ||
      publishedAt.getTime() < since.getTime() ||
      !isAiRelevant(hit)
    ) {
      continue;
    }

    const url =
      hit.url?.trim() ||
      (hit.objectID
        ? `https://news.ycombinator.com/item?id=${hit.objectID}`
        : "");
    if (!url) {
      continue;
    }

    items.push({
      source: "Hacker News",
      title,
      url,
      publishedAt,
      summary: makeSummary([hit.story_text ?? undefined], title),
    });
  }

  return items;
}

export async function fetchAllSources(since: Date): Promise<FetchResult> {
  const tasks = [
    ...RSS_SOURCES.map((source) => ({
      name: source.name,
      run: () => fetchRssSource(source, since),
    })),
    {
      name: "Hacker News",
      run: () => fetchHackerNewsAi(since),
    },
  ];

  const results = await Promise.allSettled(tasks.map((task) => task.run()));
  const failures: string[] = [];
  const items: NewsItem[] = [];

  results.forEach((result, index) => {
    if (result.status === "rejected") {
      const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
      failures.push(`${tasks[index].name}: ${reason}`);
      return;
    }

    items.push(...result.value);
  });

  return { items, failures };
}
