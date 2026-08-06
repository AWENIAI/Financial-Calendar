# Financial Calendar｜阿文风险提醒日历

A股、港股、美股交易风险事件的 ICS 订阅日历。

当前版本采用“单一 URL 订阅”方案：把 A股、港股、美股风险事件全部合成一个 `.ics` 文件，用户在 Apple Calendar / Google Calendar / Outlook 中通过一个 URL 订阅。

## 订阅链接

只使用这一个 GitHub Pages 订阅链接：

```text
https://aweniai.github.io/Financial-Calendar/calendar/GLOBAL_KEY.ics
```

站点首页也可以直接打开：

```text
https://aweniai.github.io/Financial-Calendar/
```

| 文件 | 内容 |
|---|---|
| `GLOBAL_KEY.ics` | 阿文风险提醒日历：A股、港股、美股关键事件合集 |

## 事件等级

日历标题使用 emoji 表示风险等级，等级名称全部用中文：

| 图标 | 等级 | 说明 |
|---|---|---|
| 🔴 | 极高 | 必须重点关注 |
| 🟠 | 高 | 高风险提醒 |

当前 `.ics` 只放入 🔴 和 🟠 事件，避免日历噪音过多。

每条提醒会写入这 3 个核心部分：

1. 市场反馈：当前市场已经怎么定价。
2. 历史反应：类似周期里通常怎么走。
3. 应对策略：我替你给出的具体处理方式。

## Apple Calendar 订阅方法

在 iPhone / iPad：

1. 打开“设置”。
2. 进入“日历” → “账户”。
3. 点击“添加账户” → “其他” → “添加已订阅的日历”。
4. 粘贴上方唯一 `.ics` 订阅链接。
5. 保存后，在 Apple Calendar 中勾选该订阅日历。

在 macOS：

1. 打开“日历”应用。
2. 菜单栏选择“文件” → “新建日历订阅”。
3. 粘贴上方唯一 `.ics` 订阅链接。
4. 设置自动刷新频率。
5. 点击“好”。

## Google Calendar 订阅方法

1. 打开 [Google Calendar](https://calendar.google.com/)。
2. 左侧找到“其他日历”。
3. 点击 “+”。
4. 选择“通过网址”。
5. 粘贴上方唯一 `.ics` 订阅链接。
6. 点击“添加日历”。

注意：Google Calendar 对 URL 订阅日历的刷新频率不可控，可能不是实时刷新。

## 当前内置提醒范围

当前版本内置 2026 年全年固定时间/规则型关键风险事件。

包含：

1. 美股宏观与 Fed 事件：FOMC、非农、CPI、PPI、FOMC 纪要。
2. 美股衍生品事件：VIX 期权到期、SPX / 月度 OPEX 风险窗口。
3. 美股个股财报事件：35 个重点美股标的最新窗口财报；发布前进入阶段A预判，发布后进入阶段B复盘并归档留存。
4. A股制度性事件：股指期货/期权月度交割、定期报告披露截止窗口。
5. A股月末规则型事件：每月倒数第二个中国营业日。
6. A50 期货制度性事件：最后交易日。
7. 港股制度性事件：港股指数期货/期权月度到期。

每条事件包含：

- emoji 风险等级
- 中文风险等级
- 市场标签 `[A股] / [港股] / [美股]`
- 来源名称
- 来源链接
- 影响资产
- 市场反馈
- 历史反应
- 应对策略

## 开发与更新方法

在项目根目录执行：

```bash
npm run generate
```

这个命令会读取：

```text
data/risk-events.json
data/fixed-events-2026.json
data/us-megacap-earnings.json
```

然后生成唯一订阅文件：

```text
public/calendar/GLOBAL_KEY.ics
```

### 自动更新

GitHub Actions 每个交易日北京时间 17:20 自动执行同一条链路：

1. 抓取中金所 IH / IF / IC / IM 当日成交持仓排名，生成中信期货和前20机构净多/净空跟踪事件；所有已发布交易日记录按日期永久保留，新交易日只追加，同一交易日重跑只更新当天且不产生重复；如果当天不是交易日、节假日或数据尚未发布，则不回填旧交易日、不改写持仓跟踪文件，避免重复推送旧数据。
2. 更新 35 个重点美股标的财报数据，并补抓当前时间前已经发布、但阶段B尚未完成的财报正文与复盘：先更新最近 30 天窗口内的新数据，再按官方来源搜索并抽取昨天及更早已发布财报的正文内容；已进入阶段B并生成分析的财报记录会归档锁定，后续自动更新不再覆盖或删除。
3. 重新生成订阅文件。
4. 如果内容有变化，自动提交并 push 到 `main`。
5. 在同一个 workflow 里直接部署 GitHub Pages。
6. 同步把本次变化明细写入 README 更新日志，并把上一个 README 保存到 `README.backup.md`。

说明：中金所成交持仓排名属于收盘后数据。北京时间 5:00 只能拿到最近已发布交易日，不能代表当天收盘后的“本日数据”；因此自动任务放在交易日 17:20 执行。17:20 同时避开 GitHub Actions 整点高负载时段，并为中金所发布当日完整数据留出缓冲。GitHub cron 只能先限制为周一到周五，中国节假日由脚本通过“当天 IH/IF/IC/IM 数据是否完整发布”判断。

这样 Pages 订阅链接和 GitHub README 会一起保持最新。

如果是第一次启用，需要在 GitHub 仓库设置里确认：

```text
Settings → Pages → Build and deployment → Source → GitHub Actions
```

## 新增事件方法

编辑：

```text
data/risk-events.json
```

新增一条事件，示例：

```json
{
  "market": "US",
  "level": "critical",
  "category": "Macro / CPI",
  "title": "CPI 发布：美国通胀数据",
  "start": "2026-08-12T20:30:00+08:00",
  "end": "2026-08-12T21:00:00+08:00",
  "timezone": "Asia/Shanghai",
  "location": "美国",
  "assets": ["SPY", "QQQ", "ES", "NQ"],
  "timeStatus": "confirmed",
  "sourceName": "BLS",
  "sourceUrl": "https://www.bls.gov/schedule/news_release/cpi.htm",
  "reason": "CPI 会影响利率预期、美债收益率、美元指数和成长股估值。",
  "checklist": ["是否降低杠杆", "是否避免数据公布前追单", "止损是否过近"]
}
```

保存后执行：

```bash
npm run generate
```

## ICS 订阅方案说明

本项目当前使用静态 ICS 订阅方案：

```text
事件数据 → 生成 .ics 文件 → 固定 URL 订阅 → 日历客户端自动刷新
```

优点：

1. 不需要 Google OAuth。
2. 不需要用户授权。
3. Apple / Google / Outlook 都能订阅。
4. 订阅链接固定，更新文件内容即可。

限制：

1. Google Calendar 刷新频率不可控。
2. 不适合私人持仓或敏感数据。
3. 不能像 Google Calendar API 那样强制立即更新、删除或改期。

## 更新日志

### 2026-08-06 19:35 自动更新记录

- 触发来源：schedule
- Action 记录：https://github.com/AWENIAI/Financial-Calendar/actions/runs/31097833929
- 订阅文件：`public/calendar/GLOBAL_KEY.ics`
- 当前事件数：158
- 文件变化统计：3 files changed, 176 insertions(+), 8 deletions(-)
- 变化文件：
  - 修改：`data/cffex-position-watch.json`
  - 修改：`data/us-megacap-earnings.json`
  - 修改：`public/calendar/GLOBAL_KEY.ics`
- 最近未来事件：
  - 2026-08-07 08:00：🔴 [美股] 非农就业：2026年7月 Employment Situation
  - 2026-08-07 08:00：📊 [美股] 伯克希尔哈撒韦（Berkshire Hathaway，BRK.B）财报发布：2026年6月
  - 2026-08-12 08:00：🔴 [美股] CPI 发布：2026年7月美国通胀数据
  - 2026-08-12 08:00：📊 [美股] 思科（Cisco，CSCO）财报发布：2026年7月
  - 2026-08-13 08:00：🟠 [美股] PPI 发布：2026年7月生产者价格指数

### 2026-08-05 19:32 自动更新记录

- 触发来源：schedule
- Action 记录：https://github.com/AWENIAI/Financial-Calendar/actions/runs/31001835520
- 订阅文件：`public/calendar/GLOBAL_KEY.ics`
- 当前事件数：157
- 文件变化统计：3 files changed, 181 insertions(+), 11 deletions(-)
- 变化文件：
  - 修改：`data/cffex-position-watch.json`
  - 修改：`data/us-megacap-earnings.json`
  - 修改：`public/calendar/GLOBAL_KEY.ics`
- 最近未来事件：
  - 2026-08-07 08:00：🔴 [美股] 非农就业：2026年7月 Employment Situation
  - 2026-08-07 08:00：📊 [美股] 伯克希尔哈撒韦（Berkshire Hathaway，BRK.B）财报发布：2026年6月
  - 2026-08-12 08:00：🔴 [美股] CPI 发布：2026年7月美国通胀数据
  - 2026-08-12 08:00：📊 [美股] 思科（Cisco，CSCO）财报发布：2026年7月
  - 2026-08-13 08:00：🟠 [美股] PPI 发布：2026年7月生产者价格指数

### 2026-08-04 21:45 自动更新记录

- 触发来源：workflow_dispatch
- Action 记录：https://github.com/AWENIAI/Financial-Calendar/actions/runs/30914999600
- 订阅文件：`public/calendar/GLOBAL_KEY.ics`
- 当前事件数：156
- 文件变化统计：3 files changed, 9 insertions(+), 7 deletions(-)
- 变化文件：
  - 修改：`data/cffex-position-watch.json`
  - 修改：`data/us-megacap-earnings.json`
  - 修改：`public/calendar/GLOBAL_KEY.ics`
- 最近未来事件：
  - 2026-08-05 08:00：📊 [美股] AMD（AMD，AMD）财报发布：2026年6月
  - 2026-08-05 08:00：📊 [美股] SpaceX（SpaceX，SPCX）财报发布：2026年6月
  - 2026-08-05 08:00：📊 [美股] 礼来（Eli Lilly，LLY）财报发布：2026年6月
  - 2026-08-07 08:00：🔴 [美股] 非农就业：2026年7月 Employment Situation
  - 2026-08-07 08:00：📊 [美股] 伯克希尔哈撒韦（Berkshire Hathaway，BRK.B）财报发布：2026年6月

### 2026-08-04 21:35 自动更新记录

- 触发来源：local
- Action 记录：本地运行
- 订阅文件：`public/calendar/GLOBAL_KEY.ics`
- 当前事件数：156
- 文件变化统计：4 files changed, 176 insertions(+), 2 deletions(-)
- 变化文件：
  - 修改：`README.md`
  - 修改：`data/cffex-position-watch.json`
  - 修改：`public/calendar/GLOBAL_KEY.ics`
  - 修改：`scripts/risk-calendar/update-cffex-position-watch.mjs`
- 最近未来事件：
  - 2026-08-05 08:00：📊 [美股] AMD（AMD，AMD）财报发布：2026年6月
  - 2026-08-05 08:00：📊 [美股] SpaceX（SpaceX，SPCX）财报发布：2026年6月
  - 2026-08-05 08:00：📊 [美股] 礼来（Eli Lilly，LLY）财报发布：2026年6月
  - 2026-08-07 08:00：🔴 [美股] 非农就业：2026年7月 Employment Situation
  - 2026-08-07 08:00：📊 [美股] 伯克希尔哈撒韦（Berkshire Hathaway，BRK.B）财报发布：2026年6月

### 2026-08-04 19:35 自动更新记录

- 触发来源：schedule
- Action 记录：https://github.com/AWENIAI/Financial-Calendar/actions/runs/30905427432
- 订阅文件：`public/calendar/GLOBAL_KEY.ics`
- 当前事件数：155
- 文件变化统计：3 files changed, 126 insertions(+), 54 deletions(-)
- 变化文件：
  - 修改：`data/cffex-position-watch.json`
  - 修改：`data/us-megacap-earnings.json`
  - 修改：`public/calendar/GLOBAL_KEY.ics`
- 最近未来事件：
  - 2026-08-05 08:00：📊 [美股] AMD（AMD，AMD）财报发布：2026年6月
  - 2026-08-05 08:00：📊 [美股] SpaceX（SpaceX，SPCX）财报发布：2026年6月
  - 2026-08-05 08:00：📊 [美股] 礼来（Eli Lilly，LLY）财报发布：2026年6月
  - 2026-08-07 08:00：🔴 [美股] 非农就业：2026年7月 Employment Situation
  - 2026-08-07 08:00：📊 [美股] 伯克希尔哈撒韦（Berkshire Hathaway，BRK.B）财报发布：2026年6月

### 2026-08-03 18:20 自动更新记录

- 触发来源：workflow_dispatch
- Action 记录：https://github.com/AWENIAI/Financial-Calendar/actions/runs/30805131287
- 订阅文件：`public/calendar/GLOBAL_KEY.ics`
- 当前事件数：154
- 文件变化统计：2 files changed, 2 insertions(+), 2 deletions(-)
- 变化文件：
  - 修改：`data/cffex-position-watch.json`
  - 修改：`public/calendar/GLOBAL_KEY.ics`
- 最近未来事件：
  - 2026-08-04 08:00：📊 [美股] 卡特彼勒（Caterpillar，CAT）财报发布：2026年6月
  - 2026-08-05 08:00：📊 [美股] AMD（AMD，AMD）财报发布：2026年6月
  - 2026-08-05 08:00：📊 [美股] SpaceX（SpaceX，SPCX）财报发布：2026年6月
  - 2026-08-05 08:00：📊 [美股] 礼来（Eli Lilly，LLY）财报发布：2026年6月
  - 2026-08-07 08:00：🔴 [美股] 非农就业：2026年7月 Employment Situation

### 2026-08-03 18:18 自动更新记录

- 触发来源：local
- Action 记录：本地运行
- 订阅文件：`public/calendar/GLOBAL_KEY.ics`
- 当前事件数：154
- 文件变化统计：4 files changed, 23 insertions(+), 1 deletion(-)
- 变化文件：
  - 修改：`.github/workflows/update-calendar-feed.yml`
  - 修改：`package.json`
  - 修改：`public/calendar/GLOBAL_KEY.ics`
  - 修改：`scripts/risk-calendar/generate-risk-calendar.mjs`
- 最近未来事件：
  - 2026-08-04 08:00：📊 [美股] 卡特彼勒（Caterpillar，CAT）财报发布：2026年6月
  - 2026-08-05 08:00：📊 [美股] AMD（AMD，AMD）财报发布：2026年6月
  - 2026-08-05 08:00：📊 [美股] SpaceX（SpaceX，SPCX）财报发布：2026年6月
  - 2026-08-05 08:00：📊 [美股] 礼来（Eli Lilly，LLY）财报发布：2026年6月
  - 2026-08-07 08:00：🔴 [美股] 非农就业：2026年7月 Employment Situation

### 2026-08-03 17:23 自动更新记录

- 触发来源：workflow_dispatch
- Action 记录：https://github.com/AWENIAI/Financial-Calendar/actions/runs/30801181721
- 订阅文件：`public/calendar/GLOBAL_KEY.ics`
- 当前事件数：154
- 文件变化统计：3 files changed, 2 insertions(+), 58 deletions(-)
- 变化文件：
  - 修改：`data/cffex-position-watch.json`
  - 修改：`data/us-megacap-earnings.json`
  - 修改：`public/calendar/GLOBAL_KEY.ics`
- 最近未来事件：
  - 2026-08-04 08:00：📊 [美股] 卡特彼勒（Caterpillar，CAT）财报发布：2026年6月
  - 2026-08-05 08:00：📊 [美股] AMD（AMD，AMD）财报发布：2026年6月
  - 2026-08-05 08:00：📊 [美股] SpaceX（SpaceX，SPCX）财报发布：2026年6月
  - 2026-08-05 08:00：📊 [美股] 礼来（Eli Lilly，LLY）财报发布：2026年6月
  - 2026-08-07 08:00：🔴 [美股] 非农就业：2026年7月 Employment Situation

### 2026-08-03 17:21 自动更新记录

- 触发来源：local
- Action 记录：本地运行
- 订阅文件：`public/calendar/GLOBAL_KEY.ics`
- 当前事件数：154
- 文件变化统计：5 files changed, 73 insertions(+), 72 deletions(-)
- 变化文件：
  - 修改：`.github/workflows/update-calendar-feed.yml`
  - 修改：`README.backup.md`
  - 修改：`README.md`
  - 修改：`data/cffex-position-watch.json`
  - 修改：`public/calendar/GLOBAL_KEY.ics`
- 最近未来事件：
  - 2026-08-04 08:00：📊 [美股] 卡特彼勒（Caterpillar，CAT）财报发布：2026年6月
  - 2026-08-05 08:00：📊 [美股] AMD（AMD，AMD）财报发布：2026年6月
  - 2026-08-05 08:00：📊 [美股] SpaceX（SpaceX，SPCX）财报发布：2026年6月
  - 2026-08-05 08:00：📊 [美股] 礼来（Eli Lilly，LLY）财报发布：2026年6月
  - 2026-08-07 08:00：🔴 [美股] 非农就业：2026年7月 Employment Situation

### 2026-08-03 06:18 自动更新记录

- 触发来源：local
- Action 记录：本地运行
- 订阅文件：`public/calendar/GLOBAL_KEY.ics`
- 当前事件数：154
- 文件变化统计：3 files changed, 16 insertions(+), 16 deletions(-)
- 变化文件：
  - 修改：`data/cffex-position-watch.json`
  - 修改：`public/calendar/GLOBAL_KEY.ics`
  - 修改：`scripts/risk-calendar/update-cffex-position-watch.mjs`
- 最近未来事件：
  - 2026-08-04 08:00：📊 [美股] 卡特彼勒（Caterpillar，CAT）财报发布：2026年6月
  - 2026-08-05 08:00：📊 [美股] AMD（AMD，AMD）财报发布：2026年6月
  - 2026-08-05 08:00：📊 [美股] SpaceX（SpaceX，SPCX）财报发布：2026年6月
  - 2026-08-05 08:00：📊 [美股] 礼来（Eli Lilly，LLY）财报发布：2026年6月
  - 2026-08-07 08:00：🔴 [美股] 非农就业：2026年7月 Employment Situation

### 2026-08-02 23:20 自动更新记录

- 触发来源：local
- Action 记录：本地运行
- 订阅文件：`public/calendar/GLOBAL_KEY.ics`
- 当前事件数：154
- 文件变化统计：2 files changed, 168 insertions(+), 1 deletion(-)
- 变化文件：
  - 修改：`data/cffex-position-watch.json`
  - 修改：`public/calendar/GLOBAL_KEY.ics`
- 最近未来事件：
  - 2026-08-04 08:00：📊 [美股] 卡特彼勒（Caterpillar，CAT）财报发布：2026年6月
  - 2026-08-05 08:00：📊 [美股] AMD（AMD，AMD）财报发布：2026年6月
  - 2026-08-05 08:00：📊 [美股] SpaceX（SpaceX，SPCX）财报发布：2026年6月
  - 2026-08-05 08:00：📊 [美股] 礼来（Eli Lilly，LLY）财报发布：2026年6月
  - 2026-08-07 08:00：🔴 [美股] 非农就业：2026年7月 Employment Situation

### 2026-08-02 22:50 自动更新记录

- 触发来源：local
- Action 记录：本地运行
- 订阅文件：`public/calendar/GLOBAL_KEY.ics`
- 当前事件数：153
- 文件变化统计：3 files changed, 15 insertions(+), 9 deletions(-)
- 变化文件：
  - 修改：`.github/workflows/update-calendar-feed.yml`
  - 修改：`README.md`
  - 修改：`scripts/risk-calendar/update-cffex-position-watch.mjs`
- 最近未来事件：
  - 2026-08-04 08:00：📊 [美股] 卡特彼勒（Caterpillar，CAT）财报发布：2026年6月
  - 2026-08-05 08:00：📊 [美股] AMD（AMD，AMD）财报发布：2026年6月
  - 2026-08-05 08:00：📊 [美股] SpaceX（SpaceX，SPCX）财报发布：2026年6月
  - 2026-08-05 08:00：📊 [美股] 礼来（Eli Lilly，LLY）财报发布：2026年6月
  - 2026-08-07 08:00：🔴 [美股] 非农就业：2026年7月 Employment Situation

### 2026-08-02 22:30 自动更新记录

- 触发来源：local
- Action 记录：本地运行
- 订阅文件：`public/calendar/GLOBAL_KEY.ics`
- 当前事件数：153
- 文件变化统计：新增中金所持仓跟踪脚本与空数据文件，修复 7/30、7/31 AAPL/AMZN 重复财报事件。
- 变化文件：
  - 修改：`.github/workflows/update-calendar-feed.yml`
  - 修改：`README.md`
  - 修改：`README.backup.md`
  - 新增：`data/cffex-position-watch.json`
  - 修改：`data/us-megacap-earnings.json`
  - 修改：`package.json`
  - 修改：`public/calendar/GLOBAL_KEY.ics`
  - 修改：`scripts/risk-calendar/generate-risk-calendar.mjs`
  - 新增：`scripts/risk-calendar/update-cffex-position-watch.mjs`
  - 修改：`scripts/risk-calendar/update-us-megacap-earnings.mjs`
- 最近未来事件：
  - 2026-08-04 08:00：📊 [美股] 卡特彼勒（Caterpillar，CAT）财报发布：2026年6月
  - 2026-08-05 08:00：📊 [美股] AMD（AMD，AMD）财报发布：2026年6月
  - 2026-08-05 08:00：📊 [美股] SpaceX（SpaceX，SPCX）财报发布：2026年6月
  - 2026-08-05 08:00：📊 [美股] 礼来（Eli Lilly，LLY）财报发布：2026年6月
  - 2026-08-07 08:00：🔴 [美股] 非农就业：2026年7月 Employment Situation

### 2026-08-02 06:59 自动更新记录

- 触发来源：schedule
- Action 记录：https://github.com/AWENIAI/Financial-Calendar/actions/runs/30722432150
- 订阅文件：`public/calendar/GLOBAL_KEY.ics`
- 当前事件数：155
- 文件变化统计：2 files changed, 83 insertions(+), 70 deletions(-)
- 变化文件：
  - 修改：`data/us-megacap-earnings.json`
  - 修改：`public/calendar/GLOBAL_KEY.ics`
- 最近未来事件：
  - 2026-08-04 08:00：📊 [美股] 卡特彼勒（Caterpillar，CAT）财报发布：2026年6月
  - 2026-08-05 08:00：📊 [美股] AMD（AMD，AMD）财报发布：2026年6月
  - 2026-08-05 08:00：📊 [美股] SpaceX（SpaceX，SPCX）财报发布：2026年6月
  - 2026-08-05 08:00：📊 [美股] 礼来（Eli Lilly，LLY）财报发布：2026年6月
  - 2026-08-07 08:00：🔴 [美股] 非农就业：2026年7月 Employment Situation

### 2026-08-01 12:51 自动更新记录

- 触发来源：local
- Action 记录：本地运行
- 订阅文件：`public/calendar/GLOBAL_KEY.ics`
- 当前事件数：155
- 文件变化统计：7 files changed, 529 insertions(+), 25 deletions(-)
- 变化文件：
  - 修改：`.github/workflows/update-calendar-feed.yml`
  - 修改：`README.backup.md`
  - 修改：`README.md`
  - 修改：`data/us-megacap-earnings.json`
  - 修改：`package.json`
  - 修改：`public/calendar/GLOBAL_KEY.ics`
  - 修改：`scripts/risk-calendar/update-us-megacap-earnings.mjs`
- 最近未来事件：
  - 2026-08-04 08:00：📊 [美股] 卡特彼勒（Caterpillar，CAT）财报发布：2026年6月
  - 2026-08-05 08:00：📊 [美股] AMD（AMD，AMD）财报发布：2026年6月
  - 2026-08-05 08:00：📊 [美股] SpaceX（SpaceX，SPCX）财报发布：2026年6月
  - 2026-08-05 08:00：📊 [美股] 礼来（Eli Lilly，LLY）财报发布：2026年6月
  - 2026-08-07 08:00：🔴 [美股] 非农就业：2026年7月 Employment Situation

### 2026-08-01 12:47 自动更新记录

- 触发来源：local
- Action 记录：本地运行
- 订阅文件：`public/calendar/GLOBAL_KEY.ics`
- 当前事件数：155
- 文件变化统计：7 files changed, 486 insertions(+), 25 deletions(-)
- 变化文件：
  - 修改：`.github/workflows/update-calendar-feed.yml`
  - 修改：`README.backup.md`
  - 修改：`README.md`
  - 修改：`data/us-megacap-earnings.json`
  - 修改：`package.json`
  - 修改：`public/calendar/GLOBAL_KEY.ics`
  - 修改：`scripts/risk-calendar/update-us-megacap-earnings.mjs`
- 最近未来事件：
  - 2026-08-04 08:00：📊 [美股] 卡特彼勒（Caterpillar，CAT）财报发布：2026年6月
  - 2026-08-05 08:00：📊 [美股] AMD（AMD，AMD）财报发布：2026年6月
  - 2026-08-05 08:00：📊 [美股] SpaceX（SpaceX，SPCX）财报发布：2026年6月
  - 2026-08-05 08:00：📊 [美股] 礼来（Eli Lilly，LLY）财报发布：2026年6月
  - 2026-08-07 08:00：🔴 [美股] 非农就业：2026年7月 Employment Situation

### 2026-08-01 12:45 自动更新记录

- 触发来源：local
- Action 记录：本地运行
- 订阅文件：`public/calendar/GLOBAL_KEY.ics`
- 当前事件数：155
- 文件变化统计：6 files changed, 447 insertions(+), 24 deletions(-)
- 变化文件：
  - 修改：`.github/workflows/update-calendar-feed.yml`
  - 修改：`README.md`
  - 修改：`data/us-megacap-earnings.json`
  - 修改：`package.json`
  - 修改：`public/calendar/GLOBAL_KEY.ics`
  - 修改：`scripts/risk-calendar/update-us-megacap-earnings.mjs`
- 最近未来事件：
  - 2026-08-04 08:00：📊 [美股] 卡特彼勒（Caterpillar，CAT）财报发布：2026年6月
  - 2026-08-05 08:00：📊 [美股] AMD（AMD，AMD）财报发布：2026年6月
  - 2026-08-05 08:00：📊 [美股] SpaceX（SpaceX，SPCX）财报发布：2026年6月
  - 2026-08-05 08:00：📊 [美股] 礼来（Eli Lilly，LLY）财报发布：2026年6月
  - 2026-08-07 08:00：🔴 [美股] 非农就业：2026年7月 Employment Situation

### 2026-08-01 12:16 自动更新记录

- 触发来源：local
- Action 记录：本地运行
- 订阅文件：`public/calendar/GLOBAL_KEY.ics`
- 当前事件数：155
- 文件变化统计：2 files changed, 3 insertions(+), 6 deletions(-)
- 变化文件：
  - 修改：`.github/workflows/update-calendar-feed.yml`
  - 修改：`README.md`
- 最近未来事件：
  - 2026-08-04 08:00：📊 [美股] 卡特彼勒（Caterpillar，CAT）财报发布：2026年6月
  - 2026-08-05 08:00：📊 [美股] AMD（AMD，AMD）财报发布：2026年6月
  - 2026-08-05 08:00：📊 [美股] SpaceX（SpaceX，SPCX）财报发布：2026年6月
  - 2026-08-05 08:00：📊 [美股] 礼来（Eli Lilly，LLY）财报发布：2026年6月
  - 2026-08-07 08:00：🔴 [美股] 非农就业：2026年7月 Employment Situation

### 2026-08-01 11:50 自动更新记录

- 触发来源：local
- Action 记录：本地运行
- 订阅文件：`public/calendar/GLOBAL_KEY.ics`
- 当前事件数：155
- 文件变化统计：2 files changed, 24 insertions(+), 1 deletion(-)
- 变化文件：
  - 修改：`.github/workflows/update-calendar-feed.yml`
  - 修改：`scripts/risk-calendar/update-us-megacap-earnings.mjs`
- 最近未来事件：
  - 2026-08-04 08:00：📊 [美股] 卡特彼勒（Caterpillar，CAT）财报发布：2026年6月
  - 2026-08-05 08:00：📊 [美股] AMD（AMD，AMD）财报发布：2026年6月
  - 2026-08-05 08:00：📊 [美股] SpaceX（SpaceX，SPCX）财报发布：2026年6月
  - 2026-08-05 08:00：📊 [美股] 礼来（Eli Lilly，LLY）财报发布：2026年6月
  - 2026-08-07 08:00：🔴 [美股] 非农就业：2026年7月 Employment Situation

### 2026-08-01 07:58 自动更新记录

- 触发来源：schedule
- Action 记录：https://github.com/AWENIAI/Financial-Calendar/actions/runs/30674286540
- 订阅文件：`public/calendar/GLOBAL_KEY.ics`
- 当前事件数：155
- 文件变化统计：2 files changed, 206 insertions(+), 54 deletions(-)
- 变化文件：
  - 修改：`data/us-megacap-earnings.json`
  - 修改：`public/calendar/GLOBAL_KEY.ics`
- 最近未来事件：
  - 2026-08-04 08:00：📊 [美股] 卡特彼勒（Caterpillar，CAT）财报发布：2026年6月
  - 2026-08-05 08:00：📊 [美股] AMD（AMD，AMD）财报发布：2026年6月
  - 2026-08-05 08:00：📊 [美股] SpaceX（SpaceX，SPCX）财报发布：2026年6月
  - 2026-08-05 08:00：📊 [美股] 礼来（Eli Lilly，LLY）财报发布：2026年6月
  - 2026-08-07 08:00：🔴 [美股] 非农就业：2026年7月 Employment Situation

### 2026-07-31 11:05 自动更新记录

- 触发来源：local
- Action 记录：本地运行
- 订阅文件：`public/calendar/GLOBAL_KEY.ics`
- 当前事件数：153
- 文件变化统计：2 files changed, 473 insertions(+), 623 deletions(-)
- 变化文件：
  - 修改：`public/calendar/GLOBAL_KEY.ics`
  - 修改：`scripts/risk-calendar/generate-risk-calendar.mjs`
- 最近未来事件：
  - 2026-08-04 08:00：📊 [美股] 卡特彼勒（Caterpillar，CAT）财报发布：2026年6月
  - 2026-08-05 08:00：📊 [美股] AMD（AMD，AMD）财报发布：2026年6月
  - 2026-08-05 08:00：📊 [美股] SpaceX（SpaceX，SPCX）财报发布：2026年6月
  - 2026-08-05 08:00：📊 [美股] 礼来（Eli Lilly，LLY）财报发布：2026年6月
  - 2026-08-07 08:00：🔴 [美股] 非农就业：2026年7月 Employment Situation

### 2026-07-31 10:36 自动更新记录

- 触发来源：local
- Action 记录：本地运行
- 订阅文件：`public/calendar/GLOBAL_KEY.ics`
- 当前事件数：153
- 文件变化统计：5 files changed, 866 insertions(+), 70 deletions(-)
- 变化文件：
  - 修改：`README.md`
  - 修改：`data/us-megacap-earnings.json`
  - 修改：`public/calendar/GLOBAL_KEY.ics`
  - 修改：`scripts/risk-calendar/generate-risk-calendar.mjs`
  - 修改：`scripts/risk-calendar/update-us-megacap-earnings.mjs`
- 最近未来事件：
  - 2026-07-31 20:30：📊 [美股] 埃克森美孚（Exxon Mobil，XOM）财报发布：2026年6月
  - 2026-07-31 20:30：📊 [美股] 艾伯维（AbbVie，ABBV）财报发布：2026年6月
  - 2026-07-31 20:30：📊 [美股] 雪佛龙（Chevron，CVX）财报发布：2026年6月
  - 2026-08-04 20:30：📊 [美股] 卡特彼勒（Caterpillar，CAT）财报发布：2026年6月
  - 2026-08-05 04:05：📊 [美股] AMD（AMD，AMD）财报发布：2026年6月

### 2026-07-31 09:55 自动更新记录

- 触发来源：local
- Action 记录：本地运行
- 订阅文件：`public/calendar/GLOBAL_KEY.ics`
- 当前事件数：143
- 文件变化统计：2 files changed, 63 insertions(+), 1 deletion(-)
- 变化文件：
  - 修改：`public/calendar/GLOBAL_KEY.ics`
  - 修改：`scripts/risk-calendar/generate-risk-calendar.mjs`
- 最近未来事件：
  - 2026-07-31 20:30：📊 [美股] 埃克森美孚（Exxon Mobil，XOM）财报发布：2026年6月
  - 2026-08-05 20:30：📊 [美股] 礼来（Eli Lilly，LLY）财报发布：2026年6月
  - 2026-08-07 20:30：🔴 [美股] 非农就业：2026年7月 Employment Situation
  - 2026-08-07 21:30：📊 [美股] 伯克希尔哈撒韦（Berkshire Hathaway，BRK.B）财报发布：2026年6月
  - 2026-08-12 20:30：🔴 [美股] CPI 发布：2026年7月美国通胀数据

### 2026-07-31 09:00 自动更新记录

- 触发来源：local
- Action 记录：本地运行
- 订阅文件：`public/calendar/GLOBAL_KEY.ics`
- 当前事件数：140
- 文件变化统计：2 files changed, 193 insertions(+), 193 deletions(-)
- 变化文件：
  - 修改：`public/calendar/GLOBAL_KEY.ics`
  - 修改：`scripts/risk-calendar/generate-risk-calendar.mjs`
- 最近未来事件：
  - 2026-07-31 20:30：📊 [美股] 埃克森美孚（Exxon Mobil，XOM）财报发布：2026年6月
  - 2026-08-05 20:30：📊 [美股] 礼来（Eli Lilly，LLY）财报发布：2026年6月
  - 2026-08-07 20:30：🔴 [美股] 非农就业：2026年7月 Employment Situation
  - 2026-08-07 21:30：📊 [美股] 伯克希尔哈撒韦（Berkshire Hathaway，BRK.B）财报发布：2026年6月
  - 2026-08-12 20:30：🔴 [美股] CPI 发布：2026年7月美国通胀数据

### 2026-07-31 08:53 自动更新记录

- 触发来源：local
- Action 记录：本地运行
- 订阅文件：`public/calendar/GLOBAL_KEY.ics`
- 当前事件数：140
- 文件变化统计：2 files changed, 36 insertions(+), 26 deletions(-)
- 变化文件：
  - 修改：`public/calendar/GLOBAL_KEY.ics`
  - 修改：`scripts/risk-calendar/generate-risk-calendar.mjs`
- 最近未来事件：
  - 2026-07-31 20:30：📊 [美股] 埃克森美孚（Exxon Mobil，XOM）财报发布：2026年6月
  - 2026-08-05 20:30：📊 [美股] 礼来（Eli Lilly，LLY）财报发布：2026年6月
  - 2026-08-07 20:30：🔴 [美股] 非农就业：2026年7月 Employment Situation
  - 2026-08-07 21:30：📊 [美股] 伯克希尔哈撒韦（Berkshire Hathaway，BRK.B）财报发布：2026年6月
  - 2026-08-12 20:30：🔴 [美股] CPI 发布：2026年7月美国通胀数据

### 2026-07-31 08:50 自动更新记录

- 触发来源：local
- Action 记录：本地运行
- 订阅文件：`public/calendar/GLOBAL_KEY.ics`
- 当前事件数：140
- 文件变化统计：3 files changed, 36 insertions(+), 11 deletions(-)
- 变化文件：
  - 修改：`data/us-megacap-earnings.json`
  - 修改：`public/calendar/GLOBAL_KEY.ics`
  - 修改：`scripts/risk-calendar/generate-risk-calendar.mjs`
- 最近未来事件：
  - 2026-07-31 20:30：📊 [美股] 埃克森美孚（Exxon Mobil，XOM）财报发布：2026年6月
  - 2026-08-05 20:30：📊 [美股] 礼来（Eli Lilly，LLY）财报发布：2026年6月
  - 2026-08-07 20:30：🔴 [美股] 非农就业：2026年7月 Employment Situation
  - 2026-08-07 21:30：📊 [美股] 伯克希尔哈撒韦（Berkshire Hathaway，BRK.B）财报发布：2026年6月
  - 2026-08-12 20:30：🔴 [美股] CPI 发布：2026年7月美国通胀数据

### 2026-07-31 08:45 自动更新记录

- 触发来源：local
- Action 记录：本地运行
- 订阅文件：`public/calendar/GLOBAL_KEY.ics`
- 当前事件数：140
- 文件变化统计：3 files changed, 113 insertions(+), 3 deletions(-)
- 变化文件：
  - 修改：`data/us-megacap-earnings.json`
  - 修改：`public/calendar/GLOBAL_KEY.ics`
  - 修改：`scripts/risk-calendar/generate-risk-calendar.mjs`
- 最近未来事件：
  - 2026-07-31 20:30：📊 [美股] 埃克森美孚（Exxon Mobil，XOM）财报发布：2026年6月
  - 2026-08-05 20:30：📊 [美股] 礼来（Eli Lilly，LLY）财报发布：2026年6月
  - 2026-08-07 20:30：🔴 [美股] 非农就业：2026年7月 Employment Situation
  - 2026-08-07 21:30：📊 [美股] 伯克希尔哈撒韦（Berkshire Hathaway，BRK.B）财报发布：2026年6月
  - 2026-08-12 20:30：🔴 [美股] CPI 发布：2026年7月美国通胀数据

### 2026-07-31 08:33 自动更新记录

- 触发来源：local
- Action 记录：本地运行
- 订阅文件：`public/calendar/GLOBAL_KEY.ics`
- 当前事件数：140
- 文件变化统计：5 files changed, 184 insertions(+), 39 deletions(-)
- 变化文件：
  - 修改：`README.md`
  - 修改：`data/us-megacap-earnings.json`
  - 修改：`public/calendar/GLOBAL_KEY.ics`
  - 修改：`scripts/risk-calendar/generate-risk-calendar.mjs`
  - 修改：`scripts/risk-calendar/update-us-megacap-earnings.mjs`
- 最近未来事件：
  - 2026-07-31 20:30：📊 [美股] 埃克森美孚（Exxon Mobil，XOM）财报发布：2026年6月
  - 2026-08-05 20:30：📊 [美股] 礼来（Eli Lilly，LLY）财报发布：2026年6月
  - 2026-08-07 20:30：🔴 [美股] 非农就业：2026年7月 Employment Situation
  - 2026-08-07 21:30：📊 [美股] 伯克希尔哈撒韦（Berkshire Hathaway，BRK.B）财报发布：2026年6月
  - 2026-08-12 20:30：🔴 [美股] CPI 发布：2026年7月美国通胀数据

### 2026-07-31 08:23 自动更新记录

- 触发来源：local
- Action 记录：本地运行
- 订阅文件：`public/calendar/GLOBAL_KEY.ics`
- 当前事件数：140
- 文件变化统计：4 files changed, 936 insertions(+), 16 deletions(-)
- 变化文件：
  - 修改：`data/us-megacap-earnings.json`
  - 修改：`public/calendar/GLOBAL_KEY.ics`
  - 修改：`scripts/risk-calendar/generate-risk-calendar.mjs`
  - 修改：`scripts/risk-calendar/update-us-megacap-earnings.mjs`
- 最近未来事件：
  - 2026-07-31 20:30：📊 [美股] 埃克森美孚（Exxon Mobil，XOM）财报发布：2026年6月
  - 2026-08-05 20:30：📊 [美股] 礼来（Eli Lilly，LLY）财报发布：2026年6月
  - 2026-08-07 20:30：🔴 [美股] 非农就业：2026年7月 Employment Situation
  - 2026-08-07 21:30：📊 [美股] 伯克希尔哈撒韦（Berkshire Hathaway，BRK.B）财报发布：2026年6月
  - 2026-08-12 20:30：🔴 [美股] CPI 发布：2026年7月美国通胀数据

### 2026-07-31 08:12 自动更新记录

- 触发来源：local
- Action 记录：本地运行
- 订阅文件：`public/calendar/GLOBAL_KEY.ics`
- 当前事件数：132
- 文件变化统计：2 files changed, 24 insertions(+), 19 deletions(-)
- 变化文件：
  - 修改：`public/calendar/GLOBAL_KEY.ics`
  - 修改：`scripts/risk-calendar/generate-risk-calendar.mjs`
- 最近未来事件：
  - 2026-07-31 20:30：📊 [美股] 埃克森美孚（Exxon Mobil，XOM）财报发布：2026年6月
  - 2026-08-05 20:30：📊 [美股] 礼来（Eli Lilly，LLY）财报发布：2026年6月
  - 2026-08-07 20:30：🔴 [美股] 非农就业：2026年7月 Employment Situation
  - 2026-08-07 21:30：📊 [美股] 伯克希尔哈撒韦（Berkshire Hathaway，BRK.B）财报发布：2026年6月
  - 2026-08-12 20:30：🔴 [美股] CPI 发布：2026年7月美国通胀数据

### 2026-07-31 08:07 自动更新记录

- 触发来源：local
- Action 记录：本地运行
- 订阅文件：`public/calendar/GLOBAL_KEY.ics`
- 当前事件数：132
- 文件变化统计：4 files changed, 598 insertions(+), 497 deletions(-)
- 变化文件：
  - 修改：`data/us-megacap-earnings.json`
  - 修改：`public/calendar/GLOBAL_KEY.ics`
  - 修改：`scripts/risk-calendar/generate-risk-calendar.mjs`
  - 修改：`scripts/risk-calendar/update-us-megacap-earnings.mjs`
- 最近未来事件：
  - 2026-07-31 20:30：🟠 [美股] 埃克森美孚（Exxon Mobil，XOM）财报发布：2026年6月
  - 2026-08-05 20:30：🟠 [美股] 礼来（Eli Lilly，LLY）财报发布：2026年6月
  - 2026-08-07 20:30：🔴 [美股] 非农就业：2026年7月 Employment Situation
  - 2026-08-07 21:30：🟠 [美股] 伯克希尔哈撒韦（Berkshire Hathaway，BRK.B）财报发布：2026年6月
  - 2026-08-12 20:30：🔴 [美股] CPI 发布：2026年7月美国通胀数据

### 2026-07-31 08:02 自动更新记录

- 触发来源：local
- Action 记录：本地运行
- 订阅文件：`public/calendar/GLOBAL_KEY.ics`
- 当前事件数：132
- 文件变化统计：3 files changed, 234 insertions(+), 136 deletions(-)
- 变化文件：
  - 修改：`public/calendar/GLOBAL_KEY.ics`
  - 修改：`scripts/risk-calendar/generate-risk-calendar.mjs`
  - 修改：`scripts/risk-calendar/update-us-megacap-earnings.mjs`
- 最近未来事件：
  - 2026-07-31 20:30：🟠 [US] Exxon Mobil（XOM）财报发布：Jun/2026
  - 2026-08-05 20:30：🟠 [US] Eli Lilly（LLY）财报发布：Jun/2026
  - 2026-08-07 20:30：🔴 [US] 非农就业：2026年7月 Employment Situation
  - 2026-08-07 21:30：🟠 [US] Berkshire Hathaway（BRK.B）财报发布：Jun/2026
  - 2026-08-12 20:30：🔴 [US] CPI 发布：2026年7月美国通胀数据

### 2026-07-31 07:08 自动更新记录

- 触发来源：local
- Action 记录：本地运行
- 订阅文件：`public/calendar/GLOBAL_KEY.ics`
- 当前事件数：132
- 文件变化统计：5 files changed, 133 insertions(+), 14 deletions(-)
- 变化文件：
  - 修改：`.github/workflows/update-calendar-feed.yml`
  - 修改：`README.md`
  - 修改：`package.json`
  - 修改：`public/calendar/GLOBAL_KEY.ics`
  - 修改：`scripts/risk-calendar/generate-risk-calendar.mjs`
- 最近未来事件：
  - 2026-07-31 20:30：🟠 [US] Exxon Mobil（XOM）财报发布：Jun/2026
  - 2026-08-05 20:30：🟠 [US] Eli Lilly（LLY）财报发布：Jun/2026
  - 2026-08-07 20:30：🔴 [US] 非农就业：2026年7月 Employment Situation
  - 2026-08-07 21:30：🟠 [US] Berkshire Hathaway（BRK.B）财报发布：Jun/2026
  - 2026-08-12 20:30：🔴 [US] CPI 发布：2026年7月美国通胀数据

### 2026-07-31 04:12 自动更新记录

- 触发来源：local
- Action 记录：本地运行
- 订阅文件：`public/calendar/GLOBAL_KEY.ics`
- 当前事件数：126
- 文件变化统计：4 files changed, 223 insertions(+), 1 deletion(-)
- 变化文件：
  - 修改：`README.md`
  - 修改：`data/fixed-events-2026.json`
  - 修改：`public/calendar/GLOBAL_KEY.ics`
  - 修改：`scripts/risk-calendar/generate-risk-calendar.mjs`
- 最近未来事件：
  - 2026-08-07 20:30：🔴 [US] 非农就业：2026年7月 Employment Situation
  - 2026-08-12 20:30：🔴 [US] CPI 发布：2026年7月美国通胀数据
  - 2026-08-13 20:30：🟠 [US] PPI 发布：2026年7月生产者价格指数
  - 2026-08-19 21:30：🟠 [US] VIX 期权到期日：8月标准到期
  - 2026-08-20 02:00：🟠 [US] FOMC 会议纪要发布：7月会议纪要

### 2026-07-28 全年固定事件补齐

- 补齐 2026 年 1–12 月 A股股指期货/期权月度交割日。
- 春节、端午涉及非交易日的月份已顺延：`2026-02-24`、`2026-06-22`。
- 补齐 2026 年固定时间/规则型事件：FOMC、FOMC 纪要、非农、CPI、PPI、VIX 到期、SPX / OPEX、港股指数到期、A股定期报告披露截止窗口。
- 新增 `data/fixed-events-2026.json` 作为全年固定事件清单。
- `GLOBAL_KEY.ics` 从 12 条事件更新为 116 条事件。

### 2026-07-28

- 订阅文件改为单链接模式：只保留 `public/calendar/GLOBAL_KEY.ics`。
- A股、港股、美股事件全部合并到 `GLOBAL_KEY.ics`。
- 删除分市场订阅文件 `CN_HIGH.ics`、`HK_HIGH.ics`、`US_HIGH.ics`，避免误订多个日历。

### 2026-07-28 A股交割日补齐

- 补齐 A股 `2026-07-17` 股指期货/期权月度交割日。
- 将 `2026-07-17` 作为 `2026-08-21` A股交割日的上周期回测锚点。
- `CN_HIGH.ics` 从 2 条事件更新为 3 条事件。
- `GLOBAL_KEY.ics` 从 11 条事件更新为 12 条事件。

### 2026-07-28 初始版本

- 初始化 `Financial-Calendar` 项目。
- 新增交易风险事件数据文件 `data/risk-events.json`。
- 新增 ICS 生成脚本 `scripts/risk-calendar/generate-risk-calendar.mjs`。
- 初始生成 4 个订阅文件，后续已收敛为单一 `GLOBAL_KEY.ics` 订阅文件。
- 订阅名称统一改为 `阿文风险提醒日历`。
- 支持 🔴 极高 / 🟠 高 两级中文风险标题。
- 每条事件写入来源链接、影响资产、市场反馈、历史反应和应对策略。
- README 增加 Apple Calendar / Google Calendar 订阅方法。
