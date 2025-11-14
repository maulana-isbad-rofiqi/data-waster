export async function onRequestPost(context) {
  const { env } = context;
  try {
    const list = await env.LOGS.list({ limit: 1000 });
    for (const key of list.keys) {
      await env.LOGS.delete(key.name);
    }
    return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500 });
  }
}
