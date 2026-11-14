// Pages Function para /audio/*: agrega soporte de peticiones Range (respuesta 206).
// Cloudflare Pages sirve los archivos estáticos siempre completos (200), y Safari en
// iPhone necesita poder pedir el audio por partes para reproducirlo y adelantarlo.

export async function onRequest({ request, env }) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Método no permitido", { status: 405, headers: { Allow: "GET, HEAD" } });
  }

  // Pide el archivo estático completo (sin Range) al almacenamiento de Pages.
  const asset = await env.ASSETS.fetch(new Request(request.url));
  if (!asset.ok) return asset;
  // Pages devuelve index.html para rutas inexistentes; aquí sólo se sirve audio.
  if (!(asset.headers.get("Content-Type") || "").startsWith("audio/")) {
    return new Response("Audio no encontrado", { status: 404 });
  }

  const datos = await asset.arrayBuffer();
  const total = datos.byteLength;
  const base = {
    "Content-Type": asset.headers.get("Content-Type") || "audio/mp4",
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
