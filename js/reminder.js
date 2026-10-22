// js/reminder.js
// Weekly selfie reminders: due-status from the last scan (LOCAL dates) + calendar files (.ics / Google Calendar).
const SITE_URL = 'https://glowcheck-mu.vercel.app';
const REMIND_TIME_KEY = 'glowcheck_remind_time';
const SCAN_EVERY_DAYS = 7;

const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
// Whole calendar days between two local dates (DST-safe via rounding).
const dayDiff = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / 86400000);
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const fmtDue = (d) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }); // "Thu 29 Oct"

// { status: 'upcoming' | 'due' | 'overdue' | 'first', days, next: Date, text, sub }
function dueInfo(product, now = new Date()) {
  const today = startOfDay(now);
  if (!product || !product.scans || !product.scans.length) {
    return { status: 'first', days: 0, next: today, text: 'Take your first selfie today', sub: 'It becomes your baseline for this product.' };
  }
  const last = startOfDay(product.scans[product.scans.length - 1].date);
  const next = new Date(last); next.setDate(next.getDate() + SCAN_EVERY_DAYS);
  const days = dayDiff(today, next);
  const lastAgo = dayDiff(last, today);
  const lastTxt = lastAgo === 0 ? 'today' : lastAgo === 1 ? 'yesterday' : `${plural(lastAgo, 'day')} ago`;
  if (days > 0) return { status: 'upcoming', days, next, text: `Next selfie in ${plural(days, 'day')} (${fmtDue(next)})`, sub: `Last scan ${lastTxt}. Same light, same time of day works best.` };
  if (days === 0) return { status: 'due', days: 0, next, text: 'Your weekly selfie is due today', sub: `Last scan ${lastTxt}. It takes about 30 seconds.` };
  return { status: 'overdue', days: -days, next: today, text: `Your selfie is ${plural(-days, 'day')} overdue`, sub: `Last scan ${lastTxt}. Scan now to keep your trend accurate.` };
}
const isDue = (p) => ['due', 'overdue', 'first'].includes(dueInfo(p).status);

function getRemindTime() { return localStorage.getItem(REMIND_TIME_KEY) || '09:00'; }
function setRemindTime(t) { try { localStorage.setItem(REMIND_TIME_KEY, t); } catch { /* ignore */ } }

// ---------- iCalendar (RFC 5545) ----------
const pad = (n) => String(n).padStart(2, '0');
const icsLocal = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
const icsUtc = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsEsc = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
// Fold lines longer than 75 octets (continuation lines start with a space).
function icsFold(line) {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out = []; let cur = ''; let len = 0;
  for (const ch of line) {
    const l = new TextEncoder().encode(ch).length;
    if (len + l > (out.length ? 74 : 75)) { out.push(cur); cur = ''; len = 0; }
    cur += ch; len += l;
  }
  out.push(cur);
  return out.join('\r\n ');
}

function reminderEvent(productName, next, time) {
  const [h, m] = (time || '09:00').split(':').map(Number);
  const start = new Date(next); start.setHours(h || 0, m || 0, 0, 0);
  if (start < new Date()) start.setDate(start.getDate() + 1); // overdue & time already passed today -> first alert tomorrow
  const end = new Date(start.getTime() + 15 * 60000);
  const title = `GlowCheck selfie – ${productName}`;
  const details = 'Weekly skin check for ' + productName + '.\n' +
    'Tips: face a window or bright light, clean face (no makeup), glasses off, hair off your forehead, same spot and time as last week.\n' +
    'Open GlowCheck: ' + SITE_URL;
  return { start, end, title, details };
}

function buildICS(productName, next, time) {
  const ev = reminderEvent(productName, next, time);
  const uid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}@glowcheck-mu.vercel.app`;
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//GlowCheck//Weekly selfie reminder//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${icsUtc(new Date())}`,
    `DTSTART:${icsLocal(ev.start)}`,   // floating local time: 09:00 wherever the user is
    `DTEND:${icsLocal(ev.end)}`,
    'RRULE:FREQ=WEEKLY',
    `SUMMARY:${icsEsc(ev.title)}`,
    `DESCRIPTION:${icsEsc(ev.details)}`,
    `URL:${SITE_URL}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEsc(ev.title)}`, 'TRIGGER:-PT15M', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR'
  ];
  return lines.map(icsFold).join('\r\n') + '\r\n';
}

function googleCalUrl(productName, next, time) {
  const ev = reminderEvent(productName, next, time);
  const q = new URLSearchParams({
    action: 'TEMPLATE', text: ev.title, dates: `${icsLocal(ev.start)}/${icsLocal(ev.end)}`,
    details: ev.details, recur: 'RRULE:FREQ=WEEKLY'
  });
  try { q.set('ctz', Intl.DateTimeFormat().resolvedOptions().timeZone); } catch { /* optional */ }
  return 'https://calendar.google.com/calendar/render?' + q.toString();
}

// iOS Safari opens text/calendar data URLs straight in the "Add to Calendar" sheet; other browsers get a .ics download.
function openICS(ics, filename) {
  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const dataUrl = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics);
  if (isIOS) { window.location.href = dataUrl; return 'data'; }
  try {
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = filename; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    return 'blob';
  } catch {
    window.location.href = dataUrl; return 'data';
  }
}
