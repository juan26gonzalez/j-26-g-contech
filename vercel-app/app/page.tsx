"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import LoginGate from "../components/LoginGate";
import NewProjectModal from "../components/NewProjectModal";
import Sidebar from "../components/Sidebar";
import TabActasCorte from "../components/TabActasCorte";
import TabBitacoraCloud from "../components/TabBitacoraCloud";
import TabContratosPDF from "../components/TabContratosPDF";
import TabCurvaS from "../components/TabCurvaS";
import TabHabitacionesBIM from "../components/TabHabitacionesBIM";
import TabInsumosBIM from "../components/TabInsumosBIM";
import TabMayoresCantidades from "../components/TabMayoresCantidades";
import TabNominaPagos from "../components/TabNominaPagos";
import TabPanelEjecutivo from "../components/TabPanelEjecutivo";
import TabPresupuestoAPU from "../components/TabPresupuestoAPU";
import TabRendimiento from "../components/TabRendimiento";
import TabSstSeguridad from "../components/TabSstSeguridad";
import TabVisor3DBIM from "../components/TabVisor3DBIM";
import TopHeader from "../components/TopHeader";
import {
  AuthSession,
  restoreAndValidateSession,
  signOutSession,
} from "../lib/auth";
import { calcularConsolidacionLocal, callPythonJson } from "../lib/calcClient";
import {
  DEMO_SHOWCASE_PROJECT_ID,
  getDemoBitacoraRows,
  getDemoShowcaseProject,
} from "../lib/demoData";
import {
  computeSstSummary,
  loadPayrollProjectState,
  loadSstProjectState,
  savePayrollProjectState,
  saveSstProjectState,
  syncPayrollDestajoWith5D,
} from "../lib/erpStorage";
import {
  fetchBitacoraCloud,
  loadCustomProjects,
  PROYECTOS_BASE,
  saveCustomProjects,
} from "../lib/projects";
import {
  BitacoraRow,
  ConsolidationResult,
  LiquidationParams,
  PayrollProjectData,
  ProjectConfig,
  SstProjectData,
  TabKey,
} from "../lib/types";

const CUSTOM_OVERRIDES_KEY = "jgm_contech_project_overrides_v1";

function loadFullRealPortfolio(): Record<string, ProjectConfig> {
  if (typeof window === "undefined") return { ...PROYECTOS_BASE };
  const custom = loadCustomProjects();
  let overrides: Record<string, ProjectConfig> = {};
  try {
    const rawOv = window.localStorage.getItem(CUSTOM_OVERRIDES_KEY);
    if (rawOv) overrides = JSON.parse(rawOv);
  } catch {
    // Ignorar error local
  }
  return {
    ...PROYECTOS_BASE,
    ...overrides,
    ...custom,
  };
}

export default function GerenciaBim5DPage() {
  const [proyectos, setProyectos] = useState<Record<string, ProjectConfig>>(
    PROYECTOS_BASE
  );
  const [proyectoActivoId, setProyectoActivoId] = useState<string>("casa_mendoza");
  const [activeTab, setActiveTab] = useState<TabKey>("panel");
  const [cloudRows, setCloudRows] = useState<BitacoraRow[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const wasDemoRef = useRef(false);

  const isDemo = Boolean(session?.isDemo);

  const [engineStatus, setEngineStatus] = useState<"pandas" | "client-ts" | "checking">(
    "checking"
  );
  const [pythonData, setPythonData] = useState<ConsolidationResult | null>(null);

  const proyectoActual = useMemo(
    () =>
      proyectos[proyectoActivoId] ||
      Object.values(proyectos)[0] ||
      PROYECTOS_BASE.casa_mendoza,
    [proyectos, proyectoActivoId]
  );

  const [params, setParams] = useState<LiquidationParams>({
    pct_a: PROYECTOS_BASE.casa_mendoza.a_def,
    pct_i: PROYECTOS_BASE.casa_mendoza.i_def,
    pct_u: PROYECTOS_BASE.casa_mendoza.u_def,
    pct_anticipo: PROYECTOS_BASE.casa_mendoza.ant_def,
    pct_garantia: PROYECTOS_BASE.casa_mendoza.gar_def,
  });

  // Synchronize portfolio isolation between Demo Sandbox and Real Authenticated Account
  useEffect(() => {
    if (!session) {
      setProyectos(loadFullRealPortfolio());
      return;
    }
    if (session.isDemo) {
      wasDemoRef.current = true;
      const demoProj = getDemoShowcaseProject();
      setProyectos({ [DEMO_SHOWCASE_PROJECT_ID]: demoProj });
      setProyectoActivoId(DEMO_SHOWCASE_PROJECT_ID);
      setParams({
        pct_a: demoProj.a_def,
        pct_i: demoProj.i_def,
        pct_u: demoProj.u_def,
        pct_anticipo: demoProj.ant_def,
        pct_garantia: demoProj.gar_def,
      });
      setPythonData(null);
    } else {
      const realPortfolio = loadFullRealPortfolio();
      setProyectos(realPortfolio);
      if (wasDemoRef.current) {
        wasDemoRef.current = false;
        const p = realPortfolio.casa_mendoza || Object.values(realPortfolio)[0];
        setProyectoActivoId(p.id);
        setParams({
          pct_a: p.a_def ?? 8.0,
          pct_i: p.i_def ?? 2.0,
          pct_u: p.u_def ?? 5.0,
          pct_anticipo: p.ant_def ?? 15.0,
          pct_garantia: p.gar_def ?? 5.0,
        });
        setActiveTab("panel");
      }
      setPythonData(null);
    }
  }, [session]);

  // Update AIU defaults when switching project
  const handleSelectProyecto = useCallback(
    (id: string) => {
      setProyectoActivoId(id);
      const p = proyectos[id];
      if (p) {
        setParams({
          pct_a: p.a_def ?? 8.0,
          pct_i: p.i_def ?? 2.0,
          pct_u: p.u_def ?? 5.0,
          pct_anticipo: p.ant_def ?? 15.0,
          pct_garantia: p.gar_def ?? 5.0,
        });
      }
      setPythonData(null);
    },
    [proyectos]
  );

  const syncCloud = useCallback(async () => {
    setSyncing(true);
    if (session?.isDemo) {
      setCloudRows(getDemoBitacoraRows());
      setSyncing(false);
      return;
    }
    const rows = await fetchBitacoraCloud();
    setCloudRows(rows);
    setSyncing(false);
  }, [session?.isDemo]);

  useEffect(() => {
    let mounted = true;
    restoreAndValidateSession()
      .then((restored) => {
        if (mounted) setSession(restored);
      })
      .finally(() => {
        if (mounted) setLoadingAuth(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleLogout = useCallback(async () => {
    if (session?.isDemo) {
      await signOutSession(session);
      setSession(null);
      setCloudRows([]);
      setActiveTab("panel");
      return;
    }
    if (window.confirm("¿Deseas cerrar tu sesión en Gerencia BIM 5D?")) {
      await signOutSession(session);
      setSession(null);
      setCloudRows([]);
      setActiveTab("panel");
    }
  }, [session]);

  useEffect(() => {
    if (!session) return;
    syncCloud();
  }, [session, syncCloud]);

  // Instant TS calculation + Python Pandas Serverless consolidation
  const clientFallbackData = useMemo(
    () => calcularConsolidacionLocal(proyectoActual, cloudRows),
    [proyectoActual, cloudRows]
  );

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setEngineStatus("checking");

    const runPython = async () => {
      try {
        const res = await callPythonJson<ConsolidationResult & { ok: boolean }>({
          action: "consolidar",
          proyecto_actual: proyectoActual,
          registros_bitacora: cloudRows,
        });
        if (!cancelled && res && Array.isArray(res.df_5d)) {
          setPythonData({ ...res, engine: "pandas" });
          setEngineStatus("pandas");
        }
      } catch {
        if (!cancelled) {
          setPythonData(null);
          setEngineStatus("client-ts");
        }
      }
    };

    runPython();
    return () => {
      cancelled = true;
    };
  }, [session, proyectoActual, cloudRows]);

  const activeData = pythonData || clientFallbackData;

  const hasManualPayrollEditRef = useRef(false);
  const [sstState, setSstState] = useState<SstProjectData>(() =>
    loadSstProjectState(proyectoActual, isDemo)
  );
  const [payrollState, setPayrollState] = useState<PayrollProjectData>(() =>
    loadPayrollProjectState(proyectoActual, activeData, isDemo)
  );

  useEffect(() => {
    hasManualPayrollEditRef.current = false;
    setSstState(loadSstProjectState(proyectoActual, isDemo));
    setPayrollState(loadPayrollProjectState(proyectoActual, activeData, isDemo));
    // Re-seed SST & Payroll on active project or Demo/Real session transitions
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyectoActual.id, isDemo]);

  useEffect(() => {
    if (hasManualPayrollEditRef.current) return;
    setPayrollState((prev) => {
      const { next, updatedCount } = syncPayrollDestajoWith5D(prev, activeData);
      return updatedCount > 0 ? next : prev;
    });
  }, [activeData]);

  const handleUpdateSst = useCallback(
    (next: SstProjectData) => {
      setSstState(next);
      saveSstProjectState(proyectoActual, next, isDemo);
    },
    [proyectoActual, isDemo]
  );

  const handleUpdatePayroll = useCallback(
    (next: PayrollProjectData) => {
      hasManualPayrollEditRef.current = true;
      setPayrollState(next);
      savePayrollProjectState(proyectoActual, next, isDemo);
    },
    [proyectoActual, isDemo]
  );

  const sstSummary = useMemo(() => computeSstSummary(sstState), [sstState]);

  const persistProyectoChange = (updated: ProjectConfig) => {
    const nextMap = { ...proyectos, [updated.id]: updated };
    setProyectos(nextMap);

    if (session?.isDemo) return;

    if (updated.isCustom) {
      const customOnly: Record<string, ProjectConfig> = {};
      Object.values(nextMap).forEach((p) => {
        if (p.isCustom) customOnly[p.id] = p;
      });
      saveCustomProjects(customOnly);
    } else {
      try {
        const rawOv = window.localStorage.getItem(CUSTOM_OVERRIDES_KEY);
        const ov = rawOv ? JSON.parse(rawOv) : {};
        ov[updated.id] = updated;
        window.localStorage.setItem(CUSTOM_OVERRIDES_KEY, JSON.stringify(ov));
      } catch {
        // Ignorar quota error
      }
    }
  };

  const handleSaveNewProject = (newProy: ProjectConfig) => {
    if (session?.isDemo) return;
    persistProyectoChange(newProy);
    setProyectoActivoId(newProy.id);
    setParams({
      pct_a: newProy.a_def,
      pct_i: newProy.i_def,
      pct_u: newProy.u_def,
      pct_anticipo: newProy.ant_def,
      pct_garantia: newProy.gar_def,
    });
    setActiveTab("presupuesto");
  };

  const handleDeleteCustomProject = (id: string) => {
    if (session?.isDemo) return;
    const target = proyectos[id];
    if (!target?.isCustom) return;
    const nextMap = { ...proyectos };
    delete nextMap[id];
    setProyectos(nextMap);

    const customOnly: Record<string, ProjectConfig> = {};
    Object.values(nextMap).forEach((p) => {
      if (p.isCustom) customOnly[p.id] = p;
    });
    saveCustomProjects(customOnly);
    handleSelectProyecto("casa_mendoza");
  };

  const handleExportBackup = () => {
    const backup = Object.values(proyectos).filter((p) => p.isCustom);
    const payload = JSON.stringify(
      backup.length > 0 ? backup : Object.values(proyectos),
      null,
      2
    );
    const blob = new Blob([payload], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "respaldo_proyectos_jgm_contech.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const handleImportBackup = async (file: File) => {
    if (session?.isDemo) return;
    try {
      const txt = await file.text();
      const parsed = JSON.parse(txt);
      const arr: ProjectConfig[] = Array.isArray(parsed)
        ? parsed
        : Object.values(parsed || {});
      const nextCustom: Record<string, ProjectConfig> = loadCustomProjects();
      const merged = { ...proyectos };
      let importedCount = 0;
      for (const p of arr) {
        if (p && p.id && p.nombre && Array.isArray(p.ppto_base)) {
          const item = { ...p, isCustom: true };
          nextCustom[item.id] = item;
          merged[item.id] = item;
          importedCount++;
        }
      }
      if (importedCount > 0) {
        saveCustomProjects(nextCustom);
        setProyectos(merged);
        alert(`Se restauraron ${importedCount} proyecto(s) correctamente.`);
      }
    } catch {
      alert("Archivo JSON inválido o dañado.");
    }
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="steel-panel-dark rounded-2xl px-8 py-6 text-center text-white border border-slate-500/60 shadow-2xl">
          <img
            src="/logo-mark.png"
            alt="JGM ConTech"
            className="w-14 h-14 rounded-xl border border-slate-400/60 mx-auto mb-3 animate-pulse"
          />
          <p className="text-sm font-bold tracking-wide">
            Verificando sesión JGM ConTech...
          </p>
          <p className="text-[11px] text-slate-300 mt-1">
            Gerencia BIM 5D • Supabase Auth
          </p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <LoginGate onAuthenticated={(newSession) => setSession(newSession)} />;
  }

  return (
    <div className="min-h-screen flex bg-transparent">
      <Sidebar
        proyectos={proyectos}
        proyectoActivoId={proyectoActual.id}
        onSelectProyecto={handleSelectProyecto}
        onOpenNewModal={() => setNewModalOpen(true)}
        onDeleteCustomProyecto={handleDeleteCustomProject}
        onExportBackup={handleExportBackup}
        onImportBackup={handleImportBackup}
        onSyncCloud={syncCloud}
        syncing={syncing}
        totalRegistrosCloud={cloudRows.length}
        engineStatus={engineStatus}
        params={params}
        onChangeParams={setParams}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        collapsed={sidebarCollapsed}
        isDemo={isDemo}
      />

      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-7 max-w-[1440px] mx-auto w-full space-y-5">
        <TopHeader
          proyecto={proyectoActual}
          totals={activeData.totals}
          activeTab={activeTab}
          onChangeTab={setActiveTab}
          onOpenMenuMobile={() => setMobileMenuOpen(true)}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebarDesktop={() => setSidebarCollapsed((p) => !p)}
          engineSource={activeData.engine}
          userEmail={session.user.email}
          isDemo={isDemo}
          onLogout={handleLogout}
        />

        {activeTab === "panel" && (
          <TabPanelEjecutivo
            data={activeData}
            params={params}
            sstSummary={sstSummary}
            payrollState={payrollState}
            onNavigateTab={setActiveTab}
          />
        )}
        {activeTab === "habitaciones" && (
          <TabHabitacionesBIM
            proyecto={proyectoActual}
            data={activeData}
            params={params}
            onUpdateProyecto={persistProyectoChange}
          />
        )}
        {activeTab === "visor3d" && (
          <TabVisor3DBIM
            proyecto={proyectoActual}
            data={activeData}
            params={params}
            onNavigateTab={setActiveTab}
            isDemo={isDemo}
          />
        )}
        {activeTab === "presupuesto" && (
          <TabPresupuestoAPU
            proyecto={proyectoActual}
            data={activeData}
            params={params}
            onUpdateProyecto={persistProyectoChange}
            isDemo={isDemo}
          />
        )}
        {activeTab === "contratos" && (
          <TabContratosPDF
            proyecto={proyectoActual}
            data={activeData}
            params={params}
            isDemo={isDemo}
          />
        )}
        {activeTab === "actas" && (
          <TabActasCorte
            proyecto={proyectoActual}
            data={activeData}
            params={params}
            isDemo={isDemo}
          />
        )}
        {activeTab === "mayores" && <TabMayoresCantidades data={activeData} />}
        {activeTab === "rendimiento" && <TabRendimiento data={activeData} />}
        {activeTab === "curva_s" && (
          <TabCurvaS
            proyecto={proyectoActual}
            data={activeData}
            onUpdateProyecto={persistProyectoChange}
            cloudRows={cloudRows}
            onRefreshCloud={syncCloud}
          />
        )}
        {activeTab === "insumos" && (
          <TabInsumosBIM proyecto={proyectoActual} data={activeData} />
        )}
        {activeTab === "bitacora" && (
          <TabBitacoraCloud
            proyecto={proyectoActual}
            data={activeData}
            allCloudRows={cloudRows}
            onSyncedReload={syncCloud}
            isDemo={isDemo}
          />
        )}
        {activeTab === "sst" && (
          <TabSstSeguridad
            proyecto={proyectoActual}
            sstState={sstState}
            onChangeSst={handleUpdateSst}
            isDemo={isDemo}
          />
        )}
        {activeTab === "nomina" && (
          <TabNominaPagos
            proyecto={proyectoActual}
            data={activeData}
            payrollState={payrollState}
            onChangePayroll={handleUpdatePayroll}
            isDemo={isDemo}
          />
        )}

        <footer className="pt-4 pb-2 text-center text-[11px] text-slate-600 font-semibold">
          JGM ConTech • ISO 19650 • BIM 3D / 4D / 5D • Project Controls • Ing. Juan González Mendoza (Next.js + Python Pandas + Supabase)
        </footer>
      </main>

      <NewProjectModal
        open={newModalOpen}
        onClose={() => setNewModalOpen(false)}
        onSaveProject={handleSaveNewProject}
      />
    </div>
  );
}
