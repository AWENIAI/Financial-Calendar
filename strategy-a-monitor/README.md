# A 股尾盘二次判定自动化

这是一个可直接放到 GitHub 上自动执行的最小方案。

目标：在每个交易日北京时间 14:30 自动拉取最新行情，按固定顺序生成尾盘复盘报告，并把结果写入仓库产物和 Markdown 文件。

## 方案结构

- `src/run.py`：主程序，判断交易日、拉行情、计算指标、生成报告。
- `reports/`：每次执行生成的报告。
- `.github/workflows/tailclose.yml`：GitHub Actions 定时任务。

## 运行方式

本地运行：

```bash
cd a-share-tailclose-monitor
python3 -m pip install -r requirements.txt
python3 src/run.py
```

GitHub Actions 会在每天 14:30 北京时间运行。因为 GitHub 的调度时区是 UTC，所以 workflow 里用的是 06:30 UTC。

## 依赖

- Python 3.11+
- `akshare`
- `pandas`

## 输出

程序会生成：

- `reports/YYYY-MM-DD.md`
- 标准输出里的简版摘要

## 可执行边界

这个版本已经能自动执行，但最终效果仍取决于行情源当时是否可用，以及同花顺板块代码能否稳定映射。映射失败时会在报告里明确写 `暂无可靠数据`，不会编造。
