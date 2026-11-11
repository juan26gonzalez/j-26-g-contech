"use client";

import React, { useRef } from "react";
import { BITACORA_APP_URL } from "../lib/projects";
import { LiquidationParams, ProjectConfig } from "../lib/types";

interface SidebarProps {
  proyectos: Record<string, ProjectConfig>;
  proyectoActivoId: string;
  onSelectProyecto: (id: string) => void;
  onOpenNewModal: () => void;
  onDeleteCustomProyecto: (id: string) => void;
  onExportBackup: () => void;
  onImportBackup: (file: File) => void;
  onSyncCloud: () => void;
  syncing: boolean;
  totalRegistrosCloud: number;
  engineStatus: "pandas" | "client-ts" | "checking";
  params: LiquidationParams;
  onChangeParams: (next: LiquidationParams) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export default function Sidebar({
  proyectos,
  proyectoActivoId,
  onSelectProyecto,
  onOpenNewModal,
  onDeleteCustomProyecto,
  onExportBackup,
  onImportBackup,
  onSyncCloud,
  syncing,
  totalRegistrosCloud,
  engineStatus,
  params,
  onChangeParams,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const importInputRef = useRef<HTMLInputElement>(null);
  const proyectoActual = proyectos[proyectoActivoId] || Object.values(proyectos)[0];

  const getOptionLabel = (p: ProjectConfig) => {
    if (p.id === "casa_mendoza") return "🏡 Remodelación Casa Mendoza (Sabanalarga • Revit 1.1)";
    if (p.id === "mezzanine") return "🏢 Mezzanine 3 Niveles (DOLMEN S.A. • Barranquilla)";
    const icon = p.tipo === "presupuesto" ? "📋" : p.logo || "🏗️";
    return `${icon} ${p.nombre} (${p.contratante})`;
  };

  const handleSlider = (key: keyof LiquidationParams, value: number) => {
    onChangeParams({ ...params, [key]: value });
  };

  const content = (
    <div className="flex flex-col h-full bg-gradient-to-b from-slate-100/95 via-slate-200/90 to-slate-100/95 backdrop-blur-md border-r border-slate-300 px-4 py-5 overflow-y-auto select-none">
      {/* Brand Header */}
      <div className="steel-panel-dark rounded-2xl p-4 text-white mb-4">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/logo-mark.png"
              alt="JGM ConTech Gerencia"
              className="w-11 h-11 rounded-xl shadow-md border border-slate-300/60 shrink-0"
            />
            <div className="min-w-0">
              <div className="text-[17px] font-extrabold tracking-tight leading-none truncate text-slate-50">
                JGM ConTech
              </div>
              <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-slate-300 mt-1">
                Gerencia BIM 5D
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden text-slate-300 hover:text-white p-1"
            aria-label="Cerrar menú"
          >
            ✕
          </button>
        </div>
        <div className="flex items-center justify-between pt-2.5 border-t border-white/10 text-[10px] font-bold">
          <span className="text-emerald-300 tracking-wide">
            {engineStatus === "pandas"
              ? "🐼 PYTHON PANDAS + VERCEL"
              : engineStatus === "checking"
              ? "⏳ CONECTANDO PYTHON..."
              : "⚡ MODO RÁPIDO JS/TS"}
          </span>
          <span className="text-slate-300 font-mono">v5D</span>
        </div>
      </div>

      {/* Bitácora Quick Link */}
      <a
        href={BITACORA_APP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full mb-4 flex items-center justify-center gap-2 steel-btn-primary text-white text-xs font-bold py-2.5 px-3 rounded-xl"
      >
        <span>📱</span>
        <span>Abrir Bitácora de Campo</span>
        <span>↗</span>
      </a>

      {/* Project Selector */}
      <div className="mb-3">
        <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600 mb-1.5">
          🏗️ Portafolio de Proyectos
        </div>
        <select
          value={proyectoActivoId}
          onChange={(e) => {
            onSelectProyecto(e.target.value);
            onCloseMobile();
          }}
          className="w-full rounded-xl border border-slate-300 bg-white/90 px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-600"
        >
          {Object.values(proyectos).map((p) => (
            <option key={p.id} value={p.id}>
              {getOptionLabel(p)}
            </option>
          ))}
        </select>
      </div>

      {/* Active Project Card */}
      {proyectoActual && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-3 text-xs space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-800 bg-slate-200/80 px-2 py-0.5 rounded-full border border-slate-400/70">
              {proyectoActual.tipo === "presupuesto"
                ? "Solo Presupuesto"
                : "Modo BIM 5D"}
            </span>
            <span className="text-[10px] font-mono font-bold text-slate-500">
              {proyectoActual.ppto_base?.length || 0} ítems
            </span>
          </div>
          <div className="text-[12px] font-bold text-slate-900 pt-1">
            {proyectoActual.contratante}
          </div>
          <div className="text-[11px] text-slate-600">
            📍 {proyectoActual.ubicacion}
          </div>
        </div>
      )}

      {/* Action Buttons: Nuevo / Eliminar / Respaldo */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <button
          type="button"
          onClick={onOpenNewModal}
          className="flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-2 px-2.5 rounded-xl transition-colors"
        >
          <span>➕</span>
          <span>Nuevo</span>
        </button>

        {proyectoActual?.isCustom ? (
          <button
            type="button"
            onClick={() => onDeleteCustomProyecto(proyectoActual.id)}
            className="flex items-center justify-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold py-2 px-2.5 rounded-xl transition-colors"
          >
            <span>🗑️</span>
            <span>Eliminar</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onExportBackup}
            className="flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-bold py-2 px-2.5 rounded-xl transition-colors"
            title="Descargar copia JSON de proyectos personalizados"
          >
            <span>📤</span>
            <span>Respaldo</span>
          </button>
        )}
      </div>

      {/* Extra backup controls when custom active or import needed */}
      <div className="flex gap-2 mb-4">
        {proyectoActual?.isCustom && (
          <button
            type="button"
            onClick={onExportBackup}
            className="flex-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 py-1.5 px-2 rounded-lg border border-slate-200"
          >
            📤 Exportar JSON
          </button>
        )}
        <button
          type="button"
          onClick={() => importInputRef.current?.click()}
          className="flex-1 text-[11px] font-semibold bg-slate-50 hover:bg-slate-100 text-slate-700 py-1.5 px-2 rounded-lg border border-slate-200"
        >
          📥 Restaurar JSON
        </button>
        <input
          ref={importInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onImportBackup(f);
            e.target.value = "";
          }}
        />
      </div>

      {/* Cloud Sync Box */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-4">
        <div className="flex items-center justify-between text-xs font-bold text-emerald-900">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Supabase Cloud
          </span>
          <span className="font-mono bg-white px-2 py-0.5 rounded-md border border-emerald-200 text-emerald-700">
            {totalRegistrosCloud} reg.
          </span>
        </div>
        <button
          type="button"
          onClick={onSyncCloud}
          disabled={syncing}
          className="mt-2.5 w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-bold py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1.5"
        >
          <span>{syncing ? "⏳" : "🔄"}</span>
          <span>{syncing ? "Sincronizando..." : "Sincronizar en Vivo"}</span>
        </button>
      </div>

      {/* Liquidation Sliders */}
      <div className="border-t border-slate-200 pt-3.5 space-y-3">
        <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
          📐 Parámetros AIU & Retenciones
        </div>

        {(
          [
            { key: "pct_a", label: "% Administración (A)", min: 0, max: 20, step: 0.5 },
            { key: "pct_i", label: "% Imprevistos (I)", min: 0, max: 10, step: 0.5 },
            { key: "pct_u", label: "% Utilidad (U)", min: 0, max: 15, step: 0.5 },
            { key: "pct_anticipo", label: "% Amortización Anticipo", min: 0, max: 50, step: 1 },
            { key: "pct_garantia", label: "% Retención en Garantía", min: 0, max: 15, step: 0.5 },
          ] as const
        ).map((s) => (
          <div key={s.key} className="space-y-1">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700">
              <span>{s.label}</span>
              <span className="font-mono font-bold text-slate-900">
                {params[s.key].toFixed(s.step < 1 ? 1 : 0)}%
              </span>
            </div>
            <input
              type="range"
              min={s.min}
              max={s.max}
              step={s.step}
              value={params[s.key]}
              onChange={(e) => handleSlider(s.key, Number(e.target.value))}
              className="w-full h-1.5 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-slate-800"
            />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop persistent sidebar */}
      <aside className="hidden lg:block w-[305px] shrink-0 sticky top-0 h-screen">
        {content}
      </aside>

      {/* Mobile slide-over drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={onCloseMobile}
          />
          <div className="relative w-[305px] max-w-[85vw] h-full z-10 shadow-2xl">
            {content}
          </div>
        </div>
      )}
    </>
  );
}
