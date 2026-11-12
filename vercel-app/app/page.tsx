"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import TabPanelEjecutivo from "../components/TabPanelEjecutivo";
import TabPresupuestoAPU from "../components/TabPresupuestoAPU";
import TabRendimiento from "../components/TabRendimiento";
import TabVisor3DBIM from "../components/TabVisor3DBIM";
import TopHeader from "../components/TopHeader";
import {
  AuthSession,
  restoreAndValidateSession,
  signOutSession,
} from "../lib/auth";
import { calcularConsolidacionLocal, callPythonJson } from "../lib/calcClient";
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
  ProjectConfig,
  TabKey,
} from "../lib/types";

const CUSTOM_OVERRIDES_KEY = "jgm_contech_project_overrides_v1";

export default function GerenciaBim5DPage() {
  const [proyectos, setProyectos] = useState<Record<string, ProjectConfig>>(
    PROYECTOS_BASE
  );
  const [proyectoActivoId, setProyectoActivoId] = useState<string>("casa_mendoza");
  const [activeTab, setActiveTab] = useState<TabKey>("panel");
  const [cloudRows, setCloudRows] = useState<BitacoraRow[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const [engineStatus, setEngineStatus] = useState<"pandas" | "client-ts" | "checking">(
    "checking"
  );
  const [pythonData, setPythonData] = useState<ConsolidationResult | null>(null);

  const proyectoActual = useMemo(
    () => proyectos[proyectoActivoId] || PROYECTOS_BASE.casa_mendoza,
    [proyectos, proyectoActivoId]
  );

  const [params, setParams] = useState<LiquidationParams>({
    pct_a: PROYECTOS_BASE.casa_mendoza.a_def,
    pct_i: PROYECTOS_BASE.casa_mendoza.i_def,
    pct_u: PROYECTOS_BASE.casa_mendoza.u_def,
    pct_anticipo: PROYECTOS_BASE.casa_mendoza.ant_def,
    pct_garantia: PROYECTOS_BASE.casa_mendoza.gar_def,
  });

  // Hydrate custom projects & local edits after mount
  useEffect(() => {
    const custom = loadCustomProjects();
    let overrides: Record<string, ProjectConfig> = {};
    try {
      const rawOv = window.localStorage.getItem(CUSTOM_OVERRIDES_KEY);
      if (rawOv) overrides = JSON.parse(rawOv);
    } catch {
      // Ignorar error local
    }
    setProyectos({
      ...PROYECTOS_BASE,
      ...overrides,
      ...custom,
    });
  }, []);

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
    const rows = await fetchBitacoraCloud();
    setCloudRows(rows);
    setSyncing(false);
  }, []);

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
    if (window.confirm("¿Deseas cerrar tu sesión en Gerencia BIM 5D?")) {
      await signOutSession(session);
      setSession(null);
      setCloudRows([]);
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

  const persistProyectoChange = (updated: ProjectConfig) => {
    const nextMap = { ...proyectos, [updated.id]: updated };
    setProyectos(nextMap);

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
      />

      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-7 max-w-[1440px] mx-auto w-full space-y-5">
        <TopHeader
          proyecto={proyectoActual}
          totals={activeData.totals}
          activeTab={activeTab}
          onChangeTab={setActiveTab}
          onOpenMenuMobile={() => setMobileMenuOpen(true)}
          engineSource={activeData.engine}
          userEmail={session.user.email}
          onLogout={handleLogout}
        />

        {activeTab === "panel" && (
          <TabPanelEjecutivo data={activeData} params={params} />
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
          />
        )}
        {activeTab === "presupuesto" && (
          <TabPresupuestoAPU
            proyecto={proyectoActual}
            data={activeData}
            params={params}
            onUpdateProyecto={persistProyectoChange}
          />
        )}
        {activeTab === "contratos" && (
          <TabContratosPDF
            proyecto={proyectoActual}
            data={activeData}
            params={params}
          />
        )}
        {activeTab === "actas" && (
          <TabActasCorte
            proyecto={proyectoActual}
            data={activeData}
            params={params}
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
          />
        )}

        <footer className="pt-4 pb-2 text-center text-[11px] text-slate-600 font-semibold">
          JGM ConTech • Gerencia BIM 5D Cloud (Next.js + Python Pandas + ReportLab + Supabase)
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
