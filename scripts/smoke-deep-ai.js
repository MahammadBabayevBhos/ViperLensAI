/** Dev smoke: premium multipart POST /premium/ai. Run: node scripts/smoke-deep-ai.js */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const http = require('http');
const { initDatabase, User } = require('../src/models');
const app = require('../src/app');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

const TEST_EMAIL = 'smoke-deep-ai@local.test';
const TEST_PASSWORD = 'SmokeTest!1';
const TEST_USER = 'smokedeepai';

function httpRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks).toString('utf8')
        });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  await initDatabase();
  const hash = await bcrypt.hash(TEST_PASSWORD, 10);
  await User.destroy({ where: { email: TEST_EMAIL } });
  await User.create({
    username: TEST_USER,
    email: TEST_EMAIL,
    password_hash: hash,
    tier: 'premium',
    role: 'user'
  });

  const uploadsDir = path.join(__dirname, '..', 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  const dummyExe = path.join(uploadsDir, 'smoke-dummy.exe');
  fs.writeFileSync(dummyExe, Buffer.concat([Buffer.from('MZ\x90\x00'), Buffer.alloc(120, 0)]));

  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  const host = '127.0.0.1';

  const loginBody = new URLSearchParams({ email: TEST_EMAIL, password: TEST_PASSWORD }).toString();
  const loginRes = await httpRequest(
    {
      hostname: host,
      port,
      path: '/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(loginBody)
      }
    },
    loginBody
  );

  if (loginRes.statusCode !== 302) {
    console.error('Login failed', loginRes.statusCode);
    process.exitCode = 1;
    server.close();
    return;
  }
  const cookieHeader = (loginRes.headers['set-cookie'] || []).map((c) => c.split(';')[0]).join('; ');

  const pipelineId = `smoke-${Date.now()}`;
  const resultPayload = JSON.stringify({
    storedAs: 'smoke-dummy.exe',
    fileName: 'smoke-dummy.exe',
    fileSizeKB: '1',
    analysis: { prediction: { label: 'benign', confidence: 0.1 }, verdict: 'benign' },
    historyId: null
  });

  const boundary = '----smokeBoundary' + Date.now();
  const multipart =
    `--${boundary}\r\nContent-Disposition: form-data; name="pipelineId"\r\n\r\n${pipelineId}\r\n` +
    `--${boundary}\r\nContent-Disposition: form-data; name="resultPayload"\r\n\r\n${resultPayload}\r\n` +
    `--${boundary}--\r\n`;

  const premiumRes = await httpRequest(
    {
      hostname: host,
      port,
      path: '/premium/ai',
      method: 'POST',
      headers: {
        Cookie: cookieHeader,
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': Buffer.byteLength(multipart)
      }
    },
    multipart
  );

  console.log('POST /premium/ai HTTP', premiumRes.statusCode);
  try {
    const j = JSON.parse(premiumRes.body);
    console.log('error field:', j.error || '(none)');
  } catch {
    console.log(premiumRes.body.slice(0, 400));
  }

  try {
    fs.unlinkSync(dummyExe);
  } catch (_) {}
  await User.destroy({ where: { email: TEST_EMAIL } });
  server.close();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
