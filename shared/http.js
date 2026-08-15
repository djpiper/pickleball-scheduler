// Response helpers shared by every Pages Function.
// Lives outside functions/ so Cloudflare never mistakes it for a route.

export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });

export const fail = (status, message) => json({ error: message }, status);

export const readJson = async (request) => {
  try {
    return await request.json();
  } catch {
    return null;
  }
};
