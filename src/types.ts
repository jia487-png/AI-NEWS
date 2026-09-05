export interface NewsItem {
  source: string;
  title: string;
  url: string;
  publishedAt: Date;
  summary: string;
}

export interface FetchResult {
  items: NewsItem[];
  failures: string[];
}
