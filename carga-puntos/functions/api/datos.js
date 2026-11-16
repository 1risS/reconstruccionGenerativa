// Pages Function /api/datos: lee y guarda lo que carga la artista (lugares, fotos y momentos del audio).
//
// Todo se guarda como un único documento JSON en el KV "CARGA", con un número de versión:
//   { version, guardado, datos: { lugares: [...], marcas: [...] } }
// GET devuelve el documento. PUT recibe { version, datos } y sólo guarda si "version" es la que hay
// guardada (si otra pestaña o persona guardó antes, responde 409 con lo que hay, para no pisarlo).
// Una vez por hora se guarda además una copia de lo anterior en "copia:AAAA-MM-DDTHH" (dura 90 días).
//
// Acceso: el encabezado X-Clave tiene que coincidir con la variable secreta CLAVE del proyecto.
// El plan gratuito de KV admite 1000 escrituras por día; el cliente agrupa los cambios para no gastarlas.

const CLAVE_DATOS = 'datos';
const DIAS_COPIA = 90;

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

// Compara sin cortar en el primer carácter distinto (no da pistas por el tiempo de respuesta).
function igual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

function revisar(env, request) {
  if (!env.CARGA) return json({ error: 'Falta configurar el KV CARGA (ver wrangler.toml).' }, 500);
  if (!env.CLAVE) return json({ error: 'Falta configurar la variable CLAVE del proyecto.' }, 500);
  if (!igual(request.headers.get('X-Clave') || '', env.CLAVE)) return json({ error: 'Clave incorrecta.' }, 401);
  return null;
}

export async function onRequestGet({ request, env }) {
  const error = revisar(env, request);
  if (error) return error;
  const guardado = await env.CARGA.get(CLAVE_DATOS, 'json');
  return json(guardado || { version: 0, guardado: null, datos: null });
}

export async function onRequestPut({ request, env }) {
  const error = revisar(env, request);
  if (error) return error;

  const cuerpo = await request.json().catch(() => null);
  const datos = cuerpo && cuerpo.datos;
  if (!cuerpo || !Number.isInteger(cuerpo.version) || !datos ||
      !Array.isArray(datos.lugares) || !Array.isArray(datos.marcas)) {
    return json({ error: 'Formato inválido: se espera { version, datos: { lugares: [], marcas: [] } }.' }, 400);
  }

  const actual = await env.CARGA.get(CLAVE_DATOS, 'json');
  const vActual = actual ? actual.version : 0;
  if (cuerpo.version !== vActual) {
    return json({ error: 'conflicto', version: vActual, guardado: actual && actual.guardado, datos: actual && actual.datos }, 409);
  }

  const nuevo = { version: vActual + 1, guardado: new Date().toISOString(), datos };
  await env.CARGA.put(CLAVE_DATOS, JSON.stringify(nuevo));

  // Copia de seguridad: el primer guardado de cada hora conserva el estado anterior.
  if (actual && actual.guardado && actual.guardado.slice(0, 13) !== nuevo.guardado.slice(0, 13)) {
    await env.CARGA.put('copia:' + actual.guardado.slice(0, 13), JSON.stringify(actual), {
      expirationTtl: DIAS_COPIA * 86400,
    });
  }

  return json({ version: nuevo.version, guardado: nuevo.guardado });
}

export async function onRequest() {
  return json({ error: 'Método no permitido' }, 405);
}
