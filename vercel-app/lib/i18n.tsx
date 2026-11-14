"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { TabKey } from "./types";
import {
  convertQty,
  convertUnitLabel,
  convertUnitPriceCopToDisplay,
  getUnitSystem,
  UnitSystem,
} from "./units";

export type AppLang = "es" | "en";
export type AppCurrency = "COP" | "USD" | "EUR";

// Tasas base de respaldo si la consulta de mercado en tiempo real no responde
export const EXCHANGE_RATES_COP: Record<AppCurrency, number> = {
  COP: 1,
  USD: 4350,
  EUR: 4680,
};

const PREFS_STORAGE_KEY = "jgm_contech_ui_prefs_v1";

interface AppPreferencesValue {
  lang: AppLang;
  setLang: (lang: AppLang) => void;
  currency: AppCurrency;
  setCurrency: (currency: AppCurrency) => void;
  unitSystem: UnitSystem;
  rates: Record<AppCurrency, number>;
  fxLive: boolean;
  fxSource: string;
  fxUpdatedAt: string;
  darkTheme: boolean;
  setDarkTheme: (dark: boolean) => void;
  formatMoney: (amountCop: number, decimals?: number) => string;
  formatConvertedMoney: (amountInActiveCurrency: number, decimals?: number) => string;
  formatUnitMoney: (priceCopPerMetricUnit: number, metricUnit?: string) => string;
  formatQty: (qtyMetric: number, metricUnit?: string, decimals?: number) => string;
  convertQtyValue: (qtyMetric: number, metricUnit?: string) => number;
  unitLabel: (metricUnit?: string) => string;
  formatCompactChartMoney: (amountCop: number) => number;
  chartUnitSuffix: string;
  docOpts: {
    lang: AppLang;
    currency: AppCurrency;
    unit_system: UnitSystem;
    fx_rate: number;
    cop_per_usd: number;
    cop_per_eur: number;
  };
  tr: Translations;
}

export interface Translations {
  // Generales & Header
  appSubtitle: string;
  appSlogan: string;
  online: string;
  demoSandboxBadge: string;
  openBitacora: string;
  signOut: string;
  enterRealAccount: string;
  menuMobile: string;
  toggleSidebarHide: string;
  toggleSidebarShow: string;
  clientLabel: string;
  directorLabel: string;
  modelLabel: string;
  weightedProgress: string;
  earnedCostDirect: string;
  // Grupos & Tabs
  groups: {
    direction: string;
    bim3d: string;
    planning4d5d: string;
    field: string;
    controlBilling: string;
    erpFinance: string;
  };
  tabs: Record<TabKey, string>;
  // Sidebar
  sidebar: {
    openFieldApp: string;
    portfolio: string;
    modeBudgetOnly: string;
    modeBim5d: string;
    itemsCount: string;
    newBtn: string;
    deleteBtn: string;
    backupBtn: string;
    exportJson: string;
    restoreJson: string;
    cloudLabel: string;
    demoLocalLabel: string;
    recordsShort: string;
    syncNow: string;
    syncing: string;
    aiuTitle: string;
    pctA: string;
    pctI: string;
    pctU: string;
    pctAnt: string;
    pctGar: string;
    standardsFooter: string;
  };
  // Panel Ejecutivo
  exec: {
    kpiBaseDirect: string;
    kpiExecDirect: string;
    kpiRemaining: string;
    kpiOverruns: string;
    withAiu: string;
    financialPct: string;
    contractAvailable: string;
    overrunNeeded: string;
    noOverruns: string;
    physicalProgressTitle: string;
    completedLabel: string;
    chartTitle: string;
    chartSub: string;
    barBudget: string;
    barExec: string;
    chapterTableTitle: string;
    chapterTableSub: string;
    colChapter: string;
    colBudget: string;
    colExecuted: string;
    colPct: string;
    standardsStripTitle: string;
    exchangeDisclaimer: string;
  };
  // Login
  login: {
    securityBadge: string;
    subtitle: string;
    helperLogin: string;
    helperRecovery: string;
    emailLabel: string;
    passwordLabel: string;
    rememberEmail: string;
    forgotPassword: string;
    signInBtn: string;
    signingInBtn: string;
    sendRecoveryBtn: string;
    sendingRecoveryBtn: string;
    backToLogin: string;
    demoDivider: string;
    demoBtn: string;
    demoHint: string;
    openBitacoraLink: string;
    footerNote: string;
  };
}

const ES_TR: Translations = {
  appSubtitle: "Gerencia BIM 5D",
  appSlogan: "Dirección técnica y financiera de obra civil en tiempo real.",
  online: "EN LÍNEA",
  demoSandboxBadge: "DEMO LINKEDIN (SOLO LECTURA)",
  openBitacora: "Ir a Bitácora App",
  signOut: "Salir",
  enterRealAccount: "Iniciar Sesión",
  menuMobile: "Menú",
  toggleSidebarHide: "Ocultar panel lateral (Vista Panorámica)",
  toggleSidebarShow: "Mostrar panel lateral",
  clientLabel: "Contratante",
  directorLabel: "Dir. Técnica",
  modelLabel: "Modelo",
  weightedProgress: "Avance Físico Pond.",
  earnedCostDirect: "Costo Causado (Dir.)",
  groups: {
    direction: "1. Dirección",
    bim3d: "2. BIM 3D",
    planning4d5d: "3. Planeación 4D/5D",
    field: "4. Campo & SST",
    controlBilling: "5. Control & Cobro",
    erpFinance: "6. ERP & Finanzas",
  },
  tabs: {
    panel: "Panel Ejecutivo",
    visor3d: "Visor 3D BIM",
    habitaciones: "Habitaciones & Caja",
    presupuesto: "Presupuesto 5D (APU)",
    curva_s: "Curva S & Plazo 4D",
    insumos: "Insumos BIM",
    contratos: "Contratos PDF",
    bitacora: "Bitácora Cloud",
    rendimiento: "Rendimiento & Cuadrillas",
    sst: "Seguridad & SST",
    mayores: "Mayores Cant. & Adicionales",
    actas: "Actas de Corte & Cobro",
    nomina: "Pago de Nómina",
    proveedores: "Proveedores & OC",
    clientes: "Clientes & Cartera",
  },
  sidebar: {
    openFieldApp: "Abrir Bitácora de Campo",
    portfolio: "Portafolio de Proyectos",
    modeBudgetOnly: "Solo Presupuesto",
    modeBim5d: "Modo BIM 5D",
    itemsCount: "ítems",
    newBtn: "Nuevo",
    deleteBtn: "Eliminar",
    backupBtn: "Respaldo",
    exportJson: "Exportar JSON",
    restoreJson: "Restaurar JSON",
    cloudLabel: "Supabase Cloud",
    demoLocalLabel: "Sandbox Demo Cloud",
    recordsShort: "reg.",
    syncNow: "Sincronizar en Vivo",
    syncing: "Sincronizando...",
    aiuTitle: "Parámetros AIU & Retenciones",
    pctA: "% Administración (A)",
    pctI: "% Imprevistos (I)",
    pctU: "% Utilidad (U)",
    pctAnt: "% Amortización Anticipo",
    pctGar: "% Retención en Garantía",
    standardsFooter: "ISO 19650 • OpenBIM IFC • PMI EVM 5D",
  },
  exec: {
    kpiBaseDirect: "Presupuesto Base Directo",
    kpiExecDirect: "Ejecutado Acumulado (Dir.)",
    kpiRemaining: "Saldo por Ejecutar (Dir.)",
    kpiOverruns: "Alertas Mayores Cantidades",
    withAiu: "+ AIU",
    financialPct: "financiero",
    contractAvailable: "Disponible contractual",
    overrunNeeded: "Requiere Acta de Adicional",
    noOverruns: "Sin excedentes fuera de contrato",
    physicalProgressTitle: "Progreso Físico Ponderado de Obra (BIM 5D)",
    completedLabel: "Completado",
    chartTitle: "Presupuesto vs. Ejecución Real por Capítulo",
    chartSub: "Comparativo directo agrupado por capítulos constructivos.",
    barBudget: "Presupuesto Contractual",
    barExec: "Costo Ejecutado",
    chapterTableTitle: "Resumen Financiero por Capítulo",
    chapterTableSub: "Estado de causación y saldo disponible por frente.",
    colChapter: "Capítulo",
    colBudget: "Presupuesto",
    colExecuted: "Ejecutado",
    colPct: "% Av.",
    standardsStripTitle: "Arquitectura Internacional BIM 3D / 4D / 5D • Project Controls",
    exchangeDisclaimer: "Conversión referencial desde base contractual COP",
  },
  login: {
    securityBadge: "SUPABASE AUTH",
    subtitle: "Gerencia BIM 5D • Acceso Seguro",
    helperLogin: "Inicia sesión con tus mismas credenciales de Bitácora de Obra.",
    helperRecovery: "Ingresa tu correo registrado para recibir el enlace de recuperación.",
    emailLabel: "Correo Electrónico",
    passwordLabel: "Contraseña",
    rememberEmail: "Recordar correo",
    forgotPassword: "¿Olvidaste tu clave?",
    signInBtn: "Iniciar Sesión en Gerencia BIM 5D",
    signingInBtn: "Verificando credenciales...",
    sendRecoveryBtn: "Enviar Enlace de Recuperación",
    sendingRecoveryBtn: "Enviando enlace...",
    backToLogin: "Volver al inicio de sesión",
    demoDivider: "Acceso público para reclutadores y clientes",
    demoBtn: "Explorar Demo Interactiva (LinkedIn)",
    demoHint: "Incluye modelo 3D BIM, Gantt 4D, Curva S y costos sin exponer datos privados.",
    openBitacoraLink: "Ir a Bitácora de Campo App",
    footerNote: "JGM ConTech • BIM 5D & Project Controls • Colombia / Global",
  },
};

const EN_TR: Translations = {
  appSubtitle: "BIM 5D Management",
  appSlogan: "Real-time technical and financial civil construction control.",
  online: "ONLINE",
  demoSandboxBadge: "LINKEDIN DEMO (READ-ONLY)",
  openBitacora: "Field Log App",
  signOut: "Sign Out",
  enterRealAccount: "Sign In",
  menuMobile: "Menu",
  toggleSidebarHide: "Collapse sidebar (Panoramic View)",
  toggleSidebarShow: "Expand sidebar",
  clientLabel: "Client",
  directorLabel: "Tech Director",
  modelLabel: "BIM Model",
  weightedProgress: "Weighted Physical Prog.",
  earnedCostDirect: "Earned Cost (Direct)",
  groups: {
    direction: "1. Executive",
    bim3d: "2. BIM 3D",
    planning4d5d: "3. 4D/5D Planning",
    field: "4. Field Ops & HSE",
    controlBilling: "5. Control & Billing",
    erpFinance: "6. ERP & Finance",
  },
  tabs: {
    panel: "Executive Dashboard",
    visor3d: "3D BIM Viewer",
    habitaciones: "Zones & Cashflow",
    presupuesto: "5D Budget (BOQ)",
    curva_s: "S-Curve & 4D Gantt",
    insumos: "BIM Materials",
    contratos: "PDF Contracts",
    bitacora: "Cloud Field Log",
    rendimiento: "Crew Productivity",
    sst: "HSE & Safety",
    mayores: "Change Orders & Overruns",
    actas: "Payment Certificates",
    nomina: "Payroll & Crews",
    proveedores: "Suppliers & POs",
    clientes: "Clients & Billing AR",
  },
  sidebar: {
    openFieldApp: "Open Mobile Field Log",
    portfolio: "Project Portfolio",
    modeBudgetOnly: "Budget Only",
    modeBim5d: "BIM 5D Mode",
    itemsCount: "items",
    newBtn: "New",
    deleteBtn: "Delete",
    backupBtn: "Backup",
    exportJson: "Export JSON",
    restoreJson: "Restore JSON",
    cloudLabel: "Supabase Cloud",
    demoLocalLabel: "Demo Sandbox Store",
    recordsShort: "logs",
    syncNow: "Live Sync",
    syncing: "Syncing...",
    aiuTitle: "Indirects (AIU) & Retainage",
    pctA: "% Administration (A)",
    pctI: "% Contingencies (I)",
    pctU: "% Profit Fee (U)",
    pctAnt: "% Advance Amortization",
    pctGar: "% Warranty Retainage",
    standardsFooter: "ISO 19650 • OpenBIM IFC • PMI EVM 5D",
  },
  exec: {
    kpiBaseDirect: "Baseline Direct Budget",
    kpiExecDirect: "Cumulative Earned (Dir.)",
    kpiRemaining: "Remaining Balance (Dir.)",
    kpiOverruns: "Overrun / Change Alerts",
    withAiu: "+ Ind.",
    financialPct: "financial",
    contractAvailable: "Contractual backlog",
    overrunNeeded: "Requires Change Order",
    noOverruns: "Within baseline scope",
    physicalProgressTitle: "Weighted Physical Construction Progress (BIM 5D)",
    completedLabel: "Completed",
    chartTitle: "Contract Budget vs. Actual Cost by WBS Chapter",
    chartSub: "Direct cost comparison grouped by construction trade chapters.",
    barBudget: "Contract Budget",
    barExec: "Executed Cost",
    chapterTableTitle: "Financial Summary by Chapter",
    chapterTableSub: "Earned value and available balance per trade package.",
    colChapter: "Chapter",
    colBudget: "Budget",
    colExecuted: "Executed",
    colPct: "% Prog.",
    standardsStripTitle: "Global Standards: BIM 3D / 4D / 5D • Project Controls",
    exchangeDisclaimer: "Indicative FX conversion from base COP budget",
  },
  login: {
    securityBadge: "SUPABASE AUTH",
    subtitle: "BIM 5D Management • Secure Access",
    helperLogin: "Sign in with your JGM ConTech Field Log credentials.",
    helperRecovery: "Enter your registered email to receive a password reset link.",
    emailLabel: "Email Address",
    passwordLabel: "Password",
    rememberEmail: "Remember email",
    forgotPassword: "Forgot password?",
    signInBtn: "Sign In to BIM 5D Portal",
    signingInBtn: "Verifying credentials...",
    sendRecoveryBtn: "Send Recovery Link",
    sendingRecoveryBtn: "Sending link...",
    backToLogin: "Back to sign in",
    demoDivider: "Public preview for recruiters & international clients",
    demoBtn: "Explore Live Interactive Demo (LinkedIn)",
    demoHint: "Includes live 3D BIM model, 4D MS Project Gantt, S-Curve & EVM KPIs (read-only).",
    openBitacoraLink: "Open Mobile Field Log App",
    footerNote: "JGM ConTech • BIM 5D & Project Controls • Colombia / Global",
  },
};

const AppPreferencesContext = createContext<AppPreferencesValue | null>(null);

export function AppPreferencesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [lang, setLangState] = useState<AppLang>("es");
  const [currency, setCurrencyState] = useState<AppCurrency>("COP");
  const [darkTheme, setDarkThemeState] = useState<boolean>(false);
  const [rates, setRates] = useState<Record<AppCurrency, number>>(EXCHANGE_RATES_COP);
  const [fxLive, setFxLive] = useState<boolean>(false);
  const [fxSource, setFxSource] = useState<string>("reference");
  const [fxUpdatedAt, setFxUpdatedAt] = useState<string>("");

  useEffect(() => {
    let active = true;
    const pullFx = async () => {
      try {
        const res = await fetch("/api/fx-rates", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          ok?: boolean;
          copPerUsd?: number;
          copPerEur?: number;
          source?: string;
          updatedAt?: string;
        };
        if (!active) return;
        if (
          typeof data.copPerUsd === "number" &&
          data.copPerUsd > 1000 &&
          typeof data.copPerEur === "number" &&
          data.copPerEur > 1000
        ) {
          setRates({
            COP: 1,
            USD: data.copPerUsd,
            EUR: data.copPerEur,
          });
          setFxLive(Boolean(data.ok));
          setFxSource(data.source || "live");
          setFxUpdatedAt(data.updatedAt || "");
        }
      } catch {
        // Mantener tasa de respaldo si falla la red
      }
    };
    pullFx();
    const interval = setInterval(pullFx, 15 * 60 * 1000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PREFS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.lang === "es" || parsed.lang === "en") setLangState(parsed.lang);
        if (
          parsed.currency === "COP" ||
          parsed.currency === "USD" ||
          parsed.currency === "EUR"
        ) {
          setCurrencyState(parsed.currency);
        }
        if (typeof parsed.darkTheme === "boolean") {
          setDarkThemeState(parsed.darkTheme);
        }
      }
    } catch {
      // Ignorar error de lectura localStorage
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        PREFS_STORAGE_KEY,
        JSON.stringify({ lang, currency, darkTheme })
      );
    } catch {
      // Ignorar error de escritura
    }
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute(
        "data-theme",
        darkTheme ? "dark" : "light"
      );
      document.documentElement.lang = lang;
    }
  }, [lang, currency, darkTheme]);

  const value = useMemo<AppPreferencesValue>(() => {
    const rate = rates[currency] || 1;
    const unitSystem = getUnitSystem(lang);

    const formatConvertedMoney = (amountInCurr: number, decimals?: number): string => {
      const val = Number.isFinite(amountInCurr) ? amountInCurr : 0;
      const frac = decimals !== undefined ? decimals : currency === "COP" ? 0 : 0;
      if (currency === "COP") {
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: frac,
          maximumFractionDigits: frac,
        })
          .format(val)
          .replace("$", "$ ");
      }
      if (currency === "USD") {
        return `US${new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: frac,
          maximumFractionDigits: frac,
        }).format(val)}`;
      }
      return new Intl.NumberFormat("en-IE", {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: frac,
        maximumFractionDigits: frac,
      }).format(val);
    };

    const formatMoney = (amountCop: number, decimals?: number): string => {
      const raw = Number.isFinite(amountCop) ? amountCop : 0;
      const frac = decimals !== undefined ? decimals : currency === "COP" ? 0 : 2;
      return formatConvertedMoney(raw / rate, currency === "COP" ? 0 : Math.abs(raw / rate) >= 1000 && decimals === undefined ? 0 : frac);
    };

    const formatUnitMoney = (priceCopPerMetricUnit: number, metricUnit?: string): string => {
      const converted = convertUnitPriceCopToDisplay(
        priceCopPerMetricUnit,
        metricUnit,
        currency,
        rates,
        lang
      );
      return formatConvertedMoney(converted, currency === "COP" ? 0 : 2);
    };

    const formatQty = (qtyMetric: number, metricUnit?: string, decimals = 2): string => {
      const q = convertQty(qtyMetric, metricUnit, lang);
      return q.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
    };

    const convertQtyValue = (qtyMetric: number, metricUnit?: string): number =>
      convertQty(qtyMetric, metricUnit, lang);

    const unitLabel = (metricUnit?: string): string => convertUnitLabel(metricUnit, lang);

    const formatCompactChartMoney = (amountCop: number): number => {
      const converted = (Number.isFinite(amountCop) ? amountCop : 0) / rate;
      const divisor = currency === "COP" ? 1_000_000 : 1_000;
      return Math.round((converted / divisor) * 100) / 100;
    };

    const chartUnitSuffix =
      currency === "COP" ? "M COP" : currency === "USD" ? "K USD" : "K EUR";

    return {
      lang,
      setLang: setLangState,
      currency,
      setCurrency: setCurrencyState,
      unitSystem,
      rates,
      fxLive,
      fxSource,
      fxUpdatedAt,
      darkTheme,
      setDarkTheme: setDarkThemeState,
      formatMoney,
      formatConvertedMoney,
      formatUnitMoney,
      formatQty,
      convertQtyValue,
      unitLabel,
      formatCompactChartMoney,
      chartUnitSuffix,
      docOpts: {
        lang,
        currency,
        unit_system: unitSystem,
        fx_rate: rate,
        cop_per_usd: rates.USD,
        cop_per_eur: rates.EUR,
      },
      tr: lang === "en" ? EN_TR : ES_TR,
    };
  }, [lang, currency, darkTheme, rates, fxLive, fxSource, fxUpdatedAt]);

  return (
    <AppPreferencesContext.Provider value={value}>
      {children}
    </AppPreferencesContext.Provider>
  );
}

export function useAppPreferences(): AppPreferencesValue {
  const ctx = useContext(AppPreferencesContext);
  if (!ctx) {
    const fallbackFormat = (v: number) =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      })
        .format(Number.isFinite(v) ? v : 0)
        .replace("$", "$ ");
    return {
      lang: "es",
      setLang: () => {},
      currency: "COP",
      setCurrency: () => {},
      unitSystem: "metric",
      rates: EXCHANGE_RATES_COP,
      fxLive: false,
      fxSource: "reference",
      fxUpdatedAt: "",
      darkTheme: false,
      setDarkTheme: () => {},
      formatMoney: fallbackFormat,
      formatConvertedMoney: fallbackFormat,
      formatUnitMoney: (p: number) => fallbackFormat(p),
      formatQty: (q: number) => Number(q || 0).toFixed(2),
      convertQtyValue: (q: number) => Number(q || 0),
      unitLabel: (u?: string) => u || "und",
      formatCompactChartMoney: (v: number) =>
        Math.round(((Number.isFinite(v) ? v : 0) / 1_000_000) * 100) / 100,
      chartUnitSuffix: "M COP",
      docOpts: {
        lang: "es",
        currency: "COP",
        unit_system: "metric",
        fx_rate: 1,
        cop_per_usd: EXCHANGE_RATES_COP.USD,
        cop_per_eur: EXCHANGE_RATES_COP.EUR,
      },
      tr: ES_TR,
    };
  }
  return ctx;
}
