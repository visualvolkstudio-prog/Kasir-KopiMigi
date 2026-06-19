const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const supabaseHandler = require('../api/supabase');

const PORT = Number(process.env.PORT || 3000);
const ROOT_DIR = path.resolve(__dirname, '..');
let sessions = [];
let printJobs = [];
let digitalFiles = {};

// Helper to serve static files
function serveFile(res, filePath, contentType) {
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`500 Internal Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      res.end(content, 'utf-8');
    }
  });
}

// Map file extensions to MIME types
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // ── API ROUTES ──

  // POST /api/supabase - reuse the Vercel function handler in local server mode
  if (pathname === '/api/supabase') {
    if (req.method === 'OPTIONS') {
      supabaseHandler(req, res);
      return;
    }
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 25 * 1024 * 1024) req.destroy();
    });
    req.on('end', () => {
      try {
        req.body = body ? JSON.parse(body) : {};
      } catch {
        req.body = {};
      }
      supabaseHandler(req, res);
    });
    return;
  }
  
  // GET /api/sessions
  if (pathname === '/api/sessions' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(sessions));
    return;
  }

  // GET /api/print-jobs
  if (pathname === '/api/print-jobs' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(printJobs));
    return;
  }

  // GET /d/:id - customer digital download page
  if (pathname.startsWith('/d/') && req.method === 'GET') {
    const id = pathname.split('/').pop();
    const file = digitalFiles[id];
    if (!file) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>File tidak ditemukan</h1><p>Link digital mungkin sudah tidak tersedia.</p>');
      return;
    }

    const safeCode = String(file.code || 'PHOTOBOOTH').replace(/[<>&"]/g, '');
    const images = (file.images || []).map((src, index) => `
      <figure>
        <img src="${src}" alt="Foto ${index + 1}">
        <a download="kopimigi-${safeCode}-${index + 1}.jpg" href="${src}">Download Foto ${index + 1}</a>
      </figure>
    `).join('');

    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
    });
    res.end(`<!doctype html>
      <html lang="id">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Kopimigi PhotoBooth ${safeCode}</title>
        <style>
          body{margin:0;background:#f6f1e8;color:#151515;font-family:system-ui,-apple-system,sans-serif;}
          main{max-width:760px;margin:0 auto;padding:28px 18px 44px;}
          h1{font-size:24px;margin:0 0 6px;letter-spacing:.04em;text-transform:uppercase;}
          p{margin:0 0 22px;color:#555;}
          .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;}
          figure{margin:0;background:#fff;border:1px solid #ddd;padding:10px;}
          img{display:block;width:100%;height:auto;}
          a{display:block;margin-top:10px;padding:12px 10px;background:#111;color:#fff;text-align:center;text-decoration:none;font-weight:700;}
        </style>
      </head>
      <body>
        <main>
          <h1>KOPIMIGI PHOTOBOOTH</h1>
          <p>Session ${safeCode} - simpan file asli dari sesi ini.</p>
          <div class="grid">${images}</div>
        </main>
      </body>
      </html>`);
    return;
  }

  // POST /api/digital-files
  if (pathname === '/api/digital-files' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 25 * 1024 * 1024) req.destroy();
    });

    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        if (!Array.isArray(payload.images) || payload.images.length === 0) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Missing images' }));
          return;
        }

        const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        digitalFiles[id] = {
          id,
          code: payload.code || '',
          images: payload.images.slice(0, 4),
          createdAt: Date.now()
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, id, path: `/d/${id}` }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Invalid JSON body' }));
      }
    });
    return;
  }

  // POST /api/print-jobs
  if (pathname === '/api/print-jobs' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 25 * 1024 * 1024) req.destroy();
    });

    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        if (!payload.image) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Missing image' }));
          return;
        }

        const job = {
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          code: payload.code || '',
          image: payload.image,
          paperSize: payload.paperSize || '80mm',
          quantity: Math.max(1, Math.min(4, parseInt(payload.quantity || '1', 10) || 1)),
          status: 'pending',
          createdAt: Date.now()
        };
        printJobs.push(job);
        console.log(`[API Server] Print job queued: ${job.id}, Code: ${job.code}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, job }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Invalid JSON body' }));
      }
    });
    return;
  }

  // POST /api/print-action
  if (pathname === '/api/print-action' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const { action, id } = payload;
        const job = printJobs.find(j => j.id === id);

        if (!job) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Job not found' }));
          return;
        }

        if (action === 'printing') {
          job.status = 'printing';
        } else if (action === 'failed') {
          job.status = 'failed';
          job.error = payload.error || '';
        } else if (action === 'done') {
          printJobs = printJobs.filter(j => j.id !== id);
          const sess = sessions.find(s => s.code === job.code);
          if (sess) sess.status = 'used';
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, printJobs, sessions }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Invalid JSON body' }));
      }
    });
    return;
  }

  // POST /api/action
  if (pathname === '/api/action' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const { action, code } = payload;
        let success = false;

        console.log(`[API Server] Action: ${action}, Code: ${code}`);

        if (action === 'create') {
          const existing = sessions.find(s => s.code === code);
          const sessionData = {
            code,
            status: existing?.status || payload.status || 'unused',
            createdAt: payload.createdAt || existing?.createdAt || Date.now(),
            customer: payload.customer || existing?.customer || 'Walk-in',
            package: payload.package || existing?.package || 'classic',
            photoCount: payload.photoCount || existing?.photoCount || 2,
            printQuantity: payload.printQuantity || existing?.printQuantity || 1,
            transactionId: payload.transactionId || existing?.transactionId || 'PENDING'
          };
          if (existing) Object.assign(existing, sessionData);
          else sessions.unshift(sessionData);
          success = true;
        } 
        else if (action === 'claim') {
          const sess = sessions.find(s => s.code === code && s.status === 'unused');
          if (sess) {
            sess.status = 'active';
            success = true;
          }
        } 
        else if (action === 'release') {
          const sess = sessions.find(s => s.code === code && s.status === 'active');
          if (sess) {
            sess.status = 'unused';
            success = true;
          }
        } 
        else if (action === 'finish') {
          const sess = sessions.find(s => s.code === code);
          if (sess) {
            sess.status = 'used';
            success = true;
          }
        } 
        else if (action === 'delete') {
          sessions = sessions.filter(s => s.code !== code);
          success = true;
        } 
        else if (action === 'clear_all') {
          sessions = [];
          success = true;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success, sessions }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON body' }));
      }
    });
    return;
  }

  // ── STATIC FILE SERVING ──
  let targetPath = pathname === '/' ? '/index.html' : pathname;
  if (targetPath === '/photobooth') targetPath = '/photobooth/index.html';
  if (targetPath.endsWith('/')) targetPath = `${targetPath}index.html`;
  const fullPath = path.join(ROOT_DIR, targetPath);
  
  // Safe directory check to prevent path traversal
  if (!fullPath.startsWith(ROOT_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 Forbidden');
    return;
  }

  const ext = path.extname(fullPath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  
  serveFile(res, fullPath, contentType);
});

// Find Local IP Address
const networkInterfaces = os.networkInterfaces();
let localIP = 'localhost';
for (const name of Object.keys(networkInterfaces)) {
  for (const net of networkInterfaces[name]) {
    // Skip internal (loopback) and non-ipv4 addresses
    if (net.family === 'IPv4' && !net.internal) {
      localIP = net.address;
      break;
    }
  }
}

server.listen(PORT, () => {
  console.log('\n=============================================================');
  console.log('⚡ KASIR + PHOTOBOOTH SERVER RUNNING ⚡');
  console.log(`- Kasir lokal:          http://localhost:${PORT}`);
  console.log(`- Photobooth lokal:     http://localhost:${PORT}/photobooth/`);
  console.log('\n💡 UNTUK DIAKSES DARI PERANGKAT LAIN (HP/Tablet/Laptop Kasir):');
  console.log(`- Kasir:                http://${localIP}:${PORT}`);
  console.log(`- Tampilan Booth:       http://${localIP}:${PORT}/photobooth/`);
  console.log('-------------------------------------------------------------');
  console.log('PENTING: Pastikan semua perangkat terhubung ke Wi-Fi yang sama.');
  console.log('=============================================================\n');
});
