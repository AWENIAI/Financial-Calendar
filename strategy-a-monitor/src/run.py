from __future__ import annotations

import datetime as dt
import json
import urllib.parse
import urllib.request
from pathlib import Path
from zoneinfo import ZoneInfo

TZ = ZoneInfo("Asia/Shanghai")
ROOT = Path(__file__).resolve().parents[1]
STATE_PATH = ROOT / "state" / "strategy_a.json"
REPORT_DIR = ROOT / "reports"
ICS_PATH = ROOT / "output" / "strategy-a.ics"
API = "http://hq.cnindex.com.cn/market/market/getIndexDailyDataWithDataFormat"


def now() -> dt.datetime:
    return dt.datetime.now(TZ)


def fetch(code: str) -> dict[str, float]:
    params = urllib.parse.urlencode({"indexCode": code, "startDate": (now().date() - dt.timedelta(days=180)).isoformat(), "endDate": now().date().isoformat(), "frequency": "day"})
    with urllib.request.urlopen(f"{API}?{params}", timeout=20) as response:
        payload = json.loads(response.read().decode("utf-8"))
    data = payload.get("data") or {}
    expected = {"480080": ("成长100R", "CNIG100 TRI"), "480081": ("价值100R", "CNIV100 TRI")}[code]
    if data.get("indexCode") != code or (data.get("indexName"), data.get("indexEName")) != expected:
        raise ValueError(f"指数口径校验失败: {code}")
    close_idx = data.get("item", []).index("close")
    rows = {row[0]: float(row[close_idx]) for row in data.get("data", []) if row[close_idx] is not None}
    if len(rows) < 21:
        raise ValueError(f"{code} 有效收盘数据不足 21 个交易日")
    return rows


def load_state() -> dict:
    return json.loads(STATE_PATH.read_text(encoding="utf-8")) if STATE_PATH.exists() else {"current_position": None, "trade_count": 0}


def rebuild_position(growth: dict[str, float], value: dict[str, float]) -> str | None:
    common = sorted(set(growth) & set(value))
    if len(common) < 21:
        return None
    position = "VALUE"
    for i in range(20, len(common)):
        d_pp = ((growth[common[i]] / growth[common[i - 20]] - 1) - (value[common[i]] / value[common[i - 20]] - 1)) * 100
        if position == "VALUE" and d_pp > 1:
            position = "GROWTH"
        elif position == "GROWTH" and d_pp < -1:
            position = "VALUE"
    return position


def next_trading_day(date: dt.date, common: list[str]) -> str:
    future = [d for d in common if dt.date.fromisoformat(d) > date]
    return future[0] if future else "待下一交易日确认"


def esc(text: str) -> str:
    return text.replace("\\", "\\\\").replace("\n", "\\n").replace(",", "\\,").replace(";", "\\;")


def main() -> None:
    data_date = now().date()
    growth, value = fetch("480080"), fetch("480081")
    common = sorted(set(growth) & set(value))
    if len(common) < 21:
        raise ValueError("两个指数共同有效交易日不足 21 个")
    t, old = common[-1], common[-21]
    rg = growth[t] / growth[old] - 1
    rv = value[t] / value[old] - 1
    d_pp = (rg - rv) * 100
    state = load_state()
    position = state.get("current_position") or rebuild_position(growth, value)
    if position not in {"VALUE", "GROWTH"}:
        raise ValueError("当前有效持仓无法可靠重建")
    target = position
    if position == "VALUE" and d_pp > 1:
        target = "GROWTH"
    elif position == "GROWTH" and d_pp < -1:
        target = "VALUE"
    switched = target != position
    result = "从价值切换到成长" if switched and target == "GROWTH" else "从成长切换到价值" if switched else "保持当前价值" if position == "VALUE" else "保持当前成长"
    title = f"策略 A｜{result}"
    transition = f"因此在下一交易日从“{'价值' if position == 'VALUE' else '成长'}”切换至“{'成长' if target == 'GROWTH' else '价值'}”。" if switched else "因此保持原持仓，0次交易，0换仓成本。"
    body = f"结果：{result}\n\n数据口径：480080 / 480081\n成长100R：{growth[t]:.4f}\n价值100R：{value[t]:.4f}\n成长20日累计收益：{rg:.4%}\n价值20日累计收益：{rv:.4%}\n相对收益差：{d_pp:+.4f}pp\n\n理由：成长100R的20日收益减去价值100R的20日收益，得到{d_pp:+.4f}pp。{transition}"
    REPORT_DIR.mkdir(exist_ok=True)
    (REPORT_DIR / f"{t}.txt").write_text(f"标题：{title}\n\n{body}\n", encoding="utf-8")
    STATE_PATH.parent.mkdir(exist_ok=True)
    STATE_PATH.write_text(json.dumps({"current_position": target, "last_signal_date": t, "last_result": result, "trade_count": state.get("trade_count", 0) + int(switched)}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    event_date = dt.date.fromisoformat(next_trading_day(dt.date.fromisoformat(t), common)) if switched and next_trading_day(dt.date.fromisoformat(t), common)[0].isdigit() else dt.date.fromisoformat(t)
    start = dt.datetime.combine(event_date, dt.time(14, 30), TZ)
    end = start + dt.timedelta(minutes=5)
    ICS_PATH.parent.mkdir(exist_ok=True)
    ICS_PATH.write_text(f"BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//AWENIAI//Strategy A//CN\nBEGIN:VEVENT\nUID:strategy-a-{t}@financial-calendar\nDTSTAMP:{now().strftime('%Y%m%dT%H%M%S')}\nDTSTART;TZID=Asia/Shanghai:{start.strftime('%Y%m%dT%H%M%S')}\nDTEND;TZID=Asia/Shanghai:{end.strftime('%Y%m%dT%H%M%S')}\nSUMMARY:{esc(title)}\nDESCRIPTION:{esc(body)}\nEND:VEVENT\nEND:VCALENDAR\n", encoding="utf-8")
    print(body)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        result = "数据错误无结果"
        title = f"策略 A｜{result}"
        body = f"结果：{result}\n\n数据口径：480080 / 480081\n\n理由：{exc}"
        REPORT_DIR.mkdir(exist_ok=True)
        (REPORT_DIR / f"{now().date().isoformat()}.txt").write_text(f"标题：{title}\n\n{body}\n", encoding="utf-8")
        print(body)
