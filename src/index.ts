import { parseArgs } from "node:util";
import { aggregateArticles } from "./aggregate";
import { fetchAllSources } from "./feeds";
import { writeDailyReport } from "./report";

function showUsage(): void {
  console.log(
    [
      "用法: tsx src/index.ts [--hours 24] [--output output]",
      "",
      "选项:",
      "  --hours <数字>   只保留最近 N 小时的文章，默认 24",
      "  --output <路径>  日报输出目录，默认 output",
      "  --help           显示帮助",
    ].join("\n"),
  );
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      hours: { type: "string", default: "24" },
      output: { type: "string", default: "output" },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  if (values.help) {
    showUsage();
    return;
  }

  const hours = Number(values.hours);
  if (!Number.isFinite(hours) || hours <= 0) {
    throw new Error("--hours 必须是大于 0 的数字");
  }

  const outputDir = values.output;
  const generatedAt = new Date();
  const since = new Date(generatedAt.getTime() - hours * 60 * 60 * 1000);
  const { items, failures } = await fetchAllSources(since);

  for (const failure of failures) {
    console.warn(`[warning] 抓取失败: ${failure}`);
  }

  const articles = aggregateArticles(items, since);
  if (articles.length === 0) {
    console.error("[error] 最近 24 小时内没有抓到文章，不生成日报。");
    process.exitCode = 1;
    return;
  }

  const filePath = await writeDailyReport({
    items: articles,
    generatedAt,
    hours,
    since,
    outputDir,
  });

  const sourceCount = new Set(articles.map((article) => article.source)).size;
  console.log(`[ok] 共收录 ${articles.length} 篇文章，来自 ${sourceCount} 个源`);
  console.log(`[ok] 日报已生成: ${filePath}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[error] ${message}`);
  process.exitCode = 1;
});
