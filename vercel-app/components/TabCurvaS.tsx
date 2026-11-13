"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Calendar,
  Check,
  CheckCircle2,
  ClipboardList,
  Code2,
  Download,
  FileSpreadsheet,
  Flame,
  HelpCircle,
  Lightbulb,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
  Upload,
  X,
  Zap,
} from "lucide-react";
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
import { useAppPreferences } from "../lib/i18n";
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
import { formatNum } from "../lib/projects";
import { BitacoraRow, ConsolidationResult, GanttTask, ProjectConfig } from "../lib/types";
import { localizeActivity, localizeChapter, localizeTerm } from "../lib/units";

interface TabCurvaSProps {
  proyecto: ProjectConfig;
  data: ConsolidationResult;
  onUpdateProyecto: (updated: ProjectConfig) => void;
  cloudRows?: BitacoraRow[];
  onRefreshCloud?: () => Promise<void> | void;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const ROW_HEIGHT = 42;
const TIMELINE_HEADER_HEIGHT = 50;

const MESES_ES = [
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

const MESES_EN = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];

export const VBA_MSPROJECT_SYNC_CODE = `' ==============================================================================
' MODULO DE SINCRONIZACION MS PROJECT PROFESIONAL 2021 -> JGM CONTECH CLOUD
' Sincroniza en tiempo real las tareas con el Centro de Control BIM 4D y Curva S
' ==============================================================================
Option Explicit

Public Sub SincronizarJGMConTech()
    Dim http As Object
    Dim url As String
    Dim jsonPayload As String
    Dim t As Task
    Dim count As Long
    Dim wbsStr As String, nameStr As String, startStr As String, finishStr As String
    Dim durDays As Double, durStr As String, pctVal As Long
    Dim isCrit As Boolean, isSumm As Boolean, isMile As Boolean
    Dim critJson As String, summJson As String, mileJson As String
    Dim predsStr As String, respStr As String, costStr As String
    Dim responseText As String, statusVal As Long
    
    ' URL de la API de produccion de JGM ConTech
    url = "https://jagm2000-jgmcontech.vercel.app/api/msproject-sync"
    
    If ActiveProject Is Nothing Then
        MsgBox "No hay ningun proyecto activo abierto en Microsoft Project.", vbExclamation, "JGM ConTech"
        Exit Sub
    End If
    
    ' Deteccion automatica del proyecto segun el nombre del archivo
    Dim projId As String, projTitle As String
    projTitle = ActiveProject.Name
    If InStr(1, LCase(projTitle), "mendoza") > 0 Or InStr(1, LCase(projTitle), "casa") > 0 Then
        projId = "casa_mendoza"
    Else
        projId = "mezzanine"
    End If
    
    jsonPayload = "{" & vbCrLf
    jsonPayload = jsonPayload & "  ""projectId"": """ & projId & """," & vbCrLf
    jsonPayload = jsonPayload & "  ""projectName"": """ & Replace(projTitle, """", "\""") & """," & vbCrLf
    jsonPayload = jsonPayload & "  ""source"": ""MS_PROJECT_PROFESSIONAL_2021""," & vbCrLf
    jsonPayload = jsonPayload & "  ""tasks"": [" & vbCrLf
    
    count = 0
    For Each t In ActiveProject.Tasks
        If Not t Is Nothing Then
            count = count + 1
            wbsStr = t.WBS
            If wbsStr = "" Then wbsStr = CStr(t.ID)
            
            nameStr = Replace(t.Name, """", "\""")
            nameStr = Replace(nameStr, vbCrLf, " ")
            nameStr = Replace(nameStr, vbCr, " ")
            nameStr = Replace(nameStr, vbLf, " ")
            
            startStr = Format(t.Start, "yyyy-mm-dd")
            finishStr = Format(t.Finish, "yyyy-mm-dd")
            
            ' 480 minutos laborables = 1 dia en MS Project
            durDays = Round(t.Duration / 480, 2)
            durStr = Replace(CStr(durDays), ",", ".")
            
            pctVal = CLng(t.PercentComplete)
            isCrit = t.Critical
            isSumm = t.Summary
            isMile = t.Milestone
            critJson = IIf(isCrit, "true", "false")
            summJson = IIf(isSumm, "true", "false")
            mileJson = IIf(isMile, "true", "false")
            predsStr = Replace(t.Predecessors, """", "\""")
            respStr = Replace(t.ResourceNames, """", "\""")
            costStr = Replace(CStr(Round(t.Cost, 2)), ",", ".")
            
            If count > 1 Then jsonPayload = jsonPayload & "," & vbCrLf
            
            jsonPayload = jsonPayload & "    {"
            jsonPayload = jsonPayload & """id"": """ & t.ID & """, "
            jsonPayload = jsonPayload & """uid"": """ & t.UniqueID & """, "
            jsonPayload = jsonPayload & """wbs"": """ & wbsStr & """, "
            jsonPayload = jsonPayload & """nombre"": """ & nameStr & """, "
            jsonPayload = jsonPayload & """inicio"": """ & startStr & """, "
            jsonPayload = jsonPayload & """fin"": """ & finishStr & """, "
            jsonPayload = jsonPayload & """duracionDias"": " & durStr & ", "
            jsonPayload = jsonPayload & """costo"": " & costStr & ", "
            jsonPayload = jsonPayload & """pctReal"": " & pctVal & ", "
            jsonPayload = jsonPayload & """rutaCritica"": " & critJson & ", "
            jsonPayload = jsonPayload & """esResumen"": " & summJson & ", "
            jsonPayload = jsonPayload & """esHito"": " & mileJson & ", "
            jsonPayload = jsonPayload & """predecesoras"": """ & predsStr & """, "
            jsonPayload = jsonPayload & """responsable"": """ & respStr & """"
            jsonPayload = jsonPayload & "}"
        End If
    Next t
    
    jsonPayload = jsonPayload & vbCrLf & "  ]" & vbCrLf & "}"
    
    ' Envio HTTP POST seguro
    On Error Resume Next
    Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
    If http Is Nothing Then Set http = CreateObject("MSXML2.XMLHTTP")
    If http Is Nothing Then Set http = CreateObject("WinHttp.WinHttpRequest.5.1")
    On Error GoTo ErrorHandler
    
    http.Open "POST", url, False
    http.setRequestHeader "Content-Type", "application/json; charset=utf-8"
    http.send jsonPayload
    
    statusVal = http.Status
    responseText = http.responseText
    
    If statusVal = 200 Or statusVal = 201 Then
        MsgBox "[OK] Cronograma sincronizado con exito!" & vbCrLf & vbCrLf & _
               "- Proyecto: " & projId & " (" & projTitle & ")" & vbCrLf & _
               "- Tareas procesadas: " & count & vbCrLf & _
               "- Reflejado en JGM ConTech Curva S & Plazo 4D en tiempo real.", _
               vbInformation, "JGM ConTech 4D Sync"
    Else
        MsgBox "[WARN] Error HTTP " & statusVal & ":" & vbCrLf & responseText, _
               vbCritical, "JGM ConTech 4D Sync"
    End If
    Exit Sub
    
ErrorHandler:
    MsgBox "[ERROR] Fallo de conexion al sincronizar con JGM ConTech:" & vbCrLf & Err.Description, _
           vbCritical, "JGM ConTech"
End Sub`;

function formatShortDate(iso: string, lang: "es" | "en"): string {
  const clean = String(iso || "").slice(0, 10);
  const parts = clean.split("-");
  if (parts.length !== 3) return clean;
  if (lang === "en") return `${parts[1]}/${parts[2]}/${parts[0].slice(2)}`;
  return `${parts[2]}/${parts[1]}/${parts[0].slice(2)}`;
}

function localizeGanttTaskName(task: GanttTask, lang: "es" | "en"): string {
  const raw = task.nombre || "";
  if (lang === "es") return raw;
  if (task.esHito) {
    if (raw.toLowerCase().includes("entrega")) return "◆ Final Project Handover Milestone";
    return localizeTerm(localizeActivity(raw, "en"), "en");
  }
  if (task.esResumen) {
    return localizeChapter(raw, "en")
      .replace(/^FASE\s+/i, "PHASE ")
      .replace(/ESTRUCTURA & MAMPOSTER[IÍ]A/gi, "STRUCTURE & MASONRY")
      .replace(/ENVOLVENTE, PISOS & CUBIERTA/gi, "ENVELOPE, FLOORING & ROOFING")
      .replace(/ACABADOS ARQUITECT[OÓ]NICOS & CARPINTER[IÍ]A/gi, "ARCHITECTURAL FINISHES & GLAZING")
      .replace(/ACABADOS ARQUITECT[OÓ]NICOS/gi, "ARCHITECTURAL FINISHES");
  }
  return localizeActivity(raw, "en");
}

function localizeGanttStatus(estado: string, rawLabel: string, lang: "es" | "en"): string {
  if (lang === "es") return rawLabel;
  if (estado === "completada") return "Completed";
  if (estado === "retrasada") return "Delayed";
  if (estado === "en_atencion") return "At Risk";
  if (estado === "en_curso") return "In Progress";
  return "Scheduled";
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
  cloudRows = [],
  onRefreshCloud,
}: TabCurvaSProps) {
  const { lang, currency, formatMoney } = useAppPreferences();
  const isEn = lang === "en";
  const moneyDecimals = currency === "COP" ? 0 : 2;

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

  // MS Project 2021 API modal states
  const [showApiModal, setShowApiModal] = useState<boolean>(false);
  const [activeApiTab, setActiveApiTab] = useState<"vba" | "instrucciones" | "prueba">("vba");
  const [testingApi, setTestingApi] = useState<boolean>(false);
  const [testApiResult, setTestApiResult] = useState<{
    ok: boolean;
    message: string;
    details?: unknown;
  } | null>(null);
  const [copiedVba, setCopiedVba] = useState<boolean>(false);
  const [refreshingLive, setRefreshingLive] = useState<boolean>(false);

  // Quick Add Task Form
  const [newNombre, setNewNombre] = useState<string>("");
  const [newWbs, setNewWbs] = useState<string>("");
  const [newInicio, setNewInicio] = useState<string>(() => getTodayIso());
  const [newFin, setNewFin] = useState<string>(() => addDaysIso(getTodayIso(), 7));
  const [newCritica, setNewCritica] = useState<boolean>(false);
  const [newPred, setNewPred] = useState<string>("");
  const [newMatchItem, setNewMatchItem] = useState<string>("");

  // Extract latest synced MS Project schedule from cloud logs
  const syncedMsProjectInfo = useMemo(() => {
    if (!cloudRows || cloudRows.length === 0) return null;
    const proyId = (proyecto.id || "casa_mendoza").toLowerCase();
    const tag = `[msproject_sync] [${proyId}]`;
    const found = cloudRows.find((r) => {
      const act = String(r.actividad || "").toLowerCase();
      return act.includes(tag) || (act.includes("msproject_sync") && act.includes(proyId));
    });
    if (!found) return null;
    try {
      const raw = String(found.actividad || "");
      const idxSecond = raw.indexOf("]", raw.indexOf("]") + 1);
      const jsonStr =
        idxSecond > -1
          ? raw.slice(idxSecond + 1).trim()
          : raw.replace(/\[msproject_sync\]\s*\[\w+\]\s*/i, "").trim();
      const tasks = JSON.parse(jsonStr) as GanttTask[];
      if (Array.isArray(tasks) && tasks.length > 0) {
        return {
          id: found.id,
          fecha: found.fecha,
          created_at: found.created_at,
          count: tasks.length,
          tasks,
        };
      }
    } catch {
      // Ignore parse failure
    }
    return null;
  }, [cloudRows, proyecto.id]);

  // Live poll every 8s while tab is active
  useEffect(() => {
    if (!onRefreshCloud) return;
    const interval = setInterval(() => {
      onRefreshCloud();
    }, 8000);
    return () => clearInterval(interval);
  }, [onRefreshCloud]);

  const handleManualLiveRefresh = async () => {
    if (!onRefreshCloud) return;
    setRefreshingLive(true);
    try {
      await onRefreshCloud();
      setStatusBanner({
        type: "ok",
        text: isEn
          ? "Live synchronization verified with Supabase and MS Project."
          : "Sincronización en vivo verificada con Supabase y MS Project.",
      });
    } catch {
      setStatusBanner({
        type: "error",
        text: isEn
          ? "Unable to refresh live cloud state."
          : "No se pudo actualizar el estado en vivo de la nube.",
      });
    } finally {
      setRefreshingLive(false);
    }
  };

  const handleTestApi = async () => {
    setTestingApi(true);
    setTestApiResult(null);
    try {
      const sampleTasks: GanttTask[] = [
        {
          id: "1",
          uid: "1",
          wbs: "1.1",
          nombre: "Localización, replanteo y niveles (Prueba API MS Project)",
          capitulo: "1. PRELIMINARES",
          inicio: getTodayIso(),
          fin: addDaysIso(getTodayIso(), 4),
          duracionDias: 4,
          pesoPct: 4.0,
          rutaCritica: true,
          responsable: "Topógrafo / Residente",
        },
        {
          id: "2",
          uid: "2",
          wbs: "1.2",
          nombre: "Demolición y retiro de escombros (Prueba API MS Project)",
          capitulo: "1. PRELIMINARES",
          inicio: addDaysIso(getTodayIso(), 3),
          fin: addDaysIso(getTodayIso(), 8),
          duracionDias: 5,
          pesoPct: 5.0,
          rutaCritica: true,
          predecesoras: ["1"],
          responsable: "Cuadrilla Obra",
        },
      ];

      const res = await fetch("/api/msproject-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: proyecto.id || "casa_mendoza",
          projectName: proyecto.nombre || "Casa Mendoza",
          source: "MS_PROJECT_PROFESSIONAL_2021_TEST",
          tasks: sampleTasks,
        }),
      });

      const dataRes = await res.json();
      if (!res.ok || !dataRes.ok) {
        setTestApiResult({
          ok: false,
          message:
            dataRes.error ||
            (isEn ? `HTTP ${res.status}: API error` : `HTTP ${res.status}: Fallo en la API`),
        });
      } else {
        setTestApiResult({
          ok: true,
          message: isEn
            ? `Sync test succeeded! Saved ${dataRes.tasksCount} tasks to Supabase for ${dataRes.projectId}.`
            : `Prueba de sincronización exitosa: se guardaron ${dataRes.tasksCount} tareas en Supabase para ${dataRes.projectId}.`,
          details: dataRes,
        });
        if (onRefreshCloud) {
          await onRefreshCloud();
        }
      }
    } catch (err) {
      setTestApiResult({
        ok: false,
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setTestingApi(false);
    }
  };

  const rawTasks: GanttTask[] = useMemo(() => {
    if (syncedMsProjectInfo && syncedMsProjectInfo.tasks.length > 0) {
      return syncedMsProjectInfo.tasks;
    }
    if (proyecto.gantt_base && proyecto.gantt_base.length > 0) {
      return proyecto.gantt_base;
    }
    return buildDefaultGanttFromBudget(proyecto);
  }, [syncedMsProjectInfo, proyecto]);

  const isCustomSchedule = Boolean(
    syncedMsProjectInfo || (proyecto.gantt_base && proyecto.gantt_base.length > 0)
  );

  const enrichedTasks: EnrichedGanttTask[] = useMemo(
    () => enrichGanttWithExecution(rawTasks, data, fechaCorte),
    [rawTasks, data, fechaCorte]
  );

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

  const visibleTasks: EnrichedGanttTask[] = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return enrichedTasks.filter((t) => {
      if (q) {
        const hay = `${t.wbs} ${t.nombre} ${localizeGanttTaskName(t, lang)} ${
          t.capitulo || ""
        } ${localizeChapter(t.capitulo || "", lang)} ${t.responsable || ""}`.toLowerCase();
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
  }, [enrichedTasks, busqueda, filtroEstado, lang]);

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

    const monthsList = isEn ? MESES_EN : MESES_ES;
    const months: { key: string; label: string; leftPx: number; widthPx: number }[] = [];
    for (let d = 0; d < totalDays; d++) {
      const dt = new Date(startMs + d * MS_PER_DAY);
      const key = `${dt.getUTCFullYear()}-${dt.getUTCMonth()}`;
      const label = `${monthsList[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`;
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
          label: isEn
            ? `W${w} · ${iso.slice(5, 7)}/${iso.slice(8, 10)}`
            : `S${w} · ${iso.slice(8, 10)}/${iso.slice(5, 7)}`,
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
  }, [enrichedTasks, escala, fechaCorte, isEn]);

  const barPositions = useMemo(() => {
    const posMap = new Map<
      string,
      { idx: number; startX: number; endX: number; barW: number; centerY: number }
    >();
    const items = visibleTasks.map((t, idx) => {
      const tIni = parseIsoDateMs(t.inicio);
      const tFin = Math.max(tIni, parseIsoDateMs(t.fin));
      const startX =
        ((tIni - timelineGeometry.startMs) / MS_PER_DAY) * timelineGeometry.pxPerDay;
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
          errMsg =
            pyRes.error ||
            (isEn
              ? "No valid tasks could be extracted from the Excel file."
              : "No se pudieron extraer tareas válidas del archivo Excel.");
        } else {
          parsedTasks = pyRes.tasks;
        }
      } else {
        errMsg = isEn
          ? "Unsupported format. Export from MS Project as .xml, .xlsx, or .csv."
          : "Formato no soportado. Exporta desde MS Project en .xml, .xlsx o .csv.";
      }

      if (errMsg || parsedTasks.length === 0) {
        setStatusBanner({
          type: "error",
          text:
            errMsg ||
            (isEn
              ? "No valid tasks found in the selected file."
              : "No se detectaron tareas válidas en el archivo seleccionado."),
        });
      } else {
        saveSchedule(
          parsedTasks,
          isEn
            ? `MS Project loaded successfully: ${parsedTasks.length} tasks imported from "${file.name}".`
            : `MS Project cargado correctamente: ${parsedTasks.length} tareas importadas desde "${file.name}".`
        );
      }
    } catch (err) {
      setStatusBanner({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : isEn
            ? "Error processing MS Project file."
            : "Error procesando archivo MS Project.",
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
      capitulo: isEn ? "4D SCHEDULE" : "PROGRAMACIÓN 4D",
      inicio: safeStart,
      fin: safeEnd,
      duracionDias: dur,
      pesoPct: 4.0,
      rutaCritica: newCritica,
      esHito: dur === 0,
      predecesoras: newPred ? [newPred] : undefined,
      responsable: isEn ? "Technical Director" : "Dirección Técnica",
      matchItem: newMatchItem || undefined,
    };
    saveSchedule(
      [...rawTasks, newTask],
      isEn
        ? `Task "${newTask.nombre}" added to 4D Gantt.`
        : `Tarea "${newTask.nombre}" añadida al Gantt 4D.`
    );
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
    saveSchedule(
      next,
      isEn
        ? "Task removed from Gantt schedule."
        : "Tarea eliminada del diagrama de Gantt."
    );
  };

  const handleResetDefaultGantt = () => {
    onUpdateProyecto({
      ...proyecto,
      gantt_base: undefined,
    });
    setStatusBanner({
      type: "ok",
      text: isEn
        ? "4D schedule restored to budget-derived baseline."
        : "Cronograma 4D restaurado a la línea base derivada del presupuesto del proyecto.",
    });
  };

  const handleExportCsv = () => {
    const headers = isEn
      ? [
          "ID",
          "WBS",
          "Task_Name",
          "Chapter",
          "Start",
          "Finish",
          "Duration_Days",
          "Predecessors",
          "Critical_Path",
          "Weight_%",
          "Planned_To_Date_%",
          "Actual_Progress_%",
          "Variance_%",
          "Status",
        ]
      : [
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
        `"${localizeGanttTaskName(t, lang).replace(/"/g, '""')}"`,
        `"${localizeChapter(t.capitulo || "", lang).replace(/"/g, '""')}"`,
        t.inicio,
        t.fin,
        t.duracionDias,
        (t.predecesoras || []).join("|"),
        t.rutaCritica ? (isEn ? "YES" : "SI") : "NO",
        t.pesoPct.toFixed(2),
        t.pctProgramado.toFixed(1),
        t.pctReal.toFixed(1),
        t.desviacion.toFixed(1),
        localizeGanttStatus(t.estado, t.estadoLabel, lang),
      ].join(";")
    );
    const csv = "\uFEFF" + [headers.join(";"), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = isEn
      ? `Gantt_Schedule_${proyecto.id}_${fechaCorte}.csv`
      : `Gantt_MSProject_${proyecto.id}_${fechaCorte}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Main Header + 4D Cutoff Simulator */}
      <div className="bento-card p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-slate-900 text-slate-100">
                MS Project 4D · EVM Control
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                {isCustomSchedule
                  ? isEn
                    ? "Imported MS Project Schedule"
                    : "Cronograma MS Project Importado"
                  : isEn
                  ? "Auto-4D BOQ Baseline"
                  : "Línea Base APU Auto-4D"}
              </span>
            </div>
            <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-slate-800 shrink-0" />
              <span>
                {isEn
                  ? "S-Curve, Earned Value Management (EVM) & MS Project 4D Gantt"
                  : "Curva S, Gestión del Valor Ganado (EVM) & Diagrama de Gantt MS Project"}
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {isEn ? (
                <>
                  Master schedule synchronized live with actual field progress from{" "}
                  <span className="font-semibold text-slate-700">Cloud Field Log</span> for{" "}
                  <span className="font-semibold text-slate-700">{proyecto.nombre}</span>.
                </>
              ) : (
                <>
                  Cronograma maestro sincronizado en vivo con la ejecución reportada en{" "}
                  <span className="font-semibold text-slate-700">Bitácora Cloud</span> para{" "}
                  <span className="font-semibold text-slate-700">{proyecto.nombre}</span>.
                </>
              )}
            </p>

            {/* Real-time MS Project sync status */}
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {syncedMsProjectInfo ? (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-300 text-[11px] font-bold text-emerald-800 shadow-sm">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
                  </span>
                  <span>
                    {isEn ? "MS Project Pro 2021: Online" : "MS Project Profesional 2021: En Línea"}
                  </span>
                  <span className="text-emerald-700 font-medium">
                    ({syncedMsProjectInfo.count} {isEn ? "tasks" : "tareas"} •{" "}
                    {syncedMsProjectInfo.created_at
                      ? new Date(syncedMsProjectInfo.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : syncedMsProjectInfo.fecha}
                    )
                  </span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-300 text-[11px] font-semibold text-slate-700">
                  <span className="h-2 w-2 rounded-full bg-slate-400"></span>
                  <span>
                    {isEn
                      ? "MS Project API: Ready to receive sync"
                      : "MS Project API: Listo para recibir sincronización"}
                  </span>
                </div>
              )}
              {onRefreshCloud && (
                <button
                  type="button"
                  onClick={handleManualLiveRefresh}
                  disabled={refreshingLive}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 transition"
                  title={
                    isEn
                      ? "Check live updates from Supabase"
                      : "Comprobar actualizaciones en vivo en Supabase"
                  }
                >
                  <RefreshCw className={`w-3 h-3 ${refreshingLive ? "animate-spin" : ""}`} />
                  <span>
                    {refreshingLive
                      ? isEn
                        ? "Checking..."
                        : "Verificando..."
                      : isEn
                      ? "Sync Now"
                      : "Sincronizar ahora"}
                  </span>
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowApiModal(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-extrabold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center gap-1.5 cursor-pointer transition"
              title={
                isEn
                  ? "Real-time API for Microsoft Project Desktop 2021"
                  : "API en Tiempo Real para Microsoft Project Desktop 2021"
              }
            >
              <Zap className="w-3.5 h-3.5" />
              <span>API MS Project 2021</span>
            </button>
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
              {importing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              <span>
                {importing
                  ? isEn
                    ? "Parsing file..."
                    : "Procesando archivo..."
                  : isEn
                  ? "Import MS Project"
                  : "Importar MS Project"}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm((v) => !v)}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer inline-flex items-center gap-1.5"
            >
              {showAddForm ? (
                <>
                  <X className="w-3.5 h-3.5" />
                  <span>{isEn ? "Close" : "Cerrar"}</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isEn ? "New Task" : "Nueva Tarea"}</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer inline-flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>{isEn ? "Export CSV" : "Exportar CSV"}</span>
            </button>
            {isCustomSchedule && (
              <button
                type="button"
                onClick={handleResetDefaultGantt}
                className="px-3 py-2 rounded-xl text-xs font-bold bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100 cursor-pointer inline-flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{isEn ? "Restore Baseline" : "Restaurar Base"}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowMsProjectHelp((v) => !v)}
              className="px-2.5 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer inline-flex items-center gap-1.5"
              title={
                isEn
                  ? "How to export from Microsoft Project"
                  : "Cómo exportar desde Microsoft Project"
              }
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>{isEn ? "MSP Guide" : "Guía MSP"}</span>
            </button>
          </div>
        </div>

        {/* MS Project quick export guide */}
        {showMsProjectHelp && (
          <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-4 text-xs text-slate-700 space-y-1.5">
            <p className="font-bold text-slate-900 flex items-center gap-1.5">
              <Lightbulb className="w-4 h-4 text-sky-600 shrink-0" />
              <span>
                {isEn
                  ? "How to import your live schedule from Microsoft Project in 10 seconds:"
                  : "Cómo traer tu programación real desde Microsoft Project en 10 segundos:"}
              </span>
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                {isEn ? (
                  <>
                    <strong>Option 1 (Recommended — Preserves WBS, Critical Path & Predecessors):</strong>{" "}
                    In MS Project click <em>File → Save As → Format: </em>
                    <code className="px-1 py-0.5 rounded bg-white border border-sky-200">XML Format (*.xml)</code>{" "}
                    and upload it via <strong>Import MS Project</strong>.
                  </>
                ) : (
                  <>
                    <strong>Opción 1 (Recomendada — Conserva EDT, Ruta Crítica y Predecesoras exactas):</strong>{" "}
                    En MS Project ve a <em>Archivo → Guardar como → Tipo: </em>
                    <code className="px-1 py-0.5 rounded bg-white border border-sky-200">Formato XML (*.xml)</code>{" "}
                    y súbelo con el botón <strong>Importar MS Project</strong>.
                  </>
                )}
              </li>
              <li>
                {isEn ? (
                  <>
                    <strong>Option 2 (Excel / CSV):</strong> Export columns{" "}
                    <code className="px-1 py-0.5 rounded bg-white border border-sky-200">Task Name</code>,{" "}
                    <code className="px-1 py-0.5 rounded bg-white border border-sky-200">Start</code>,{" "}
                    <code className="px-1 py-0.5 rounded bg-white border border-sky-200">Finish</code>,{" "}
                    <code className="px-1 py-0.5 rounded bg-white border border-sky-200">Predecessors</code>,{" "}
                    <code className="px-1 py-0.5 rounded bg-white border border-sky-200">Critical</code> as{" "}
                    <code>.xlsx</code> or <code>.csv</code>.
                  </>
                ) : (
                  <>
                    <strong>Opción 2 (Excel / CSV):</strong> Exporta o copia tus columnas{" "}
                    <code className="px-1 py-0.5 rounded bg-white border border-sky-200">Nombre de tarea</code>,{" "}
                    <code className="px-1 py-0.5 rounded bg-white border border-sky-200">Comienzo</code>,{" "}
                    <code className="px-1 py-0.5 rounded bg-white border border-sky-200">Fin</code>,{" "}
                    <code className="px-1 py-0.5 rounded bg-white border border-sky-200">Predecesoras</code>,{" "}
                    <code className="px-1 py-0.5 rounded bg-white border border-sky-200">Crítica</code> en{" "}
                    <code>.xlsx</code> o <code>.csv</code>.
                  </>
                )}
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
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* 4D EVM Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="steel-subcard rounded-2xl p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              {isEn ? "Planned Value at Cutoff (PV)" : "Valor Planeado a Corte (PV)"}
            </p>
            <p className="text-2xl font-extrabold text-slate-900 mt-1 kpi-num">
              {formatMoney(pv, moneyDecimals)}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {pvPct.toFixed(1)}%{" "}
              {isEn
                ? `scheduled through ${formatShortDate(fechaCorte, lang)}`
                : `programado al ${formatShortDate(fechaCorte, lang)}`}
            </p>
          </div>

          <div className="steel-subcard rounded-2xl p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              {isEn ? "Actual Earned Value (EV)" : "Valor Ganado Real (EV)"}
            </p>
            <p className="text-2xl font-extrabold text-slate-900 mt-1 kpi-num">
              {formatMoney(ev, moneyDecimals)}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {evPct.toFixed(1)}%{" "}
              {isEn ? "physical progress on site" : "físico ejecutado en obra"}
            </p>
          </div>

          <div className="steel-subcard rounded-2xl p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              {isEn ? "Schedule Performance (SPI)" : "Índice Desempeño Plazo (SPI)"}
            </p>
            <p
              className={`text-2xl font-extrabold mt-1 kpi-num ${
                spi >= 1 ? "text-emerald-600" : spi >= 0.85 ? "text-amber-600" : "text-rose-600"
              }`}
            >
              {spi.toFixed(2)}
            </p>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              {spi < 0.85 && <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />}
              <span>
                {spi >= 1
                  ? isEn
                    ? "Ahead or on 4D schedule"
                    : "Adelantado o en línea 4D"
                  : spi >= 0.85
                  ? isEn
                    ? "Manageable minor variance"
                    : "Leve retraso controlable"
                  : isEn
                  ? "Schedule slippage vs. baseline"
                  : "Desfase frente a línea base"}
              </span>
            </p>
          </div>

          <div className="steel-subcard rounded-2xl p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              {isEn ? "Cost Performance (CPI)" : "Índice Desempeño Costo (CPI)"}
            </p>
            <p
              className={`text-2xl font-extrabold mt-1 kpi-num ${
                cpi >= 1 ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              {cpi.toFixed(2)}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {cpi >= 1
                ? isEn
                  ? "Efficient BOQ cost control"
                  : "Control eficiente de APU"
                : isEn
                ? "Cost overrun detected in items"
                : "Sobrecosto detectado en ítems"}
            </p>
          </div>
        </div>

        {/* 4D Cutoff Interactive Slider */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-3 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-700" />
            <span className="text-xs font-extrabold text-slate-800">
              {isEn ? "4D Cutoff / Simulator:" : "Corte / Simulador 4D:"}
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
              {isEn ? "Today" : "Hoy"}
            </button>
          </div>

          <div className="flex-1 min-w-[200px] flex items-center gap-3">
            <span className="text-[11px] font-mono text-slate-500">
              {formatShortDate(curvaSeries.startIso, lang)}
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
              {formatShortDate(curvaSeries.endIso, lang)}
            </span>
          </div>

          <div className="text-xs text-slate-600 font-semibold">
            {isEn ? "Total duration:" : "Duración total:"}{" "}
            <span className="text-slate-900 font-bold">
              {curvaSeries.totalDays} {isEn ? "days" : "días"}
            </span>
          </div>
        </div>
      </div>

      {/* Collapsible New Task Form */}
      {showAddForm && (
        <form
          onSubmit={handleAddTask}
          className="bento-card p-5 border-2 border-slate-300 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-slate-700" />
              <span>
                {isEn
                  ? "Add Activity to 4D MS Project Schedule"
                  : "Agregar Actividad al Cronograma MS Project 4D"}
              </span>
            </h4>
            <span className="text-[11px] text-slate-500">
              {isEn
                ? "Automatically saved in local project workspace"
                : "Se guarda automáticamente en el proyecto local"}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="lg:col-span-2">
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                {isEn ? "Task Name *" : "Nombre de la Tarea *"}
              </label>
              <input
                type="text"
                required
                placeholder={
                  isEn
                    ? "e.g. Aluminum Facade Glazing"
                    : "Ej: Instalación Ventanería Fachada"
                }
                value={newNombre}
                onChange={(e) => setNewNombre(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                {isEn ? "WBS" : "EDT / WBS"}
              </label>
              <input
                type="text"
                placeholder={isEn ? "e.g. 4.7" : "Ej: 4.7"}
                value={newWbs}
                onChange={(e) => setNewWbs(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                {isEn ? "Start" : "Comienzo"}
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
                {isEn ? "Finish" : "Fin"}
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
                {isEn ? "Predecessor" : "Predecesora"}
              </label>
              <select
                value={newPred}
                onChange={(e) => setNewPred(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
              >
                <option value="">{isEn ? "None" : "Ninguna"}</option>
                {rawTasks
                  .filter((t) => !t.esResumen)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.wbs} · {localizeGanttTaskName(t, lang).slice(0, 28)}
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
                <Flame className="w-3.5 h-3.5 text-rose-500" />
                <span>{isEn ? "Flag Critical Path" : "Marcar en Ruta Crítica"}</span>
              </label>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-600">
                  {isEn ? "Link BOQ Item (Field Log):" : "Vincular Ítem APU (Bitácora):"}
                </span>
                <select
                  value={newMatchItem}
                  onChange={(e) => setNewMatchItem(e.target.value)}
                  className="px-2.5 py-1 rounded-lg border border-slate-300 text-xs bg-white max-w-[260px]"
                >
                  <option value="">
                    {isEn ? "Auto-match by name" : "Auto-emparejar por nombre"}
                  </option>
                  {(proyecto.ppto_base || []).map((it) => (
                    <option key={it.Item} value={it.Item}>
                      {it.Item} · {localizeActivity(it.Actividad, lang).slice(0, 38)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="steel-btn-primary px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
            >
              {isEn ? "Save 4D Task" : "Guardar Tarea 4D"}
            </button>
          </div>
        </form>
      )}

      {/* DUAL-PANE MS PROJECT GANTT CHART */}
      <div className="bento-card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-slate-800 shrink-0" />
              <span>
                {isEn
                  ? "MS Project Gantt Diagram — 4D Schedule Control"
                  : "Diagrama de Gantt MS Project — Control de Plazo 4D"}
              </span>
            </h4>
            <p className="text-xs text-slate-500">
              {isEn
                ? "Click any task or bar to edit dates, manual % override, or critical path flag."
                : "Haz clic sobre cualquier actividad o barra para editar fechas, % manual o ruta crítica."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
              <input
                type="text"
                placeholder={isEn ? "Filter WBS or task..." : "Filtrar EDT o tarea..."}
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-300 text-xs w-44 bg-white"
              />
            </div>

            {/* Status filters */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-[11px] font-bold">
              {(
                [
                  {
                    key: "todas",
                    label: `${isEn ? "All" : "Todas"} (${summaryCounts.total})`,
                    icon: null,
                  },
                  {
                    key: "criticas",
                    label: `${isEn ? "Critical" : "Crítica"} (${summaryCounts.criticas})`,
                    icon: <Flame className="w-3 h-3 text-rose-500" />,
                  },
                  {
                    key: "atrasadas",
                    label: `${isEn ? "Delayed" : "Atraso"} (${summaryCounts.atrasadas})`,
                    icon: <AlertTriangle className="w-3 h-3 text-amber-500" />,
                  },
                  {
                    key: "completadas",
                    label: `${isEn ? "Done" : "Listas"} (${summaryCounts.completadas})`,
                    icon: <CheckCircle2 className="w-3 h-3 text-emerald-500" />,
                  },
                ] as const
              ).map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setFiltroEstado(item.key)}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer inline-flex items-center gap-1 ${
                    filtroEstado === item.key
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>

            {/* Timescale */}
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
                {isEn ? "Weeks" : "Semanas"}
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
                {isEn ? "Days" : "Días"}
              </button>
            </div>

            {/* Predecessor links SVG */}
            <button
              type="button"
              onClick={() => setMostrarDependencias((v) => !v)}
              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border cursor-pointer inline-flex items-center gap-1 ${
                mostrarDependencias
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-600 border-slate-300"
              }`}
            >
              <Link2 className="w-3 h-3" />
              <span>{isEn ? "FS Links" : "Enlaces FS"}</span>
            </button>
          </div>
        </div>

        {/* Visual Legend */}
        <div className="flex flex-wrap items-center gap-4 text-[11px] font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-2.5 rounded-sm bg-slate-800 inline-block" />
            {isEn ? "Chapter / Summary" : "Capítulo / Resumen"}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-2.5 rounded-sm bg-rose-500 inline-block" />
            {isEn ? "Critical Path" : "Ruta Crítica"}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-2.5 rounded-sm bg-sky-600 inline-block" />
            {isEn ? "In Progress / Normal" : "En Ejecución / Normal"}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-2.5 rounded-sm bg-emerald-500 inline-block" />
            {isEn ? "100% Built (Field Log)" : "Completado Real (Bitácora)"}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 bg-amber-500 rotate-45" />
            {isEn ? "Milestone" : "Hito"}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-0.5 h-3.5 bg-rose-600 inline-block" />
            {isEn
              ? `4D Cutoff Line (${formatShortDate(fechaCorte, lang)})`
              : `Línea Corte 4D (${formatShortDate(fechaCorte, lang)})`}
          </span>
        </div>

        {/* Dual-Pane Container */}
        <div className="border border-slate-300 rounded-2xl overflow-hidden bg-white shadow-inner">
          <div className="overflow-x-auto max-h-[560px] overflow-y-auto relative">
            <div className="flex min-w-max">
              {/* LEFT STICKY PANE: WBS Table */}
              <div className="w-[450px] min-w-[450px] sticky left-0 z-20 bg-white border-r-2 border-slate-300 shadow-[4px_0_12px_-4px_rgba(15,23,42,0.12)]">
                <div
                  style={{ height: TIMELINE_HEADER_HEIGHT }}
                  className="bg-slate-900 text-slate-100 text-[10px] font-bold uppercase tracking-wider grid grid-cols-[44px_1fr_64px_64px_42px_52px] items-center px-2 border-b border-slate-700 sticky top-0 z-30"
                >
                  <span>{isEn ? "WBS" : "EDT"}</span>
                  <span>{isEn ? "Task / Phase Name" : "Nombre de Tarea / Capítulo"}</span>
                  <span className="text-center">{isEn ? "Start" : "Comienzo"}</span>
                  <span className="text-center">{isEn ? "Finish" : "Fin"}</span>
                  <span className="text-center">{isEn ? "Days" : "Días"}</span>
                  <span className="text-right pr-1">{isEn ? "% Act" : "% Real"}</span>
                </div>

                <div>
                  {visibleTasks.length === 0 ? (
                    <div className="p-6 text-xs text-slate-500 text-center">
                      {isEn
                        ? "No tasks match the current filter."
                        : "No hay tareas que coincidan con el filtro aplicado."}
                    </div>
                  ) : (
                    visibleTasks.map((t) => {
                      const isSelected = t.id === selectedTaskId;
                      const localizedTitle = localizeGanttTaskName(t, lang);
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
                                title={isEn ? "Critical Path" : "Ruta Crítica"}
                              />
                            )}
                            <span
                              className="truncate"
                              title={`${t.wbs} · ${localizedTitle}`}
                            >
                              {localizedTitle}
                            </span>
                          </div>
                          <span className="text-center font-mono text-[10px] text-slate-500">
                            {formatShortDate(t.inicio, lang)}
                          </span>
                          <span className="text-center font-mono text-[10px] text-slate-500">
                            {formatShortDate(t.fin, lang)}
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

              {/* RIGHT PANE: Gantt Timeline */}
              <div
                style={{ width: timelineGeometry.widthPx }}
                className="relative bg-white shrink-0"
              >
                <div
                  style={{ height: TIMELINE_HEADER_HEIGHT }}
                  className="sticky top-0 z-10 bg-slate-900 text-slate-100 border-b border-slate-700 select-none"
                >
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

                <div
                  style={{
                    height: Math.max(ROW_HEIGHT, visibleTasks.length * ROW_HEIGHT),
                  }}
                  className="relative"
                >
                  {timelineGeometry.ticks.map((tk, i) => (
                    <div
                      key={i}
                      style={{ left: tk.leftPx, width: tk.widthPx }}
                      className={`absolute top-0 bottom-0 border-r border-slate-100 pointer-events-none ${
                        tk.isWeekend ? "bg-slate-100/60" : ""
                      }`}
                    />
                  ))}

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

                  {barPositions.items.map(({ task, idx, startX, barW }) => {
                    const topRow = idx * ROW_HEIGHT;
                    const pctFill = Math.min(100, Math.max(0, task.pctReal));
                    const taskName = localizeGanttTaskName(task, lang);

                    if (task.esHito) {
                      return (
                        <div
                          key={task.id}
                          onClick={() => setSelectedTaskId(task.id)}
                          style={{ top: topRow + 13, left: startX }}
                          className="absolute flex items-center gap-2 z-[4] cursor-pointer group"
                          title={`${taskName} (${task.inicio})`}
                        >
                          <div className="w-4 h-4 bg-amber-500 border-2 border-amber-700 rotate-45 shadow-sm group-hover:scale-110 transition-transform" />
                          <span className="text-[10px] font-extrabold text-amber-800 whitespace-nowrap bg-amber-50/90 px-1.5 py-0.5 rounded border border-amber-200">
                            {formatShortDate(task.inicio, lang)} · {taskName.replace("◆ ", "")}
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
                          title={`${taskName}: ${pctFill.toFixed(1)}%`}
                        >
                          <div
                            style={{ width: `${pctFill}%` }}
                            className="h-full bg-emerald-400/90 rounded-tl-sm"
                          />
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
                        title={`${task.wbs} · ${taskName}\n${
                          isEn ? "Start" : "Inicio"
                        }: ${task.inicio} | ${isEn ? "Finish" : "Fin"}: ${task.fin}\n${
                          isEn ? "Actual" : "Real"
                        }: ${pctFill.toFixed(1)}% vs ${
                          isEn ? "Plan" : "Prog"
                        }: ${task.pctProgramado.toFixed(1)}% (${localizeGanttStatus(
                          task.estado,
                          task.estadoLabel,
                          lang
                        )})`}
                      >
                        <div
                          style={{ width: `${pctFill}%` }}
                          className={`h-full rounded-l-[5px] ${
                            pctFill >= 99.5 ? "rounded-r-[5px]" : ""
                          } ${fillClass} transition-all duration-300`}
                        />

                        <span
                          style={{ left: barW + 6 }}
                          className="absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-[10px] font-bold text-slate-600 pointer-events-none inline-flex items-center gap-1"
                        >
                          {pctFill > 0 ? `${formatNum(pctFill, 0)}%` : ""}
                          {task.estado === "retrasada" && (
                            <AlertTriangle className="w-3 h-3 text-rose-500 inline" />
                          )}
                        </span>
                      </div>
                    );
                  })}

                  {timelineGeometry.showCorteLine && (
                    <div
                      style={{ left: timelineGeometry.corteX }}
                      className="absolute top-0 bottom-0 w-0.5 bg-rose-600 z-[8] pointer-events-none"
                    >
                      <div className="sticky top-0 -translate-x-1/2 bg-rose-600 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-b shadow whitespace-nowrap">
                        {isEn ? "4D CUTOFF" : "CORTE 4D"}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SELECTED TASK QUICK EDITOR */}
      {selectedTask && (
        <div className="bento-card p-5 border-2 border-slate-900/15 bg-slate-50 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-slate-900 text-white text-[10px] font-mono font-bold">
                  {isEn ? "WBS" : "EDT"} {selectedTask.wbs}
                </span>
                <span className="text-xs font-bold text-slate-500">
                  {localizeChapter(selectedTask.capitulo || "General", lang)}
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
                  {localizeGanttStatus(selectedTask.estado, selectedTask.estadoLabel, lang)}
                </span>
              </div>
              <h5 className="text-sm font-extrabold text-slate-900 mt-1">
                {localizeGanttTaskName(selectedTask, lang)}
              </h5>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleDeleteTask(selectedTask.id)}
                className="px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold hover:bg-rose-100 cursor-pointer inline-flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isEn ? "Delete" : "Eliminar"}</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedTaskId(null)}
                className="px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 cursor-pointer inline-flex items-center gap-1"
              >
                <span>{isEn ? "Close" : "Cerrar"}</span>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                {isEn ? "Start Date" : "Fecha Comienzo"}
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
                {isEn ? "Finish Date" : "Fecha Fin"}
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
                {isEn ? "Manual % (if unlinked)" : "% Manual (si no vincula APU)"}
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
                {isEn ? "Planned vs. Actual" : "Programado a Corte / Real"}
              </label>
              <div className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-mono text-xs text-slate-700">
                {isEn ? "Plan" : "Prog"}: {selectedTask.pctProgramado.toFixed(1)}% ·{" "}
                {isEn ? "Act" : "Real"}: {selectedTask.pctReal.toFixed(1)}%
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
                <Flame className="w-3.5 h-3.5 text-rose-500" />
                <span>{isEn ? "Critical Path" : "Ruta Crítica"}</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* S-CURVE CHART */}
      <div className="bento-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-slate-800 shrink-0" />
              <span>
                {isEn
                  ? "S-Curve Trajectory: Scheduled (MS Project) vs. Actual Progress (%)"
                  : "Trayectoria Curva S: Programado (MS Project) vs. Avance Real (%)"}
              </span>
            </h4>
            <p className="text-xs text-slate-500">
              {isEn
                ? "Dynamically computed from active Gantt weights through "
                : "Calculada dinámicamente ponderando las actividades del Gantt activo hasta "}
              <span className="font-semibold text-slate-700">
                {formatShortDate(fechaCorte, lang)}
              </span>
              .
            </p>
          </div>
          <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-700">
            {isEn ? "Current cutoff:" : "Corte actual:"} PV {pvPct.toFixed(1)}% · EV{" "}
            {evPct.toFixed(1)}%
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
                tickFormatter={(v) =>
                  isEn ? String(v).replace(/^Sem\b/i, "Wk") : String(v)
                }
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
                  const cleanLabel = isEn
                    ? String(label).replace(/^Sem\b/i, "Wk")
                    : String(label);
                  const p = payload?.[0]?.payload as { fechaIso?: string } | undefined;
                  return p?.fechaIso
                    ? `${cleanLabel} (${formatShortDate(p.fechaIso, lang)})`
                    : cleanLabel;
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="Programado"
                name={
                  isEn
                    ? "Scheduled Baseline (MS Project)"
                    : "Línea Base Programada (MS Project)"
                }
                stroke="#64748b"
                strokeWidth={2.5}
                strokeDasharray="6 4"
                dot={{ r: 3.5 }}
              />
              <Area
                type="monotone"
                dataKey="Real"
                name={
                  isEn
                    ? "Actual Physical Progress (Field Log)"
                    : "Avance Físico Real (Bitácora)"
                }
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

      {/* API & VBA MODAL */}
      {showApiModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white">
              <div className="flex items-center gap-3">
                <Zap className="w-6 h-6 text-amber-400 shrink-0" />
                <div>
                  <h3 className="text-base font-extrabold tracking-tight">
                    {isEn
                      ? "Real-Time API · Microsoft Project Professional 2021"
                      : "API en Tiempo Real · Microsoft Project Profesional 2021"}
                  </h3>
                  <p className="text-xs text-slate-300">
                    {isEn
                      ? "Instant synchronization between Desktop MS Project and your 4D S-Curve & Gantt."
                      : "Sincronización instantánea de tu cronograma de escritorio con la Curva S y Plazo 4D"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowApiModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 flex items-center justify-center text-sm font-bold transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex border-b border-slate-200 bg-slate-50 px-5 pt-3 gap-2">
              <button
                type="button"
                onClick={() => setActiveApiTab("vba")}
                className={`px-4 py-2 text-xs font-bold rounded-t-lg transition border-b-2 cursor-pointer inline-flex items-center gap-1.5 ${
                  activeApiTab === "vba"
                    ? "border-indigo-600 text-indigo-700 bg-white"
                    : "border-transparent text-slate-600 hover:text-slate-900"
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>
                  {isEn ? "VBA Macro Code (MS Project)" : "Código Macro VBA (MS Project)"}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveApiTab("instrucciones")}
                className={`px-4 py-2 text-xs font-bold rounded-t-lg transition border-b-2 cursor-pointer inline-flex items-center gap-1.5 ${
                  activeApiTab === "instrucciones"
                    ? "border-indigo-600 text-indigo-700 bg-white"
                    : "border-transparent text-slate-600 hover:text-slate-900"
                }`}
              >
                <ClipboardList className="w-3.5 h-3.5" />
                <span>
                  {isEn ? "Step-by-Step Guide (Alt + F11)" : "Guía Paso a Paso (Alt + F11)"}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveApiTab("prueba")}
                className={`px-4 py-2 text-xs font-bold rounded-t-lg transition border-b-2 cursor-pointer inline-flex items-center gap-1.5 ${
                  activeApiTab === "prueba"
                    ? "border-indigo-600 text-indigo-700 bg-white"
                    : "border-transparent text-slate-600 hover:text-slate-900"
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>{isEn ? "Test Live API" : "Probar API en Vivo"}</span>
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4 text-xs text-slate-700">
              {activeApiTab === "vba" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-bold text-slate-900 text-sm">
                        {isEn
                          ? "VBA Macro for Microsoft Project Professional 2021"
                          : "Macro VBA para Microsoft Project Profesional 2021"}
                      </p>
                      <p className="text-slate-500">
                        {isEn
                          ? "Paste it into your MS Project workbook module to push WBS schedules directly."
                          : "Pégalo en tu proyecto de MS Project para enviar tu programación directo a la nube."}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(VBA_MSPROJECT_SYNC_CODE);
                        setCopiedVba(true);
                        setTimeout(() => setCopiedVba(false), 2500);
                      }}
                      className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      {copiedVba ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <ClipboardList className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {copiedVba
                          ? isEn
                            ? "Copied!"
                            : "¡Copiado!"
                          : isEn
                          ? "Copy VBA Code"
                          : "Copiar Código VBA"}
                      </span>
                    </button>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-[11px] text-emerald-300 overflow-x-auto max-h-[380px] shadow-inner">
                    <pre>{VBA_MSPROJECT_SYNC_CODE}</pre>
                  </div>
                </div>
              )}

              {activeApiTab === "instrucciones" && (
                <div className="space-y-4">
                  <h4 className="font-extrabold text-slate-900 text-sm">
                    {isEn
                      ? "How to install the Microsoft Project 2021 sync in 3 steps:"
                      : "Cómo instalar el sincronizador en Microsoft Project 2021 en 3 pasos:"}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                      <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 font-black flex items-center justify-center text-xs">
                        1
                      </div>
                      <h5 className="font-bold text-slate-900">
                        {isEn ? "Open VBA Editor" : "Abrir Editor VBA"}
                      </h5>
                      <p className="text-slate-600">
                        {isEn ? (
                          <>
                            With your project open in MS Project Pro 2021, press{" "}
                            <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-300 font-mono text-[10px] font-bold">
                              Alt + F11
                            </kbd>
                            .
                          </>
                        ) : (
                          <>
                            En Microsoft Project Profesional 2021 con tu proyecto abierto, presiona{" "}
                            <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-300 font-mono text-[10px] font-bold">
                              Alt + F11
                            </kbd>
                            .
                          </>
                        )}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                      <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 font-black flex items-center justify-center text-xs">
                        2
                      </div>
                      <h5 className="font-bold text-slate-900">
                        {isEn ? "Insert Module" : "Insertar Módulo"}
                      </h5>
                      <p className="text-slate-600">
                        {isEn ? (
                          <>
                            Go to <strong>Insert → Module</strong> in the top menu and paste the copied VBA macro.
                          </>
                        ) : (
                          <>
                            En la barra de menús ve a <strong>Insertar → Módulo</strong>. Se abrirá una ventana en blanco; pega allí el código VBA copiado.
                          </>
                        )}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                      <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 font-black flex items-center justify-center text-xs">
                        3
                      </div>
                      <h5 className="font-bold text-slate-900">
                        {isEn ? "Save & Run" : "Guardar y Ejecutar"}
                      </h5>
                      <p className="text-slate-600">
                        {isEn ? (
                          <>
                            Close the editor (<kbd className="px-1 py-0.5 rounded bg-white border border-slate-300 font-mono text-[10px]">Alt + Q</kbd>). Press{" "}
                            <kbd className="px-1 py-0.5 rounded bg-white border border-slate-300 font-mono text-[10px] font-bold">Alt + F8</kbd>
                            , select <code>SincronizarJGMConTech</code>, and click <strong>Run</strong>.
                          </>
                        ) : (
                          <>
                            Cierra el editor (<kbd className="px-1 py-0.5 rounded bg-white border border-slate-300 font-mono text-[10px]">Alt + Q</kbd>). Presiona{" "}
                            <kbd className="px-1 py-0.5 rounded bg-white border border-slate-300 font-mono text-[10px] font-bold">Alt + F8</kbd>
                            , selecciona <code>SincronizarJGMConTech</code> y haz clic en <strong>Ejecutar</strong>.
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-4 space-y-1.5">
                    <p className="font-bold text-indigo-950 flex items-center gap-1.5">
                      <Lightbulb className="w-4 h-4 text-indigo-700 shrink-0" />
                      <span>
                        {isEn
                          ? "Pro Tip: 1-Click Ribbon Button in MS Project"
                          : "Tip Profesional: Botón de 1 Clic en la Cinta de Opciones de MS Project"}
                      </span>
                    </p>
                    <p className="text-indigo-900 leading-relaxed">
                      {isEn
                        ? "Right-click the MS Project Ribbon → Customize the Ribbon → Assign a custom macro button pointing to SincronizarJGMConTech so every schedule change syncs to the web S-Curve in one click."
                        : "Haz clic derecho sobre cualquier pestaña de MS Project → Personalizar la cinta de opciones → Crea un botón apuntando a la macro SincronizarJGMConTech para actualizar la Curva S web al instante."}
                    </p>
                  </div>
                </div>
              )}

              {activeApiTab === "prueba" && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">
                        {isEn ? "Official API Endpoint:" : "Endpoint Oficial de la API:"}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold font-mono text-[10px]">
                        POST · REST
                      </span>
                    </div>
                    <code className="block p-2 rounded bg-white border border-slate-200 font-mono text-slate-800 text-[11px] select-all">
                      https://jagm2000-jgmcontech.vercel.app/api/msproject-sync
                    </code>
                    <p className="text-slate-500 text-[11px]">
                      {isEn ? "Active target project:" : "Proyecto objetivo actual:"}{" "}
                      <strong>{proyecto.nombre}</strong> (<code>{proyecto.id}</code>)
                    </p>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      type="button"
                      onClick={handleTestApi}
                      disabled={testingApi}
                      className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition flex items-center gap-2 disabled:opacity-60 cursor-pointer shadow-sm"
                    >
                      {testingApi ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Activity className="w-4 h-4" />
                      )}
                      <span>
                        {testingApi
                          ? isEn
                            ? "Sending test payload..."
                            : "Enviando prueba a Supabase..."
                          : isEn
                          ? "Simulate MS Project Sync"
                          : "Simular Sincronización de MS Project"}
                      </span>
                    </button>
                    {testApiResult && (
                      <span
                        className={`font-bold text-xs inline-flex items-center gap-1.5 ${
                          testApiResult.ok ? "text-emerald-700" : "text-rose-700"
                        }`}
                      >
                        {testApiResult.ok ? (
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                        )}
                        <span>{testApiResult.message}</span>
                      </span>
                    )}
                  </div>

                  {Boolean(testApiResult?.details) && (
                    <div className="rounded-xl border border-slate-200 bg-slate-900 text-emerald-400 p-3 font-mono text-[11px] overflow-x-auto">
                      <pre>{JSON.stringify(testApiResult?.details, null, 2)}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <span>
                Microsoft Office Project Professional 2021 • Build 14334.20522
              </span>
              <div className="flex items-center gap-2">
                <a
                  href="/Cronograma_Prueba_Casa_Mendoza.xml"
                  download="Cronograma_Prueba_Casa_Mendoza.xml"
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition inline-flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>
                    {isEn ? "Download Sample XML" : "Descargar XML Prueba"}
                  </span>
                </a>
                <button
                  type="button"
                  onClick={() => setShowApiModal(false)}
                  className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-bold transition cursor-pointer"
                >
                  {isEn ? "Close" : "Cerrar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
