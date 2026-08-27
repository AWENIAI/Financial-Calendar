from __future__ import annotations

import datetime as dt
import os
from dataclasses import dataclass, asdict
from pathlib import Path
from zoneinfo import ZoneInfo

TZ = ZoneInfo("Asia/Shanghai")
ROOT = Path(__file__).resolve().parents[1]
REPORT_DIR = ROOT / "reports"


@dataclass
class BoardConfig:
    order: int
    name: str
    code: str | None
    note: str = ""


BOARDS = [
    BoardConfig(1, "半导体", "881121"),
    BoardConfig(2, "存储芯片", "886042"),
    BoardConfig(3, "CPO", "886033"),
    BoardConfig(4, "半导体材料", "884091"),
    BoardConfig(5, "人工智能", None, "需当日核验同花顺有效代码"),
    BoardConfig(6, "算力租赁", "886050"),
    BoardConfig(7, "CRO概念", "885927"),
    BoardConfig(8, "人形机器人", None, "需当日核验同花顺有效代码"),
    BoardConfig(9, "商业航天", None, "需当日核验同花顺有效代码"),
    BoardConfig(10, "东数西算(算力)", "885957"),
    BoardConfig(11, "锂电池概念", "885710"),
    BoardConfig(12, "科创50", "000688"),
    BoardConfig(13, "PCB概念", "885959", "附加监控"),
]


def now_shanghai() -> dt.datetime:
    return dt.datetime.now(tz=TZ)


def is_a_share_trading_day(today: dt.date | None = None) -> bool:
    today = today or now_shanghai().date()
    try:
        import akshare as ak
        import pandas as pd

        calendar = ak.tool_trade_date_hist_sina()
        if isinstance(calendar, pd.DataFrame):
            dates = pd.to_datetime(calendar.iloc[:, 0]).dt.date
            return today in set(dates)
    except Exception:
        pass
    weekday = today.weekday()
    return weekday < 5


def market_session_active(ts: dt.datetime | None = None) -> bool:
    ts = ts or now_shanghai()
    t = ts.time()
    morning = dt.time(9, 30) <= t <= dt.time(11, 30)
    afternoon = dt.time(13, 0) <= t <= dt.time(15, 0)
    return morning or afternoon


def fetch_index_snapshot(code: str) -> dict:
    try:
        import akshare as ak
        import pandas as pd

        df = ak.stock_zh_index_spot_em()
        if not isinstance(df, pd.DataFrame) or df.empty:
            return {}
        candidates = df[df.astype(str).apply(lambda row: row.str.contains(code).any(), axis=1)]
        if candidates.empty:
            return {}
        row = candidates.iloc[0].to_dict()
        return row
    except Exception:
        return {}


def render_board(board: BoardConfig) -> str:
    snapshot = fetch_index_snapshot(board.code) if board.code else {}
    current = snapshot.get("最新价", "暂无可靠数据")
    change = snapshot.get("涨跌幅", "暂无可靠数据")
    high = snapshot.get("最高", "暂无可靠数据")
    low = snapshot.get("最低", "暂无可靠数据")
    amount = snapshot.get("成交额", "暂无可靠数据")
    return f"""## {board.order}｜{board.name}｜{board.code or '待核验'}
数据截至：{now_shanghai().strftime('%Y-%m-%d %H:%M:%S')}
当前指数：{current}
今日涨跌：{change}
今日最高：{high}
今日最低：{low}
成交额：{amount}
上涨/下跌家数：暂无可靠数据
市场宽度：暂无可靠数据
生命周期：暂无可靠数据
趋势：暂无可靠数据
R1 第一压力区：暂无可靠数据
形成原因：暂无可靠数据
距离当前：暂无可靠数据
R2 强压力区：暂无可靠数据
形成原因：暂无可靠数据
距离当前：暂无可靠数据
S1 第一支撑区：暂无可靠数据
形成原因：暂无可靠数据
距离当前：暂无可靠数据
S2 强支撑区：暂无可靠数据
形成原因：暂无可靠数据
距离当前：暂无可靠数据
结构状态：暂无可靠数据
当前承接：暂无可靠数据
承接可信度：暂无可靠数据
日内低点回收率：暂无可靠数据
量价 + MA5状态：暂无可靠数据
空仓动作：观望
已有仓位：持有偏防守
当前是否加仓：否
当前是否减仓：否
核心原因：暂无可靠数据
什么情况下加仓：S1有效承接、宽度恢复、龙头止跌、站上MA5后再考虑
什么情况下减仓：跌破S1/S2、放量破位、宽度恶化时减仓
短线失效位：暂无可靠数据
日线失效位：暂无可靠数据
中期失效位：暂无可靠数据
"""


def render_report() -> str:
    ts = now_shanghai()
    if not is_a_share_trading_day(ts.date()):
        return "今日A股休市，不执行14:30板块复盘。\n"
    if not market_session_active(ts):
        return "当前不在A股交易时段，已跳过自动复盘。\n"

    header = [
        f"# A股尾盘二次判定报告",
        f"数据时间：{ts.strftime('%Y-%m-%d %H:%M:%S')}",
        "",
    ]
    body = [render_board(board) for board in BOARDS]
    footer = [
        "## 🚨 当前破位清单",
        "暂无可靠数据",
        "",
        "## 第一性原理总结",
        "1. 买方现在是否愿意提高成交价格？暂无可靠数据",
        "2. 卖方是否仍愿意不断降低价格成交？暂无可靠数据",
        "3. 板块价格回升是真实资金承接，还是单纯跌深反抽？暂无可靠数据",
        "4. 市场宽度是否支持指数表现？暂无可靠数据",
        "5. 当前最重要的矛盾是什么？暂无可靠数据",
        "",
        "## 对抗式审查",
        "当前主结论默认视为不成立，直到行情数据足够可靠。",
        "",
        "【今日最强】暂无可靠数据",
        "【有效承接】暂无可靠数据",
        "【初步承接】暂无可靠数据",
        "【弱承接】暂无可靠数据",
        "【明确破位】暂无可靠数据",
        "【严重破位】暂无可靠数据",
        "【适合开仓】暂无",
        "【适合加仓】暂无",
        "【持有优先】暂无",
        "【减仓优先】暂无",
        "【规避】暂无",
        "【今天最重要的一句话】数据源可用时，这个脚本会自动产出固定格式复盘；当前版本先保证自动执行框架完整。",
        "",
    ]
    return "\n".join(header + body + footer)


def main() -> None:
    report = render_report()
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    path = REPORT_DIR / f"{now_shanghai().date().isoformat()}.md"
    path.write_text(report, encoding="utf-8")
    print(report)
    print(f"\n[written] {path}")


if __name__ == "__main__":
    main()
