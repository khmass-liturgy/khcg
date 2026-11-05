// Only scores explicitly linked from the public KHCG score collection are shared.
Deno.serve(async (req: Request) => {
  const fail = (status: number) => new Response('악보를 열 수 없습니다.', {
    status, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' }
  });
  if (req.method !== 'GET') return fail(405);
  const id = new URL(req.url).searchParams.get('id') || '';
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) return fail(400);
  try {
    const record = await fetch(`https://khmasscg-default-rtdb.firebaseio.com/gyoha-guitar/scores/${id}/scoreLink.json`, { cache: 'no-store' });
    if (!record.ok) return fail(503);
    const link = await record.json();
    if (typeof link !== 'string') return fail(404);
    const source = new URL(link);
    if (source.origin !== 'https://khmass-liturgy.github.io' || source.pathname !== '/c-repo/') return fail(404);
    const path = source.searchParams.get('scorePath') || '';
    if (!/^[0-9a-f-]{36}\/library\/[0-9a-f-]{36}\/score\.(pdf|jpg|png|webp)$/i.test(path)) return fail(404);
    const ext = path.split('.').pop()!.toLowerCase();
    const mime: Record<string, string> = { pdf: 'application/pdf', jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) return fail(503);
    const file = await fetch(`${url}/storage/v1/object/authenticated/scores/${path.split('/').map(encodeURIComponent).join('/')}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: 'no-store'
    });
    if (!file.ok || !file.body) return fail(file.status === 404 ? 404 : 503);
    return new Response(file.body, { headers: {
      'Content-Type': mime[ext], 'Content-Disposition': 'inline', 'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox", 'Cache-Control': 'no-store'
    } });
  } catch (_) { return fail(503); }
});
