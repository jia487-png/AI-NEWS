# AI-NEWS
抓取日报并生成一个MarkDown文档

帮我做一个新闻聚合CLI工具，需求如下：
&#x20;1.从以下RSS源抓取最近24小时的文章&#x20;
&#x20;     -TechCrunch AI频道
&#x20;     -The Verge AI频道
&#x20;     -Hacker News AI标签流
2.提取每篇文章的标题、链接、发布时间、来源&#x20;
3.按时间倒序排列，输出一份Markdown格式的日报到output目录&#x20;
4.用TypeScript写，用tsx直接运行&#x20;
先别急着写代码，给我一个实现方案。

好的，先不写代码。下面是实现方案。
总体设计
一个纯 CLI：tsx 直接跑入口脚本，并发抓取 3 个源，解析成统一的 NewsItem 结构，按发布时间倒序合并，最后生成 Markdown 日报写入 output/。
核心数据模型固定为 4 个字段：
interface NewsItem {
  title: string;
  url: string;
  publishedAt: Date;
  source: "TechCrunch" | "The Verge" | "Hacker News";
}
技术选型
- Node.js 18+，原生 fetch，不引网络请求库
- TypeScript + tsx 直接运行，不经过 tsc 编译
- 运行时依赖只加 rss-parser，用于 TechCrunch / The Verge 的 RSS/Atom 解析
- 时间处理用原生 Date + UTC 比较，避免引入 dayjs/moment
- 不用 axios、dotenv，配置尽量简单
项目结构：
package.json
tsconfig.json
src/
  index.ts        CLI 入口
  types.ts        文章数据模型
  sources.ts      源定义
  fetchers.ts     抓取与解析
  aggregate.ts    过滤、去重、排序
  report.ts       Markdown 渲染与写文件
output/          生成的日报

数据源处理
1. TechCrunch AI 频道：解析 RSS，取 title / link / pubDate
2. The Verge AI 频道：同上。实际 RSS 地址实现时会先做一次 HTTP 探测，确认 Vox 频道当前可用的 feed URL，因为这类站点的频道地址偶尔调整
3. Hacker News：这是需要处理的一个点。HN 官方没有真正意义上的 “AI 标签 RSS”，news.ycombinator.com/rss 只是首页热文。默认方案是：用 HN Algolia 的 search_by_date 接口抓最近 24 小时的新帖，并用标题层面的 AI 关键词过滤，作为“AI 流”等价实现；找不到外链的 HN 帖子回退到 item?id= 评论页。实现阶段先实测接口，若 HN 提供了更精确的 AI tag 参数就直接用它
CLI 与日报
脚本用法：
npx tsx src/index.ts
npx tsx src/index.ts --hours 24
npx tsx src/index.ts --output output
流程是：
1. 并发抓取三个源，每路单独加超时，例如 15 秒
2. 只保留 publishedAt 落在最近 24 小时内的文章
3. 按 URL 规范化去重：如果 HN 恰好转发了 TechCrunch/Verge 的同一篇文章，保留原发布源
4. 按发布时间倒序
5. 渲染 Markdown 并写入 output/ai-news-YYYY-MM-DD.md
日报大致格式：
# AI 新闻日报

- 生成时间：2026-09-06 10:30 +08:00
- 覆盖范围：最近 24 小时
- 文章数：48（TechCrunch 12 / The Verge 14 / Hacker News 22）

## 按时间倒序

- **09:42** [AI 模型发布新版本](https://...) — TechCrunch
- **09:15** [某公司发布新品](https://...) — The Verge
- ...

健壮性处理
- 单个源抓取失败只记录 stderr 警告，不中断整个任务
- 解析失败或缺少发布时间的文章跳过
- 当天重复运行时覆盖同名日报，避免文件堆积
- 三个源都失败或 24 小时内没有文章时不写空文件，并让进程以非 0 退出码结束
- 代码分层让后续加源、加 --hours、换输出格式都容易
验证方式
先做一轮真实抓取并检查输出的 Markdown：标题、链接、时间、来源齐全，排序正确，文件落在 output/。排序、过滤、Markdown 渲染这类纯函数会保留测试余地；如果希望有测试，我再补一组基于固定 fixture 的测试。
如果你认可这个方案，我就开始搭项目、抓真实源确认地址，并跑出第一份日报。

方案没问题，补充两点：
1.为日报里的加一句搞要
2.日报开头加统计数据：共收录X篇，来自Y个源

收到，方案更新为：日报顶部加“共收录 X 篇，来自 Y 个源”，每条新闻下加一句摘要（优先取 RSS 自带摘要，去掉 HTML，取首个完整句；没有正文摘要的条目则用标题概括）。我现在开始搭建并实现。




  Ran commands


我按补充后的方案开始搭建，先写核心文件与依赖配置，随后安装依赖并做真实抓取验证。




Edited filesran a command


@types/rss-parser 在 registry 中不存在，先移除它并继续安装。




Edited a fileran commands


类型检查已通过。现在联网跑一次完整抓取，确认三个源的真实可达性、条目数量和日报内容。




  Ran commands


日报本体是正常的 UTF-8（刚才终端显示乱码只是 PowerShell 控制台编码问题）。HN 源当前返回 0 条且没有报错，我正在用相同 API 参数做对照验证，定位查询写法的问题。




Edited filesran commands


定位到原因：HN Algolia 不支持把多个关键词用 OR 拼成单个查询，短语形式还会直接返回 0。我改成抓取最近 24 小时的新帖子流，再用 AI 关键词规则做标题/正文过滤，这样语义与“AI 流”一致且更稳定。




Edited filesran commands


HN 源目前按“标题/正文命中 AI 关键词”过滤后收到 186 条，数量太宽，混进了大量低质量 Show HN。我先探测 HN 是否真有 ai 标签参数，再决定收窄策略。




Edited a fileran commands


日报整体可用，但我在抽查时发现 Verge 的 feed 混入了一篇非 AI 文章，需要确认当前 RSS 地址是否实际对应 AI 分类，避免把整站新闻误当成 AI 频道。




Edited a fileran commands


Worked for 10分钟 17秒







已经实现并跑通，生成了第一份日报：[ai-news-2026-09-05.md](D:/claudecodelx/AI-NEWS/output/ai-news-2026-09-05.md)。
日报开头现在是“共收录 200 篇文章，来自 3 个源”，随后每条新闻包含来源、发布时间和一句摘要。实际摘要优先取 RSS/正文自带的摘要首句，HN 帖子没有正文时用标题兜底，没有调用外部 LLM。
主要文件：
- [src/feeds.ts](D:/claudecodelx/AI-NEWS/src/feeds.ts)：抓取 TechCrunch、The Verge 和 HN
- [src/aggregate.ts](D:/claudecodelx/AI-NEWS/src/aggregate.ts)：24 小时过滤、URL 去重、倒序
- [src/report.ts](D:/claudecodelx/AI-NEWS/src/report.ts)：Markdown 渲染和写文件
- [src/index.ts](D:/claudecodelx/AI-NEWS/src/index.ts)：CLI 入口
运行方式：
npm run daily
npm run daily -- --hours 48
npm run daily -- --output reports

验证已完成：tsc --noEmit 通过，真实抓取跑通，当前日报 200 篇、来自 3 个源，且按发布时间倒序。
需要说明一点：HN 没有公开的官方 AI tag，Algolia 上也不存在 ai 标签，所以实现里是从最近 24 小时 HN 帖子流中按标题/正文的 AI 关键词过滤。如果之后觉得 HN 条数太宽，可以再加 --min-points 或排除 Show HN 这类过滤规则。

