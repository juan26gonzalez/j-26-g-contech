"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { TabKey } from "./types";

export type AppLang = "es" | "en";
export type AppCurrency = "COP" | "USD" | "EUR";

// Tasas referenciales para visualización ejecutiva internacional
export const EXCHANGE_RATES_COP: Record<AppCurrency, number> = {
  COP: 1,
  USD: 4150,
  EUR: 4480,
};

const PREFS_STORAGE_KEY = "jgm_contech_ui_prefs_v1";

interface AppPreferencesValue {
  lang: AppLang;
  setLang: (lang: AppLang) => void;
  currency: AppCurrency;
  setCurrency: (currency: AppCurrency) => void;
  darkTheme: boolean;
  setDarkTheme: (dark: boolean) => void;
  formatMoney: (amountCop: number) => string;
  formatCompactChartMoney: (amountCop: number) => number;
  chartUnitSuffix: string;
  tr: Translations;
}

export interface Translations {
  // Generales & Header
  appSubtitle: string;
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
    field: "4. Campo",
    controlBilling: "5. Control & Cobro",
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
    mayores: "Mayores Cant. & Adicionales",
    actas: "Actas de Corte & Cobro",
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
    field: "4. Field Ops",
    controlBilling: "5. Control & Billing",
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
    mayores: "Change Orders & Overruns",
    actas: "Payment Certificates",
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
    const rate = EXCHANGE_RATES_COP[currency] || 1;

    const formatMoney = (amountCop: number): string => {
      const raw = Number.isFinite(amountCop) ? amountCop : 0;
      const converted = raw / rate;
      if (currency === "COP") {
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        })
          .format(converted)
          .replace("$", "$ ");
      }
      if (currency === "USD") {
        return `US${new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        }).format(converted)}`;
      }
      return new Intl.NumberFormat("de-DE", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      }).format(converted);
    };

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
      darkTheme,
      setDarkTheme: setDarkThemeState,
      formatMoney,
      formatCompactChartMoney,
      chartUnitSuffix,
      tr: lang === "en" ? EN_TR : ES_TR,
    };
  }, [lang, currency, darkTheme]);

  return (
    <AppPreferencesContext.Provider value={value}>
      {children}
    </AppPreferencesContext.Provider>
  );
}

export function useAppPreferences(): AppPreferencesValue {
  const ctx = useContext(AppPreferencesContext);
  if (!ctx) {
    return {
      lang: "es",
      setLang: () => {},
      currency: "COP",
      setCurrency: () => {},
      darkTheme: false,
      setDarkTheme: () => {},
      formatMoney: (v: number) =>
        new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        })
          .format(Number.isFinite(v) ? v : 0)
          .replace("$", "$ "),
      formatCompactChartMoney: (v: number) =>
        Math.round(((Number.isFinite(v) ? v : 0) / 1_000_000) * 100) / 100,
      chartUnitSuffix: "M COP",
      tr: ES_TR,
    };
  }
  return ctx;
}
