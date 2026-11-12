import { normalizarTexto } from "./calcClient";
import { ConsolidationResult, GanttTask, ProjectConfig } from "./types";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export function parseIsoDateMs(dateStr: string): number {
  const clean = String(dateStr || "").trim().slice(0, 10);
  const parts = clean.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    return Date.now();
  }
  return Date.UTC(parts[0], parts[1] - 1, parts[2]);
}

export function formatMsToIso(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDaysIso(baseIso: string, deltaDays: number): string {
  return formatMsToIso(parseIsoDateMs(baseIso) + deltaDays * MS_PER_DAY);
}

/**
 * Cronograma MS Project Base para Mezzanine 3 Niveles (alineado con TabCronograma de Bitácora).
 * Incluye filas resumen de fase, predecesoras, ruta crítica y entrega final.
 */
export const MEZZANINE_GANTT_BASE: GanttTask[] = [
  {
    id: "FASE-1",
    uid: "FASE-1",
    wbs: "1",
    nombre: "🏗️ FASE 1 — PRELIMINARES Y REPLANTEO",
    capitulo: "1. PRELIMINARES",
    inicio: "2026-10-15",
    fin: "2026-10-26",
    duracionDias: 11,
    pesoPct: 0,
    esResumen: true,
    rutaCritica: true,
  },
  {
    id: "ACT-01",
    uid: "ACT-01",
    wbs: "1.1",
    nombre: "Localización, trazado y replanteo",
    capitulo: "1. PRELIMINARES",
    inicio: "2026-10-15",
    fin: "2026-10-20",
    duracionDias: 5,
    meta: 180.0,
    unidad: "m²",
    pesoPct: 2.0,
    rutaCritica: true,
    responsable: "Topografía / Residente",
    matchItem: "1.1",
  },
  {
    id: "ACT-02",
    uid: "ACT-02",
    wbs: "1.2",
    nombre: "Demolición y retiro de material (plantillas, muros)",
    capitulo: "1. PRELIMINARES",
    inicio: "2026-10-18",
    fin: "2026-10-26",
    duracionDias: 8,
    meta: 48.68,
    unidad: "m³",
    pesoPct: 3.5,
    rutaCritica: true,
    predecesoras: ["ACT-01"],
    responsable: "Cuadrilla Demolición",
    matchItem: "1.3",
  },
  {
    id: "FASE-2",
    uid: "FASE-2",
    wbs: "2",
    nombre: "🏗️ FASE 2 — CIMENTACIÓN Y ESTRUCTURA CONCRETO/ACERO",
    capitulo: "2. CIMENTACION",
    inicio: "2026-10-25",
    fin: "2026-11-20",
    duracionDias: 26,
    pesoPct: 0,
    esResumen: true,
    rutaCritica: true,
  },
  {
    id: "ACT-03",
    uid: "ACT-03",
    wbs: "2.1",
    nombre: "Construcción de plantilla de concreto / solado",
    capitulo: "2. CIMENTACION",
    inicio: "2026-10-25",
    fin: "2026-11-03",
    duracionDias: 9,
    meta: 25.3,
    unidad: "m²",
    pesoPct: 5.0,
    rutaCritica: true,
    predecesoras: ["ACT-02"],
    responsable: "Oficial Estructuras",
    matchItem: "3.1",
  },
  {
    id: "ACT-04",
    uid: "ACT-04",
    wbs: "2.2",
    nombre: "Concreto en zapatas y cimentación",
    capitulo: "2. CIMENTACION",
    inicio: "2026-10-28",
    fin: "2026-11-08",
    duracionDias: 11,
    meta: 8.82,
    unidad: "m³",
    pesoPct: 8.0,
    rutaCritica: true,
    predecesoras: ["ACT-03"],
    responsable: "Cuadrilla Concretos",
    matchItem: "3.2",
  },
  {
    id: "ACT-05",
    uid: "ACT-05",
    wbs: "2.3",
    nombre: "Concreto en vigas de cimentación y amarre",
    capitulo: "2. CIMENTACION",
    inicio: "2026-11-04",
    fin: "2026-11-15",
    duracionDias: 11,
    meta: 5.13,
    unidad: "m³",
    pesoPct: 7.5,
    rutaCritica: true,
    predecesoras: ["ACT-04"],
    responsable: "Cuadrilla Concretos",
    matchItem: "3.3",
  },
  {
    id: "ACT-06",
    uid: "ACT-06",
    wbs: "2.4",
    nombre: "Concreto en pedestales y estructura metálica",
    capitulo: "2. CIMENTACION",
    inicio: "2026-11-08",
    fin: "2026-11-20",
    duracionDias: 12,
    meta: 3.59,
    unidad: "m³",
    pesoPct: 9.0,
    rutaCritica: true,
    predecesoras: ["ACT-05"],
    responsable: "Cuadrilla Estructuras",
    matchItem: "3.4",
  },
  {
    id: "FASE-3",
    uid: "FASE-3",
    wbs: "3",
    nombre: "🧱 FASE 3 — MAMPOSTERÍA, CUBIERTA E INSTALACIONES",
    capitulo: "3. MAMPOSTERIA",
    inicio: "2026-11-16",
    fin: "2026-12-12",
    duracionDias: 26,
    pesoPct: 0,
    esResumen: true,
    rutaCritica: true,
  },
  {
    id: "ACT-07",
    uid: "ACT-07",
    wbs: "3.1",
    nombre: "Muros en mampostería de bloques de concreto",
    capitulo: "3. MAMPOSTERIA",
    inicio: "2026-11-16",
    fin: "2026-12-05",
    duracionDias: 19,
    meta: 367.5,
    unidad: "m²",
    pesoPct: 14.0,
    rutaCritica: false,
    predecesoras: ["ACT-06"],
    responsable: "Cuadrilla Pegadores",
    matchItem: "6.1",
  },
  {
    id: "ACT-08",
    uid: "ACT-08",
    wbs: "3.2",
    nombre: "Montaje de estructura y cubierta en Eternit",
    capitulo: "3. MAMPOSTERIA",
    inicio: "2026-11-25",
    fin: "2026-12-10",
    duracionDias: 15,
    meta: 13948.0,
    unidad: "kg",
    pesoPct: 10.0,
    rutaCritica: true,
    predecesoras: ["ACT-06"],
    responsable: "Especialista Cubiertas",
    matchItem: "5.1",
  },
  {
    id: "ACT-09",
    uid: "ACT-09",
    wbs: "3.3",
    nombre: "Red de tubería hidrosanitaria PVC y conexiones",
    capitulo: "3. MAMPOSTERIA",
    inicio: "2026-11-28",
    fin: "2026-12-12",
    duracionDias: 14,
    meta: 185.0,
    unidad: "kg",
    pesoPct: 6.0,
    rutaCritica: false,
    predecesoras: ["ACT-07"],
    responsable: "Técnico Hidrosanitario",
    matchItem: "5.2",
  },
  {
    id: "FASE-4",
    uid: "FASE-4",
    wbs: "4",
    nombre: "🎨 FASE 4 — ACABADOS, PINTURA Y ENTREGA",
    capitulo: "4. ACABADOS",
    inicio: "2026-12-04",
    fin: "2027-01-14",
    duracionDias: 41,
    pesoPct: 0,
    esResumen: true,
    rutaCritica: false,
  },
  {
    id: "ACT-10",
    uid: "ACT-10",
    wbs: "4.1",
    nombre: "Pañete y mortero de revoco en muros",
    capitulo: "4. ACABADOS",
    inicio: "2026-12-04",
    fin: "2026-12-22",
    duracionDias: 18,
    meta: 735.0,
    unidad: "m²",
    pesoPct: 11.0,
    rutaCritica: false,
    predecesoras: ["ACT-07"],
    responsable: "Cuadrilla Pañetadores",
    matchItem: "6.4",
  },
  {
    id: "ACT-11",
    uid: "ACT-11",
    wbs: "4.2",
    nombre: "Instalación de losa Metaldeck y cielo raso",
    capitulo: "4. ACABADOS",
    inicio: "2026-12-12",
    fin: "2026-12-28",
    duracionDias: 16,
    meta: 150.0,
    unidad: "m²",
    pesoPct: 7.0,
    rutaCritica: false,
    predecesoras: ["ACT-08"],
    responsable: "Cuadrilla Drywall",
    matchItem: "3.6",
  },
  {
    id: "ACT-12",
    uid: "ACT-12",
    wbs: "4.3",
    nombre: "Placa piso concreto e=12cm y enchape",
    capitulo: "4. ACABADOS",
    inicio: "2026-12-18",
    fin: "2027-01-05",
    duracionDias: 18,
    meta: 52.0,
    unidad: "m²",
    pesoPct: 8.0,
    rutaCritica: false,
    predecesoras: ["ACT-09"],
    responsable: "Enchapadores",
    matchItem: "3.5",
  },
  {
    id: "ACT-13",
    uid: "ACT-13",
    wbs: "4.4",
    nombre: "Estuco, pintura y viga cinta remate",
    capitulo: "4. ACABADOS",
    inicio: "2026-12-26",
    fin: "2027-01-10",
    duracionDias: 15,
    meta: 35.0,
    unidad: "ml",
    pesoPct: 6.0,
    rutaCritica: false,
    predecesoras: ["ACT-10"],
    responsable: "Pintores",
    matchItem: "6.2",
  },
  {
    id: "ACT-17",
    uid: "ACT-17",
    wbs: "4.5",
    nombre: "Limpieza final y entrega técnica de obra",
    capitulo: "4. ACABADOS",
    inicio: "2027-01-08",
    fin: "2027-01-14",
    duracionDias: 6,
    meta: 1.0,
    unidad: "gl",
    pesoPct: 3.0,
    rutaCritica: true,
    predecesoras: ["ACT-12", "ACT-13"],
    responsable: "Ing. Residente",
    matchItem: "7.1",
  },
  {
    id: "HITO-FIN",
    uid: "HITO-FIN",
    wbs: "4.6",
    nombre: "◆ Hito Final: Entrega Contrato DOLMEN S.A.",
    capitulo: "4. ACABADOS",
    inicio: "2027-01-15",
    fin: "2027-01-15",
    duracionDias: 0,
    pesoPct: 0,
    esHito: true,
    rutaCritica: true,
    predecesoras: ["ACT-17"],
    responsable: "Interventoría / Cliente",
  },
];

/**
 * Genera una programación 4D de obra realista en MS Project a partir del Presupuesto APU
 * (ideal para Remodelación Casa Mendoza y nuevos proyectos sin archivo .xml cargado aún).
 */
export function buildDefaultGanttFromBudget(proyecto: ProjectConfig): GanttTask[] {
  if (proyecto.id === "mezzanine") {
    return MEZZANINE_GANTT_BASE.map((t) => ({ ...t }));
  }

  const baseDate = proyecto.id === "casa_mendoza" ? "2026-11-02" : "2026-11-11";
  const items = proyecto.ppto_base || [];
  if (items.length === 0) return [];

  const totalCost = items.reduce(
    (s, it) => s + (Number(it.Cantidad_Contratada) || 0) * (Number(it.Precio_Unitario) || 0),
    0
  );

  // Agrupación por capítulo manteniendo un escalonamiento constructivo realista
  const capOrder: string[] = [];
  const byCap = new Map<string, typeof items>();
  for (const it of items) {
    if (!byCap.has(it.Capitulo)) {
      capOrder.push(it.Capitulo);
      byCap.set(it.Capitulo, []);
    }
    byCap.get(it.Capitulo)!.push(it);
  }

  const tasks: GanttTask[] = [];
  let cursorDay = 0;
  let lastTaskId: string | undefined;

  capOrder.forEach((cap, cIdx) => {
    const capItems = byCap.get(cap) || [];
    const capStartOffset = cursorDay;
    let capMaxEndOffset = capStartOffset + 1;
    const capTasks: GanttTask[] = [];

    capItems.forEach((it, iIdx) => {
      const cost = (Number(it.Cantidad_Contratada) || 0) * (Number(it.Precio_Unitario) || 0);
      const weight = totalCost > 0 ? Number(((cost / totalCost) * 100).toFixed(2)) : Number((100 / items.length).toFixed(2));
      const dur = Math.max(4, Math.min(18, Math.round(weight * 0.65) + 4));
      const startOffset = capStartOffset + iIdx * 3;
      const endOffset = startOffset + dur;
      if (endOffset > capMaxEndOffset) capMaxEndOffset = endOffset;

      const tid = `T-${it.Item}`;
      capTasks.push({
        id: tid,
        uid: tid,
        wbs: it.Item,
        nombre: it.Actividad,
        capitulo: cap,
        inicio: addDaysIso(baseDate, startOffset),
        fin: addDaysIso(baseDate, endOffset),
        duracionDias: dur,
        meta: it.Cantidad_Contratada,
        unidad: it.Unidad,
        pesoPct: weight,
        rutaCritica: cIdx <= 2 || weight >= 10,
        predecesoras: lastTaskId ? [lastTaskId] : undefined,
        responsable: proyecto.id === "casa_mendoza" ? "Cuadrilla Remodelación" : "Equipo Obra",
        matchItem: it.Item,
      });
      lastTaskId = tid;
    });

    tasks.push({
      id: `CAP-${cIdx + 1}`,
      uid: `CAP-${cIdx + 1}`,
      wbs: `${cIdx + 1}`,
      nombre: cap,
      capitulo: cap,
      inicio: addDaysIso(baseDate, capStartOffset),
      fin: addDaysIso(baseDate, capMaxEndOffset),
      duracionDias: capMaxEndOffset - capStartOffset,
      pesoPct: 0,
      esResumen: true,
      rutaCritica: capTasks.some((t) => t.rutaCritica),
    });
    tasks.push(...capTasks);
    cursorDay = Math.max(capStartOffset + 5, capMaxEndOffset - 3);
  });

  const maxEnd = tasks.reduce((mx, t) => (t.fin > mx ? t.fin : mx), baseDate);
  tasks.push({
    id: "HITO-ENTREGA",
    uid: "HITO-ENTREGA",
    wbs: `${capOrder.length + 1}`,
    nombre: `◆ Entrega Final — ${proyecto.nombre}`,
    capitulo: "CIERRE",
    inicio: maxEnd,
    fin: maxEnd,
    duracionDias: 0,
    pesoPct: 0,
    esHito: true,
    rutaCritica: true,
    predecesoras: lastTaskId ? [lastTaskId] : undefined,
    responsable: "Ing. Juan González Mendoza",
  });

  return tasks;
}

export function getInitialGanttTasksForProject(proyecto: ProjectConfig): GanttTask[] {
  if (proyecto.gantt_base && proyecto.gantt_base.length > 0) {
    return proyecto.gantt_base;
  }
  return buildDefaultGanttFromBudget(proyecto);
}

/**
 * Parsea formato XML nativo de Microsoft Project (MSPDI: Save As -> XML Format *.xml).
 */
export function parseMsProjectXml(xmlText: string): { tasks: GanttTask[]; error?: string } {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, "text/xml");
    const parseErr = doc.querySelector("parsererror");
    if (parseErr) {
      return { tasks: [], error: "El archivo XML no tiene un formato válido." };
    }

    const taskNodes = Array.from(doc.getElementsByTagName("Task"));
    if (taskNodes.length === 0) {
      return { tasks: [], error: "No se encontraron nodos <Task> de MS Project en el archivo XML." };
    }

    const getTag = (el: Element, tag: string): string => {
      const child = Array.from(el.children).find((c) => c.localName === tag);
      return (child?.textContent || "").trim();
    };

    const parseIsoDurDays = (durStr: string, startIso: string, endIso: string): number => {
      // Ej: PT80H0M0S -> 10 días (8h/día), P5DT0H0M0S -> 5 días
      const dMatch = durStr.match(/P(?:(\d+)D)?(?:T(?:(\d+)H)?)?/i);
      if (dMatch && (dMatch[1] || dMatch[2])) {
        const d = Number(dMatch[1] || 0);
        const h = Number(dMatch[2] || 0);
        return Math.max(0, Math.round(d + h / 8));
      }
      return Math.max(0, Math.round((parseIsoDateMs(endIso) - parseIsoDateMs(startIso)) / MS_PER_DAY));
    };

    const rawTasks: (GanttTask & { costVal: number })[] = [];
    for (const node of taskNodes) {
      const uid = getTag(node, "UID");
      const id = getTag(node, "ID") || uid;
      const isNull = getTag(node, "IsNull") === "1";
      const nombre = getTag(node, "Name");
      if (uid === "0" || isNull || !nombre) continue;

      const startRaw = getTag(node, "Start").slice(0, 10);
      const finishRaw = getTag(node, "Finish").slice(0, 10) || startRaw;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(startRaw)) continue;

      const endIso = /^\d{4}-\d{2}-\d{2}$/.test(finishRaw) ? finishRaw : startRaw;
      const esResumen = getTag(node, "Summary") === "1";
      const esHito = getTag(node, "Milestone") === "1";
      const rutaCritica = getTag(node, "Critical") === "1";
      const duracionDias = esHito ? 0 : parseIsoDurDays(getTag(node, "Duration"), startRaw, endIso);
      const wbs = getTag(node, "WBS") || getTag(node, "OutlineNumber") || id;
      const pctManual = Number(getTag(node, "PercentComplete") || 0) || 0;
      const costVal = Number(getTag(node, "Cost") || 0) || 0;

      const predLinks = Array.from(node.children).filter((c) => c.localName === "PredecessorLink");
      const predecesoras = predLinks
        .map((pl) => getTag(pl, "PredecessorUID"))
        .filter(Boolean);

      rawTasks.push({
        id: uid || id,
        uid: uid || id,
        wbs,
        nombre,
        inicio: startRaw,
        fin: endIso < startRaw ? startRaw : endIso,
        duracionDias,
        pesoPct: 0,
        rutaCritica,
        esResumen,
        esHito: esHito || duracionDias === 0,
        predecesoras: predecesoras.length > 0 ? predecesoras : undefined,
        responsable: getTag(node, "Notes").slice(0, 40) || "MS Project",
        pctManual,
        costVal,
      });
    }

    if (rawTasks.length === 0) {
      return { tasks: [], error: "No se pudieron extraer tareas con fechas válidas del XML." };
    }

    const hojas = rawTasks.filter((t) => !t.esResumen && !t.esHito);
    const sumCost = hojas.reduce((s, t) => s + t.costVal, 0);
    const sumDur = hojas.reduce((s, t) => s + Math.max(1, t.duracionDias), 0) || 1;

    const tasks: GanttTask[] = rawTasks.map(({ costVal, ...t }) => ({
      ...t,
      pesoPct:
        t.esResumen || t.esHito
          ? 0
          : sumCost > 0
          ? Number(((costVal / sumCost) * 100).toFixed(2))
          : Number(((Math.max(1, t.duracionDias) / sumDur) * 100).toFixed(2)),
    }));

    return { tasks };
  } catch (err) {
    return { tasks: [], error: `Error leyendo XML de MS Project: ${String(err)}` };
  }
}

function parseFlexibleDateIso(raw: string): string | null {
  let s = String(raw || "").trim();
  if (!s) return null;
  // Remover día de semana típico en MS Project español ("jue 15/10/26", "vie. 15/10/2026")
  s = s.replace(/^[a-záéíóú]+\.?\s+/i, "").trim();

  const isoMatch = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, "0")}-${isoMatch[3].padStart(2, "0")}`;
  }
  const latMatch = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (latMatch) {
    const dd = latMatch[1].padStart(2, "0");
    const mm = latMatch[2].padStart(2, "0");
    let yy = latMatch[3];
    if (yy.length === 2) yy = `20${yy}`;
    return `${yy}-${mm}-${dd}`;
  }
  return null;
}

export function parseMsProjectTabular(text: string): { tasks: GanttTask[]; error?: string } {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0);

  let headerIdx = -1;
  let sep = ",";
  let cols: string[] = [];

  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const candidateSep = lines[i].includes("\t") ? "\t" : lines[i].includes(";") ? ";" : ",";
    const parsedCols = lines[i].split(candidateSep).map((c) => normalizarTexto(c.replace(/^"|"$/g, "")));
    const hasName = parsedCols.some((c) => ["nombre", "task name", "actividad", "name", "tarea"].some((k) => c.includes(k)));
    const hasStart = parsedCols.some((c) => ["comienzo", "inicio", "start"].some((k) => c.includes(k)));
    if (hasName && hasStart) {
      headerIdx = i;
      sep = candidateSep;
      cols = parsedCols;
      break;
    }
  }

  if (headerIdx === -1) {
    return {
      tasks: [],
      error: "No se detectaron cabeceras de MS Project (Nombre, Comienzo/Inicio, Fin).",
    };
  }

  const idxOf = (keys: string[]) => cols.findIndex((c) => keys.some((k) => c.includes(k)));
  const iName = idxOf(["nombre", "task name", "actividad", "name", "tarea"]);
  const iStart = idxOf(["comienzo", "inicio", "start"]);
  const iEnd = idxOf(["fin", "finish", "termino"]);
  const iWbs = idxOf(["edt", "wbs", "esquema"]);
  const iDur = idxOf(["duracion", "duration"]);
  const iPred = idxOf(["predecesora", "predecessor"]);
  const iCrit = idxOf(["critica", "critical"]);
  const iPct = idxOf(["% completado", "% completo", "percent", "avance"]);
  const iResp = idxOf(["recurso", "resource", "responsable"]);
  const iId = idxOf(["id", "uid"]);

  const rawTasks: GanttTask[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cells = lines[i].split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
    const nombre = (cells[iName] || "").trim();
    const inicio = parseFlexibleDateIso(cells[iStart] || "");
    if (!nombre || !inicio) continue;

    const fin = (iEnd >= 0 ? parseFlexibleDateIso(cells[iEnd] || "") : null) || inicio;
    const durMatch = (iDur >= 0 ? cells[iDur] || "" : "").match(/(\d+)/);
    const dur = durMatch
      ? Number(durMatch[1])
      : Math.max(0, Math.round((parseIsoDateMs(fin) - parseIsoDateMs(inicio)) / MS_PER_DAY));
    const tid = (iId >= 0 ? cells[iId] : "") || String(rawTasks.length + 1);
    const wbs = (iWbs >= 0 ? cells[iWbs] : "") || String(rawTasks.length + 1);
    const preds =
      iPred >= 0 && cells[iPred]
        ? cells[iPred]
            .split(/[,;\s]+/)
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;
    const critNorm = iCrit >= 0 ? normalizarTexto(cells[iCrit] || "") : "";
    const pctManual = iPct >= 0 ? Number((cells[iPct] || "").replace(/[^\d.,]/g, "").replace(",", ".")) || 0 : 0;

    rawTasks.push({
      id: tid,
      uid: tid,
      wbs,
      nombre,
      inicio,
      fin: fin < inicio ? inicio : fin,
      duracionDias: dur,
      pesoPct: Math.max(1, dur),
      rutaCritica: ["si", "yes", "1", "true"].includes(critNorm),
      esHito: dur === 0,
      predecesoras: preds,
      responsable: (iResp >= 0 ? cells[iResp] : "") || "MS Project",
      pctManual,
    });
  }

  if (rawTasks.length === 0) {
    return { tasks: [], error: "No se encontraron filas con fechas válidas en el archivo." };
  }

  const totalW = rawTasks.reduce((s, t) => s + (t.esHito ? 0 : t.pesoPct), 0) || 1;
  return {
    tasks: rawTasks.map((t) => ({
      ...t,
      pesoPct: t.esHito ? 0 : Number(((t.pesoPct / totalW) * 100).toFixed(2)),
    })),
  };
}

export type GanttTaskState =
  | "completada"
  | "en_tiempo"
  | "en_atencion"
  | "retrasada"
  | "por_iniciar"
  | "resumen"
  | "hito";

export interface EnrichedGanttTask extends GanttTask {
  ejecutado: number;
  pctReal: number;
  pctProgramado: number;
  desviacion: number;
  estado: GanttTaskState;
  estadoLabel: string;
}

export function enrichGanttWithExecution(
  tasks: GanttTask[],
  data: ConsolidationResult,
  fechaCorteIso: string
): EnrichedGanttTask[] {
  const tCorte = parseIsoDateMs(fechaCorteIso);
  const byItem = new Map<string, (typeof data.df_5d)[number]>();
  for (const row of data.df_5d || []) {
    byItem.set(String(row.Item), row);
  }

  // Enriquecer primero tareas detalle (no resumen)
  const detailEnriched = tasks.map((task): EnrichedGanttTask => {
    const tIni = parseIsoDateMs(task.inicio);
    const tFin = parseIsoDateMs(task.fin);
    let pctProgramado = 0;
    if (tCorte >= tFin) pctProgramado = 100;
    else if (tCorte > tIni && tFin > tIni) {
      pctProgramado = Math.min(100, Math.max(0, ((tCorte - tIni) / (tFin - tIni)) * 100));
    }

    // Buscar ejecución real vinculada desde df_5d (Supabase Bitácora)
    let matchedRow = task.matchItem ? byItem.get(task.matchItem) : undefined;
    if (!matchedRow && !task.esResumen && !task.esHito) {
      const tNorm = normalizarTexto(task.nombre);
      matchedRow = (data.df_5d || []).find((r) => {
        const aNorm = normalizarTexto(r.Actividad);
        if (aNorm.includes(tNorm) || tNorm.includes(aNorm)) return true;
        if (tNorm.includes("frescasa") && aNorm.includes("frescasa")) return true;
        if (tNorm.includes("cielo") && !tNorm.includes("frescasa") && aNorm.includes("cielo") && !aNorm.includes("frescasa")) return true;
        if (tNorm.includes("panete") || tNorm.includes("revoco")) return aNorm.includes("panete") || aNorm.includes("revoco");
        if (tNorm.includes("estuco") || tNorm.includes("pintura")) return aNorm.includes("estuco") || aNorm.includes("pintura");
        if (tNorm.includes("plantilla")) return aNorm.includes("plantilla");
        if (tNorm.includes("porcelanato") || tNorm.includes("enchape")) return aNorm.includes("porcelanato") || aNorm.includes("enchape");
        if (tNorm.includes("puerta")) return aNorm.includes("puerta");
        if (tNorm.includes("ventana")) return aNorm.includes("ventana");
        if (tNorm.includes("cubierta") || tNorm.includes("eternit")) return aNorm.includes("cubierta") || aNorm.includes("eternit");
        if (tNorm.includes("zapata")) return aNorm.includes("zapata");
        if (tNorm.includes("viga")) return aNorm.includes("viga");
        if (tNorm.includes("pedestal") || tNorm.includes("columna")) return aNorm.includes("pedestal") || aNorm.includes("columna");
        if ((tNorm.includes("mamposteria") || tNorm.includes("bloque") || tNorm.includes("muro")) && !tNorm.includes("panete") && !tNorm.includes("estuco") && !tNorm.includes("pintura")) {
          return (aNorm.includes("mamposteria") || aNorm.includes("bloque") || aNorm.includes("muro")) && !aNorm.includes("panete") && !aNorm.includes("estuco") && !aNorm.includes("pintura");
        }
        return false;
      });
    }

    const ejecutado = matchedRow ? Number(matchedRow.Cantidad_Ejecutada) || 0 : 0;
    const pctReal = matchedRow
      ? Number(matchedRow["Avance_%"]) || 0
      : Number(task.pctManual || 0);
    const desviacion = pctReal - pctProgramado;

    let estado: GanttTaskState = "por_iniciar";
    let estadoLabel = "Por Iniciar";

    if (task.esResumen) {
      estado = "resumen";
      estadoLabel = "Fase Resumen";
    } else if (task.esHito) {
      estado = "hito";
      estadoLabel = pctReal >= 100 ? "Hito Cumplido" : "Hito";
    } else if (pctReal >= 99.5) {
      estado = "completada";
      estadoLabel = "Completada";
    } else if (pctReal > 0 || pctProgramado > 0) {
      if (desviacion >= -5) {
        estado = "en_tiempo";
        estadoLabel = "Al Día";
      } else if (desviacion >= -18) {
        estado = "en_atencion";
        estadoLabel = "Alerta";
      } else {
        estado = "retrasada";
        estadoLabel = "Atrasada";
      }
    }

    return {
      ...task,
      ejecutado,
      pctReal,
      pctProgramado,
      desviacion,
      estado,
      estadoLabel,
    };
  });

  // Recalcular % promedio de cada fila resumen a partir de sus tareas hermanas posteriores
  for (let i = 0; i < detailEnriched.length; i++) {
    const row = detailEnriched[i];
    if (!row.esResumen) continue;
    const children: EnrichedGanttTask[] = [];
    for (let j = i + 1; j < detailEnriched.length; j++) {
      if (detailEnriched[j].esResumen) break;
      if (!detailEnriched[j].esHito) children.push(detailEnriched[j]);
    }
    if (children.length > 0) {
      const wSum = children.reduce((s, c) => s + (c.pesoPct || 1), 0);
      row.pctReal =
        wSum > 0
          ? children.reduce((s, c) => s + Math.min(c.pctReal, 100) * (c.pesoPct || 1), 0) / wSum
          : 0;
      row.pctProgramado =
        wSum > 0 ? children.reduce((s, c) => s + c.pctProgramado * (c.pesoPct || 1), 0) / wSum : 0;
    }
  }

  return detailEnriched;
}

export interface CurvaSPoint {
  semana: string;
  fechaIso: string;
  Programado: number;
  Real: number | null;
}

export function buildGanttCurvaSSeries(
  tasks: EnrichedGanttTask[],
  data: ConsolidationResult,
  fechaCorteIso: string
): {
  points: CurvaSPoint[];
  pvPctAtCorte: number;
  startIso: string;
  endIso: string;
  totalDays: number;
} {
  if (tasks.length === 0) {
    return {
      points: [
        { semana: "Sem 1", fechaIso: fechaCorteIso, Programado: 25, Real: data.totals.avance_fisico_ponderado },
        { semana: "Sem 2", fechaIso: fechaCorteIso, Programado: 60, Real: null },
        { semana: "Sem 3", fechaIso: fechaCorteIso, Programado: 100, Real: null },
      ],
      pvPctAtCorte: 25,
      startIso: fechaCorteIso,
      endIso: fechaCorteIso,
      totalDays: 1,
    };
  }

  const startMs = Math.min(...tasks.map((t) => parseIsoDateMs(t.inicio)));
  const endMs = Math.max(...tasks.map((t) => parseIsoDateMs(t.fin)), startMs + MS_PER_DAY);
  const totalDays = Math.max(1, Math.round((endMs - startMs) / MS_PER_DAY));
  const detailTasks = tasks.filter((t) => !t.esResumen && !t.esHito);
  const totalWeight = detailTasks.reduce((s, t) => s + (t.pesoPct || 1), 0) || 1;

  const evalScheduledAt = (tMs: number): number => {
    let acc = 0;
    for (const t of detailTasks) {
      const ti = parseIsoDateMs(t.inicio);
      const tf = parseIsoDateMs(t.fin);
      const w = t.pesoPct || 1;
      if (tMs >= tf) acc += w;
      else if (tMs > ti && tf > ti) acc += w * ((tMs - ti) / (tf - ti));
    }
    return Number(((acc / totalWeight) * 100).toFixed(1));
  };

  const tCorte = parseIsoDateMs(fechaCorteIso);
  const pvPctAtCorte = evalScheduledAt(tCorte);
  const realTotal = Number((data.totals.avance_fisico_ponderado || 0).toFixed(1));

  // Paso adaptativo entre 6 y 12 puntos semanales para lectura limpia de Curva S
  const totalWeeks = Math.max(4, Math.ceil(totalDays / 7));
  const stepDays = totalWeeks <= 12 ? 7 : Math.ceil(totalDays / 10);

  const points: CurvaSPoint[] = [];
  let wNum = 1;
  for (let cur = startMs; cur < endMs; cur += stepDays * MS_PER_DAY) {
    const sampleMs = Math.min(cur + stepDays * MS_PER_DAY, endMs);
    const iso = formatMsToIso(sampleMs);
    const prog = evalScheduledAt(sampleMs);
    const isPastOrToday = cur <= tCorte;
    const ratioDone = tCorte > startMs ? Math.min(1, Math.max(0, (sampleMs - startMs) / (tCorte - startMs))) : 1;
    const label =
      sampleMs >= tCorte && cur <= tCorte
        ? `Sem ${wNum} (Corte)`
        : `Sem ${wNum}`;

    points.push({
      semana: label,
      fechaIso: iso,
      Programado: prog,
      Real: isPastOrToday ? Number((realTotal * ratioDone).toFixed(1)) : null,
    });
    wNum++;
    if (sampleMs >= endMs) break;
  }

  return {
    points,
    pvPctAtCorte,
    startIso: formatMsToIso(startMs),
    endIso: formatMsToIso(endMs),
    totalDays,
  };
}
