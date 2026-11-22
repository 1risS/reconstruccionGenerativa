// Pages Function para /deriva-3d/video/*: soporte de peticiones Range (respuesta 206) para la película del modo
// video de la deriva 3D. Es la misma lógica que functions/audio/[[path]].js (Cloudflare Pages sirve los estáticos
// siempre completos y Safari en iPhone no reproduce un video si no lo puede pedir por partes): si se toca una, revisar
// la otra. Lo que no es video (p. ej. el atlas paredes.webp) pasa tal cual.

export async function onRequest({ request, env }) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Método no permitido", { status: 405, headers: { Allow: "GET, HEAD" } });
  }

  // Pide el archivo estático completo (sin Range) al almacenamiento de Pages.
  const asset = await env.ASSETS.fetch(new Request(request.url));
  if (!asset.ok) return asset;
  if (!(asset.headers.get("Content-Type") || "").startsWith("video/")) return asset;

  const datos = await asset.arrayBuffer();
  const total = datos.byteLength;
  const base = {
    "Content-Type": asset.headers.get("Content-Type") || "video/mp4",
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=3600",
  };
  const cuerpo = (b) => (request.method === "HEAD" ? null : b);

  const rango = request.headers.get("Range");
  const m = rango && /^bytes=(\d*)-(\d*)$/.exec(rango.trim());
  if (!m || (m[1] === "" && m[2] === "")) {
    return new Response(cuerpo(datos), { status: 200, headers: { ...base, "Content-Length": String(total) } });
  }

  let ini, fin;
  if (m[1] === "") {
    // sufijo: últimos N bytes
    ini = Math.max(0, total - Number(m[2]));
    fin = total - 1;
  } else {
    ini = Number(m[1]);
    fin = m[2] === "" ? total - 1 : Math.min(Number(m[2]), total - 1);
  }

  if (ini >= total || ini > fin) {
    return new Response(null, { status: 416, headers: { ...base, "Content-Range": `bytes */${total}` } });
  }

  return new Response(cuerpo(datos.slice(ini, fin + 1)), {
    status: 206,
    headers: { ...base, "Content-Range": `bytes ${ini}-${fin}/${total}`, "Content-Length": String(fin - ini + 1) },
  });
}
