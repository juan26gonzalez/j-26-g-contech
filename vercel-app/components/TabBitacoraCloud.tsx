"use client";

import React, { useState } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  ClipboardList,
  ClipboardPlus,
  Globe,
  Info,
  Loader2,
  Lock,
  Radio,
  Rocket,
  Smartphone,
  XCircle,
} from "lucide-react";
import {
  BITACORA_APP_URL,
  formatColombiaTimestamp,
  getColombiaNow,
  insertBitacoraCloud,
} from "../lib/projects";
import { BitacoraRow, ConsolidationResult, ProjectConfig } from "../lib/types";
import { useAppPreferences } from "../lib/i18n";
import { localizeActivity, localizeBitacoraObservacion } from "../lib/units";

interface TabBitacoraCloudProps {
  proyecto: ProjectConfig;
  data: ConsolidationResult;
  allCloudRows: BitacoraRow[];
  onSyncedReload: () => Promise<void>;
  isDemo?: boolean;
}

interface StatusBanner {
  type: "info" | "success" | "error";
  text: string;
}

function formatLocalizedActivity(raw: string, lang: "es" | "en"): string {
  const m = /^(\[[^\]]+\]\s*)(.*)$/.exec(raw || "");
  if (m) {
    return `${m[1]}${localizeActivity(m[2], lang)}`;
  }
  return localizeActivity(localizeBitacoraObservacion(raw || "", lang), lang);
}

export default function TabBitacoraCloud({
  proyecto,
  data,
  allCloudRows,
  onSyncedReload,
  isDemo = false,
}: TabBitacoraCloudProps) {
  const { lang, formatQty, unitLabel } = useAppPreferences();
  const isEn = lang === "en";

  const [actSeleccionada, setActSeleccionada] = useState(
    proyecto.ppto_base[0]?.Actividad || (isEn ? "General Site Progress" : "Avance General de Obra")
  );
  const [cantidad, setCantidad] = useState<number>(10);
  const [unidad, setUnidad] = useState<string>(
    proyecto.ppto_base[0]?.Unidad || "m²"
  );
  const [desperdicio, setDesperdicio] = useState<number>(2);
  const [submitting, setSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<StatusBanner | null>(null);
  const [showGlobalAudit, setShowGlobalAudit] = useState(false);

  React.useEffect(() => {
    const first = proyecto.ppto_base[0];
    if (first) {
      setActSeleccionada(first.Actividad);
      setUnidad(first.Unidad);
    }
  }, [proyecto.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDemo) {
      setStatusMsg({
        type: "info",
        text: isEn
          ? "LinkedIn Demo Mode (Read-Only): the cloud database is write-protected."
          : "Modo Demo LinkedIn (Solo lectura): la base de datos en la nube está protegida contra escritura.",
      });
      return;
    }
    if (cantidad <= 0) {
      setStatusMsg({
        type: "error",
        text: isEn ? "Quantity must be greater than 0." : "La cantidad debe ser mayor a 0.",
      });
      return;
    }
    setSubmitting(true);
    setStatusMsg(null);
    const { fechaStr } = getColombiaNow();
    const res = await insertBitacoraCloud({
      fecha: fechaStr,
      actividad: `[${proyecto.id}] ${actSeleccionada}`,
      unidad,
      cantidad,
      desperdicio,
    });
    if (res.ok) {
      setStatusMsg({
        type: "success",
        text: isEn
          ? "Field log entry saved to Supabase Cloud."
          : "Reporte registrado en Supabase Cloud correctamente.",
      });
      await onSyncedReload();
    } else {
      setStatusMsg({
        type: "error",
        text: isEn
          ? `Supabase save error: ${res.error}`
          : `Error al guardar en Supabase: ${res.error}`,
      });
    }
    setSubmitting(false);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bento-card flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              {isEn
                ? "Cloud Field Log & Direct Site Reporting"
                : "Bitácora Diaria Cloud & Registro Directo en Obra"}
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {isEn ? (
              <>
                Strict project isolation tagged with <code>[{proyecto.id}]</code> using Colombia official time (UTC-5).
              </>
            ) : (
              <>
                Aislamiento estricto por proyecto con etiqueta <code>[{proyecto.id}]</code> en hora oficial Colombia (UTC-5).
              </>
            )}
          </p>
        </div>

        <a
          href={BITACORA_APP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center gap-1.5"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>{isEn ? "Open Site Resident App" : "Abrir App Móvil de Residentes"}</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Form POST to Supabase */}
      <form onSubmit={handleSubmit} className="bento-card space-y-3 text-xs">
        <div className="font-extrabold text-slate-800 flex items-center gap-2">
          <ClipboardPlus className="w-4 h-4 text-slate-700" />
          <span>
            {isEn
              ? `Log New Daily Progress to Supabase (${proyecto.nombre})`
              : `Registrar Nuevo Avance Diario en Supabase (${proyecto.nombre})`}
          </span>
        </div>

        {statusMsg && (
          <div
            className={`rounded-xl px-4 py-2.5 font-bold border flex items-center gap-2 ${
              statusMsg.type === "error"
                ? "bg-red-50 border-red-200 text-red-700"
                : statusMsg.type === "info"
                ? "bg-amber-50 border-amber-200 text-amber-800"
                : "bg-emerald-50 border-emerald-200 text-emerald-800"
            }`}
          >
            {statusMsg.type === "error" ? (
              <XCircle className="w-4 h-4 shrink-0" />
            ) : statusMsg.type === "info" ? (
              <Info className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-5">
            <label className="block font-bold text-slate-700 mb-1">
              {isEn ? "Work Activity" : "Actividad Constructiva"}
            </label>
            <select
              value={actSeleccionada}
              onChange={(e) => {
                const val = e.target.value;
                setActSeleccionada(val);
                const found = proyecto.ppto_base.find((p) => p.Actividad === val);
                if (found) setUnidad(found.Unidad);
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-slate-50 font-semibold"
            >
              {proyecto.ppto_base.map((p) => (
                <option key={p.Item} value={p.Actividad}>
                  [{p.Item}] {localizeActivity(p.Actividad, lang)}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block font-bold text-slate-700 mb-1">
              {isEn ? "Quantity (Base)" : "Cantidad"}
            </label>
            <input
              type="number"
              step="0.01"
              value={cantidad}
              onChange={(e) => setCantidad(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono font-bold"
            />
          </div>
          <div className="md:col-span-1">
            <label className="block font-bold text-slate-700 mb-1">
              {isEn ? "Unit" : "Und"}
            </label>
            <input
              value={unidad}
              onChange={(e) => setUnidad(e.target.value)}
              title={isEn ? `Display unit: ${unitLabel(unidad)}` : undefined}
              className="w-full rounded-lg border border-slate-300 px-2 py-2 text-center font-mono"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block font-bold text-slate-700 mb-1">
              {isEn ? "Waste (%)" : "Desperdicio (%)"}
            </label>
            <input
              type="number"
              step="0.5"
              value={desperdicio}
              onChange={(e) => setDesperdicio(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono"
            />
          </div>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={submitting || isDemo}
              title={
                isDemo
                  ? isEn
                    ? "Read-only Demo Mode"
                    : "Modo Demo de solo lectura"
                  : undefined
              }
              className={`w-full steel-btn-primary font-extrabold py-2.5 px-3 rounded-xl inline-flex items-center justify-center gap-1.5 ${
                isDemo ? "opacity-55 cursor-not-allowed" : ""
              }`}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{isEn ? "Saving..." : "Enviando..."}</span>
                </>
              ) : isDemo ? (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>{isEn ? "Read-Only" : "Solo Lectura"}</span>
                </>
              ) : (
                <>
                  <Rocket className="w-3.5 h-3.5" />
                  <span>{isEn ? "Send to Cloud" : "Enviar Cloud"}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Isolated Project Table */}
      <div className="bento-card space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-slate-700" />
            <span>
              {isEn
                ? `Active Project Logs (${data.obra_activa.length})`
                : `Registros del Proyecto Activo (${data.obra_activa.length})`}
            </span>
          </h3>
          <button
            type="button"
            onClick={() => setShowGlobalAudit((v) => !v)}
            className="text-xs font-bold text-slate-800 hover:text-slate-950 hover:underline"
          >
            {showGlobalAudit
              ? isEn
                ? "Hide Global Audit"
                : "Ocultar Auditoría Global"
              : isEn
              ? `View Global Audit (${allCloudRows.length} logs)`
              : `Ver Auditoría Global (${allCloudRows.length} registros)`}
          </button>
        </div>

        {data.obra_activa.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            {isEn ? (
              <>
                No logs recorded for <b>{proyecto.nombre}</b> in Supabase yet.
              </>
            ) : (
              <>
                Sin reportes registrados para <b>{proyecto.nombre}</b> en Supabase todavía.
              </>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto max-h-80">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-900 text-white font-bold sticky top-0">
                <tr>
                  <th className="p-2.5">ID</th>
                  <th className="p-2.5">
                    {isEn ? "Date & Time (COL UTC-5)" : "Fecha y Hora (Colombia)"}
                  </th>
                  <th className="p-2.5">{isEn ? "Activity" : "Actividad"}</th>
                  <th className="p-2.5 text-right">{isEn ? "Quantity" : "Cantidad"}</th>
                  <th className="p-2.5 text-center">{isEn ? "Unit" : "Und"}</th>
                  <th className="p-2.5 text-right">{isEn ? "Waste" : "Desperdicio"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.obra_activa.map((r, i) => {
                  const rawUnit = r.unidad || "und";
                  return (
                    <tr key={r.id ?? i} className="hover:bg-slate-50">
                      <td className="p-2 font-mono text-slate-500">#{r.id ?? "-"}</td>
                      <td className="p-2 font-mono text-slate-700">
                        {formatColombiaTimestamp(r.created_at, r.fecha)}
                      </td>
                      <td className="p-2 font-semibold text-slate-900">
                        {formatLocalizedActivity(r.actividad, lang)}
                      </td>
                      <td className="p-2 text-right font-mono font-bold text-slate-900">
                        {formatQty(Number(r.cantidad || 0), rawUnit, 2)}
                      </td>
                      <td className="p-2 text-center font-mono">
                        {unitLabel(rawUnit)}
                      </td>
                      <td className="p-2 text-right font-mono">{r.desperdicio ?? 0}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Global Audit */}
      {showGlobalAudit && (
        <div className="bento-card space-y-2 border border-slate-300 bg-slate-50">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-2">
            <Globe className="w-3.5 h-3.5 text-slate-600" />
            <span>
              {isEn
                ? `Unfiltered Global Audit (${allCloudRows.length} logs in Supabase)`
                : `Auditoría Global Sin Filtrar (${allCloudRows.length} registros en Supabase)`}
            </span>
          </h3>
          <div className="overflow-x-auto max-h-64 bg-white rounded-xl border border-slate-200">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0">
                <tr>
                  <th className="p-2">ID</th>
                  <th className="p-2">{isEn ? "Date" : "Fecha"}</th>
                  <th className="p-2">{isEn ? "Raw / Tagged Activity" : "Actividad Cruda"}</th>
                  <th className="p-2 text-right">{isEn ? "Quantity" : "Cantidad"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allCloudRows.slice(0, 60).map((r, i) => (
                  <tr key={r.id ?? i}>
                    <td className="p-2 font-mono text-slate-500">#{r.id}</td>
                    <td className="p-2 font-mono">{r.fecha}</td>
                    <td className="p-2">{formatLocalizedActivity(r.actividad, lang)}</td>
                    <td className="p-2 text-right font-mono font-bold">
                      {formatQty(Number(r.cantidad || 0), r.unidad || "und", 2)}{" "}
                      <span className="text-[10px] text-slate-500">{unitLabel(r.unidad || "und")}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
