// server.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// pastikan logs.txt berada di root project (lokasi pasti)
const LOG_FILE = path.resolve(process.cwd(), 'logs.txt');

app.use(bodyParser.json());
// serve semua file statis dari root project
app.use(express.static(path.join(__dirname)));

// POST /api/logs -> append log
app.post('/api/logs', (req, res) => {
  const { type, title, msg, timestamp } = req.body || {};
  const time = timestamp || new Date().toISOString();
  const line = `[${time}] ${String(type || 'INFO').toUpperCase()} ${title || ''} - ${msg || ''}\n`;
  fs.appendFile(LOG_FILE, line, (err) => {
    if (err) {
      console.error('append log failed', err);
      return res.status(500).json({ ok: false, err: String(err) });
    }
    res.json({ ok: true });
  });
});

// GET /api/logs -> return logs, disable caching
app.get('/api/logs', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  fs.readFile(LOG_FILE, 'utf8', (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') return res.type('text/plain').send('');
      console.error('read logs failed', err);
      return res.status(500).send('');
    }
    res.type('text/plain').send(data);
  });
});

// POST /api/clear-logs -> overwrite file with empty content
app.post('/api/clear-logs', (req, res) => {
  fs.writeFile(LOG_FILE, '', (err) => {
    if (err) {
      console.error('clear logs failed', err);
      return res.status(500).json({ ok: false, err: String(err) });
    }
    res.json({ ok: true });
  });
});

app.listen(PORT, () => console.log(`Server berjalan: http://localhost:${PORT}`));
