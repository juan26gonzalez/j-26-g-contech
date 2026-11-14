"use client";

import React, { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileCheck2,
  Flame,
  HardHat,
  Info,
  Plus,
  Printer,
  ShieldCheck,
  Users,
  Zap,
} from "lucide-react";
import {
  computeSstSummary,
  downloadCsvUtf8,
  escapeHtml,
  openExecutivePrintSheet,
} from "../lib/erpStorage";
import { useAppPreferences } from "../lib/i18n";
import type {
  ProjectConfig,
  SstEppWorker,
  SstIncident,
  SstIncidentType,
  SstPermit,
  SstPermitStatus,
  SstPermitType,
  SstProjectData,
  SstTalk,
} from "../lib/types";
import { sanitizeDemoProject } from "../lib/units";

type SstSubView = "permisos" | "charlas" | "epp" | "incidentes";

interface TabSstSeguridadProps {
  proyecto: ProjectConfig;
  sstState: SstProjectData;
  onChangeSst: (next: SstProjectData) => void;
  isDemo?: boolean;
}

const FT_PER_METER = 3.2808399;

export default function TabSstSeguridad({
  proyecto,
  sstState,
  onChangeSst,
  isDemo = false,
}: TabSstSeguridadProps) {
  const { lang, formatQty, convertQtyValue } = useAppPreferences();
  const isEn = lang === "en";
  const safeProyecto = useMemo(
    () => sanitizeDemoProject(proyecto, Boolean(isDemo), lang),
    [proyecto, isDemo, lang]
  );

  const [subView, setSubView] = useState<SstSubView>("permisos");
  const [permitFilter, setPermitFilter] = useState<"all" | SstPermitStatus>("all");
  const [statusFeedback, setStatusFeedback] = useState<string>("");

  // New PTAR form state
  const [newPermitTipo, setNewPermitTipo] = useState<SstPermitType>("alturas");
  const [newPermitFrente, setNewPermitFrente] = useState("");
  const [newPermitResp, setNewPermitResp] = useState("");
  const [newPermitHeightInput, setNewPermitHeightInput] = useState("2.5");
  const [newPermitChecklistOk, setNewPermitChecklistOk] = useState(true);
  const [newPermitArlOk, setNewPermitArlOk] = useState(true);
  const [newPermitNotes, setNewPermitNotes] = useState("");

  // New Toolbox Talk form state
  const [newTalkFrente, setNewTalkFrente] = useState("");
  const [newTalkTema, setNewTalkTema] = useState("");
  const [newTalkInstructor, setNewTalkInstructor] = useState("");
  const [newTalkAsistentes, setNewTalkAsistentes] = useState("8");
  const [newTalkAtsOk, setNewTalkAtsOk] = useState(true);

  // New EPP Worker role form state
  const [newWorkerCode, setNewWorkerCode] = useState("");
  const [newWorkerRole, setNewWorkerRole] = useState("");
  const [newWorkerCrew, setNewWorkerCrew] = useState("");
  const [newWorkerCertAlturas, setNewWorkerCertAlturas] = useState(true);

  // New Incident / CAPA form state
  const [newIncTipo, setNewIncTipo] = useState<SstIncidentType>("condicion_insegura");
  const [newIncFrente, setNewIncFrente] = useState("");
  const [newIncDesc, setNewIncDesc] = useState("");
  const [newIncCapa, setNewIncCapa] = useState("");
  const [newIncResp, setNewIncResp] = useState("");
  const [newIncDeadline, setNewIncDeadline] = useState(() =>
    new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)
  );

  const summary = useMemo(() => computeSstSummary(sstState), [sstState]);

  const totalAsistencias = useMemo(
    () => sstState.charlas.reduce((acc, c) => acc + Number(c.asistentes || 0), 0),
    [sstState.charlas]
  );

  const filteredPermits = useMemo(() => {
    if (permitFilter === "all") return sstState.permisos;
    return sstState.permisos.filter((p) => p.estado === permitFilter);
  }, [sstState.permisos, permitFilter]);

  const notify = (msg: string) => {
    setStatusFeedback(msg);
    setTimeout(() => setStatusFeedback(""), 4500);
  };

  const getPermitTypeLabel = (tipo: SstPermitType): string => {
    switch (tipo) {
      case "alturas":
        return isEn ? "Working at Heights" : "Trabajo en Alturas";
      case "caliente":
        return isEn ? "Hot Work (Weld/Cut)" : "Trabajo en Caliente";
      case "excavacion":
        return isEn ? "Excavation & Trenching" : "Excavación & Zanjas";
      case "electrico":
        return isEn ? "Electrical LOTO" : "Riesgo Eléctrico LOTO";
      case "izaje":
        return isEn ? "Critical Rigging & Lift" : "Izaje de Cargas";
    }
  };

  const getPermitStatusLabel = (estado: SstPermitStatus): string => {
    switch (estado) {
      case "vigente":
        return isEn ? "Active" : "Vigente";
      case "pendiente":
        return isEn ? "Pending Sign-Off" : "Pendiente";
      case "cerrado":
        return isEn ? "Closed" : "Cerrado";
      case "vencido":
        return isEn ? "Expired" : "Vencido";
    }
  };

  const getPermitStatusBadgeClass = (estado: SstPermitStatus): string => {
    switch (estado) {
      case "vigente":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "pendiente":
        return "bg-amber-50 text-amber-800 border-amber-200";
      case "vencido":
        return "bg-rose-50 text-rose-700 border-rose-200";
      case "cerrado":
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  const getIncidentTypeLabel = (tipo: SstIncidentType): string => {
    switch (tipo) {
      case "cuasi_accidente":
        return isEn ? "Near Miss" : "Cuasi-Accidente";
      case "condicion_insegura":
        return isEn ? "Unsafe Condition" : "Condición Insegura";
      case "incidente_leve":
        return isEn ? "First Aid / Minor" : "Incidente Leve";
      case "accidente_lti":
        return isEn ? "Lost-Time Injury (LTI)" : "Accidente Incapacitante (LTI)";
    }
  };

  const handleAddDaysAndHours = () => {
    const crewHeadcount = Math.max(1, sstState.eppTrabajadores.length);
    onChangeSst({
      ...sstState,
      diasSinLti: sstState.diasSinLti + 1,
      horasHombreAcum: sstState.horasHombreAcum + crewHeadcount * 8,
    });
    notify(
      isEn
        ? `Added +1 LTI-free day and +${crewHeadcount * 8} man-hours.`
        : `Sumado +1 día sin LTI y +${crewHeadcount * 8} horas-hombre acumuladas.`
    );
  };

  const handleAddPermit = (e: React.FormEvent) => {
    e.preventDefault();
    const frente = newPermitFrente.trim();
    if (!frente) return;

    const rawHeight = Number(newPermitHeightInput || 0);
    const heightM =
      newPermitTipo === "alturas"
        ? isEn
          ? Math.round((rawHeight / FT_PER_METER) * 100) / 100
          : Math.round(rawHeight * 100) / 100
        : undefined;

    const nextNumber = sstState.permisos.length + 1;
    const prefix = isDemo ? "PTAR-NB-" : "PTAR-";
    const codigo = `${prefix}${String(nextNumber).padStart(3, "0")}`;
    const readyToAuthorize = newPermitChecklistOk && newPermitArlOk;

    const newItem: SstPermit = {
      id: `ptar-${Date.now()}`,
      codigo,
      fecha: new Date().toISOString().slice(0, 10),
      tipo: newPermitTipo,
      frente,
      frenteEn: frente,
      responsable: newPermitResp.trim() || (isEn ? "Site HSE Officer" : "Inspector SST / Residente"),
      responsableEn: newPermitResp.trim() || "Site HSE Officer",
      alturaM: heightM,
      ptarChecklistOk: newPermitChecklistOk,
      arlVerificada: newPermitArlOk,
      estado: readyToAuthorize ? "vigente" : "pendiente",
      notas: newPermitNotes.trim() || undefined,
      notasEn: newPermitNotes.trim() || undefined,
    };

    onChangeSst({
      ...sstState,
      permisos: [newItem, ...sstState.permisos],
    });
    setNewPermitFrente("");
    setNewPermitNotes("");
    notify(
      readyToAuthorize
        ? isEn
          ? `Permit ${codigo} issued and active.`
          : `Permiso ${codigo} emitido en estado Vigente.`
        : isEn
          ? `Permit ${codigo} saved as Pending (requires checklist & insurance verification).`
          : `Permiso ${codigo} creado como Pendiente (falta checklist o ARL vigente).`
    );
  };

  const handleCyclePermitStatus = (permitId: string) => {
    const order: SstPermitStatus[] = ["pendiente", "vigente", "cerrado", "vencido"];
    const nextPermits = sstState.permisos.map((p) => {
      if (p.id !== permitId) return p;
      const idx = order.indexOf(p.estado);
      const nextEstado = order[(idx + 1) % order.length];
      // Enforce safety gate: cannot set "vigente" if ARL or checklist failed
      if (nextEstado === "vigente" && (!p.arlVerificada || !p.ptarChecklistOk)) {
        return { ...p, ptarChecklistOk: true, arlVerificada: true, estado: "vigente" as SstPermitStatus };
      }
      return { ...p, estado: nextEstado };
    });
    onChangeSst({ ...sstState, permisos: nextPermits });
  };

  const handleAddTalk = (e: React.FormEvent) => {
    e.preventDefault();
    const tema = newTalkTema.trim();
    if (!tema) return;
    const item: SstTalk = {
      id: `talk-${Date.now()}`,
      fecha: new Date().toISOString().slice(0, 10),
      frente: newTalkFrente.trim() || (isEn ? "All Active Crews" : "Todos los Frentes de Obra"),
      frenteEn: newTalkFrente.trim() || "All Active Crews",
      tema,
      temaEn: tema,
      instructor: newTalkInstructor.trim() || (isEn ? "Site HSE Officer" : "Coordinación SST"),
      instructorEn: newTalkInstructor.trim() || "Site HSE Officer",
      asistentes: Math.max(1, Number(newTalkAsistentes || 1)),
      atsCompletado: newTalkAtsOk,
    };
    onChangeSst({
      ...sstState,
      charlas: [item, ...sstState.charlas],
    });
    setNewTalkTema("");
    setNewTalkFrente("");
    notify(isEn ? "Daily Toolbox Talk & ATS logged." : "Charla de 5 min & ATS registrada.");
  };

  const handleToggleTalkAts = (talkId: string) => {
    onChangeSst({
      ...sstState,
      charlas: sstState.charlas.map((c) =>
        c.id === talkId ? { ...c, atsCompletado: !c.atsCompletado } : c
      ),
    });
  };

  const handleToggleWorkerEpp = (
    workerId: string,
    field: "casco" | "botas" | "arnes" | "guantes" | "gafas"
  ) => {
    onChangeSst({
      ...sstState,
      eppTrabajadores: sstState.eppTrabajadores.map((w) =>
        w.id === workerId ? { ...w, [field]: !w[field] } : w
      ),
    });
  };

  const handleAddEppWorker = (e: React.FormEvent) => {
    e.preventDefault();
    const role = newWorkerRole.trim();
    if (!role) return;
    const nextCode =
      newWorkerCode.trim() ||
      `OP-${String(sstState.eppTrabajadores.length + 1).padStart(2, "0")}`;
    const item: SstEppWorker = {
      id: `epp-${Date.now()}`,
      codigo: nextCode,
      rol: role,
      rolEn: role,
      cuadrilla: newWorkerCrew.trim() || (isEn ? "Field Crew" : "Frente General"),
      cargoCertAltura: newWorkerCertAlturas,
      venceCertAltura: new Date(Date.now() + 210 * 86400000).toISOString().slice(0, 10),
      estadoAfiliacion: "activa",
      casco: true,
      botas: true,
      arnes: newWorkerCertAlturas,
      guantes: true,
      gafas: true,
    };
    onChangeSst({
      ...sstState,
      eppTrabajadores: [...sstState.eppTrabajadores, item],
    });
    setNewWorkerCode("");
    setNewWorkerRole("");
    setNewWorkerCrew("");
    notify(isEn ? `Worker role ${nextCode} added to PPE matrix.` : `Rol ${nextCode} agregado a Matriz EPP.`);
  };

  const handleAddIncident = (e: React.FormEvent) => {
    e.preventDefault();
    const desc = newIncDesc.trim();
    if (!desc) return;
    const item: SstIncident = {
      id: `inc-${Date.now()}`,
      fecha: new Date().toISOString().slice(0, 10),
      tipo: newIncTipo,
      frente: newIncFrente.trim() || (isEn ? "General Site" : "Frente General"),
      frenteEn: newIncFrente.trim() || "General Site",
      descripcion: desc,
      descripcionEn: desc,
      accionCapa: newIncCapa.trim() || (isEn ? "Immediate corrective barrier & crew briefing" : "Corrección inmediata y verificación en campo"),
      accionCapaEn: newIncCapa.trim() || "Immediate corrective barrier & crew briefing",
      responsable: newIncResp.trim() || (isEn ? "Site Supervisor / HSE" : "Residente / SST"),
      fechaLimite: newIncDeadline,
      cerrado: false,
    };
    onChangeSst({
      ...sstState,
      diasSinLti: newIncTipo === "accidente_lti" ? 0 : sstState.diasSinLti,
      incidentes: [item, ...sstState.incidentes],
    });
    setNewIncDesc("");
    setNewIncCapa("");
    setNewIncFrente("");
    notify(
      newIncTipo === "accidente_lti"
        ? isEn
          ? "LTI event logged. LTI-free streak reset to 0."
          : "Evento LTI registrado. Contador de días sin accidentes reiniciado."
        : isEn
          ? "CAPA safety observation logged."
          : "Novedad y acción CAPA registrada."
    );
  };

  const handleToggleIncidentClosed = (incId: string) => {
    onChangeSst({
      ...sstState,
      incidentes: sstState.incidentes.map((inc) =>
        inc.id === incId ? { ...inc, cerrado: !inc.cerrado } : inc
      ),
    });
  };

  const handleExportCsv = () => {
    const headers = isEn
      ? [
          "Permit Code",
          "Date",
          "Risk Type",
          "Work Zone",
          "Supervisor",
          "Height (ft)",
          "Checklist OK",
          "Insurance Verified",
          "Status",
        ]
      : [
          "Código PTAR",
          "Fecha",
          "Tipo Riesgo",
          "Frente de Obra",
          "Responsable",
          "Altura (m)",
          "Checklist OK",
          "ARL Vigente",
          "Estado",
        ];

    const rows = sstState.permisos.map((p) => [
      p.codigo,
      p.fecha,
      getPermitTypeLabel(p.tipo),
      isEn ? p.frenteEn || p.frente : p.frente,
      isEn ? p.responsableEn || p.responsable : p.responsable,
      p.alturaM != null
        ? isEn
          ? (p.alturaM * FT_PER_METER).toFixed(2)
          : p.alturaM.toFixed(2)
        : "-",
      p.ptarChecklistOk ? "SI" : "NO",
      p.arlVerificada ? "SI" : "NO",
      getPermitStatusLabel(p.estado),
    ]);

    downloadCsvUtf8(
      `SST_PTAR_${safeProyecto.id}_${new Date().toISOString().slice(0, 10)}.csv`,
      headers,
      rows
    );
  };

  const handlePrintDossier = (singlePermit?: SstPermit) => {
    if (singlePermit) {
      const hDisplay =
        singlePermit.alturaM != null
          ? formatQty(singlePermit.alturaM, "m", 2)
          : isEn
            ? "N/A"
            : "N/A";
      const htmlBody = `
        <div class="kpi-grid">
          <div class="kpi"><div class="kpi-label">${isEn ? "Permit Code" : "Código PTAR"}</div><div class="kpi-val">${escapeHtml(singlePermit.codigo)}</div></div>
          <div class="kpi"><div class="kpi-label">${isEn ? "Hazard Class" : "Tipo de Riesgo"}</div><div class="kpi-val">${escapeHtml(getPermitTypeLabel(singlePermit.tipo))}</div></div>
          <div class="kpi"><div class="kpi-label">${isEn ? "Elevation / Depth" : "Altura / Cota"}</div><div class="kpi-val">${escapeHtml(hDisplay)}</div></div>
          <div class="kpi"><div class="kpi-label">${isEn ? "Authorization" : "Estado"}</div><div class="kpi-val">${escapeHtml(getPermitStatusLabel(singlePermit.estado))}</div></div>
        </div>
        <h2>${isEn ? "Work Zone & Safety Controls" : "Frente de Trabajo & Verificación Pre-Operacional"}</h2>
        <table>
          <tbody>
            <tr><th>${isEn ? "Work Zone" : "Frente"}</th><td>${escapeHtml(isEn ? singlePermit.frenteEn || singlePermit.frente : singlePermit.frente)}</td></tr>
            <tr><th>${isEn ? "Competent Supervisor" : "Responsable SST / Coordinador"}</th><td>${escapeHtml(isEn ? singlePermit.responsableEn || singlePermit.responsable : singlePermit.responsable)}</td></tr>
            <tr><th>${isEn ? "Pre-Task Checklist" : "Checklist PTAR Completo"}</th><td>${singlePermit.ptarChecklistOk ? (isEn ? "VERIFIED" : "VERIFICADO") : isEn ? "PENDING" : "PENDIENTE"}</td></tr>
            <tr><th>${isEn ? "Workers' Comp / ARL Coverage" : "Afiliación ARL Riesgo V"}</th><td>${singlePermit.arlVerificada ? (isEn ? "ACTIVE" : "VIGENTE") : isEn ? "UNVERIFIED" : "SIN VERIFICAR"}</td></tr>
            <tr><th>${isEn ? "Control Notes" : "Observaciones Técnicas"}</th><td>${escapeHtml((isEn ? singlePermit.notasEn || singlePermit.notas : singlePermit.notas) || "-")}</td></tr>
          </tbody>
        </table>
      `;
      const opened = openExecutivePrintSheet({
        docTitle: `${isEn ? "Safe Work Permit (PTAR)" : "Permiso de Trabajo Seguro (PTAR)"} • ${singlePermit.codigo}`,
        badge: isEn ? "ISO 45001 • OSHA 1926 PTAR" : "ISO 45001 • RES. 4272 PTAR",
        projectTitle: safeProyecto.nombre,
        clientName: safeProyecto.contratante,
        periodOrDate: singlePermit.fecha,
        bodyHtml: htmlBody,
        footerNote: (safeProyecto.firma_residente || "").replace(/\n/g, " — "),
        lang,
      });
      if (!opened) notify(isEn ? "Allow pop-ups to print PDF." : "Permite ventanas emergentes para imprimir PDF.");
      return;
    }

    const permitsRows = sstState.permisos
      .map(
        (p) => `<tr>
          <td><strong>${escapeHtml(p.codigo)}</strong></td>
          <td>${escapeHtml(p.fecha)}</td>
          <td>${escapeHtml(getPermitTypeLabel(p.tipo))}</td>
          <td>${escapeHtml(isEn ? p.frenteEn || p.frente : p.frente)}</td>
          <td class="num">${p.alturaM != null ? escapeHtml(formatQty(p.alturaM, "m", 2)) : "-"}</td>
          <td><span class="pill">${escapeHtml(getPermitStatusLabel(p.estado))}</span></td>
        </tr>`
      )
      .join("");

    const capaRows =
      sstState.incidentes.length === 0
        ? `<tr><td colspan="5">${isEn ? "No incidents or open CAPA actions recorded." : "Sin novedades ni acciones CAPA registradas."}</td></tr>`
        : sstState.incidentes
            .map(
              (i) => `<tr>
                <td>${escapeHtml(i.fecha)}</td>
                <td>${escapeHtml(getIncidentTypeLabel(i.tipo))}</td>
                <td>${escapeHtml(isEn ? i.descripcionEn : i.descripcion)}</td>
                <td>${escapeHtml(isEn ? i.accionCapaEn : i.accionCapa)}</td>
                <td><span class="pill">${i.cerrado ? (isEn ? "Closed" : "Cerrada") : isEn ? "Open" : "Abierta"}</span></td>
              </tr>`
            )
            .join("");

    const bodyHtml = `
      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-label">${isEn ? "LTI-Free Days" : "Días Sin Accidentes"}</div><div class="kpi-val">${summary.diasSinLti}</div></div>
        <div class="kpi"><div class="kpi-label">${isEn ? "Man-Hours Worked" : "Horas-Hombre"}</div><div class="kpi-val">${summary.horasHombreAcum.toLocaleString()}</div></div>
        <div class="kpi"><div class="kpi-label">${isEn ? "Active PTAR Permits" : "Permisos PTAR Activos"}</div><div class="kpi-val">${summary.permisosActivos}</div></div>
        <div class="kpi"><div class="kpi-label">${isEn ? "PPE Compliance" : "Cumplimiento EPP"}</div><div class="kpi-val">${summary.eppPct}%</div></div>
      </div>
      <h2>${isEn ? "High-Risk Work Permits Log (PTAR)" : "Registro de Permisos de Trabajo de Alto Riesgo (PTAR)"}</h2>
      <table>
        <thead>
          <tr>
            <th>${isEn ? "Code" : "Código"}</th>
            <th>${isEn ? "Date" : "Fecha"}</th>
            <th>${isEn ? "Risk Class" : "Tipo"}</th>
            <th>${isEn ? "Work Zone" : "Frente"}</th>
            <th class="num">${isEn ? "Elevation" : "Altura"}</th>
            <th>${isEn ? "Status" : "Estado"}</th>
          </tr>
        </thead>
        <tbody>${permitsRows}</tbody>
      </table>
      <h2>${isEn ? "CAPA & Safety Observations Register" : "Registro de Hallazgos & Acciones CAPA"}</h2>
      <table>
        <thead>
          <tr>
            <th>${isEn ? "Date" : "Fecha"}</th>
            <th>${isEn ? "Category" : "Categoría"}</th>
            <th>${isEn ? "Observation" : "Descripción"}</th>
            <th>${isEn ? "CAPA Action" : "Acción Correctiva"}</th>
            <th>${isEn ? "Status" : "Estado"}</th>
          </tr>
        </thead>
        <tbody>${capaRows}</tbody>
      </table>
    `;

    const opened = openExecutivePrintSheet({
      docTitle: isEn
        ? "Executive HSE & Jobsite Safety Dossier"
        : "Informe Ejecutivo de Seguridad & Salud en el Trabajo (SST)",
      badge: isEn ? "ISO 45001 • OSHA 1926" : "ISO 45001 • DEC. 1072 / RES. 4272",
      projectTitle: safeProyecto.nombre,
      clientName: safeProyecto.contratante,
      periodOrDate: new Date().toISOString().slice(0, 10),
      bodyHtml,
      footerNote: (safeProyecto.firma_residente || "").replace(/\n/g, " — "),
      lang,
    });
    if (!opened) notify(isEn ? "Allow pop-ups to generate PDF." : "Permite ventanas emergentes para generar el PDF.");
  };

  return (
    <div className="space-y-4">
      {/* Executive Header Card */}
      <div className="bento-card flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold tracking-wide uppercase">
            <ShieldCheck className="w-3.5 h-3.5" />
            {isEn
              ? "ISO 45001 • OSHA 29 CFR 1926 • FALL PROTECTION (>6 ft)"
              : "ISO 45001 • DEC. 1072 / RES. 0312 • RES. 4272 ALTURAS (>1.50 m)"}
          </div>
          <h2 className="text-lg font-extrabold text-slate-900">
            {isEn
              ? "Site Health, Safety & Environment (HSE) Control"
              : "Seguridad, Salud en el Trabajo (SST) & Permisos PTAR"}
          </h2>
          <p className="text-xs text-slate-600 max-w-3xl">
            {isEn
              ? "Real-time site risk governance: high-risk PTAR permits, daily 5-minute toolbox talks & JSA, crew PPE compliance matrix, and CAPA corrective tracking."
              : "Gestión preventiva en obra: permisos de alto riesgo (PTAR), charlas pre-operacionales con ATS, matriz de entrega de EPP y seguimiento de hallazgos CAPA."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleAddDaysAndHours}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition-colors"
            title={
              isEn
                ? "Close shift safely (+1 LTI-free day & +8h per active crew role)"
                : "Cerrar jornada segura (+1 día sin accidentes & +8h por trabajador)"
            }
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            {isEn ? "+1 Safe Day" : "+1 Día Seguro"}
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            {isEn ? "Export HSE CSV" : "CSV SST"}
          </button>
          <button
            type="button"
            onClick={() => handlePrintDossier()}
            className="steel-btn-primary inline-flex items-center gap-1.5 text-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            {isEn ? "Print HSE Dossier (PDF)" : "Informe SST PDF"}
          </button>
        </div>
      </div>

      {/* Mode / Persistence Banner */}
      <div
        className={`rounded-xl px-3.5 py-2.5 text-xs flex flex-wrap items-center justify-between gap-2 border ${
          isDemo
            ? "bg-amber-50/90 border-amber-200 text-amber-900"
            : "bg-sky-50/90 border-sky-200 text-sky-900"
        }`}
      >
        <div className="flex items-center gap-2 font-medium">
          <Info className="w-4 h-4 shrink-0" />
          <span>
            {isDemo
              ? isEn
                ? "Interactive LinkedIn Demo Sandbox: PTAR permits, PPE toggles, and CAPAs work live in session memory without storing PII or modifying cloud records."
                : "Sandbox Interactivo Demo: puedes emitir permisos PTAR, marcar EPP y cerrar CAPAs en esta sesión sin almacenar datos personales ni alterar la nube."
              : isEn
                ? `Active Project Storage (${safeProyecto.nombre}): All HSE logs and CAPAs auto-save cleanly for this project.`
                : `Almacenamiento de Proyecto (${safeProyecto.nombre}): Los registros SST y CAPAs se guardan automáticamente para esta obra.`}
          </span>
        </div>
        {statusFeedback && (
          <span className="px-2.5 py-0.5 rounded-full bg-white/90 border border-slate-300 text-slate-800 font-bold">
            {statusFeedback}
          </span>
        )}
      </div>

      {/* 4 Executive HSE KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
        <div className="bento-card flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              {isEn ? "LTI-Free Safety Streak" : "Días Sin Accidentes (LTI)"}
            </span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 tabular-nums">
              {summary.diasSinLti}
            </span>
            <span className="text-xs font-semibold text-emerald-700">
              {isEn ? "days continuous" : "días continuos"}
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600">
            <span>
              {summary.horasHombreAcum.toLocaleString()} {isEn ? "man-hrs" : "H-H"}
            </span>
            <span className="font-bold text-slate-800">
              TRIR: {summary.trir.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="bento-card flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              {isEn ? "High-Risk Permits (PTAR)" : "Permisos Alto Riesgo (PTAR)"}
            </span>
            <Flame className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 tabular-nums">
              {summary.permisosActivos}
            </span>
            <span className="text-xs font-semibold text-slate-600">
              / {sstState.permisos.length} {isEn ? "total logs" : "emitidos"}
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-600">
            {isEn
              ? "Heights >6 ft • Hot Work • LOTO"
              : "Alturas >1.50 m • Caliente • Izaje"}
          </div>
        </div>

        <div className="bento-card flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              {isEn ? "Toolbox Talks & JSA" : "Charlas 5 Min & ATS"}
            </span>
            <Users className="w-4 h-4 text-sky-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 tabular-nums">
              {summary.charlasTotales}
            </span>
            <span className="text-xs font-semibold text-sky-700">
              {totalAsistencias} {isEn ? "attendees" : "asistencias"}
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-600">
            {isEn
              ? "Daily shift pre-task briefings"
              : "Charlas pre-operacionales por frente"}
          </div>
        </div>

        <div className="bento-card flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              {isEn ? "PPE Matrix & Open CAPA" : "Cumplimiento EPP & CAPA"}
            </span>
            <HardHat className="w-4 h-4 text-slate-700" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 tabular-nums">
              {summary.eppPct}%
            </span>
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                summary.capasAbiertas > 0
                  ? "bg-amber-50 text-amber-800 border-amber-200"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200"
              }`}
            >
              {summary.capasAbiertas}{" "}
              {isEn ? "open CAPA" : summary.capasAbiertas === 1 ? "CAPA abierta" : "CAPAs abiertas"}
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-600">
            {sstState.eppTrabajadores.length}{" "}
            {isEn ? "crew roles audited" : "roles en matriz EPP"}
          </div>
        </div>
      </div>

      {/* Sub-Navigation Pills */}
      <div className="bento-card p-2 flex flex-wrap gap-1.5">
        {(
          [
            {
              key: "permisos" as SstSubView,
              icon: ClipboardCheck,
              label: isEn
                ? `Safe Work Permits (${sstState.permisos.length})`
                : `Permisos PTAR (${sstState.permisos.length})`,
            },
            {
              key: "charlas" as SstSubView,
              icon: Users,
              label: isEn
                ? `Toolbox Talks & JSA (${sstState.charlas.length})`
                : `Charlas & ATS (${sstState.charlas.length})`,
            },
            {
              key: "epp" as SstSubView,
              icon: HardHat,
              label: isEn
                ? `PPE & Altitude Certs (${sstState.eppTrabajadores.length})`
                : `Matriz EPP & Alturas (${sstState.eppTrabajadores.length})`,
            },
            {
              key: "incidentes" as SstSubView,
              icon: AlertTriangle,
              label: isEn
                ? `Incidents & CAPA (${sstState.incidentes.length})`
                : `Hallazgos & CAPA (${sstState.incidentes.length})`,
            },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = subView === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setSubView(tab.key)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                active
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* SUB-VIEW 1: PTAR PERMITS */}
      {subView === "permisos" && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          <div className="xl:col-span-4 bento-card space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
              <Plus className="w-4 h-4 text-sky-600" />
              <h3 className="text-sm font-bold text-slate-900">
                {isEn ? "Issue New PTAR Permit" : "Emitir Nuevo Permiso PTAR"}
              </h3>
            </div>

            <form onSubmit={handleAddPermit} className="space-y-2.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {isEn ? "Risk / Permit Type" : "Tipo de Trabajo de Alto Riesgo"}
                </label>
                <select
                  value={newPermitTipo}
                  onChange={(e) => setNewPermitTipo(e.target.value as SstPermitType)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-slate-900 font-medium"
                >
                  <option value="alturas">{getPermitTypeLabel("alturas")}</option>
                  <option value="caliente">{getPermitTypeLabel("caliente")}</option>
                  <option value="excavacion">{getPermitTypeLabel("excavacion")}</option>
                  <option value="electrico">{getPermitTypeLabel("electrico")}</option>
                  <option value="izaje">{getPermitTypeLabel("izaje")}</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {isEn ? "Work Zone / Activity" : "Frente de Obra / Actividad"}
                </label>
                <input
                  type="text"
                  required
                  value={newPermitFrente}
                  onChange={(e) => setNewPermitFrente(e.target.value)}
                  placeholder={
                    isEn ? "e.g., East Facade Scaffolding" : "Ej: Andamio Fachada Este / Cubierta"
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {isEn ? "Supervisor Role" : "Coordinador / Resp."}
                  </label>
                  <input
                    type="text"
                    value={newPermitResp}
                    onChange={(e) => setNewPermitResp(e.target.value)}
                    placeholder={isEn ? "Site HSE Officer" : "Inspector SST"}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-slate-900"
                  />
                </div>
                {newPermitTipo === "alturas" && (
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      {isEn ? "Work Height (ft)" : "Altura Trabajo (m)"}
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={newPermitHeightInput}
                      onChange={(e) => setNewPermitHeightInput(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-slate-900 tabular-nums"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {isEn ? "Safety Control Measures" : "Controles & Equipos Verificados"}
                </label>
                <input
                  type="text"
                  value={newPermitNotes}
                  onChange={(e) => setNewPermitNotes(e.target.value)}
                  placeholder={
                    isEn
                      ? "e.g., Dual lanyard, 5,000 lb anchor"
                      : "Ej: Línea de vida certificada y punto de anclaje"
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-slate-900"
                />
              </div>

              <div className="space-y-1.5 pt-1">
                <label className="flex items-center gap-2 text-slate-700 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newPermitChecklistOk}
                    onChange={(e) => setNewPermitChecklistOk(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  {isEn
                    ? "JSA & Pre-task hazard checklist complete"
                    : "Checklist PTAR y análisis de riesgo completo"}
                </label>
                <label className="flex items-center gap-2 text-slate-700 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newPermitArlOk}
                    onChange={(e) => setNewPermitArlOk(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  {isEn
                    ? "Active Workers' Comp & Altitude Cert verified"
                    : "ARL Riesgo V & Certificado Alturas vigente"}
                </label>
              </div>

              <button
                type="submit"
                className="w-full steel-btn-primary justify-center inline-flex items-center gap-1.5 mt-2"
              >
                <FileCheck2 className="w-3.5 h-3.5" />
                {isEn ? "Authorize & Log PTAR" : "Autorizar & Registrar PTAR"}
              </button>
            </form>
          </div>

          <div className="xl:col-span-8 bento-card space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {isEn ? "Site Work Permits Register (PTAR)" : "Registro Maestro de Permisos PTAR"}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {isEn
                    ? "Click a status badge to cycle workflow state (Pending → Active → Closed)."
                    : "Haz clic en la insignia de estado para cambiar su ciclo (Pendiente → Vigente → Cerrado)."}
                </p>
              </div>
              <div className="flex flex-wrap gap-1">
                {(["all", "vigente", "pendiente", "cerrado"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setPermitFilter(f)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold border ${
                      permitFilter === f
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {f === "all"
                      ? isEn
                        ? "All"
                        : "Todos"
                      : getPermitStatusLabel(f)}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500">
                    <th className="py-2 pr-2">{isEn ? "Code" : "Código"}</th>
                    <th className="py-2 px-2">{isEn ? "Hazard / Zone" : "Riesgo / Frente"}</th>
                    <th className="py-2 px-2">{isEn ? "Elevation" : "Cota"}</th>
                    <th className="py-2 px-2">{isEn ? "Controls" : "Validación"}</th>
                    <th className="py-2 px-2">{isEn ? "Status" : "Estado"}</th>
                    <th className="py-2 pl-2 text-right">{isEn ? "PDF" : "Imprimir"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPermits.map((p) => {
                    const alturaDisplay =
                      p.alturaM != null
                        ? isEn
                          ? `${convertQtyValue(p.alturaM, "m").toFixed(1)} ft`
                          : `${p.alturaM.toFixed(2)} m`
                        : "—";
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/70">
                        <td className="py-2.5 pr-2 align-top">
                          <div className="font-extrabold text-slate-900">{p.codigo}</div>
                          <div className="text-[10px] text-slate-500">{p.fecha}</div>
                        </td>
                        <td className="py-2.5 px-2 align-top">
                          <div className="font-bold text-slate-800">
                            {getPermitTypeLabel(p.tipo)}
                          </div>
                          <div className="text-slate-600">
                            {isEn ? p.frenteEn || p.frente : p.frente}
                          </div>
                          {(p.notas || p.notasEn) && (
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              {isEn ? p.notasEn || p.notas : p.notas}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-2 align-top font-semibold text-slate-800 tabular-nums whitespace-nowrap">
                          {alturaDisplay}
                        </td>
                        <td className="py-2.5 px-2 align-top">
                          <div className="flex flex-col gap-1">
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-bold ${
                                p.ptarChecklistOk ? "text-emerald-700" : "text-amber-700"
                              }`}
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              {p.ptarChecklistOk
                                ? isEn
                                  ? "JSA Checked"
                                  : "Checklist OK"
                                : isEn
                                  ? "JSA Pending"
                                  : "Sin Checklist"}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-bold ${
                                p.arlVerificada ? "text-emerald-700" : "text-rose-700"
                              }`}
                            >
                              <Activity className="w-3 h-3" />
                              {p.arlVerificada
                                ? isEn
                                  ? "WC/ARL OK"
                                  : "ARL Vigente"
                                : isEn
                                  ? "No ARL"
                                  : "ARL Pend."}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-2 align-top">
                          <button
                            type="button"
                            onClick={() => handleCyclePermitStatus(p.id)}
                            className={`px-2.5 py-1 rounded-full border text-[10px] font-extrabold transition-transform active:scale-95 ${getPermitStatusBadgeClass(
                              p.estado
                            )}`}
                            title={isEn ? "Click to advance status" : "Clic para cambiar estado"}
                          >
                            {getPermitStatusLabel(p.estado)}
                          </button>
                        </td>
                        <td className="py-2.5 pl-2 align-top text-right">
                          <button
                            type="button"
                            onClick={() => handlePrintDossier(p)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-[10px] font-bold"
                            title={isEn ? "Print single PTAR" : "Imprimir PTAR"}
                          >
                            <Printer className="w-3 h-3" />
                            PTAR
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-VIEW 2: TOOLBOX TALKS & ATS */}
      {subView === "charlas" && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          <div className="xl:col-span-4 bento-card space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
              <Plus className="w-4 h-4 text-sky-600" />
              <h3 className="text-sm font-bold text-slate-900">
                {isEn ? "Log Toolbox Talk & JSA" : "Registrar Charla de 5 Min & ATS"}
              </h3>
            </div>
            <form onSubmit={handleAddTalk} className="space-y-2.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {isEn ? "Safety Briefing Topic" : "Tema de Seguridad / Riesgo Crítico"}
                </label>
                <input
                  type="text"
                  required
                  value={newTalkTema}
                  onChange={(e) => setNewTalkTema(e.target.value)}
                  placeholder={
                    isEn
                      ? "e.g., Anchor inspection & edge fall prevention"
                      : "Ej: Inspección de eslingas, cascos y orden en andamios"
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-slate-900"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {isEn ? "Work Zone / Crew" : "Frente o Cuadrilla Participante"}
                </label>
                <input
                  type="text"
                  value={newTalkFrente}
                  onChange={(e) => setNewTalkFrente(e.target.value)}
                  placeholder={
                    isEn ? "Structure & Envelope Crews" : "Frente Estructura & Mampostería"
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-slate-900"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {isEn ? "Instructor" : "Líder / Instructor"}
                  </label>
                  <input
                    type="text"
                    value={newTalkInstructor}
                    onChange={(e) => setNewTalkInstructor(e.target.value)}
                    placeholder={isEn ? "HSE Officer" : "Coordinación SST"}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {isEn ? "Attendees" : "Asistentes"}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newTalkAsistentes}
                    onChange={(e) => setNewTalkAsistentes(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-slate-900 tabular-nums"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-slate-700 font-semibold cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={newTalkAtsOk}
                  onChange={(e) => setNewTalkAtsOk(e.target.checked)}
                  className="rounded border-slate-300"
                />
                {isEn
                  ? "Daily JSA (Job Safety Analysis) signed by crew"
                  : "ATS (Análisis de Trabajo Seguro) diligenciado y firmado"}
              </label>
              <button
                type="submit"
                className="w-full steel-btn-primary justify-center inline-flex items-center gap-1.5 mt-2"
              >
                <Users className="w-3.5 h-3.5" />
                {isEn ? "Save Toolbox Talk" : "Guardar Charla & ATS"}
              </button>
            </form>
          </div>

          <div className="xl:col-span-8 bento-card space-y-3">
            <div className="border-b border-slate-200 pb-2">
              <h3 className="text-sm font-bold text-slate-900">
                {isEn ? "Toolbox Talks & JSA Attendance Log" : "Historial de Charlas Diarias & ATS"}
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {sstState.charlas.map((c) => (
                <div
                  key={c.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 flex flex-col justify-between gap-2"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="font-extrabold text-sky-700">{c.fecha}</span>
                      <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700 font-bold">
                        {c.asistentes} {isEn ? "workers" : "operarios"}
                      </span>
                    </div>
                    <h4 className="mt-1.5 text-xs font-extrabold text-slate-900 leading-snug">
                      {isEn ? c.temaEn : c.tema}
                    </h4>
                    <p className="mt-1 text-[11px] text-slate-600">
                      <strong>{isEn ? "Zone:" : "Frente:"}</strong>{" "}
                      {isEn ? c.frenteEn || c.frente : c.frente}
                    </p>
                  </div>
                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">
                      {isEn ? c.instructorEn || c.instructor : c.instructor}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggleTalkAts(c.id)}
                      className={`px-2 py-0.5 rounded-full border font-bold ${
                        c.atsCompletado
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-amber-50 text-amber-800 border-amber-200"
                      }`}
                    >
                      {c.atsCompletado
                        ? isEn
                          ? "JSA Signed"
                          : "ATS Firmado"
                        : isEn
                          ? "JSA Pending"
                          : "ATS Pendiente"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUB-VIEW 3: PPE MATRIX */}
      {subView === "epp" && (
        <div className="space-y-4">
          <div className="bento-card space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {isEn
                    ? "Field Crew PPE Compliance & Altitude Certification Matrix"
                    : "Matriz de Dotación EPP, Seguridad Social & Certificación Alturas"}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {isEn
                    ? "Click any PPE badge to audit compliance live (auto-updates Executive PPE KPI %)."
                    : "Haz clic en cada ítem de EPP para auditar en tiempo real (recalcula el % de cumplimiento)."}
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-extrabold">
                {summary.eppPct}% {isEn ? "Global PPE Score" : "Cumplimiento Global"}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500">
                    <th className="py-2 pr-2">{isEn ? "ID / Role" : "Código / Rol"}</th>
                    <th className="py-2 px-2">{isEn ? "Crew" : "Cuadrilla"}</th>
                    <th className="py-2 px-2">{isEn ? "Heights Cert" : "Cert. Alturas"}</th>
                    <th className="py-2 px-2 text-center">{isEn ? "Helmet" : "Casco"}</th>
                    <th className="py-2 px-2 text-center">{isEn ? "Boots" : "Botas"}</th>
                    <th className="py-2 px-2 text-center">{isEn ? "Harness" : "Arnés"}</th>
                    <th className="py-2 px-2 text-center">{isEn ? "Gloves" : "Guantes"}</th>
                    <th className="py-2 px-2 text-center">{isEn ? "Goggles" : "Gafas"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sstState.eppTrabajadores.map((w) => (
                    <tr key={w.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 pr-2">
                        <div className="font-extrabold text-slate-900">
                          {w.codigo} • {isEn ? w.rolEn : w.rol}
                        </div>
                        <span className="inline-block mt-0.5 text-[10px] font-bold text-emerald-700">
                          {isEn ? "Insurance: Active" : `Afiliación: ${w.estadoAfiliacion.toUpperCase()}`}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-slate-700 font-medium">{w.cuadrilla}</td>
                      <td className="py-2.5 px-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            w.cargoCertAltura
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-slate-100 text-slate-600 border-slate-200"
                          }`}
                        >
                          {w.cargoCertAltura
                            ? `${isEn ? "Valid thru" : "Vence"} ${w.venceCertAltura}`
                            : isEn
                              ? "Ground Only"
                              : "Solo Nivel 0"}
                        </span>
                      </td>
                      {(["casco", "botas", "arnes", "guantes", "gafas"] as const).map((field) => {
                        const checked = w[field];
                        return (
                          <td key={field} className="py-2.5 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleWorkerEpp(w.id, field)}
                              className={`w-7 h-7 rounded-lg border text-[11px] font-black transition-colors ${
                                checked
                                  ? "bg-emerald-600 text-white border-emerald-700"
                                  : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                              }`}
                              title={
                                checked
                                  ? isEn
                                    ? "Delivered & inspected"
                                    : "Entregado y vigente"
                                  : isEn
                                    ? "Missing / Replacement required"
                                    : "Faltante / Requiere reposición"
                              }
                            >
                              {checked ? "OK" : "!"}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <form
            onSubmit={handleAddEppWorker}
            className="bento-card grid grid-cols-1 md:grid-cols-5 gap-2.5 items-end text-xs"
          >
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {isEn ? "Worker Code" : "Código Op."}
              </label>
              <input
                type="text"
                value={newWorkerCode}
                onChange={(e) => setNewWorkerCode(e.target.value)}
                placeholder="OP-06"
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-slate-900"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">
                {isEn ? "Trade / Functional Role (no PII)" : "Cargo / Rol Funcional (sin datos privados)"}
              </label>
              <input
                type="text"
                required
                value={newWorkerRole}
                onChange={(e) => setNewWorkerRole(e.target.value)}
                placeholder={isEn ? "e.g., Certified Welder" : "Ej: Oficial Soldador Certificado"}
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-slate-900"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {isEn ? "Assigned Crew" : "Cuadrilla"}
              </label>
              <input
                type="text"
                value={newWorkerCrew}
                onChange={(e) => setNewWorkerCrew(e.target.value)}
                placeholder={isEn ? "Roof / Steel" : "Frente Cubierta"}
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-slate-900"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newWorkerCertAlturas}
                  onChange={(e) => setNewWorkerCertAlturas(e.target.checked)}
                />
                {isEn ? "Heights Cert." : "Cert. Alturas"}
              </label>
              <button
                type="submit"
                className="steel-btn-primary justify-center inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                {isEn ? "Add Role" : "Agregar Rol"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SUB-VIEW 4: INCIDENTS & CAPA */}
      {subView === "incidentes" && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          <div className="xl:col-span-4 bento-card space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
              <Zap className="w-4 h-4 text-amber-600" />
              <h3 className="text-sm font-bold text-slate-900">
                {isEn ? "Report Observation / CAPA" : "Reportar Hallazgo o Cuasi-Accidente"}
              </h3>
            </div>
            <form onSubmit={handleAddIncident} className="space-y-2.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {isEn ? "Classification" : "Clasificación del Evento"}
                </label>
                <select
                  value={newIncTipo}
                  onChange={(e) => setNewIncTipo(e.target.value as SstIncidentType)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-slate-900 font-medium"
                >
                  <option value="condicion_insegura">{getIncidentTypeLabel("condicion_insegura")}</option>
                  <option value="cuasi_accidente">{getIncidentTypeLabel("cuasi_accidente")}</option>
                  <option value="incidente_leve">{getIncidentTypeLabel("incidente_leve")}</option>
                  <option value="accidente_lti">{getIncidentTypeLabel("accidente_lti")}</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {isEn ? "Work Zone" : "Frente / Ubicación"}
                </label>
                <input
                  type="text"
                  value={newIncFrente}
                  onChange={(e) => setNewIncFrente(e.target.value)}
                  placeholder={isEn ? "e.g., Stairwell / Material Yard" : "Ej: Patio de Acopio / Cubierta"}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-slate-900"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {isEn ? "Condition / Finding Description" : "Descripción de la Condición / Evento"}
                </label>
                <textarea
                  required
                  rows={2}
                  value={newIncDesc}
                  onChange={(e) => setNewIncDesc(e.target.value)}
                  placeholder={
                    isEn
                      ? "Describe unsafe act or hazard..."
                      : "Describe la condición insegura o hallazgo preventivo..."
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-slate-900"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {isEn ? "Corrective / Preventive Action (CAPA)" : "Acción Correctiva / Preventiva (CAPA)"}
                </label>
                <textarea
                  rows={2}
                  value={newIncCapa}
                  onChange={(e) => setNewIncCapa(e.target.value)}
                  placeholder={
                    isEn
                      ? "Engineering barrier, signage, or retraining..."
                      : "Barrera física, señalización o reposición inmediata..."
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-slate-900"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {isEn ? "Owner Role" : "Responsable Cierre"}
                  </label>
                  <input
                    type="text"
                    value={newIncResp}
                    onChange={(e) => setNewIncResp(e.target.value)}
                    placeholder={isEn ? "Site Supervisor" : "Residente / SST"}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {isEn ? "Target Close Date" : "Fecha Límite"}
                  </label>
                  <input
                    type="date"
                    value={newIncDeadline}
                    onChange={(e) => setNewIncDeadline(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-slate-900"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full steel-btn-primary justify-center inline-flex items-center gap-1.5"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                {isEn ? "Register CAPA Action" : "Registrar Hallazgo & CAPA"}
              </button>
            </form>
          </div>

          <div className="xl:col-span-8 bento-card space-y-3">
            <div className="border-b border-slate-200 pb-2">
              <h3 className="text-sm font-bold text-slate-900">
                {isEn
                  ? "Incident Log & Corrective/Preventive Actions (CAPA)"
                  : "Seguimiento de Hallazgos, Cuasi-Accidentes & Planes CAPA"}
              </h3>
            </div>
            {sstState.incidentes.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-xs text-slate-500">
                {isEn
                  ? "Zero open safety observations or incidents recorded on this project."
                  : "Sin hallazgos ni incidentes registrados para este proyecto."}
              </div>
            ) : (
              <div className="space-y-2.5">
                {sstState.incidentes.map((inc) => (
                  <div
                    key={inc.id}
                    className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        <span
                          className={`px-2 py-0.5 rounded-full font-extrabold border ${
                            inc.tipo === "accidente_lti"
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : inc.tipo === "incidente_leve"
                                ? "bg-amber-50 text-amber-800 border-amber-200"
                                : "bg-sky-50 text-sky-800 border-sky-200"
                          }`}
                        >
                          {getIncidentTypeLabel(inc.tipo)}
                        </span>
                        <span className="font-bold text-slate-700">{inc.fecha}</span>
                        <span className="text-slate-500">
                          • {isEn ? inc.frenteEn || inc.frente : inc.frente}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-900">
                        {isEn ? inc.descripcionEn : inc.descripcion}
                      </p>
                      <p className="text-xs text-slate-600">
                        <strong className="text-slate-800">CAPA:</strong>{" "}
                        {isEn ? inc.accionCapaEn : inc.accionCapa}
                      </p>
                      <div className="text-[11px] text-slate-500">
                        {isEn ? "Owner:" : "Responsable:"}{" "}
                        <strong className="text-slate-700">{inc.responsable}</strong> •{" "}
                        {isEn ? "Due:" : "Límite:"} {inc.fechaLimite}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleIncidentClosed(inc.id)}
                      className={`shrink-0 px-3 py-1.5 rounded-lg border text-xs font-extrabold transition-colors ${
                        inc.cerrado
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                          : "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
                      }`}
                    >
                      {inc.cerrado
                        ? isEn
                          ? "CAPA Closed"
                          : "CAPA Cerrada"
                        : isEn
                          ? "Mark CAPA Closed"
                          : "Cerrar CAPA"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
