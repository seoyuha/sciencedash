// 과학 대시 · 교사 관리 서버
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(express.json({ limit: '3mb' }));

const PUB = path.join(__dirname, 'public');
const DATA = process.env.DATA_FILE || path.join(__dirname, 'data.json');
const PASS = process.env.TEACHER_PASSWORD || require('crypto').randomBytes(24).toString('hex');
const CLASSES = ['1', '2', '3', '4', '5', '6', '7'];
const UNITS = [1, 2, 3];
const emptyProg = () => ({ 1: {}, 2: {}, 3: {} });
const unitOk = u => UNITS.includes(+u);
const NLV = 20; // 단계 수

function defaultBank() {
  const html = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8');
  const m = html.match(/<script type="application\/json" id="qdata">([\s\S]*?)<\/script>/);
  return JSON.parse(m[1]);
}

let db = { classes: {}, students: {}, bank: null, bankVersion: 1 };
try { db = Object.assign(db, JSON.parse(fs.readFileSync(DATA, 'utf8'))); } catch (e) { }
// 선생님이 문제를 고친 적이 없으면 늘 최신 기본 문제를 써요
if (!db.bank || !db.bankEdited) { const nb = defaultBank(); if (JSON.stringify(nb) !== JSON.stringify(db.bank)) { db.bank = nb; db.bankVersion = (db.bankVersion || 1) + 1; } }
function fixClasses() { CLASSES.forEach(c => { db.classes[c] = Object.assign({ phase: 'waiting', phaseAt: 0, unit: 1, unlockAll: false, size: 30, names: [] }, db.classes[c] || {}); delete db.classes[c].open; if (!unitOk(db.classes[c].unit)) db.classes[c].unit = 1; }); }
const ONLINE_MS = 12000, COUNT_MS = 3200;
function phaseOf(c) { if (c.phase === 'countdown' && Date.now() - c.phaseAt >= COUNT_MS) { c.phase = 'playing'; save(); } return c.phase; }
fixClasses();

let saveT = null;
function save() { clearTimeout(saveT); saveT = setTimeout(() => fs.writeFile(DATA, JSON.stringify(db), () => { }), 700); }

const tokens = new Set();
function auth(req, res, next) {
  const t = req.get('x-token') || req.query.token;
  if (t && tokens.has(t)) return next();
  res.status(401).json({ error: 'login' });
}

/* ---------- 학생 ---------- */
app.get('/api/ping', (q, s) => s.json({ ok: true, app: 'science-dash' }));

function cfgFor(cls, v) {
  const c = db.classes[cls] || db.classes['1'], ph = phaseOf(c);
  const o = { phase: ph, open: ph === 'playing', countdownLeft: ph === 'countdown' ? Math.max(0, COUNT_MS - (Date.now() - c.phaseAt)) : 0, unit: c.unit, unlockAll: c.unlockAll, size: c.size, bankVersion: db.bankVersion };
  if (+v !== db.bankVersion) o.bank = db.bank;
  return o;
}
app.get('/api/config', (q, s) => s.json(cfgFor(String(q.query.cls), q.query.v)));

const nameOf = (cls, num) => ((db.classes[cls] || {}).names || [])[num - 1] || '';
app.get('/api/roster', (q, s) => {
  const cls = String(q.query.cls), c = db.classes[cls];
  if (!c) return s.status(404).json({ error: 'nocls' });
  const now = Date.now(), used = Object.values(db.students).filter(st => st.cls === cls && now - (st.last || 0) < ONLINE_MS).map(st => st.num);
  s.json({ size: c.size, names: c.names || [], used, phase: phaseOf(c), unit: c.unit });
});
app.post('/api/join', (q, s) => {
  const b = q.body || {}, cls = String(b.cls), num = parseInt(b.num, 10), device = String(b.device || '');
  const c = db.classes[cls];
  if (!c || !(num >= 1 && num <= c.size) || !device) return s.status(400).json({ error: 'bad' });
  const sid = `${cls}-${num}`;
  let st = db.students[sid];
  if (st && st.device && st.device !== device && Date.now() - (st.last || 0) < ONLINE_MS) return s.status(409).json({ error: 'inuse' });
  if (!st) st = db.students[sid] = { sid, cls, num, prog: emptyProg(), joined: Date.now() };
  st.device = device; st.name = nameOf(cls, num); st.last = Date.now(); st.status = { state: 'map' };
  save();
  s.json({ sid, name: st.name, progress: st.prog });
});

app.post('/api/beat', (q, s) => {
  const b = q.body || {}, st = db.students[b.sid];
  if (!st) return s.status(404).json({ error: 'nostudent' });
  if (b.device && st.device && b.device !== st.device) return s.status(409).json({ error: 'inuse' });
  st.last = Date.now();
  st.status = { state: String(b.state || ''), unit: b.unit, level: b.level, sec: b.sec, deaths: b.deaths };
  s.json(cfgFor(st.cls, b.v));
});

app.post('/api/result', (q, s) => {
  const b = q.body || {}, st = db.students[b.sid];
  if (!st) return s.status(404).json({ error: 'nostudent' });
  const u = unitOk(b.unit) ? +b.unit : 1, lv = parseInt(b.level, 10);
  if (!(lv >= 1 && lv <= NLV)) return s.status(400).json({ error: 'bad' });
  const p = st.prog[u] = st.prog[u] || {};
  const cur = p[lv] || { stars: 0, first: 0, total: 3, retries: null, time: null, plays: 0 };
  const stars = Math.min(3, Math.max(0, b.stars | 0)), first = Math.max(0, b.first | 0), retries = Math.max(0, b.retries | 0), time = Math.max(0, b.time | 0);
  cur.plays++; cur.stars = Math.max(cur.stars, stars); cur.first = Math.max(cur.first, first); cur.total = b.total | 0 || 3;
  cur.retries = cur.retries == null ? retries : Math.min(cur.retries, retries);
  cur.time = cur.time == null ? time : Math.min(cur.time, time);
  cur.lastAt = Date.now(); p[lv] = cur; st.last = Date.now();
  save();
  s.json({ progress: st.prog });
});

/* ---------- 전자칠판 ---------- */
app.get('/api/board', (q, s) => {
  const cls = String(q.query.cls), c = db.classes[cls];
  if (!c) return s.status(404).json({ error: 'nocls' });
  const ph = phaseOf(c), now = Date.now(), list = Object.values(db.students).filter(st => st.cls === cls);
  const done = list.filter(st => Object.keys((st.prog || {})[c.unit] || {}).length >= NLV).length;
  s.json({ phase: ph, countdownLeft: ph === 'countdown' ? Math.max(0, COUNT_MS - (now - c.phaseAt)) : 0, unit: c.unit, size: c.size, done, online: list.filter(st => now - (st.last || 0) < ONLINE_MS).length });
});

/* ---------- 교사 ---------- */
app.post('/api/teacher/login', (q, s) => {
  if (String((q.body || {}).password || '') !== PASS) return s.status(403).json({ error: 'wrong' });
  const t = crypto.randomBytes(16).toString('hex'); tokens.add(t);
  s.json({ token: t, defaultPass: false });
});
app.get('/api/teacher/state', auth, (q, s) => {
  const now = Date.now();
  CLASSES.forEach(c => phaseOf(db.classes[c]));
  const students = Object.values(db.students).map(st => ({ sid: st.sid, cls: st.cls, num: st.num, name: nameOf(st.cls, st.num), online: now - (st.last || 0) < ONLINE_MS, last: st.last || 0, status: st.status || {}, prog: st.prog }));
  const withBank = +q.query.v !== db.bankVersion;
  s.json({ classes: db.classes, students, bankVersion: db.bankVersion, bank: withBank ? db.bank : undefined, now });
});
app.post('/api/teacher/class', auth, (q, s) => {
  const b = q.body || {}, list = b.cls === 'all' ? CLASSES : [String(b.cls)];
  list.forEach(c => {
    if (!db.classes[c]) return;
    if (['start', 'end', 'ready'].includes(b.action)) { db.classes[c].phase = b.action === 'start' ? 'countdown' : b.action === 'end' ? 'ended' : 'waiting'; db.classes[c].phaseAt = Date.now(); }
    if (b.size >= 1 && b.size <= 50) db.classes[c].size = b.size | 0;
    if (Array.isArray(b.names)) db.classes[c].names = b.names.slice(0, 50).map(x => String(x || '').trim().slice(0, 12));
    if (unitOk(b.unit)) db.classes[c].unit = +b.unit;
    if (typeof b.unlockAll === 'boolean') db.classes[c].unlockAll = b.unlockAll;
  });
  save(); s.json({ classes: db.classes });
});
app.post('/api/teacher/bank', auth, (q, s) => {
  const bank = (q.body || {}).bank;
  if (!bank || !UNITS.every(u => Array.isArray(bank[u]))) return s.status(400).json({ error: 'bad' });
  db.bank = bank; db.bankEdited = true; db.bankVersion++; save(); s.json({ bankVersion: db.bankVersion });
});
app.post('/api/teacher/bank/reset', auth, (q, s) => { db.bank = defaultBank(); db.bankEdited = false; db.bankVersion++; save(); s.json({ bankVersion: db.bankVersion, bank: db.bank }); });
app.post('/api/teacher/reset', auth, (q, s) => {
  const b = q.body || {};
  Object.values(db.students).forEach(st => {
    if (b.cls !== 'all' && st.cls !== String(b.cls)) return;
    if (b.removeStudents) { delete db.students[st.sid]; return; }
    if (unitOk(b.unit)) st.prog[+b.unit] = {}; else st.prog = emptyProg();
  });
  save(); s.json({ ok: true });
});
app.get('/api/teacher/backup', auth, (q, s) => {
  s.setHeader('Content-Disposition', 'attachment; filename="science-dash-backup.json"');
  s.json(db);
});
app.post('/api/teacher/restore', auth, (q, s) => {
  const d = (q.body || {}).data;
  if (!d || typeof d.students !== 'object') return s.status(400).json({ error: 'bad' });
  db = { classes: d.classes || {}, students: d.students, bank: d.bank || db.bank, bankVersion: (db.bankVersion || 1) + 1 };
  fixClasses(); save(); s.json({ ok: true });
});
app.get('/api/teacher/csv', auth, (q, s) => {
  const u = unitOk(q.query.unit) ? +q.query.unit : 1;
  const head = ['반', '번호', '이름', '깬 단계', '별', '첫 시도 정답', '문제 수', '정답률(%)', '재도전 합', '최고 기록 합(초)', ...Array.from({ length: NLV }, (_, i) => `L${i + 1} 별`)];
  const rows = Object.values(db.students).sort((a, b) => a.cls - b.cls || a.num - b.num).map(st => {
    const p = st.prog[u] || {}, v = Object.values(p);
    const stars = v.reduce((a, x) => a + x.stars, 0), first = v.reduce((a, x) => a + x.first, 0), total = v.reduce((a, x) => a + x.total, 0);
    return [st.cls + "반", st.num, nameOf(st.cls, st.num), v.length, stars, first, total, total ? Math.round(first / total * 100) : 0, v.reduce((a, x) => a + (x.retries || 0), 0), v.reduce((a, x) => a + (x.time || 0), 0), ...Array.from({ length: NLV }, (_, i) => p[i + 1] ? p[i + 1].stars : '')];
  });
  const csv = '﻿' + [head, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  s.setHeader('Content-Type', 'text/csv; charset=utf-8');
  s.setHeader('Content-Disposition', `attachment; filename="science-dash-${u}.csv"`);
  s.send(csv);
});

app.get('/teacher', (q, s) => s.sendFile(path.join(PUB, 'teacher.html')));
app.get('/board', (q, s) => s.sendFile(path.join(PUB, 'board.html')));
app.use(express.static(PUB));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Science Dash server on ' + PORT));
