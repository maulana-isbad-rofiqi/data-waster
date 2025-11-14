export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const id = Date.now() + "-" + Math.random().toString(36).slice(2);
    await env.LOGS.put(id, JSON.stringify(body));
    return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500 });
  }
}

export async function onRequestGet(context) {
  const { env } = context;
  try {
    const list = await env.LOGS.list({ limit: 1000 });
    let output = "";
    for (const key of list.keys) {
      const item = await env.LOGS.get(key.name);
      if (!item) continue;
      const log = JSON.parse(item);
      output += `[${log.timestamp}] ${String(log.type||'INFO').toUpperCase()} ${log.title||''} - ${log.msg||''}\n`;
    }
    return new Response(output, { headers: { "Content-Type": "text/plain" } });
  } catch (err) {
    return new Response('', { status: 500 });
  }
}
