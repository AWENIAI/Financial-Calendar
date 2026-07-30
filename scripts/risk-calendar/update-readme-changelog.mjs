import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const readmePath = path.join(rootDir, 'README.md');
const backupPath = path.join(rootDir, 'README.backup.md');
const calendarPath = path.join(rootDir, 'public/calendar/GLOBAL_KEY.ics');
const isDryRun = process.argv.includes('--dry-run');

function runGit(args) {
  try {
    return execFileSync('git', args, { cwd: rootDir, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function beijingNow() {
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(new Date());

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}`;
}

function statusLabel(status) {
  const labels = {
    A: '新增',
    M: '修改',
    D: '删除',
    R: '重命名',
    C: '复制'
  };
  return labels[status[0]] || status;
}

function changedFiles() {
  const output = runGit(['diff', '--name-status']);
  if (!output) return ['- 未检测到文件级变更。'];

  return output.split('\n').map((line) => {
    const [status, ...fileParts] = line.split('\t');
    return `  - ${statusLabel(status)}：\`${fileParts.join(' → ')}\``;
  });
}

function shortStat() {
  return runGit(['diff', '--shortstat']) || '无文本统计变化。';
}

function parseCalendarEvents() {
  if (!fs.existsSync(calendarPath)) return [];

  const content = fs.readFileSync(calendarPath, 'utf8');
  return content
    .split('BEGIN:VEVENT')
    .slice(1)
    .map((block) => {
      const start = block.match(/DTSTART[^:]*:(\d{8}T\d{6})/)?.[1];
      const summary = block.match(/SUMMARY:(.+)/)?.[1]?.replace(/\\,/g, ',').replace(/\\;/g, ';');
      if (!start || !summary) return null;

      return {
        start,
        date: `${start.slice(0, 4)}-${start.slice(4, 6)}-${start.slice(6, 8)} ${start.slice(9, 11)}:${start.slice(11, 13)}`,
        summary
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.start.localeCompare(b.start));
}

function upcomingEvents(events) {
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(new Date());
  const now = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const nowKey = `${now.year}${now.month}${now.day}T${now.hour}${now.minute}${now.second}`;

  return events
    .filter((event) => event.start >= nowKey)
    .slice(0, 5)
    .map((event) => `  - ${event.date}：${event.summary}`);
}

function buildEntry() {
  const events = parseCalendarEvents();
  const upcoming = upcomingEvents(events);
  const runUrl = process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : '本地运行';

  return [
    `### ${beijingNow()} 自动更新记录`,
    '',
    `- 触发来源：${process.env.GITHUB_EVENT_NAME || 'local'}`,
    `- Action 记录：${runUrl}`,
    `- 订阅文件：\`public/calendar/GLOBAL_KEY.ics\``,
    `- 当前事件数：${events.length}`,
    `- 文件变化统计：${shortStat()}`,
    '- 变化文件：',
    ...changedFiles(),
    '- 最近未来事件：',
    ...(upcoming.length ? upcoming : ['  - 暂无未来事件。']),
    ''
  ].join('\n');
}

function insertEntry(readme, entry) {
  const marker = '## 更新日志';
  const index = readme.indexOf(marker);
  if (index === -1) {
    return `${readme.trimEnd()}\n\n${marker}\n\n${entry}\n`;
  }

  const insertAt = index + marker.length;
  return `${readme.slice(0, insertAt)}\n\n${entry}${readme.slice(insertAt).replace(/^\n+/, '\n')}`;
}

const readme = fs.readFileSync(readmePath, 'utf8');
const entry = buildEntry();

if (isDryRun) {
  console.log(entry);
} else {
  fs.writeFileSync(backupPath, readme, 'utf8');
  fs.writeFileSync(readmePath, insertEntry(readme, entry), 'utf8');
  console.log('README change log updated. Previous README saved to README.backup.md.');
}
