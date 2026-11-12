import { NextResponse } from "next/server";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/projects";
import { parseMsProjectXml } from "@/lib/msProjectGantt";
import { GanttTask } from "@/lib/types";

export const dynamic = "force-dynamic";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key, X-Requested-With",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

interface RawTaskInput {
  id?: string | number;
  uid?: string | number;
  wbs?: string;
  nombre?: string;
  name?: string;
  capitulo?: string;
  inicio?: string;
  start?: string;
  fin?: string;
  finish?: string;
  duracionDias?: number | string;
  duration?: number | string;
  meta?: number;
  unidad?: string;
  pesoPct?: number;
  pctReal?: number;
  percentComplete?: number;
  rutaCritica?: boolean;
  critical?: boolean;
  esResumen?: boolean;
  summary?: boolean;
  esHito?: boolean;
  milestone?: boolean;
  predecesoras?: string | string[];
  responsable?: string;
  matchItem?: string;
  costo?: number;
}

function cleanIsoDate(val?: string): string {
  if (!val) return new Date().toISOString().slice(0, 10);
  const clean = String(val).trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  // Fallback si viene en formato DD/MM/YYYY
  const parts = clean.split(/[/.-]/);
  if (parts.length === 3 && parts[2].length === 4) {
    const d = parts[0].padStart(2, "0");
    const m = parts[1].padStart(2, "0");
    const y = parts[2];
    return `${y}-${m}-${d}`;
  }
  return new Date().toISOString().slice(0, 10);
}

function normalizeIncomingTasks(rawList: RawTaskInput[]): GanttTask[] {
  if (!Array.isArray(rawList)) return [];

  const preliminary = rawList
    .filter((t) => Boolean(t && (t.nombre || t.name)))
    .map((t, idx) => {
      const id = String(t.id || t.uid || idx + 1);
      const uid = String(t.uid || t.id || id);
      const wbs = String(t.wbs || `${idx + 1}`);
      const nombre = String(t.nombre || t.name || `Tarea ${idx + 1}`).trim();
      const inicio = cleanIsoDate(t.inicio || t.start);
      const fin = cleanIsoDate(t.fin || t.finish);

      let duracionDias = 0;
      if (typeof t.duracionDias === "number") {
        duracionDias = Math.max(0, t.duracionDias);
      } else if (typeof t.duracionDias === "string") {
        duracionDias = parseFloat(t.duracionDias) || 0;
      } else if (typeof t.duration === "number") {
        duracionDias = Math.max(0, t.duration);
      }

      const esHito = Boolean(t.esHito ?? t.milestone ?? duracionDias === 0);
      const esResumen = Boolean(t.esResumen ?? t.summary);
      const rutaCritica = Boolean(t.rutaCritica ?? t.critical);

      let preds: string[] | undefined = undefined;
      if (Array.isArray(t.predecesoras)) {
        preds = t.predecesoras.map((s) => String(s).trim().replace(/^(\d+).*$/, "$1")).filter(Boolean);
      } else if (typeof t.predecesoras === "string" && t.predecesoras.trim().length > 0) {
        preds = t.predecesoras
          .split(/[,;]/)
          .map((s) => s.trim().replace(/^(\d+).*$/, "$1"))
          .filter(Boolean);
      }

      const pctReal =
        typeof t.pctReal === "number"
          ? t.pctReal
          : typeof t.percentComplete === "number"
          ? t.percentComplete
          : undefined;

      const costVal = typeof t.costo === "number" ? Math.max(0, t.costo) : 0;

      return {
        costVal,
        explicitPeso: typeof t.pesoPct === "number" ? t.pesoPct : undefined,
        task: {
          id,
          uid,
          wbs,
          nombre,
          capitulo: t.capitulo || (esResumen ? nombre : "PROGRAMACIÓN 4D"),
          inicio,
          fin: fin < inicio ? inicio : fin,
          duracionDias,
          pesoPct: 0,
          rutaCritica,
          esResumen,
          esHito,
          predecesoras: preds && preds.length > 0 ? preds : undefined,
          responsable: t.responsable || "Dirección de Obra",
          matchItem: t.matchItem || undefined,
          pctManual: pctReal,
        } satisfies GanttTask,
      };
    });

  const hojas = preliminary.filter((x) => !x.task.esResumen && !x.task.esHito);
  const totalCost = hojas.reduce((s, x) => s + x.costVal, 0);
  const totalDur = hojas.reduce((s, x) => s + Math.max(1, x.task.duracionDias), 0) || 1;

  return preliminary.map(({ costVal, explicitPeso, task }) => ({
    ...task,
    pesoPct:
      explicitPeso !== undefined
        ? explicitPeso
        : task.esResumen || task.esHito
        ? 0
        : totalCost > 0
        ? Number(((costVal / totalCost) * 100).toFixed(2))
        : Number(((Math.max(1, task.duracionDias) / totalDur) * 100).toFixed(2)),
  }));
}

/**
 * GET /api/msproject-sync?projectId=casa_mendoza
 * Consulta el último cronograma sincronizado desde MS Project Profesional
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = (searchParams.get("projectId") || "casa_mendoza").toLowerCase().trim();

    const tagBuscar = `[MSPROJECT_SYNC] [${projectId}]`;
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/bitacora_obra?actividad=like.*${encodeURIComponent(tagBuscar)}*&order=id.desc&limit=1`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
        cache: "no-store",
      }
    );

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `Error en Supabase: HTTP ${res.status}` },
        { status: 502, headers: corsHeaders }
      );
    }

    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        {
          ok: true,
          projectId,
          hasSyncedSchedule: false,
          tasks: [],
          message: `No hay cronograma sincronizado vía API aún para ${projectId}.`,
        },
        { headers: corsHeaders }
      );
    }

    const row = rows[0];
    const rawAct = String(row.actividad || "");
    const prefixIdx = rawAct.indexOf("]");
    let jsonPart = "";
    if (prefixIdx > -1) {
      const secondIdx = rawAct.indexOf("]", prefixIdx + 1);
      jsonPart = secondIdx > -1 ? rawAct.slice(secondIdx + 1).trim() : rawAct.slice(prefixIdx + 1).trim();
    } else {
      jsonPart = rawAct.replace("[MSPROJECT_SYNC]", "").trim();
    }

    let parsedTasks: GanttTask[] = [];
    try {
      parsedTasks = JSON.parse(jsonPart);
    } catch {
      parsedTasks = [];
    }

    return NextResponse.json(
      {
        ok: true,
        projectId,
        hasSyncedSchedule: parsedTasks.length > 0,
        syncId: row.id,
        fechaSincronizacion: row.fecha,
        createdAt: row.created_at,
        tasksCount: parsedTasks.length,
        tasks: parsedTasks,
      },
      { headers: corsHeaders }
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * POST /api/msproject-sync
 * Recibe el cronograma exportado por el Macro VBA de Microsoft Project Profesional 2021
 */
export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let bodyText = "";

    try {
      bodyText = await req.text();
    } catch {
      return NextResponse.json(
        { ok: false, error: "No se pudo leer el cuerpo de la petición." },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!bodyText.trim()) {
      return NextResponse.json(
        { ok: false, error: "El cuerpo de la petición está vacío." },
        { status: 400, headers: corsHeaders }
      );
    }

    let projectId = "casa_mendoza";
    let projectName = "Casa Mendoza";
    let incomingTasks: RawTaskInput[] = [];
    let source = "MS_PROJECT_DESKTOP_VBA";

    // Si viene en formato XML nativo de MS Project
    if (bodyText.trim().startsWith("<?xml") || bodyText.trim().startsWith("<Project")) {
      const xmlRes = parseMsProjectXml(bodyText);
      if (xmlRes.error || !xmlRes.tasks || xmlRes.tasks.length === 0) {
        return NextResponse.json(
          { ok: false, error: xmlRes.error || "No se pudieron extraer tareas del XML de MS Project." },
          { status: 400, headers: corsHeaders }
        );
      }
      incomingTasks = xmlRes.tasks;
      source = "MS_PROJECT_XML_DIRECT";
    } else {
      // JSON enviado por el Macro VBA de MS Project 2021
      let parsedJson: {
        projectId?: string;
        projectName?: string;
        source?: string;
        tasks?: RawTaskInput[];
      } = {};

      try {
        parsedJson = JSON.parse(bodyText);
      } catch (jsonErr) {
        return NextResponse.json(
          {
            ok: false,
            error: `JSON inválido desde MS Project: ${jsonErr instanceof Error ? jsonErr.message : String(jsonErr)}`,
          },
          { status: 400, headers: corsHeaders }
        );
      }

      if (parsedJson.projectId) {
        projectId = String(parsedJson.projectId).toLowerCase().trim();
      } else if (parsedJson.projectName) {
        const pName = String(parsedJson.projectName).toLowerCase();
        if (pName.includes("mendoza") || pName.includes("casa")) {
          projectId = "casa_mendoza";
        } else if (pName.includes("mezzanine")) {
          projectId = "mezzanine";
        }
      }

      if (parsedJson.projectName) projectName = String(parsedJson.projectName);
      if (parsedJson.source) source = String(parsedJson.source);
      incomingTasks = Array.isArray(parsedJson.tasks) ? parsedJson.tasks : [];
    }

    if (incomingTasks.length === 0) {
      return NextResponse.json(
        { ok: false, error: "El cronograma no contiene ninguna tarea válida." },
        { status: 400, headers: corsHeaders }
      );
    }

    const normalizedTasks = normalizeIncomingTasks(incomingTasks);

    // Guardar en Supabase bitacora_obra como registro maestro de sincronización MS Project
    const hoyIso = new Date().toISOString().slice(0, 10);
    const payloadActividad = `[MSPROJECT_SYNC] [${projectId}] ${JSON.stringify(normalizedTasks)}`;

    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/bitacora_obra`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        fecha: hoyIso,
        actividad: payloadActividad,
        unidad: "cronograma",
        cantidad: normalizedTasks.length,
        desperdicio: 0,
      }),
    });

    if (!insertRes.ok) {
      const errTxt = await insertRes.text();
      return NextResponse.json(
        { ok: false, error: `Error guardando en Supabase: HTTP ${insertRes.status} - ${errTxt}` },
        { status: 502, headers: corsHeaders }
      );
    }

    const insertedRows = await insertRes.json();
    const syncRowId = Array.isArray(insertedRows) && insertedRows[0] ? insertedRows[0].id : undefined;

    return NextResponse.json(
      {
        ok: true,
        message: "¡Cronograma de MS Project Profesional sincronizado con éxito!",
        projectId,
        projectName,
        source,
        syncRowId,
        tasksCount: normalizedTasks.length,
        timestamp: new Date().toISOString(),
      },
      { status: 201, headers: corsHeaders }
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500, headers: corsHeaders }
    );
  }
}
