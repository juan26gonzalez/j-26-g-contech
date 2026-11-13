"use client";

import React, { useState } from "react";
import {
  BITACORA_APP_URL,
  formatColombiaTimestamp,
  getColombiaNow,
  insertBitacoraCloud,
} from "../lib/projects";
import { BitacoraRow, ConsolidationResult, ProjectConfig } from "../lib/types";

interface TabBitacoraCloudProps {
  proyecto: ProjectConfig;
  data: ConsolidationResult;
  allCloudRows: BitacoraRow[];
  onSyncedReload: () => Promise<void>;
  isDemo?: boolean;
}

export default function TabBitacoraCloud({
  proyecto,
  data,
  allCloudRows,
  onSyncedReload,
  isDemo = false,
}: TabBitacoraCloudProps) {
  const [actSeleccionada, setActSeleccionada] = useState(
    proyecto.ppto_base[0]?.Actividad || "Avance General de Obra"
  );
  const [cantidad, setCantidad] = useState<number>(10);
  const [unidad, setUnidad] = useState<string>(
    proyecto.ppto_base[0]?.Unidad || "m²"
  );
  const [desperdicio, setDesperdicio] = useState<number>(2);
  const [submitting, setSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
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
      setStatusMsg(
        "ℹ️ Modo Demo LinkedIn (Solo lectura): la base de datos en la nube está protegida contra escritura."
      );
      return;
    }
    if (cantidad <= 0) {
      setStatusMsg("❌ La cantidad debe ser mayor a 0.");
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
      setStatusMsg("✅ Reporte registrado en Supabase Cloud correctamente.");
      await onSyncedReload();
    } else {
      setStatusMsg(`❌ Error al guardar en Supabase: ${res.error}`);
    }
    setSubmitting(false);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bento-card flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-extrabold text-slate-900">
            📡 Bitácora Diaria Cloud & Registro Directo en Obra
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Aislamiento estricto por proyecto con etiqueta <code>[{proyecto.id}]</code> en hora oficial Colombia (UTC-5).
          </p>
        </div>

        <a
          href={BITACORA_APP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold"
        >
          📱 Abrir App Móvil de Residentes ↗
        </a>
      </div>

      {/* Form POST to Supabase */}
      <form onSubmit={handleSubmit} className="bento-card space-y-3 text-xs">
        <div className="font-extrabold text-slate-800">
          📝 Registrar Nuevo Avance Diario en Supabase ({proyecto.nombre})
        </div>

        {statusMsg && (
          <div
            className={`rounded-xl px-4 py-2.5 font-bold border ${
              statusMsg.startsWith("❌")
                ? "bg-red-50 border-red-200 text-red-700"
                : "bg-emerald-50 border-emerald-200 text-emerald-800"
            }`}
          >
            {statusMsg}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-5">
            <label className="block font-bold text-slate-700 mb-1">
              Actividad Constructiva
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
                  [{p.Item}] {p.Actividad}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block font-bold text-slate-700 mb-1">Cantidad</label>
            <input
              type="number"
              step="0.01"
              value={cantidad}
              onChange={(e) => setCantidad(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono font-bold"
            />
          </div>
          <div className="md:col-span-1">
            <label className="block font-bold text-slate-700 mb-1">Und</label>
            <input
              value={unidad}
              onChange={(e) => setUnidad(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-2 py-2 text-center font-mono"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block font-bold text-slate-700 mb-1">Desperdicio (%)</label>
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
              title={isDemo ? "Modo Demo de solo lectura" : undefined}
              className={`w-full steel-btn-primary font-extrabold py-2.5 px-3 rounded-xl ${
                isDemo ? "opacity-55 cursor-not-allowed" : ""
              }`}
            >
              {submitting ? "⏳..." : isDemo ? "🔒 Solo Lectura" : "🚀 Enviar Cloud"}
            </button>
          </div>
        </div>
      </form>

      {/* Isolated Project Table */}
      <div className="bento-card space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-slate-900">
            📋 Registros del Proyecto Activo ({data.obra_activa.length})
          </h3>
          <button
            type="button"
            onClick={() => setShowGlobalAudit((v) => !v)}
            className="text-xs font-bold text-slate-800 hover:text-slate-950 hover:underline"
          >
            {showGlobalAudit
              ? "Ocultar Auditoría Global"
              : `Ver Auditoría Global (${allCloudRows.length} registros)`}
          </button>
        </div>

        {data.obra_activa.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            Sin reportes registrados para <b>{proyecto.nombre}</b> en Supabase todavía.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-80">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-900 text-white font-bold sticky top-0">
                <tr>
                  <th className="p-2.5">ID</th>
                  <th className="p-2.5">Fecha y Hora (Colombia)</th>
                  <th className="p-2.5">Actividad</th>
                  <th className="p-2.5 text-right">Cantidad</th>
                  <th className="p-2.5 text-center">Und</th>
                  <th className="p-2.5 text-right">Desperdicio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.obra_activa.map((r, i) => (
                  <tr key={r.id ?? i} className="hover:bg-slate-50">
                    <td className="p-2 font-mono text-slate-500">#{r.id ?? "-"}</td>
                    <td className="p-2 font-mono text-slate-700">
                      {formatColombiaTimestamp(r.created_at, r.fecha)}
                    </td>
                    <td className="p-2 font-semibold text-slate-900">{r.actividad}</td>
                    <td className="p-2 text-right font-mono font-bold text-slate-900">
                      {r.cantidad}
                    </td>
                    <td className="p-2 text-center">{r.unidad || "und"}</td>
                    <td className="p-2 text-right font-mono">{r.desperdicio ?? 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Global Audit */}
      {showGlobalAudit && (
        <div className="bento-card space-y-2 border border-slate-300 bg-slate-50">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
            🌐 Auditoría Global Sin Filtrar ({allCloudRows.length} registros en Supabase)
          </h3>
          <div className="overflow-x-auto max-h-64 bg-white rounded-xl border border-slate-200">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0">
                <tr>
                  <th className="p-2">ID</th>
                  <th className="p-2">Fecha</th>
                  <th className="p-2">Actividad Cruda</th>
                  <th className="p-2 text-right">Cantidad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allCloudRows.slice(0, 60).map((r, i) => (
                  <tr key={r.id ?? i}>
                    <td className="p-2 font-mono text-slate-500">#{r.id}</td>
                    <td className="p-2 font-mono">{r.fecha}</td>
                    <td className="p-2">{r.actividad}</td>
                    <td className="p-2 text-right font-mono font-bold">{r.cantidad}</td>
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
