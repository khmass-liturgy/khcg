const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const { stripTypeScriptTypes } = require('module');
const source = stripTypeScriptTypes(fs.readFileSync('supabase/functions/shared-score/index.ts', 'utf8'));
const path = '306fd552-b8e9-4225-b89f-234668d9a8b5/library/97f40adf-e71e-48a1-bd3d-c08d75bb524c/score.pdf';
let handler, calls = [], link = 'https://khmass-liturgy.github.io/c-repo/?scorePath=' + encodeURIComponent(path);
const sandbox = { URL, Response, encodeURIComponent, Deno: { serve: fn => handler = fn, env: { get: key => ({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'server-only' })[key] } },
  fetch: async (url, options) => {
    calls.push(String(url));
    if (String(url).startsWith('https://khmasscg-default-rtdb.firebaseio.com/')) return Response.json(link);
    assert.strictEqual(options.headers.Authorization, 'Bearer server-only');
    return new Response('%PDF-1.4', { headers: { 'Content-Type': 'application/pdf' } });
  }
};
vm.runInNewContext(source, sandbox);
(async () => {
  let result = await handler({ method: 'GET', url: 'https://example.test/?id=score123' });
  assert.strictEqual(result.status, 200);
  assert.strictEqual(result.headers.get('content-type'), 'application/pdf');
  assert.strictEqual(await result.text(), '%PDF-1.4');
  assert(calls[0].endsWith('/scores/score123/scoreLink.json'));
  assert(calls[1].endsWith('/' + path));
  calls = [];
  result = await handler({ method: 'GET', url: 'https://example.test/?id=..%2Fprivate' });
  assert.strictEqual(result.status, 400);
  assert.strictEqual(calls.length, 0);
  link = 'https://evil.example/?scorePath=' + encodeURIComponent(path);
  result = await handler({ method: 'GET', url: 'https://example.test/?id=score123' });
  assert.strictEqual(result.status, 404);
  assert.strictEqual(calls.length, 1);
  link = 'https://khmass-liturgy.github.io/c-repo/?scorePath=' + encodeURIComponent('private/secrets.pdf');
  result = await handler({ method: 'GET', url: 'https://example.test/?id=score123' });
  assert.strictEqual(result.status, 404);
  console.log('KHCG_SHARED_SCORE_TEST_OK');
})().catch(error => { console.error(error); process.exitCode = 1; });
