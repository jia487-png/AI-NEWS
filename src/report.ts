import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { escapeMarkdownLinkText } from "./text";
import type { NewsItem } from "./types";

export interface ReportOptions {
  items: NewsItem[];
  generatedAt: Date;
  hours: number;
  since: Date;
  outputDir: string;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function formatOffset(date: Date): string {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absolute = Math.abs(offsetMinutes);
  return `${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`;
}

function formatDateTime(date: Date): string {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())} ` +
    formatOffset(date)
  );
}

function formatFileDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function buildReport(options: ReportOptions): string {
  const sourceCount = new Set(options.items.map((item) => item.source)).size;
  const lines = [
    "# AI 新闻日报",
    "",
    `共收录 **${options.items.length}** 篇文章，来自 **${sourceCount}** 个源`,
    "",
    "- 生成时间：" + formatDateTime(options.generatedAt),
    `- 覆盖范围：最近 ${options.hours} 小时（${formatDateTime(options.since)} 之后）`,
    "",
    "## 按时间倒序",
    "",
  ];

  for (const item of options.items) {
    lines.push(
      `### [${escapeMarkdownLinkText(item.title)}](${item.url})`,
      "",
      `- 来源：${item.source}`,
      `- 发布时间：${formatDateTime(item.publishedAt)}`,
      `- 摘要：${item.summary}`,
      "",
    );
  }

  return lines.join("\n");
}

export async function writeDailyReport(
  options: ReportOptions,
): Promise<string> {
  await mkdir(options.outputDir, { recursive: true });

  const fileName = `ai-news-${formatFileDate(options.generatedAt)}.md`;
  const filePath = path.join(options.outputDir, fileName);
  await writeFile(filePath, buildReport(options), "utf8");
  return filePath;
}
