"use client";

import React from "react";
import { BITACORA_APP_URL, formatCOP } from "../lib/projects";
import { ConsolidationTotals, ProjectConfig, TabKey } from "../lib/types";

interface TopHeaderProps {
  proyecto: ProjectConfig;
  totals: ConsolidationTotals;
  activeTab: TabKey;
  onChangeTab: (tab: TabKey) => void;
  onOpenMenuMobile: () => void;
  engineSource: "pandas" | "client-ts";
}

const TABS: { key: TabKey; label: string }[] = [
  { key: "panel", label: "🏠 Panel Ejecutivo" },
  { key: "habitaciones", label: "🏠 Habitaciones & Caja" },
  { key: "visor3d", label: "🧊 Visor 3D BIM" },
  { key: "presupuesto", label: "💰 Presupuesto 5D (APU)" },
  { key: "contratos", label: "📜 Contratos PDF" },
  { key: "actas", label: "📑 Actas de Corte & Cobro" },
  { key: "mayores", label: "⚠️ Mayores Cantidades & Adicionales" },
  { key: "rendimiento", label: "👥 Rendimiento & Cuadrillas" },
  { key: "curva_s", label: "📈 Curva S & Plazo 4D" },
  { key: "insumos", label: "🧱 Insumos BIM" },
  { key: "bitacora", label: "📡 Bitácora Cloud" },
];

export default function TopHeader({
  proyecto,
  totals,
  activeTab,
  onChangeTab,
  onOpenMenuMobile,
  engineSource,
}: TopHeaderProps) {
  return (
    <div className="space-y-4">
      {/* Executive Header Banner */}
      <div className="steel-panel-dark relative overflow-hidden rounded-2xl text-white p-5 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onOpenMenuMobile}
                className="lg:hidden inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 px-2.5 py-1 rounded-lg text-xs font-bold border border-white/20"
              >
                ☰ Menú
              </button>
              <span className="bg-slate-200/15 border border-slate-300/40 text-slate-100 text-[11px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full">
                {proyecto.badge}
              </span>
              <span className="bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[11px] font-bold px-2.5 py-1 rounded-full">
                ● EN LÍNEA • {engineSource === "pandas" ? "PANDAS ENGINE" : "FAST SYNC"}
              </span>
              <a
                href={BITACORA_APP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-slate-100/15 hover:bg-slate-100/25 border border-slate-300/35 text-slate-50 text-[11px] font-bold px-2.5 py-1 rounded-full transition-colors"
              >
                📱 Ir a Bitácora App ↗
              </a>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <img
                src="/logo-mark.png"
                alt="JGM ConTech"
                className="hidden sm:block w-12 h-12 rounded-xl border border-slate-300/50 shadow-md shrink-0"
              />
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight leading-snug text-white">
                  {proyecto.logo} {proyecto.nombre}
                </h1>
                <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
                  Contratante: <b>{proyecto.contratante}</b> &nbsp;|&nbsp; Dir. Técnica:{" "}
                  <b>{proyecto.contratista}</b> &nbsp;|&nbsp; Modelo:{" "}
                  <b>{proyecto.modelo_bim}</b>
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-stretch gap-3 shrink-0">
            <div className="bg-gradient-to-br from-slate-200/15 to-slate-400/10 backdrop-blur-md border border-slate-300/30 rounded-xl px-4 py-2.5 text-center min-w-[125px] shadow-inner">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
                Avance Físico Pond.
              </div>
              <div className="text-xl sm:text-2xl font-extrabold font-mono text-white mt-0.5">
                {totals.avance_fisico_ponderado.toFixed(1)}%
              </div>
            </div>

            <div className="bg-emerald-500/20 backdrop-blur-md border border-emerald-400/35 rounded-xl px-4 py-2.5 text-center min-w-[155px]">
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-200">
                Costo Causado (Dir.)
              </div>
              <div className="text-lg sm:text-xl font-extrabold font-mono text-emerald-300 mt-0.5">
                {formatCOP(totals.total_costo_ejecutado)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Pills (9 modules) */}
      <div className="bento-card !p-1.5 overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max">
          {TABS.map((t) => {
            const active = activeTab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => onChangeTab(t.key)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  active
                    ? "steel-btn-primary text-white shadow-sm"
                    : "text-slate-700 hover:text-slate-950 hover:bg-slate-200/75"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
