// Сайт + приём заказа: ZIP с фото пересылается в Telegram через бота.
// Запуск: BOT_TOKEN=... CHAT_ID=... node server.js  (Node 18+, без зависимостей)
import http from 'node:http';
import { readFile } from 'node:fs/promises';

const { BOT_TOKEN, CHAT_ID, PORT = 3000 } = process.env;
if (!BOT_TOKEN || !CHAT_ID) { console.error('Задайте BOT_TOKEN и CHAT_ID'); process.exit(1); }
const MAX = 45 * 1024 * 1024; // лимит Telegram для ботов: 50 МБ

http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(await readFile(new URL('./index.html', import.meta.url)));
    }
    if (req.method === 'POST' && req.url.split('?')[0] === '/api/order') {
      const chunks = []; let size = 0;
      for await (const c of req) {
        size += c.length;
        if (size > MAX) { res.writeHead(413); return res.end('too large'); }
        chunks.push(c);
      }
      console.log('Отримано замовлення, байт:', size);
      const q = new URL(req.url, 'http://x').searchParams;
      const dec = k => Buffer.from(q.get(k) || '', 'base64url').toString('utf8');
      const text = dec('m');
      const fname = (dec('n').replace(/[\\/:*?"<>|\r\n]/g, '').trim().slice(0, 60) || 'zamovlennya') + '.zip';
      const fd = new FormData();
      fd.append('chat_id', CHAT_ID);
      fd.append('caption', String(text || 'Нове замовлення').slice(0, 1000));
      fd.append('document', new Blob([Buffer.concat(chunks)], { type: 'application/zip' }), fname);
      const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, { method: 'POST', body: fd });
      if (!r.ok) { console.error('Telegram відхилив запит:', r.status, await r.text()); res.writeHead(502); return res.end('telegram error'); }
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end('{"ok":true}');
    }
    res.writeHead(404); res.end();
  } catch (e) {
    console.error(e); res.writeHead(500); res.end('error');
  }
}).listen(PORT, () => console.log('Слухаю порт ' + PORT));
