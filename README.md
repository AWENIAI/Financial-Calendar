# Financial Calendar｜交易风险提醒日历

A股、港股、美股交易风险事件的 ICS 订阅日历。

当前版本先采用“URL 订阅”方案：把风险事件生成 `.ics` 文件，用户在 Apple Calendar / Google Calendar / Outlook 中通过 URL 订阅。

## 订阅链接

如果仓库发布在 GitHub `main` 分支，可使用以下链接订阅：

```text
https://raw.githubusercontent.com/AWENIAI/Financial-Calendar/main/public/calendar/CN_HIGH.ics
https://raw.githubusercontent.com/AWENIAI/Financial-Calendar/main/public/calendar/HK_HIGH.ics
https://raw.githubusercontent.com/AWENIAI/Financial-Calendar/main/public/calendar/US_HIGH.ics
https://raw.githubusercontent.com/AWENIAI/Financial-Calendar/main/public/calendar/GLOBAL_KEY.ics
```

| 文件 | 内容 |
|---|---|
| `CN_HIGH.ics` | A股高风险事件 |
| `HK_HIGH.ics` | 港股高风险事件 |
| `US_HIGH.ics` | 美股高风险事件 |
| `GLOBAL_KEY.ics` | A股、港股、美股关键事件合集 |

## 事件等级

日历标题使用 emoji 表示风险等级：

| 图标 | 等级 | 说明 |
|---|---|---|
| 🔴 | Critical | 必须重点关注 |
| 🟠 | High | 高风险提醒 |

当前 `.ics` 只放入 🔴 和 🟠 事件，避免日历噪音过多。

## Apple Calendar 订阅方法

在 iPhone / iPad：

1. 打开“设置”。
2. 进入“日历” → “账户”。
3. 点击“添加账户” → “其他” → “添加已订阅的日历”。
4. 粘贴上方任一 `.ics` 订阅链接。
5. 保存后，在 Apple Calendar 中勾选该订阅日历。

在 macOS：

1. 打开“日历”应用。
2. 菜单栏选择“文件” → “新建日历订阅”。
3. 粘贴上方任一 `.ics` 订阅链接。
4. 设置自动刷新频率。
5. 点击“好”。

## Google Calendar 订阅方法

1. 打开 [Google Calendar](https://calendar.google.com/)。
2. 左侧找到“其他日历”。
3. 点击 “+”。
4. 选择“通过网址”。
5. 粘贴上方任一 `.ics` 订阅链接。
6. 点击“添加日历”。

注意：Google Calendar 对 URL 订阅日历的刷新频率不可控，可能不是实时刷新。

## 当前内置提醒范围

当前版本先内置 2026 年 7–8 月关键风险事件。

包含：

1. 美股宏观与 Fed 事件：FOMC、非农、CPI、PPI、FOMC 纪要。
2. 美股衍生品事件：VIX 期权到期、SPX / 月度 OPEX 风险窗口。
3. A股制度性事件：股指期货/期权月度交割、中报披露截止窗口。
4. 港股制度性事件：港股指数期货/期权月度到期。

每条事件包含：

- emoji 风险等级
- 市场标签 `[CN] / [HK] / [US]`
- 来源名称
- 来源链接
- 影响资产
- 为什么提醒
- 交易前检查清单

## 开发与更新方法

在项目根目录执行：

```bash
npm run generate
```

这个命令会读取：

```text
data/risk-events.json
```

然后生成：

```text
public/calendar/CN_HIGH.ics
public/calendar/HK_HIGH.ics
public/calendar/US_HIGH.ics
public/calendar/GLOBAL_KEY.ics
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

### 2026-07-27

- 初始化 `Financial-Calendar` 项目。
- 新增交易风险事件数据文件 `data/risk-events.json`。
- 新增 ICS 生成脚本 `scripts/risk-calendar/generate-risk-calendar.mjs`。
- 生成 4 个订阅文件：
  - `CN_HIGH.ics`
  - `HK_HIGH.ics`
  - `US_HIGH.ics`
  - `GLOBAL_KEY.ics`
- 支持 🔴 Critical / 🟠 High 两级风险标题。
- 每条事件写入来源链接、影响资产、提醒原因和交易前检查清单。
- README 增加 Apple Calendar / Google Calendar 订阅方法。

