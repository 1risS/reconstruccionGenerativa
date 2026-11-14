// Lee site/assets/sitios.js (escrito para el navegador) desde Node.
import { readFileSync } from "node:fs";
import vm from "node:vm";
const code = readFileSync(new URL("../site/assets/sitios.js", import.meta.url), "utf8");
const ctx = { window: {} };
vm.runInNewContext(code, ctx);
export const MUESTRA = ctx.window.MUESTRA;
export const SITIOS = ctx.window.SITIOS;
