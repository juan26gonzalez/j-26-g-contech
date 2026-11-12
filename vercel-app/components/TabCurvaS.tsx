"use client";

import React, { useMemo, useRef, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { callPythonJson } from "../lib/calcClient";
import {
  addDaysIso,
  buildDefaultGanttFromBudget,
  buildGanttCurvaSSeries,
  EnrichedGanttTask,
  enrichGanttWithExecution,
  formatMsToIso,
  parseIsoDateMs,
  parseMsProjectTabular,
  parseMsProjectXml,
} from "../lib/msProjectGantt";
import { formatCOP, formatNum } from "../lib/projects";
import { ConsolidationResult, GanttTask, ProjectConfig } from "../lib/types";

interface TabCurvaSProps {
  proyecto: ProjectConfig;
  data: ConsolidationResult;
  onUpdateProyecto: (updated: ProjectConfig) => void;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const ROW_HEIGHT = 42;
const TIMELINE_HEADER_HEIGHT = 50;

const MESES_CORTO = [
  "ENE",
  "FEB",
  "MAR",
  "ABR",
  "MAY",
  "JUN",
  "JUL",
  "AGO",
  "SEP",
  "OCT",
  "NOV",
  "DIC",
];

function formatShortDateEs(iso: string): string {
  const clean = String(iso || "").slice(0, 10);
  const parts = clean.split("-");
  if (parts.length !== 3) return clean;
  return `${parts[2]}/${parts[1]}/${parts[0].slice(2)}`;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    for (let j = 0; j < slice.length; j++) {
      binary += String.fromCharCode(slice[j]);
    }
  }
  return btoa(binary);
}

function getTodayIso(): string {
  try {
    return new Date().toISOString().slice(0, 10);
  } catch {
    return "2026-11-11";
  }
}

export default function TabCurvaS({
  proyecto,
  data,
  onUpdateProyecto,
}: TabCurvaSProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [fechaCorte, setFechaCorte] = useState<string>(() => getTodayIso());
  const [escala, setEscala] = useState<"week" | "day">("week");
  const [mostrarDependencias, setMostrarDependencias] = useState<boolean>(true);
  const [filtroEstado, setFiltroEstado] = useState<
    "todas" | "criticas" | "atrasadas" | "completadas"
  >("todas");
  const [busqueda, setBusqueda] = useState<string>("");

  const [importing, setImporting] = useState<boolean>(false);
  const [statusBanner, setStatusBanner] = useState<{
    type: "ok" | "error";
    text: string;
  } | null>(null);
  const [showMsProjectHelp, setShowMsProjectHelp] = useState<boolean>(false);
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Formulario rápido de nueva tarea MS Project
  const [newNombre, setNewNombre] = useState<string>("");
  const [newWbs, setNewWbs] = useState<string>("");
  const [newInicio, setNewInicio] = useState<string>(() => getTodayIso());
  const [newFin, setNewFin] = useState<string>(() => addDaysIso(getTodayIso(), 7));
  const [newCritica, setNewCritica] = useState<boolean>(false);
  const [newPred, setNewPred] = useState<string>("");
  const [newMatchItem, setNewMatchItem] = useState<string>("");

  // Cronograma base activo: custom MS Project guardado en proyecto o generado del presupuesto APU
  const rawTasks: GanttTask[] = useMemo(() => {
    if (proyecto.gantt_base && proyecto.gantt_base.length > 0) {
      return proyecto.gantt_base;
    }
    return buildDefaultGanttFromBudget(proyecto);
  }, [proyecto]);

  const isCustomSchedule = Boolean(
    proyecto.gantt_base && proyecto.gantt_base.length > 0
  );

  // Tareas enriquecidas con ejecución real de Supabase Bitácora + % programado a fechaCorte
  const enrichedTasks: EnrichedGanttTask[] = useMemo(
    () => enrichGanttWithExecution(rawTasks, data, fechaCorte),
    [rawTasks, data, fechaCorte]
  );

  // Curva S y métricas EVM sincronizadas dinámicamente con las tareas y la fecha de corte
  const curvaSeries = useMemo(
    () => buildGanttCurvaSSeries(enrichedTasks, data, fechaCorte),
    [enrichedTasks, data, fechaCorte]
  );

  const totalPpto = data.totals.total_ppto_contratado || 0;
  const pvPct = curvaSeries.pvPctAtCorte;
  const pv = totalPpto * (pvPct / 100);
  const evPct = data.totals.avance_fisico_ponderado || 0;
  const ev = data.totals.total_costo_ejecutado || 0;
  const spi = pv > 0 ? ev / pv : 1.0;
  const sobrecosto = data.totals.total_sobrecosto_cop || 0;
  const cpi = ev > 0 ? ev / (ev + sobrecosto) : 1.0;

  // Filtrado de filas visibles en el diagrama de Gantt
  const visibleTasks: EnrichedGanttTask[] = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return enrichedTasks.filter((t) => {
      if (q) {
        const hay = `${t.wbs} ${t.nombre} ${t.capitulo || ""} ${t.responsable || ""}`
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filtroEstado === "criticas") {
        return Boolean(t.rutaCritica) || Boolean(t.esResumen);
      }
      if (filtroEstado === "atrasadas") {
        return (
          t.estado === "retrasada" ||
          t.estado === "en_atencion" ||
          Boolean(t.esResumen)
        );
      }
      if (filtroEstado === "completadas") {
        return t.estado === "completada" || t.pctReal >= 99.5;
      }
      return true;
    });
  }, [enrichedTasks, busqueda, filtroEstado]);

  // Resumen de conteos para badges del cronograma
  const summaryCounts = useMemo(() => {
    const detail = enrichedTasks.filter((t) => !t.esResumen && !t.esHito);
    return {
      total: detail.length,
      criticas: detail.filter((t) => t.rutaCritica).length,
      atrasadas: detail.filter(
        (t) => t.estado === "retrasada" || t.estado === "en_atencion"
      ).length,
      completadas: detail.filter((t) => t.estado === "completada").length,
    };
  }, [enrichedTasks]);

  // Cálculos geométricos del eje temporal del Diagrama de Gantt
  const timelineGeometry = useMemo(() => {
    const minTaskMs =
      enrichedTasks.length > 0
        ? Math.min(...enrichedTasks.map((t) => parseIsoDateMs(t.inicio)))
        : parseIsoDateMs(fechaCorte);
    const maxTaskMs =
      enrichedTasks.length > 0
        ? Math.max(...enrichedTasks.map((t) => parseIsoDateMs(t.fin)))
        : minTaskMs + 30 * MS_PER_DAY;

    const startMs = minTaskMs - 3 * MS_PER_DAY;
    const endMs = Math.max(maxTaskMs + 7 * MS_PER_DAY, startMs + 21 * MS_PER_DAY);
    const totalDays = Math.max(14, Math.ceil((endMs - startMs) / MS_PER_DAY));
    const pxPerDay = escala === "day" ? 28 : 11;
    const widthPx = Math.max(680, totalDays * pxPerDay);

    // Agrupar por meses para banda superior
    const months: { key: string; label: string; leftPx: number; widthPx: number }[] = [];
    for (let d = 0; d < totalDays; d++) {
      const dt = new Date(startMs + d * MS_PER_DAY);
      const key = `${dt.getUTCFullYear()}-${dt.getUTCMonth()}`;
      const label = `${MESES_CORTO[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`;
      const last = months[months.length - 1];
      if (last && last.key === key) {
        last.widthPx += pxPerDay;
      } else {
        months.push({
          key,
          label,
          leftPx: d * pxPerDay,
          widthPx: pxPerDay,
        });
      }
    }

    // Marcas de semanas o días para banda inferior + líneas verticales
    const ticks: {
      leftPx: number;
      widthPx: number;
      label: string;
      isWeekend?: boolean;
    }[] = [];

    if (escala === "day") {
      for (let d = 0; d < totalDays; d++) {
        const dt = new Date(startMs + d * MS_PER_DAY);
        const dow = dt.getUTCDay();
        const isWeekend = dow === 0 || dow === 6;
        ticks.push({
          leftPx: d * pxPerDay,
          widthPx: pxPerDay,
          label: String(dt.getUTCDate()).padStart(2, "0"),
          isWeekend,
        });
      }
    } else {
      const step = 7;
      for (let d = 0, w = 1; d < totalDays; d += step, w++) {
        const iso = formatMsToIso(startMs + d * MS_PER_DAY);
        const span = Math.min(step, totalDays - d);
        ticks.push({
          leftPx: d * pxPerDay,
          widthPx: span * pxPerDay,
          label: `S${w} · ${iso.slice(8, 10)}/${iso.slice(5, 7)}`,
        });
      }
    }

    const corteMs = parseIsoDateMs(fechaCorte);
    const corteX = ((corteMs - startMs) / MS_PER_DAY) * pxPerDay;

    return {
      startMs,
      endMs,
      totalDays,
      pxPerDay,
      widthPx,
      months,
      ticks,
      corteX,
      showCorteLine: corteX >= -4 && corteX <= widthPx + 4,
    };
  }, [enrichedTasks, escala, fechaCorte]);

  // Posiciones (x, y) de cada tarea visible para dibujar barras y predecesoras SVG
  const barPositions = useMemo(() => {
    const posMap = new Map<
      string,
      { idx: number; startX: number; endX: number; barW: number; centerY: number }
    >();
    const items = visibleTasks.map((t, idx) => {
      const tIni = parseIsoDateMs(t.inicio);
      const tFin = Math.max(tIni, parseIsoDateMs(t.fin));
      const startX =
        ((tIni - timelineGeometry.startMs) / MS_PER_DAY) *
        timelineGeometry.pxPerDay;
      const rawDays = Math.max(0, (tFin - tIni) / MS_PER_DAY);
      const barW = t.esHito
        ? 14
        : Math.max(12, (rawDays + 1) * timelineGeometry.pxPerDay);
      const endX = t.esHito ? startX + 7 : startX + barW;
      const centerY = idx * ROW_HEIGHT + ROW_HEIGHT / 2;

      const geom = { idx, startX, endX, barW, centerY };
      posMap.set(t.id, geom);
      if (t.uid && t.uid !== t.id) posMap.set(t.uid, geom);
      return { task: t, ...geom };
    });

    // Conectores Finish-to-Start SVG para predecesoras visibles
    const links: { key: string; pathD: string; critical: boolean }[] = [];
    if (mostrarDependencias) {
      items.forEach((item) => {
        const preds = item.task.predecesoras || [];
        preds.forEach((predId) => {
          const pred = posMap.get(predId);
          if (!pred || pred.idx === item.idx) return;
          const x1 = pred.endX;
          const y1 = pred.centerY;
          const x2 = item.startX - 2;
          const y2 = item.centerY;
          const elbowOut = x1 + 8;
          let pathD = "";
          if (x2 >= elbowOut + 4) {
            pathD = `M ${x1} ${y1} L ${elbowOut} ${y1} L ${elbowOut} ${y2} L ${x2} ${y2}`;
          } else {
            const detourY = y2 > y1 ? y1 + ROW_HEIGHT * 0.44 : y1 - ROW_HEIGHT * 0.44;
            const entryX = x2 - 8;
            pathD = `M ${x1} ${y1} L ${elbowOut} ${y1} L ${elbowOut} ${detourY} L ${entryX} ${detourY} L ${entryX} ${y2} L ${x2} ${y2}`;
          }
          links.push({
            key: `${predId}->${item.task.id}`,
            pathD,
            critical: Boolean(item.task.rutaCritica),
          });
        });
      });
    }

    return { items, links };
  }, [visibleTasks, timelineGeometry, mostrarDependencias]);

  // Parámetros para el slider temporal de simulación 4D
  const sliderBounds = useMemo(() => {
    const sMs = parseIsoDateMs(curvaSeries.startIso);
    const eMs = parseIsoDateMs(curvaSeries.endIso);
    const span = Math.max(1, Math.round((eMs - sMs) / MS_PER_DAY));
    const curMs = parseIsoDateMs(fechaCorte);
    const val = Math.min(span, Math.max(0, Math.round((curMs - sMs) / MS_PER_DAY)));
    return { span, val };
  }, [curvaSeries.startIso, curvaSeries.endIso, fechaCorte]);

  const selectedTask = useMemo(
    () => enrichedTasks.find((t) => t.id === selectedTaskId) || null,
    [enrichedTasks, selectedTaskId]
  );

  // --- Handlers ---
  const saveSchedule = (nextTasks: GanttTask[], bannerMsg?: string) => {
    onUpdateProyecto({
      ...proyecto,
      gantt_base: nextTasks,
    });
    if (bannerMsg) {
      setStatusBanner({ type: "ok", text: bannerMsg });
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setImporting(true);
    setStatusBanner(null);

    try {
      const lower = file.name.toLowerCase();
      let parsedTasks: GanttTask[] = [];
      let errMsg: string | undefined;

      if (lower.endsWith(".xml")) {
        const text = await file.text();
        const res = parseMsProjectXml(text);
        parsedTasks = res.tasks;
        errMsg = res.error;
      } else if (lower.endsWith(".csv") || lower.endsWith(".txt")) {
        const text = await file.text();
        const res = parseMsProjectTabular(text);
        parsedTasks = res.tasks;
        errMsg = res.error;
      } else if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
        const buffer = await file.arrayBuffer();
        const b64 = arrayBufferToBase64(buffer);
        const pyRes = await callPythonJson<{
          ok: boolean;
          tasks?: GanttTask[];
          error?: string;
        }>({
          action: "parse_msproject",
          filename: file.name,
          file_base64: b64,
        });
        if (!pyRes.ok || !pyRes.tasks || pyRes.tasks.length === 0) {
          errMsg = pyRes.error || "No se pudieron extraer tareas válidas del archivo Excel.";
        } else {
          parsedTasks = pyRes.tasks;
        }
      } else {
        errMsg = "Formato no soportado. Exporta desde MS Project en .xml, .xlsx o .csv.";
      }

      if (errMsg || parsedTasks.length === 0) {
        setStatusBanner({
          type: "error",
          text: errMsg || "No se detectaron tareas válidas en el archivo seleccionado.",
        });
      } else {
        saveSchedule(
          parsedTasks,
          `MS Project cargado correctamente: ${parsedTasks.length} tareas importadas desde "${file.name}".`
        );
      }
    } catch (err) {
      setStatusBanner({
        type: "error",
        text: err instanceof Error ? err.message : "Error procesando archivo MS Project.",
      });
    } finally {
      setImporting(false);
    }
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNombre.trim()) return;
    const safeStart = newInicio || getTodayIso();
    const safeEnd = newFin < safeStart ? safeStart : newFin;
    const dur = Math.max(
      0,
      Math.round((parseIsoDateMs(safeEnd) - parseIsoDateMs(safeStart)) / MS_PER_DAY)
    );
    const id = `MSP-${Date.now().toString().slice(-4)}`;
    const newTask: GanttTask = {
      id,
      uid: id,
      wbs: newWbs.trim() || `${rawTasks.length + 1}`,
      nombre: newNombre.trim(),
      capitulo: "PROGRAMACIÓN 4D",
      inicio: safeStart,
      fin: safeEnd,
      duracionDias: dur,
      pesoPct: 4.0,
      rutaCritica: newCritica,
      esHito: dur === 0,
      predecesoras: newPred ? [newPred] : undefined,
      responsable: "Dirección Técnica",
      matchItem: newMatchItem || undefined,
    };
    saveSchedule([...rawTasks, newTask], `Tarea "${newTask.nombre}" añadida al Gantt 4D.`);
    setNewNombre("");
    setNewWbs("");
    setNewPred("");
    setNewMatchItem("");
    setShowAddForm(false);
  };

  const handleUpdateSelectedTask = (patch: Partial<GanttTask>) => {
    if (!selectedTaskId) return;
    const next = rawTasks.map((t) => {
      if (t.id !== selectedTaskId) return t;
      const merged = { ...t, ...patch };
      const iMs = parseIsoDateMs(merged.inicio);
      const fMs = Math.max(iMs, parseIsoDateMs(merged.fin));
      merged.fin = formatMsToIso(fMs);
      merged.duracionDias = merged.esHito
        ? 0
        : Math.max(1, Math.round((fMs - iMs) / MS_PER_DAY));
      return merged;
    });
    saveSchedule(next);
  };

  const handleDeleteTask = (id: string) => {
    const next = rawTasks.filter((t) => t.id !== id);
    setSelectedTaskId(null);
    saveSchedule(next, "Tarea eliminada del diagrama de Gantt.");
  };

  const handleResetDefaultGantt = () => {
    onUpdateProyecto({
      ...proyecto,
      gantt_base: undefined,
    });
    setStatusBanner({
      type: "ok",
      text: "Cronograma 4D restaurado a la línea base derivada del presupuesto del proyecto.",
    });
  };

  const handleExportCsv = () => {
    const headers = [
      "ID",
      "EDT_WBS",
      "Nombre_Tarea",
      "Capitulo",
      "Inicio",
      "Fin",
      "Duracion_Dias",
      "Predecesoras",
      "Ruta_Critica",
      "Peso_%",
      "Programado_Corte_%",
      "Avance_Real_%",
      "Desviacion_%",
      "Estado",
    ];
    const rows = enrichedTasks.map((t) =>
      [
        t.id,
        t.wbs,
        `"${(t.nombre || "").replace(/"/g, '""')}"`,
        `"${(t.capitulo || "").replace(/"/g, '""')}"`,
        t.inicio,
        t.fin,
        t.duracionDias,
        (t.predecesoras || []).join("|"),
        t.rutaCritica ? "SI" : "NO",
        t.pesoPct.toFixed(2),
        t.pctProgramado.toFixed(1),
        t.pctReal.toFixed(1),
        t.desviacion.toFixed(1),
        t.estadoLabel,
      ].join(";")
    );
    const csv = "\uFEFF" + [headers.join(";"), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Gantt_MSProject_${proyecto.id}_${fechaCorte}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Encabezado Principal + Simulador de Fecha de Corte 4D */}
      <div className="bento-card p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-slate-900 text-slate-100">
                MS Project 4D · EVM Control
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                {isCustomSchedule ? "Cronograma MS Project Importado" : "Línea Base APU Auto-4D"}
              </span>
            </div>
            <h3 className="text-lg font-extrabold text-slate-900">
              📈 Curva S, Gestión del Valor Ganado (EVM) & Diagrama de Gantt MS Project
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Cronograma maestro sincronizado en vivo con la ejecución reportada en{" "}
              <span className="font-semibold text-slate-700">Bitácora Cloud</span> para{" "}
              <span className="font-semibold text-slate-700">{proyecto.nombre}</span>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xml,.xlsx,.xls,.csv,.txt"
              onChange={handleImportFile}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="steel-btn-primary px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              <span>📥</span>
              <span>{importing ? "Procesando archivo..." : "Importar MS Project"}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm((v) => !v)}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              {showAddForm ? "✕ Cerrar" : "➕ Nueva Tarea"}
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              📑 Exportar CSV
            </button>
            {isCustomSchedule && (
              <button
                type="button"
                onClick={handleResetDefaultGantt}
                className="px-3 py-2 rounded-xl text-xs font-bold bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100 cursor-pointer"
              >
                ↺ Restaurar Base
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowMsProjectHelp((v) => !v)}
              className="px-2.5 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer"
              title="Cómo exportar desde Microsoft Project"
            >
              ❓ Guía MSP
            </button>
          </div>
        </div>

        {/* Ayuda rápida de exportación desde Microsoft Project */}
        {showMsProjectHelp && (
          <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-4 text-xs text-slate-700 space-y-1.5">
            <p className="font-bold text-slate-900">
              💡 Cómo traer tu programación real desde Microsoft Project en 10 segundos:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Opción 1 (Recomendada — Conserva EDT, Ruta Crítica y Predecesoras exactas):</strong>{" "}
                En MS Project ve a <em>Archivo → Guardar como → Tipo: </em>
                <code className="px-1 py-0.5 rounded bg-white border border-sky-200">Formato XML (*.xml)</code> y súbelo con el botón <strong>Importar MS Project</strong>.
              </li>
              <li>
                <strong>Opción 2 (Excel / CSV):</strong> Exporta o copia tus columnas{" "}
                <code className="px-1 py-0.5 rounded bg-white border border-sky-200">Nombre de tarea</code>,{" "}
                <code className="px-1 py-0.5 rounded bg-white border border-sky-200">Comienzo</code>,{" "}
                <code className="px-1 py-0.5 rounded bg-white border border-sky-200">Fin</code>,{" "}
                <code className="px-1 py-0.5 rounded bg-white border border-sky-200">Predecesoras</code>,{" "}
                <code className="px-1 py-0.5 rounded bg-white border border-sky-200">Crítica</code> en{" "}
                <code>.xlsx</code> o <code>.csv</code>.
              </li>
            </ul>
          </div>
        )}

        {statusBanner && (
          <div
            className={`rounded-xl px-4 py-2.5 text-xs font-semibold border flex items-center justify-between ${
              statusBanner.type === "ok"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-rose-50 border-rose-200 text-rose-800"
            }`}
          >
            <span>{statusBanner.text}</span>
            <button
              type="button"
              onClick={() => setStatusBanner(null)}
              className="ml-3 text-[11px] opacity-70 hover:opacity-100 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Tarjetas EVM 4D */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="steel-subcard rounded-2xl p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Valor Planeado a Corte (PV)
            </p>
            <p className="text-2xl font-extrabold text-slate-900 mt-1 kpi-num">
              {formatCOP(pv)}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {pvPct.toFixed(1)}% programado al {formatShortDateEs(fechaCorte)}
            </p>
          </div>

          <div className="steel-subcard rounded-2xl p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Valor Ganado Real (EV)
            </p>
            <p className="text-2xl font-extrabold text-slate-900 mt-1 kpi-num">
              {formatCOP(ev)}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {evPct.toFixed(1)}% físico ejecutado en obra
            </p>
          </div>

          <div className="steel-subcard rounded-2xl p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Índice Desempeño Plazo (SPI)
            </p>
            <p
              className={`text-2xl font-extrabold mt-1 kpi-num ${
                spi >= 1 ? "text-emerald-600" : spi >= 0.85 ? "text-amber-600" : "text-rose-600"
              }`}
            >
              {spi.toFixed(2)}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {spi >= 1
                ? "Adelantado o en línea 4D"
                : spi >= 0.85
                ? "Leve retraso controlable"
                : "⚠️ Desfase frente a línea base"}
            </p>
          </div>

          <div className="steel-subcard rounded-2xl p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Índice Desempeño Costo (CPI)
            </p>
            <p
              className={`text-2xl font-extrabold mt-1 kpi-num ${
                cpi >= 1 ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              {cpi.toFixed(2)}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {cpi >= 1 ? "Control eficiente de APU" : "Sobrecosto detectado en ítems"}
            </p>
          </div>
        </div>

        {/* Simulador Interactivo de Fecha de Corte 4D */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-3 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold text-slate-800">
              🎞️ Corte / Simulador 4D:
            </span>
            <input
              type="date"
              value={fechaCorte}
              onChange={(e) => {
                if (e.target.value) setFechaCorte(e.target.value);
              }}
              className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-800"
            />
            <button
              type="button"
              onClick={() => setFechaCorte(getTodayIso())}
              className="px-2.5 py-1 rounded-lg bg-slate-900 text-white text-[11px] font-bold hover:bg-slate-800 cursor-pointer"
            >
              Hoy
            </button>
          </div>

          <div className="flex-1 min-w-[200px] flex items-center gap-3">
            <span className="text-[11px] font-mono text-slate-500">
              {formatShortDateEs(curvaSeries.startIso)}
            </span>
            <input
              type="range"
              min={0}
              max={sliderBounds.span}
              value={sliderBounds.val}
              onChange={(e) => {
                const offset = Number(e.target.value) || 0;
                setFechaCorte(addDaysIso(curvaSeries.startIso, offset));
              }}
              className="flex-1 accent-slate-800 cursor-pointer"
            />
            <span className="text-[11px] font-mono text-slate-500">
              {formatShortDateEs(curvaSeries.endIso)}
            </span>
          </div>

          <div className="text-xs text-slate-600 font-semibold">
            Duración total:{" "}
            <span className="text-slate-900 font-bold">{curvaSeries.totalDays} días</span>
          </div>
        </div>
      </div>

      {/* Formulario colapsable para agregar nueva tarea al MS Project 4D */}
      {showAddForm && (
        <form
          onSubmit={handleAddTask}
          className="bento-card p-5 border-2 border-slate-300 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-extrabold text-slate-900">
              ➕ Agregar Actividad al Cronograma MS Project 4D
            </h4>
            <span className="text-[11px] text-slate-500">
              Se guarda automáticamente en el proyecto local
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="lg:col-span-2">
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Nombre de la Tarea *
              </label>
              <input
                type="text"
                required
                placeholder="Ej: Instalación Ventanería Fachada"
                value={newNombre}
                onChange={(e) => setNewNombre(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                EDT / WBS
              </label>
              <input
                type="text"
                placeholder="Ej: 4.7"
                value={newWbs}
                onChange={(e) => setNewWbs(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Comienzo
              </label>
              <input
                type="date"
                value={newInicio}
                onChange={(e) => setNewInicio(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Fin
              </label>
              <input
                type="date"
                value={newFin}
                onChange={(e) => setNewFin(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Predecesora
              </label>
              <select
                value={newPred}
                onChange={(e) => setNewPred(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
              >
                <option value="">Ninguna</option>
                {rawTasks
                  .filter((t) => !t.esResumen)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.wbs} · {t.nombre.slice(0, 28)}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-4">
              <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newCritica}
                  onChange={(e) => setNewCritica(e.target.checked)}
                  className="rounded border-slate-300"
                />
                🔥 Marcar en Ruta Crítica
              </label>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-600">
                  Vincular Ítem APU (Bitácora):
                </span>
                <select
                  value={newMatchItem}
                  onChange={(e) => setNewMatchItem(e.target.value)}
                  className="px-2.5 py-1 rounded-lg border border-slate-300 text-xs bg-white max-w-[260px]"
                >
                  <option value="">Auto-emparejar por nombre</option>
                  {(proyecto.ppto_base || []).map((it) => (
                    <option key={it.Item} value={it.Item}>
                      {it.Item} · {it.Actividad.slice(0, 38)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="steel-btn-primary px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
            >
              Guardar Tarea 4D
            </button>
          </div>
        </form>
      )}

      {/* DIAGRAMA DE GANTT MS PROJECT DUAL-PANE */}
      <div className="bento-card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-base font-extrabold text-slate-900">
              📊 Diagrama de Gantt MS Project — Control de Plazo 4D
            </h4>
            <p className="text-xs text-slate-500">
              Haz clic sobre cualquier actividad o barra para editar fechas, % manual o ruta crítica.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Buscador */}
            <input
              type="text"
              placeholder="🔍 Filtrar EDT o tarea..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs w-44 bg-white"
            />

            {/* Filtros de estado */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-[11px] font-bold">
              {(
                [
                  ["todas", `Todas (${summaryCounts.total})`],
                  ["criticas", `🔥 Crítica (${summaryCounts.criticas})`],
                  ["atrasadas", `⚠️ Atraso (${summaryCounts.atrasadas})`],
                  ["completadas", `✅ Listas (${summaryCounts.completadas})`],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFiltroEstado(key)}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                    filtroEstado === key
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Escala temporal */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setEscala("week")}
                className={`px-2.5 py-1 rounded-lg cursor-pointer ${
                  escala === "week"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500"
                }`}
              >
                Semanas
              </button>
              <button
                type="button"
                onClick={() => setEscala("day")}
                className={`px-2.5 py-1 rounded-lg cursor-pointer ${
                  escala === "day"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500"
                }`}
              >
                Días
              </button>
            </div>

            {/* Toggle predecesoras SVG */}
            <button
              type="button"
              onClick={() => setMostrarDependencias((v) => !v)}
              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border cursor-pointer ${
                mostrarDependencias
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-600 border-slate-300"
              }`}
            >
              🔗 Enlaces FS
            </button>
          </div>
        </div>

        {/* Leyenda visual */}
        <div className="flex flex-wrap items-center gap-4 text-[11px] font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-2.5 rounded-sm bg-slate-800 inline-block" /> Capítulo / Resumen
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-2.5 rounded-sm bg-rose-500 inline-block" /> Ruta Crítica
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-2.5 rounded-sm bg-sky-600 inline-block" /> En Ejecución / Normal
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-2.5 rounded-sm bg-emerald-500 inline-block" /> Completado Real (Bitácora)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 bg-amber-500 rotate-45" /> Hito
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-0.5 h-3.5 bg-rose-600 inline-block" /> Línea Corte 4D ({formatShortDateEs(fechaCorte)})
          </span>
        </div>

        {/* Contenedor Sincronizado Izquierda (WBS) + Derecha (Timeline Horizontal Scrollable) */}
        <div className="border border-slate-300 rounded-2xl overflow-hidden bg-white shadow-inner">
          <div className="overflow-x-auto max-h-[560px] overflow-y-auto relative">
            <div className="flex min-w-max">
              {/* PANEL IZQUIERDO STICKY: Tabla WBS estilo MS Project */}
              <div className="w-[450px] min-w-[450px] sticky left-0 z-20 bg-white border-r-2 border-slate-300 shadow-[4px_0_12px_-4px_rgba(15,23,42,0.12)]">
                {/* Header fijo WBS */}
                <div
                  style={{ height: TIMELINE_HEADER_HEIGHT }}
                  className="bg-slate-900 text-slate-100 text-[10px] font-bold uppercase tracking-wider grid grid-cols-[44px_1fr_64px_64px_42px_52px] items-center px-2 border-b border-slate-700 sticky top-0 z-30"
                >
                  <span>EDT</span>
                  <span>Nombre de Tarea / Capítulo</span>
                  <span className="text-center">Comienzo</span>
                  <span className="text-center">Fin</span>
                  <span className="text-center">Días</span>
                  <span className="text-right pr-1">% Real</span>
                </div>

                {/* Filas WBS */}
                <div>
                  {visibleTasks.length === 0 ? (
                    <div className="p-6 text-xs text-slate-500 text-center">
                      No hay tareas que coincidan con el filtro aplicado.
                    </div>
                  ) : (
                    visibleTasks.map((t) => {
                      const isSelected = t.id === selectedTaskId;
                      return (
                        <div
                          key={t.id}
                          onClick={() => setSelectedTaskId(t.id)}
                          style={{ height: ROW_HEIGHT }}
                          className={`grid grid-cols-[44px_1fr_64px_64px_42px_52px] items-center px-2 border-b border-slate-100 text-[11px] cursor-pointer transition-colors ${
                            t.esResumen
                              ? "bg-slate-100 font-extrabold text-slate-900"
                              : isSelected
                              ? "bg-sky-50 text-slate-900 ring-1 ring-inset ring-sky-300"
                              : "bg-white hover:bg-slate-50 text-slate-700"
                          }`}
                        >
                          <span className="font-mono text-[10px] text-slate-500 truncate">
                            {t.wbs}
                          </span>
                          <div className="flex items-center gap-1.5 min-w-0 pr-2">
                            {t.rutaCritica && !t.esResumen && (
                              <span
                                className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"
                                title="Ruta Crítica"
                              />
                            )}
                            <span
                              className="truncate"
                              title={`${t.wbs} · ${t.nombre}`}
                            >
                              {t.nombre}
                            </span>
                          </div>
                          <span className="text-center font-mono text-[10px] text-slate-500">
                            {formatShortDateEs(t.inicio)}
                          </span>
                          <span className="text-center font-mono text-[10px] text-slate-500">
                            {formatShortDateEs(t.fin)}
                          </span>
                          <span className="text-center font-mono text-[10px] text-slate-600">
                            {t.esHito ? "0d" : `${t.duracionDias}d`}
                          </span>
                          <div className="text-right pr-1">
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold kpi-num ${
                                t.esResumen
                                  ? "bg-slate-200 text-slate-800"
                                  : t.pctReal >= 99.5
                                  ? "bg-emerald-100 text-emerald-800"
                                  : t.estado === "retrasada"
                                  ? "bg-rose-100 text-rose-700"
                                  : t.estado === "en_atencion"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {formatNum(t.pctReal, 0)}%
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* PANEL DERECHO: Timeline Gantt + Barras + Predecesoras SVG */}
              <div
                style={{ width: timelineGeometry.widthPx }}
                className="relative bg-white shrink-0"
              >
                {/* Cabecera Meses + Semanas/Días */}
                <div
                  style={{ height: TIMELINE_HEADER_HEIGHT }}
                  className="sticky top-0 z-10 bg-slate-900 text-slate-100 border-b border-slate-700 select-none"
                >
                  {/* Fila superior: Meses */}
                  <div className="relative h-[22px] border-b border-slate-700/80">
                    {timelineGeometry.months.map((m) => (
                      <div
                        key={m.key}
                        style={{ left: m.leftPx, width: m.widthPx }}
                        className="absolute top-0 bottom-0 border-r border-slate-700/80 flex items-center px-2 text-[10px] font-extrabold tracking-wider text-slate-200 truncate"
                      >
                        {m.label}
                      </div>
                    ))}
                  </div>

                  {/* Fila inferior: Ticks (Semanas o Días) */}
                  <div className="relative h-[28px]">
                    {timelineGeometry.ticks.map((tk, i) => (
                      <div
                        key={i}
                        style={{ left: tk.leftPx, width: tk.widthPx }}
                        className={`absolute top-0 bottom-0 border-r border-slate-700/60 flex items-center justify-center text-[10px] font-mono ${
                          tk.isWeekend ? "bg-slate-800/80 text-slate-400" : "text-slate-300"
                        }`}
                      >
                        {tk.label}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cuerpo del Timeline */}
                <div
                  style={{
                    height: Math.max(ROW_HEIGHT, visibleTasks.length * ROW_HEIGHT),
                  }}
                  className="relative"
                >
                  {/* Líneas verticales de cuadrícula + fines de semana */}
                  {timelineGeometry.ticks.map((tk, i) => (
                    <div
                      key={i}
                      style={{ left: tk.leftPx, width: tk.widthPx }}
                      className={`absolute top-0 bottom-0 border-r border-slate-100 pointer-events-none ${
                        tk.isWeekend ? "bg-slate-100/60" : ""
                      }`}
                    />
                  ))}

                  {/* Bandas horizontales alternas por fila */}
                  {visibleTasks.map((t, idx) => (
                    <div
                      key={`bg-${t.id}`}
                      style={{ top: idx * ROW_HEIGHT, height: ROW_HEIGHT }}
                      className={`absolute left-0 right-0 border-b border-slate-100 pointer-events-none ${
                        t.esResumen
                          ? "bg-slate-100/80"
                          : idx % 2 === 1
                          ? "bg-slate-50/40"
                          : ""
                      }`}
                    />
                  ))}

                  {/* Capa SVG: Conectores Finish-to-Start de Predecesoras */}
                  {mostrarDependencias && barPositions.links.length > 0 && (
                    <svg
                      width={timelineGeometry.widthPx}
                      height={visibleTasks.length * ROW_HEIGHT}
                      className="absolute inset-0 pointer-events-none z-[2]"
                    >
                      <defs>
                        <marker
                          id="gantt-arrow-slate"
                          markerWidth="6"
                          markerHeight="6"
                          refX="5"
                          refY="3"
                          orient="auto"
                        >
                          <path d="M0,0 L6,3 L0,6 Z" fill="#64748b" />
                        </marker>
                        <marker
                          id="gantt-arrow-crit"
                          markerWidth="6"
                          markerHeight="6"
                          refX="5"
                          refY="3"
                          orient="auto"
                        >
                          <path d="M0,0 L6,3 L0,6 Z" fill="#e11d48" />
                        </marker>
                      </defs>
                      {barPositions.links.map((lk) => (
                        <path
                          key={lk.key}
                          d={lk.pathD}
                          fill="none"
                          stroke={lk.critical ? "#f43f5e" : "#94a3b8"}
                          strokeWidth={lk.critical ? 1.4 : 1.1}
                          markerEnd={
                            lk.critical
                              ? "url(#gantt-arrow-crit)"
                              : "url(#gantt-arrow-slate)"
                          }
                        />
                      ))}
                    </svg>
                  )}

                  {/* Barras Gantt de cada tarea */}
                  {barPositions.items.map(({ task, idx, startX, barW }) => {
                    const topRow = idx * ROW_HEIGHT;
                    const pctFill = Math.min(100, Math.max(0, task.pctReal));

                    if (task.esHito) {
                      return (
                        <div
                          key={task.id}
                          onClick={() => setSelectedTaskId(task.id)}
                          style={{ top: topRow + 13, left: startX }}
                          className="absolute flex items-center gap-2 z-[4] cursor-pointer group"
                          title={`${task.nombre} (${task.inicio})`}
                        >
                          <div className="w-4 h-4 bg-amber-500 border-2 border-amber-700 rotate-45 shadow-sm group-hover:scale-110 transition-transform" />
                          <span className="text-[10px] font-extrabold text-amber-800 whitespace-nowrap bg-amber-50/90 px-1.5 py-0.5 rounded border border-amber-200">
                            {formatShortDateEs(task.inicio)} · {task.nombre.replace("◆ ", "")}
                          </span>
                        </div>
                      );
                    }

                    if (task.esResumen) {
                      return (
                        <div
                          key={task.id}
                          onClick={() => setSelectedTaskId(task.id)}
                          style={{ top: topRow + 14, left: startX, width: barW }}
                          className="absolute h-3 bg-slate-800 rounded-t-sm z-[4] cursor-pointer"
                          title={`${task.nombre}: ${pctFill.toFixed(1)}% real`}
                        >
                          {/* Progreso acumulado del capítulo */}
                          <div
                            style={{ width: `${pctFill}%` }}
                            className="h-full bg-emerald-400/90 rounded-tl-sm"
                          />
                          {/* Puntas bracket características de MS Project Summary Bar */}
                          <div className="absolute -bottom-1.5 left-0 w-1.5 h-2 bg-slate-800" />
                          <div className="absolute -bottom-1.5 right-0 w-1.5 h-2 bg-slate-800" />
                        </div>
                      );
                    }

                    const trackClass = task.rutaCritica
                      ? "bg-rose-100 border-rose-400"
                      : "bg-sky-100 border-sky-400";
                    const fillClass =
                      pctFill >= 99.5
                        ? "bg-emerald-500"
                        : task.rutaCritica
                        ? "bg-rose-500"
                        : "bg-sky-600";

                    return (
                      <div
                        key={task.id}
                        onClick={() => setSelectedTaskId(task.id)}
                        style={{ top: topRow + 9, left: startX, width: barW }}
                        className={`absolute h-6 rounded-md border ${trackClass} z-[4] cursor-pointer shadow-sm hover:brightness-95 transition flex items-center overflow-visible`}
                        title={`${task.wbs} · ${task.nombre}\nInicio: ${task.inicio} | Fin: ${task.fin}\nReal: ${pctFill.toFixed(
                          1
                        )}% vs Prog: ${task.pctProgramado.toFixed(1)}% (${task.estadoLabel})`}
                      >
                        <div
                          style={{ width: `${pctFill}%` }}
                          className={`h-full rounded-l-[5px] ${
                            pctFill >= 99.5 ? "rounded-r-[5px]" : ""
                          } ${fillClass} transition-all duration-300`}
                        />

                        {/* Etiqueta de avance / alerta fuera a la derecha de la barra */}
                        <span
                          style={{ left: barW + 6 }}
                          className="absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-[10px] font-bold text-slate-600 pointer-events-none"
                        >
                          {pctFill > 0 ? `${formatNum(pctFill, 0)}%` : ""}
                          {task.estado === "retrasada" ? " ⚠️" : ""}
                        </span>
                      </div>
                    );
                  })}

                  {/* Línea vertical roja de Corte 4D / HOY */}
                  {timelineGeometry.showCorteLine && (
                    <div
                      style={{ left: timelineGeometry.corteX }}
                      className="absolute top-0 bottom-0 w-0.5 bg-rose-600 z-[8] pointer-events-none"
                    >
                      <div className="sticky top-0 -translate-x-1/2 bg-rose-600 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-b shadow">
                        CORTE 4D
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PANEL INSPECTOR / EDITOR RÁPIDO DE TAREA SELECCIONADA */}
      {selectedTask && (
        <div className="bento-card p-5 border-2 border-slate-900/15 bg-slate-50 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-slate-900 text-white text-[10px] font-mono font-bold">
                  EDT {selectedTask.wbs}
                </span>
                <span className="text-xs font-bold text-slate-500">
                  {selectedTask.capitulo || "General"}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    selectedTask.estado === "completada"
                      ? "bg-emerald-100 text-emerald-800"
                      : selectedTask.estado === "retrasada"
                      ? "bg-rose-100 text-rose-700"
                      : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {selectedTask.estadoLabel}
                </span>
              </div>
              <h5 className="text-sm font-extrabold text-slate-900 mt-1">
                {selectedTask.nombre}
              </h5>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleDeleteTask(selectedTask.id)}
                className="px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold hover:bg-rose-100 cursor-pointer"
              >
                🗑️ Eliminar
              </button>
              <button
                type="button"
                onClick={() => setSelectedTaskId(null)}
                className="px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 cursor-pointer"
              >
                Cerrar ✕
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                Fecha Comienzo
              </label>
              <input
                type="date"
                value={selectedTask.inicio}
                onChange={(e) => {
                  if (e.target.value)
                    handleUpdateSelectedTask({ inicio: e.target.value });
                }}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                Fecha Fin
              </label>
              <input
                type="date"
                value={selectedTask.fin}
                onChange={(e) => {
                  if (e.target.value)
                    handleUpdateSelectedTask({ fin: e.target.value });
                }}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                % Manual (si no vincula APU)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={selectedTask.pctManual ?? Math.round(selectedTask.pctReal)}
                onChange={(e) =>
                  handleUpdateSelectedTask({
                    pctManual: Math.min(100, Math.max(0, Number(e.target.value) || 0)),
                  })
                }
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                Programado a Corte / Real
              </label>
              <div className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-mono text-xs text-slate-700">
                Prog: {selectedTask.pctProgramado.toFixed(1)}% · Real:{" "}
                {selectedTask.pctReal.toFixed(1)}%
              </div>
            </div>

            <div className="flex items-end">
              <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-bold text-slate-700 cursor-pointer w-full">
                <input
                  type="checkbox"
                  checked={Boolean(selectedTask.rutaCritica)}
                  onChange={(e) =>
                    handleUpdateSelectedTask({ rutaCritica: e.target.checked })
                  }
                />
                🔥 Ruta Crítica
              </label>
            </div>
          </div>
        </div>
      )}

      {/* GRÁFICO CURVA S (SINCRONIZADO EN VIVO CON GANTT 4D Y BITÁCORA) */}
      <div className="bento-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h4 className="text-sm font-extrabold text-slate-900">
              📉 Trayectoria Curva S: Programado (MS Project) vs. Avance Real (%)
            </h4>
            <p className="text-xs text-slate-500">
              Calculada dinámicamente ponderando las actividades del Gantt activo hasta{" "}
              <span className="font-semibold text-slate-700">
                {formatShortDateEs(fechaCorte)}
              </span>
              .
            </p>
          </div>
          <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-700">
            Corte actual: PV {pvPct.toFixed(1)}% · EV {evPct.toFixed(1)}%
          </span>
        </div>

        <div className="h-[340px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={curvaSeries.points}
              margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="semana"
                tick={{ fontSize: 11, fill: "#475569" }}
              />
              <YAxis
                unit="%"
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: "#475569" }}
              />
              <Tooltip
                formatter={(v) => `${Number(v).toFixed(1)}%`}
                labelFormatter={(label, payload) => {
                  const p = payload?.[0]?.payload as
                    | { fechaIso?: string }
                    | undefined;
                  return p?.fechaIso
                    ? `${label} (${formatShortDateEs(p.fechaIso)})`
                    : String(label);
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="Programado"
                name="Línea Base Programada (MS Project)"
                stroke="#64748b"
                strokeWidth={2.5}
                strokeDasharray="6 4"
                dot={{ r: 3.5 }}
              />
              <Area
                type="monotone"
                dataKey="Real"
                name="Avance Físico Real (Bitácora)"
                stroke="#0284c7"
                fill="#0284c7"
                fillOpacity={0.22}
                strokeWidth={3}
                connectNulls={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
