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
3. 美股个股财报事件：前 20 大公司未来 30 天内财报。
4. A股制度性事件：股指期货/期权月度交割、定期报告披露截止窗口。
5. A股月末规则型事件：每月倒数第二个中国营业日。
6. A50 期货制度性事件：最后交易日。
7. 港股制度性事件：港股指数期货/期权月度到期。

每条事件包含：

- emoji 风险等级
- 中文风险等级
- 市场标签 `[CN] / [HK] / [US]`
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

GitHub Actions 每天北京时间 7:00 自动执行同一条链路：

1. 更新未来 30 天内的美股前 20 大公司财报数据。
2. 重新生成订阅文件。
3. 如果内容有变化，自动提交并 push 到 `main`。
4. 在同一个 workflow 里直接部署 GitHub Pages。
5. 同步把本次变化明细写入 README 更新日志，并把上一个 README 保存到 `README.backup.md`。

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
