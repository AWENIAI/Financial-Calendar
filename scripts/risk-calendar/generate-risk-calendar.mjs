import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const dataPath = path.join(rootDir, 'data/risk-events.json');
const outputDir = path.join(rootDir, 'public/calendar');

const LEVEL_META = {
  critical: {
    emoji: '🔴',
    label: '极高',
    alarmTriggers: ['-P1D', '-PT30M']
  },
  high: {
    emoji: '🟠',
    label: '高',
    alarmTriggers: ['-PT1H']
  }
};

const CALENDARS = [
  {
    file: 'GLOBAL_KEY.ics',
    name: '阿文风险提醒日历',
    description: 'A股、港股、美股关键交易风险事件合集',
    filter: () => true
  }
]

function readEvents() {
  const raw = fs.readFileSync(dataPath, 'utf8');
  const events = JSON.parse(raw);
  return events
    .filter((event) => LEVEL_META[event.level])
    .sort((a, b) => a.start.localeCompare(b.start) || a.market.localeCompare(b.market));
}

function escapeText(value) {
  return String(value ?? '')
    .replaceAll('\\', '\\\\')
    .replaceAll(';', '\\;')
    .replaceAll(',', '\\,')
    .replaceAll('\r\n', '\\n')
    .replaceAll('\n', '\\n');
}

function formatDateTime(value) {
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) throw new Error(`Invalid datetime: ${value}`);
  return `${match[1]}${match[2]}${match[3]}T${match[4]}${match[5]}00`;
}

function stableUid(event) {
  const seed = [event.market, event.category, event.sourceName, event.title, event.start.slice(0, 10)].join('|');
  const digest = crypto.createHash('sha1').update(seed).digest('hex').slice(0, 10);
  return `risk-${event.market}-${event.start.slice(0, 10)}-${digest}@financial-calendar`;
}

function summary(event) {
  const meta = LEVEL_META[event.level];
  return `${meta.emoji} [${event.market}] ${event.title}`;
}

function buildDescription(event) {
  const meta = LEVEL_META[event.level];
  return [
    `风险等级：${event.levelLabel || meta.label}`,
    `市场：${event.market}`,
    `事件类型：${event.category}`,
    `影响资产：${event.assets.join('、')}`,
    `时间状态：${event.timeStatus}`,
    `来源：${event.sourceName}`,
    `来源链接：${event.sourceUrl}`,
    '',
    `市场反馈：${event.marketExpectation}`,
    `历史反应：${event.historicalReaction}`,
    '',
    `应对策略：${event.actionPlan}`
  ].join('\n');
}

function renderAlarm(event, trigger) {
  return [
    'BEGIN:VALARM',
    `TRIGGER;RELATED=START:${trigger}`,
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(summary(event))}`,
    'END:VALARM'
  ].join('\r\n');
}

function renderEvent(event) {
  const meta = LEVEL_META[event.level];
  return [
    'BEGIN:VEVENT',
    `UID:${stableUid(event)}`,
    `DTSTAMP:${formatDateTime(new Date().toISOString())}Z`,
    `DTSTART;TZID=${event.timezone}:${formatDateTime(event.start)}`,
    `DTEND;TZID=${event.timezone}:${formatDateTime(event.end || event.start)}`,
    `LOCATION:${escapeText(event.location)}`,
    `SUMMARY:${escapeText(summary(event))}`,
    `DESCRIPTION:${escapeText(buildDescription(event))}`,
    'CATEGORIES:交易风险',
    'TRANSP:TRANSPARENT',
    `X-RISK-LEVEL:${event.levelLabel || meta.label}`,
    `X-SOURCE-URL:${escapeText(event.sourceUrl)}`,
    ...meta.alarmTriggers.map((trigger) => renderAlarm(event, trigger)),
    'END:VEVENT'
  ].join('\r\n');
}

function renderCalendar(calendar, events) {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AWEN Financial Calendar//阿文风险提醒日历//ZH-CN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(calendar.name)}`,
    `X-WR-CALDESC:${escapeText(calendar.description)}`,
    'X-WR-TIMEZONE:Asia/Shanghai',
    'BEGIN:VTIMEZONE',
    'TZID:Asia/Shanghai',
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:+0800',
    'TZOFFSETTO:+0800',
    'TZNAME:CST',
    'END:STANDARD',
    'END:VTIMEZONE',
    ...events.map(renderEvent),
    'END:VCALENDAR',
    ''
  ].join('\r\n');
}

function main() {
  const events = readEvents();
  fs.mkdirSync(outputDir, { recursive: true });
  fs.rmSync(path.join(outputDir, 'CN_HIGH.ics'), { force: true });
  fs.rmSync(path.join(outputDir, 'HK_HIGH.ics'), { force: true });
  fs.rmSync(path.join(outputDir, 'US_HIGH.ics'), { force: true });

  for (const calendar of CALENDARS) {
    const selected = events.filter(calendar.filter);
    const output = renderCalendar(calendar, selected);
    const outputPath = path.join(outputDir, calendar.file);
    fs.writeFileSync(outputPath, output, 'utf8');
    console.log(`${calendar.file}: ${selected.length} events`);
  }
}

main();
