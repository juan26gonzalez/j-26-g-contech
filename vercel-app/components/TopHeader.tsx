"use client";

import React from "react";
import {
  AlertTriangle,
  Box,
  Calculator,
  Compass,
  ExternalLink,
  FileText,
  GanttChart,
  Globe,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Menu,
  Moon,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Radio,
  Receipt,
  ShieldCheck,
  Smartphone,
  Sun,
  User,
  Users,
  Wallet,
} from "lucide-react";
import { AppCurrency, useAppPreferences } from "../lib/i18n";
import { BITACORA_APP_URL } from "../lib/projects";
import { ConsolidationTotals, ProjectConfig, TabKey } from "../lib/types";

interface TopHeaderProps {
  proyecto: ProjectConfig;
  totals: ConsolidationTotals;
  activeTab: TabKey;
  onChangeTab: (tab: TabKey) => void;
  onOpenMenuMobile: () => void;
  sidebarCollapsed?: boolean;
  onToggleSidebarDesktop?: () => void;
  engineSource: "pandas" | "client-ts";
  userEmail?: string;
  isDemo?: boolean;
  onLogout?: () => void;
}

const TAB_ICONS: Record<TabKey, React.ComponentType<{ className?: string }>> = {
  panel: LayoutDashboard,
  visor3d: Box,
  habitaciones: LayoutGrid,
  presupuesto: Calculator,
  curva_s: GanttChart,
  insumos: Package,
  contratos: FileText,
  bitacora: Radio,
  rendimiento: Users,
  sst: ShieldCheck,
  mayores: AlertTriangle,
  actas: Receipt,
  nomina: Wallet,
};

const TAB_GROUPS: {
  groupKey:
    | "direction"
    | "bim3d"
    | "planning4d5d"
    | "field"
    | "controlBilling"
    | "erpFinance";
  keys: TabKey[];
}[] = [
  { groupKey: "direction", keys: ["panel"] },
  { groupKey: "bim3d", keys: ["visor3d", "habitaciones"] },
  {
    groupKey: "planning4d5d",
    keys: ["presupuesto", "curva_s", "insumos", "contratos"],
  },
  { groupKey: "field", keys: ["bitacora", "rendimiento", "sst"] },
  { groupKey: "controlBilling", keys: ["mayores", "actas"] },
  { groupKey: "erpFinance", keys: ["nomina"] },
];

export default function TopHeader({
  proyecto,
  totals,
  activeTab,
  onChangeTab,
  onOpenMenuMobile,
  sidebarCollapsed = false,
  onToggleSidebarDesktop,
  engineSource,
  userEmail,
  isDemo = false,
  onLogout,
}: TopHeaderProps) {
  const {
    lang,
    setLang,
    currency,
    setCurrency,
    unitSystem,
    rates,
    fxLive,
    fxSource,
    darkTheme,
    setDarkTheme,
    formatMoney,
    tr,
  } = useAppPreferences();

  const fxChipText =
    currency === "COP"
      ? `USD ${Math.round(rates.USD).toLocaleString("en-US")}`
      : currency === "USD"
      ? `1 USD = ${Math.round(rates.USD).toLocaleString("en-US")} COP`
      : `1 EUR = ${Math.round(rates.EUR).toLocaleString("en-US")} COP`;

  return (
    <div className="space-y-3.5">
      {/* Executive Header Banner */}
      <div className="steel-panel-dark relative overflow-hidden rounded-2xl text-white p-4 sm:p-6">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="space-y-2.5 min-w-0">
            {/* Top Controls & Status Bar */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={onOpenMenuMobile}
                className="lg:hidden inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 px-2.5 py-1 rounded-lg text-xs font-bold border border-white/20"
              >
                <Menu className="w-3.5 h-3.5" />
                <span>{tr.menuMobile}</span>
              </button>

              {onToggleSidebarDesktop && (
                <button
                  type="button"
                  onClick={onToggleSidebarDesktop}
                  title={
                    sidebarCollapsed
                      ? tr.toggleSidebarShow
                      : tr.toggleSidebarHide
                  }
                  className="hidden lg:inline-flex items-center gap-1.5 bg-slate-200/15 hover:bg-slate-200/25 border border-slate-300/35 text-slate-100 text-[11px] font-bold px-2.5 py-1 rounded-full transition-colors"
                >
                  {sidebarCollapsed ? (
                    <PanelLeftOpen className="w-3.5 h-3.5" />
                  ) : (
                    <PanelLeftClose className="w-3.5 h-3.5" />
                  )}
                </button>
              )}

              <span className="bg-slate-200/15 border border-slate-300/40 text-slate-100 text-[10px] sm:text-[11px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full">
                {proyecto.badge}
              </span>

              {isDemo ? (
                <span className="inline-flex items-center gap-1 bg-amber-400/20 border border-amber-300/50 text-amber-200 text-[10px] sm:text-[11px] font-bold px-2.5 py-1 rounded-full">
                  <Compass className="w-3 h-3" />
                  <span>{tr.demoSandboxBadge}</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px] sm:text-[11px] font-bold px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>
                    {tr.online} •{" "}
                    {engineSource === "pandas" ? "PANDAS ENGINE" : "FAST SYNC"}
                  </span>
                </span>
              )}

              <a
                href={BITACORA_APP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 bg-slate-100/15 hover:bg-slate-100/25 border border-slate-300/35 text-slate-50 text-[10px] sm:text-[11px] font-bold px-2.5 py-1 rounded-full transition-colors"
              >
                <Smartphone className="w-3 h-3" />
                <span>{tr.openBitacora}</span>
                <ExternalLink className="w-2.5 h-2.5 opacity-80" />
              </a>

              {/* International Switchers: Language + Units + Live FX Currency + Theme */}
              <div
                className="inline-flex items-center rounded-full bg-slate-900/65 border border-slate-400/35 p-0.5 text-[10px] font-bold"
                title={
                  lang === "en"
                    ? "Language: English • Measurement System: Imperial (ft², yd³, ft, lb)"
                    : "Idioma: Español • Sistema de Medidas: Métrico SI (m², m³, ml, kg)"
                }
              >
                <Globe className="w-3 h-3 text-slate-300 ml-1.5 mr-1" />
                {(["es", "en"] as const).map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setLang(code)}
                    className={`px-2 py-0.5 rounded-full uppercase transition-colors ${
                      lang === code
                        ? "bg-white text-slate-900"
                        : "text-slate-300 hover:text-white"
                    }`}
                  >
                    {code}
                  </button>
                ))}
                <span className="px-1.5 text-[9px] font-mono text-sky-300 border-l border-slate-600/70 ml-0.5">
                  {unitSystem === "imperial" ? "IMP" : "SI"}
                </span>
              </div>

              <div
                className="inline-flex items-center rounded-full bg-slate-900/65 border border-slate-400/35 p-0.5 text-[10px] font-bold"
                title={`${fxSource} • 1 USD = ${rates.USD.toLocaleString("en-US")} COP • 1 EUR = ${rates.EUR.toLocaleString("en-US")} COP`}
              >
                {(["COP", "USD", "EUR"] as AppCurrency[]).map((curr) => (
                  <button
                    key={curr}
                    type="button"
                    onClick={() => setCurrency(curr)}
                    className={`px-2 py-0.5 rounded-full transition-colors ${
                      currency === curr
                        ? "bg-emerald-400 text-slate-950 font-extrabold"
                        : "text-slate-300 hover:text-white"
                    }`}
                  >
                    {curr}
                  </button>
                ))}
                <span className="hidden sm:inline-flex items-center gap-1 pl-1.5 pr-2 text-[9px] font-mono text-emerald-200/90 border-l border-slate-600/70 ml-0.5">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      fxLive ? "bg-emerald-400" : "bg-amber-300"
                    }`}
                  />
                  {fxChipText}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setDarkTheme(!darkTheme)}
                title={
                  darkTheme
                    ? "Switch to Brushed Steel Light"
                    : "Switch to Dark Engineering Studio"
                }
                className="inline-flex items-center gap-1 bg-slate-900/65 hover:bg-slate-800 border border-slate-400/35 text-slate-200 text-[10px] sm:text-[11px] font-bold px-2.5 py-1 rounded-full transition-colors"
              >
                {darkTheme ? (
                  <Sun className="w-3 h-3 text-amber-300" />
                ) : (
                  <Moon className="w-3 h-3 text-sky-300" />
                )}
              </button>

              {userEmail && !isDemo && (
                <span
                  title={userEmail}
                  className="inline-flex items-center gap-1 bg-slate-900/50 border border-slate-400/35 text-slate-200 text-[10px] sm:text-[11px] font-semibold px-2.5 py-1 rounded-full"
                >
                  <User className="w-3 h-3" />
                  <span>{userEmail.split("@")[0]}</span>
                </span>
              )}

              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  title={isDemo ? tr.enterRealAccount : tr.signOut}
                  className={`inline-flex items-center gap-1 border text-[10px] sm:text-[11px] font-bold px-2.5 py-1 rounded-full transition-colors ${
                    isDemo
                      ? "bg-white/15 hover:bg-white/25 border-white/35 text-white"
                      : "bg-rose-500/20 hover:bg-rose-500/35 border-rose-400/40 text-rose-100"
                  }`}
                >
                  <LogOut className="w-3 h-3" />
                  <span>{isDemo ? tr.enterRealAccount : tr.signOut}</span>
                </button>
              )}
            </div>

            {/* Project Title Row */}
            <div className="flex items-center gap-3 pt-0.5">
              <img
                src="/logo-mark.png"
                alt="JGM ConTech"
                className="hidden sm:block w-12 h-12 rounded-xl border border-slate-300/50 shadow-md shrink-0"
              />
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight leading-snug text-white truncate">
                  {proyecto.nombre}
                </h1>
                <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
                  {tr.clientLabel}: <b>{proyecto.contratante}</b> &nbsp;|&nbsp;{" "}
                  {tr.directorLabel}: <b>{proyecto.contratista}</b> &nbsp;|&nbsp;{" "}
                  {tr.modelLabel}: <b>{proyecto.modelo_bim}</b>
                </p>
              </div>
            </div>
          </div>

          {/* Right Executive KPI Pills */}
          <div className="flex flex-wrap sm:flex-nowrap items-stretch gap-3 shrink-0">
            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-xl px-4 py-2.5 text-center min-w-[140px]">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
                {tr.weightedProgress}
              </div>
              <div className="text-xl sm:text-2xl font-extrabold font-mono text-white mt-0.5">
                {totals.avance_fisico_ponderado.toFixed(1)}%
              </div>
            </div>

            <div className="bg-emerald-500/20 backdrop-blur-md border border-emerald-400/35 rounded-xl px-4 py-2.5 text-center min-w-[165px]">
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-200">
                {tr.earnedCostDirect}
              </div>
              <div className="text-lg sm:text-xl font-extrabold font-mono text-emerald-300 mt-0.5">
                {formatMoney(totals.total_costo_ejecutado)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Ribbon Jerárquica Enterprise */}
      <nav
        aria-label="Módulos gerenciales BIM 5D"
        className="bento-card !p-2"
      >
        <div className="flex flex-wrap items-stretch gap-2">
          {TAB_GROUPS.map((grp) => (
            <div
              key={grp.groupKey}
              className="steel-subcard rounded-xl px-1.5 py-1 flex flex-col gap-1"
            >
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 px-1.5 leading-none pt-0.5">
                {tr.groups[grp.groupKey]}
              </span>
              <div className="flex flex-wrap items-center gap-1">
                {grp.keys.map((key) => {
                  const active = activeTab === key;
                  const Icon = TAB_ICONS[key];
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => onChangeTab(key)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all whitespace-nowrap ${
                        active
                          ? "steel-btn-primary text-white shadow-sm"
                          : "text-slate-700 hover:text-slate-950 hover:bg-slate-300/60"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span>{tr.tabs[key]}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </nav>
    </div>
  );
}
