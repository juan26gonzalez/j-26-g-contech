"use client";

import React, { useMemo, useState } from "react";
import {
  Banknote,
  Building2,
  Calculator,
  CheckCircle2,
  Download,
  Hammer,
  Info,
  Link2,
  Plus,
  Printer,
  RefreshCw,
  ShieldAlert,
  Users,
  Wallet,
} from "lucide-react";
import {
  computePayrollSummary,
  computeWorkerPayRow,
  downloadCsvUtf8,
  escapeHtml,
  openExecutivePrintSheet,
  syncPayrollDestajoWith5D,
} from "../lib/erpStorage";
import { useAppPreferences } from "../lib/i18n";
import type {
  ConsolidationResult,
  PayrollModalidad,
  PayrollProjectData,
  PayrollStatus,
  PayrollWorkerEntry,
  ProjectConfig,
} from "../lib/types";
import {
  localizeActivity,
  sanitizeDemoProject,
  unitConversionFactor,
} from "../lib/units";

interface TabNominaPagosProps {
  proyecto: ProjectConfig;
  data: ConsolidationResult;
  payrollState: PayrollProjectData;
  onChangePayroll: (next: PayrollProjectData) => void;
  isDemo?: boolean;
}

export default function TabNominaPagos({
  proyecto,
  data,
  payrollState,
  onChangePayroll,
  isDemo = false,
}: TabNominaPagosProps) {
  const {
    lang,
    currency,
    rates,
    formatMoney,
    formatUnitMoney,
    convertQtyValue,
    unitLabel,
  } = useAppPreferences();
  const isEn = lang === "en";
  const fxRate = rates[currency] || 1;
  const safeProyecto = useMemo(
    () => sanitizeDemoProject(proyecto, Boolean(isDemo), lang),
    [proyecto, isDemo, lang]
  );

  const [filterModalidad, setFilterModalidad] = useState<"all" | PayrollModalidad>("all");
  const [feedback, setFeedback] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  // Add Worker / Piecework Crew form state
  const [newCodigo, setNewCodigo] = useState("");
  const [newNombreRol, setNewNombreRol] = useState("");
  const [newEspecialidad, setNewEspecialidad] = useState("");
  const [newModalidad, setNewModalidad] = useState<PayrollModalidad>("destajo");
  const [newMatchItem, setNewMatchItem] = useState<string>(() =>
    data.df_5d[0] ? String(data.df_5d[0].Item) : ""
  );
  const [newUnidadPago, setNewUnidadPago] = useState("m²");
  const [newTarifaInputDisplay, setNewTarifaInputDisplay] = useState("");
  const [newDias, setNewDias] = useState("10");
  const [newArlRiesgoV, setNewArlRiesgoV] = useState(true);

  const summary = useMemo(
    () => computePayrollSummary(payrollState, lang),
    [payrollState, lang]
  );

  const filteredRegistros = useMemo(() => {
    if (filterModalidad === "all") return payrollState.registros;
    return payrollState.registros.filter((r) => r.modalidad === filterModalidad);
  }, [payrollState.registros, filterModalidad]);

  const laborSharePct = useMemo(() => {
    const directExecuted = Number(data.totals?.total_costo_ejecutado || 0);
    if (directExecuted <= 0) return 0;
    return Math.round((summary.costoTotalEmpresaCop / directExecuted) * 1000) / 10;
  }, [summary.costoTotalEmpresaCop, data.totals?.total_costo_ejecutado]);

  const notify = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(""), 4500);
  };

  const getStatusLabel = (estado: PayrollStatus): string => {
    switch (estado) {
      case "borrador":
        return isEn ? "Draft" : "Borrador";
      case "aprobada":
        return isEn ? "Approved" : "Aprobada";
      case "pagada":
        return isEn ? "Disbursed" : "Pagada";
    }
  };

  const getStatusBadgeClass = (estado: PayrollStatus): string => {
    switch (estado) {
      case "pagada":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "aprobada":
        return "bg-sky-50 text-sky-700 border-sky-200";
      case "borrador":
        return "bg-amber-50 text-amber-800 border-amber-200";
    }
  };

  const handleSync5D = () => {
    const { next, updatedCount } = syncPayrollDestajoWith5D(payrollState, data);
    onChangePayroll(next);
    notify(
      updatedCount > 0
        ? isEn
          ? `Synced ${updatedCount} piecework crew(s) from BIM 5D executed quantities.`
          : `Sincronizadas ${updatedCount} cuadrilla(s) a destajo desde Bitácora & Avance 5D.`
        : isEn
          ? "All BIM 5D piecework quantities are already up to date."
          : "Las cantidades a destajo ya coinciden con el avance real 5D."
    );
  };

  const handlePeriodChange = (val: string) => {
    onChangePayroll({
      ...payrollState,
      periodo: val,
    });
  };

  const handleUpdateEntry = (
    id: string,
    updater: (entry: PayrollWorkerEntry) => PayrollWorkerEntry
  ) => {
    onChangePayroll({
      ...payrollState,
      registros: payrollState.registros.map((r) => (r.id === id ? updater(r) : r)),
    });
  };

  const handleCycleStatus = (id: string) => {
    const order: PayrollStatus[] = ["borrador", "aprobada", "pagada"];
    handleUpdateEntry(id, (r) => {
      const idx = order.indexOf(r.estado);
      return { ...r, estado: order[(idx + 1) % order.length] };
    });
  };

  const handleSelect5DItem = (itemCode: string) => {
    setNewMatchItem(itemCode);
    const matched = data.df_5d.find((d) => String(d.Item) === itemCode);
    if (matched) {
      setNewUnidadPago(matched.Unidad || "m²");
      if (!newEspecialidad.trim()) {
        setNewEspecialidad(matched.Actividad.slice(0, 46));
      }
      const suggestedMetricCop = Math.max(
        9000,
        Math.round(Number(matched.Precio_Unitario || 0) * 0.25)
      );
      const uFactor = isEn ? unitConversionFactor(matched.Unidad) : 1;
      const suggestedDisplay = suggestedMetricCop / fxRate / uFactor;
      setNewTarifaInputDisplay(
        currency === "COP"
          ? String(Math.round(suggestedDisplay))
          : suggestedDisplay.toFixed(2)
      );
    }
  };

  const handleAddWorker = (e: React.FormEvent) => {
    e.preventDefault();
    const rolName = newNombreRol.trim();
    if (!rolName) return;

    const matched =
      newModalidad === "destajo" && newMatchItem
        ? data.df_5d.find((d) => String(d.Item) === newMatchItem)
        : undefined;

    const unit =
      newModalidad === "destajo" ? matched?.Unidad || newUnidadPago || "m²" : "día";

    const rawRateDisplay = Number(newTarifaInputDisplay || 0);
    // Convert active display currency + imperial unit rate back into base COP per metric unit/day
    const unitFactor = newModalidad === "destajo" && isEn ? unitConversionFactor(unit) : 1;
    const baseRateCop =
      rawRateDisplay > 0
        ? Math.round(rawRateDisplay * fxRate * unitFactor)
        : newModalidad === "jornal"
          ? 110000
          : 18000;

    const nextCode =
      newCodigo.trim() ||
      `${newModalidad === "destajo" ? "CREW" : "EMP"}-${String(
        payrollState.registros.length + 1
      ).padStart(2, "0")}`;

    const entry: PayrollWorkerEntry = {
      id: `pay-${Date.now()}`,
      codigo: nextCode,
      nombreRol: rolName,
      nombreRolEn: rolName,
      especialidad:
        newEspecialidad.trim() ||
        (matched ? matched.Actividad.slice(0, 48) : isEn ? "Field Crew" : "Ejecución Obra"),
      especialidadEn:
        newEspecialidad.trim() ||
        (matched ? localizeActivity(matched.Actividad, "en").slice(0, 48) : "Field Crew"),
      modalidad: newModalidad,
      unidadPago: unit,
      tarifaBaseCop: baseRateCop,
      diasTrabajados: Math.max(1, Number(newDias || 10)),
      horasExtra: 0,
      cantidadDestajoMetric:
        newModalidad === "destajo" && matched
          ? Number(matched.Cantidad_Ejecutada || 0)
          : 0,
      actividadMatchItem: newModalidad === "destajo" && matched ? String(matched.Item) : undefined,
      prestamoDescuentoCop: 0,
      afiliadoArlRiesgoV: newArlRiesgoV,
      estado: "borrador",
      notas: matched
        ? isEn
          ? `Linked to BIM 5D Item ${matched.Item}`
          : `Vinculado con Ítem BIM 5D ${matched.Item}`
        : undefined,
    };

    onChangePayroll({
      ...payrollState,
      registros: [...payrollState.registros, entry],
    });
    setNewCodigo("");
    setNewNombreRol("");
    setNewEspecialidad("");
    setNewTarifaInputDisplay("");
    setShowAddForm(false);
    notify(
      isEn
        ? `Added ${nextCode} to current pay period.`
        : `${nextCode} agregado a la planilla del periodo.`
    );
  };

  const handleExportCsv = () => {
    const headers = isEn
      ? [
          "Code",
          "Role / Crew",
          "Specialty / Trade",
          "Type",
          "Unit",
          "Days",
          "OT Hours",
          "Piecework Qty",
          `Gross Pay (${currency})`,
          `Withholding (${currency})`,
          `Advances/Loans (${currency})`,
          `Net Pay (${currency})`,
          `Employer Burden (${currency})`,
          `Total Employer Cost (${currency})`,
          "Status",
        ]
      : [
          "Código",
          "Rol / Cuadrilla",
          "Especialidad",
          "Modalidad",
          "Unidad",
          "Días",
          "Horas Extra",
          "Cant. Destajo",
          `Devengado Bruto (${currency})`,
          `Salud + Pensión (${currency})`,
          `Préstamos (${currency})`,
          `Neto a Pagar (${currency})`,
          `Carga Empleador ARL/SS (${currency})`,
          `Costo Total Empresa (${currency})`,
          "Estado",
        ];

    const toCurr = (cop: number) =>
      currency === "COP"
        ? Math.round(cop)
        : Number((cop / fxRate).toFixed(2));

    const rows = payrollState.registros.map((r) => {
      const calc = computeWorkerPayRow(r, lang);
      const qtyOut =
        r.modalidad === "destajo"
          ? convertQtyValue(r.cantidadDestajoMetric, r.unidadPago).toFixed(2)
          : "-";
      return [
        r.codigo,
        isEn ? r.nombreRolEn : r.nombreRol,
        isEn ? r.especialidadEn : r.especialidad,
        r.modalidad === "destajo"
          ? isEn
            ? "Piecework"
            : "Destajo"
          : isEn
            ? "Daily Rate"
            : "Jornal",
        r.modalidad === "destajo"
          ? unitLabel(r.unidadPago)
          : isEn
            ? "day"
            : "día",
        r.diasTrabajados,
        r.horasExtra,
        qtyOut,
        toCurr(calc.devengadoBrutoCop),
        toCurr(calc.deduccionLeyCop),
        toCurr(r.prestamoDescuentoCop),
        toCurr(calc.netoPagarCop),
        toCurr(calc.cargaEmpleadorCop),
        toCurr(calc.costoTotalEmpresaCop),
        getStatusLabel(r.estado),
      ];
    });

    downloadCsvUtf8(
      `Nomina_${safeProyecto.id}_${payrollState.periodo.replace(/\s+/g, "_")}.csv`,
      headers,
      rows
    );
  };

  const handlePrintPayStub = (entry: PayrollWorkerEntry) => {
    const calc = computeWorkerPayRow(entry, lang);
    const rateFormatted =
      entry.modalidad === "destajo"
        ? formatUnitMoney(entry.tarifaBaseCop, entry.unidadPago)
        : `${formatMoney(entry.tarifaBaseCop)} / ${isEn ? "day" : "día"}`;
    const qtyText =
      entry.modalidad === "destajo"
        ? `${convertQtyValue(entry.cantidadDestajoMetric, entry.unidadPago).toFixed(2)} ${unitLabel(entry.unidadPago)}`
        : `${entry.diasTrabajados} ${isEn ? "days" : "días"}`;

    const htmlBody = `
      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-label">${isEn ? "Pay Code" : "Código"}</div><div class="kpi-val">${escapeHtml(entry.codigo)}</div></div>
        <div class="kpi"><div class="kpi-label">${isEn ? "Gross Pay" : "Devengado Bruto"}</div><div class="kpi-val">${escapeHtml(formatMoney(calc.devengadoBrutoCop, 2))}</div></div>
        <div class="kpi"><div class="kpi-label">${isEn ? "Total Deductions" : "Total Descuentos"}</div><div class="kpi-val">${escapeHtml(formatMoney(calc.deduccionLeyCop + entry.prestamoDescuentoCop, 2))}</div></div>
        <div class="kpi"><div class="kpi-label">${isEn ? "Net Pay" : "Neto a Pagar"}</div><div class="kpi-val">${escapeHtml(formatMoney(calc.netoPagarCop, 2))}</div></div>
      </div>
      <h2>${escapeHtml(isEn ? entry.nombreRolEn : entry.nombreRol)} — ${escapeHtml(isEn ? entry.especialidadEn : entry.especialidad)}</h2>
      <table>
        <thead>
          <tr>
            <th>${isEn ? "Concept" : "Concepto"}</th>
            <th>${isEn ? "Basis / Quantity" : "Base / Cantidad"}</th>
            <th class="num">${isEn ? "Earnings" : "Devengado"}</th>
            <th class="num">${isEn ? "Deductions" : "Deducciones"}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${entry.modalidad === "destajo" ? (isEn ? "Piecework Production" : "Producción a Destajo") : isEn ? "Base Daily Wage" : "Salario Ordinario Jornal"}</td>
            <td>${escapeHtml(qtyText)} @ ${escapeHtml(rateFormatted)}</td>
            <td class="num">${escapeHtml(formatMoney(calc.salarioOrdinarioCop, 2))}</td>
            <td class="num">-</td>
          </tr>
          <tr>
            <td>${isEn ? "Overtime Pay (1.5x)" : "Recargo Horas Extra (1.25x)"}</td>
            <td>${entry.horasExtra} h</td>
            <td class="num">${escapeHtml(formatMoney(calc.recargoExtrasCop, 2))}</td>
            <td class="num">-</td>
          </tr>
          <tr>
            <td>${isEn ? "Statutory FICA / Withholding (7.65%)" : "Seguridad Social Trabajador (Salud 4% + Pensión 4%)"}</td>
            <td>${isEn ? "7.65% of gross" : "8.00% IBC"}</td>
            <td class="num">-</td>
            <td class="num">${escapeHtml(formatMoney(calc.deduccionLeyCop, 2))}</td>
          </tr>
          <tr>
            <td>${isEn ? "Tool / Cash Advance Loan Repayment" : "Descuento Préstamo / Herramienta"}</td>
            <td>-</td>
            <td class="num">-</td>
            <td class="num">${escapeHtml(formatMoney(entry.prestamoDescuentoCop, 2))}</td>
          </tr>
        </tbody>
      </table>
      <h2>${isEn ? "Employer Burden & Cost Allocation (Project Cost 5D)" : "Aportes Empleador & Costo Real de Proyecto"}</h2>
      <table>
        <tbody>
          <tr>
            <td>${entry.afiliadoArlRiesgoV ? (isEn ? "Workers' Comp High Risk (6.50%)" : "ARL Riesgo V Construcción (6.96%)") : isEn ? "Workers' Comp Admin (1.50%)" : "ARL Riesgo I (0.522%)"}</td>
            <td class="num">${escapeHtml(formatMoney(calc.arlObraCop, 2))}</td>
          </tr>
          <tr>
            <td>${isEn ? "Employer FICA / FUTA & Fringe (8.25%)" : "Pensión 12% + CCF 4% + Prov. Prestaciones 21.83%"}</td>
            <td class="num">${escapeHtml(formatMoney(calc.seguridadSocialYPrestacionesCop, 2))}</td>
          </tr>
          <tr>
            <td><strong>${isEn ? "Total Project Labor Burden" : "Costo Total Empresa (Bruto + Aportes)"}</strong></td>
            <td class="num"><strong>${escapeHtml(formatMoney(calc.costoTotalEmpresaCop, 2))}</strong></td>
          </tr>
        </tbody>
      </table>
    `;

    const opened = openExecutivePrintSheet({
      docTitle: isEn
        ? `Pay Stub / Certified Wage Statement • ${entry.codigo}`
        : `Volante Individual de Pago • ${entry.codigo}`,
      badge: isEn ? "CERTIFIED PAYROLL STATEMENT" : "VOLANTE DE NÓMINA PILA",
      projectTitle: safeProyecto.nombre,
      clientName: safeProyecto.contratante,
      periodOrDate: payrollState.periodo,
      bodyHtml: htmlBody,
      footerNote: (safeProyecto.firma_residente || "").replace(/\n/g, " — "),
      lang,
    });
    if (!opened) notify(isEn ? "Allow pop-ups to print pay stub." : "Permite ventanas emergentes para imprimir volante.");
  };

  const handlePrintConsolidated = () => {
    const rowsHtml = payrollState.registros
      .map((r) => {
        const calc = computeWorkerPayRow(r, lang);
        const qtyDisplay =
          r.modalidad === "destajo"
            ? `${convertQtyValue(r.cantidadDestajoMetric, r.unidadPago).toFixed(1)} ${unitLabel(r.unidadPago)}`
            : `${r.diasTrabajados} d`;
        return `<tr>
          <td><strong>${escapeHtml(r.codigo)}</strong></td>
          <td>${escapeHtml(isEn ? r.nombreRolEn : r.nombreRol)}</td>
          <td>${r.modalidad === "destajo" ? (isEn ? "Piecework" : "Destajo") : isEn ? "Daily" : "Jornal"}</td>
          <td class="num">${escapeHtml(qtyDisplay)}</td>
          <td class="num">${escapeHtml(formatMoney(calc.devengadoBrutoCop, 2))}</td>
          <td class="num">${escapeHtml(formatMoney(calc.deduccionLeyCop + r.prestamoDescuentoCop, 2))}</td>
          <td class="num"><strong>${escapeHtml(formatMoney(calc.netoPagarCop, 2))}</strong></td>
          <td class="num">${escapeHtml(formatMoney(calc.costoTotalEmpresaCop, 2))}</td>
          <td><span class="pill">${escapeHtml(getStatusLabel(r.estado))}</span></td>
        </tr>`;
      })
      .join("");

    const htmlBody = `
      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-label">${isEn ? "Gross Payroll" : "Devengado Bruto"}</div><div class="kpi-val">${escapeHtml(formatMoney(summary.devengadoBrutoCop, 2))}</div></div>
        <div class="kpi"><div class="kpi-label">${isEn ? "Deductions" : "Deducciones"}</div><div class="kpi-val">${escapeHtml(formatMoney(summary.deduccionesCop, 2))}</div></div>
        <div class="kpi"><div class="kpi-label">${isEn ? "Net Payable" : "Neto a Dispersar"}</div><div class="kpi-val">${escapeHtml(formatMoney(summary.netoPagarCop, 2))}</div></div>
        <div class="kpi"><div class="kpi-label">${isEn ? "Total Project Burden" : "Costo Total Empresa"}</div><div class="kpi-val">${escapeHtml(formatMoney(summary.costoTotalEmpresaCop, 2))}</div></div>
      </div>
      <h2>${isEn ? "Consolidated Construction Payroll Sheet" : "Planilla Consolidada de Nómina Mixta & Destajo 5D"}</h2>
      <table>
        <thead>
          <tr>
            <th>${isEn ? "Code" : "Código"}</th>
            <th>${isEn ? "Role / Crew" : "Cargo / Cuadrilla"}</th>
            <th>${isEn ? "Type" : "Modalidad"}</th>
            <th class="num">${isEn ? "Units / Days" : "Cant. / Días"}</th>
            <th class="num">${isEn ? "Gross" : "Bruto"}</th>
            <th class="num">${isEn ? "Deduct." : "Deduc."}</th>
            <th class="num">${isEn ? "Net Pay" : "Neto Pagar"}</th>
            <th class="num">${isEn ? "Total Cost" : "Costo Emp."}</th>
            <th>${isEn ? "Status" : "Estado"}</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    `;

    const opened = openExecutivePrintSheet({
      docTitle: isEn
        ? "Consolidated Construction Payroll & Certified Labor Sheet"
        : "Planilla Consolidada de Nómina & Liquidación Destajo",
      badge: isEn
        ? `CERTIFIED PAYROLL • ${currency}`
        : `NÓMINA MIXTA PILA • ${currency}`,
      projectTitle: safeProyecto.nombre,
      clientName: safeProyecto.contratante,
      periodOrDate: payrollState.periodo,
      bodyHtml: htmlBody,
      footerNote: (safeProyecto.firma_residente || "").replace(/\n/g, " — "),
      lang,
    });
    if (!opened) notify(isEn ? "Allow pop-ups to generate PDF." : "Permite ventanas emergentes para generar el PDF.");
  };

  return (
    <div className="space-y-4">
      {/* Executive Header */}
      <div className="bento-card flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-sky-50 border border-sky-200 text-sky-800 text-[11px] font-bold tracking-wide uppercase">
            <Wallet className="w-3.5 h-3.5" />
            {isEn
              ? `CERTIFIED PAYROLL • FICA 7.65% + WORKERS' COMP 6.5% • BIM 5D PIECEWORK`
              : `NÓMINA MIXTA PILA • SALUD 4% + PENSIÓN 4% + ARL RIESGO V 6.96% • DESTAJO 5D`}
          </div>
          <h2 className="text-lg font-extrabold text-slate-900">
            {isEn
              ? "Construction Payroll, Piecework & Crew Settlement"
              : "Pago de Nómina Mixta, Jornal & Destajo Vinculado al 5D"}
          </h2>
          <p className="text-xs text-slate-600 max-w-3xl">
            {isEn
              ? "Liquidates site staff daily wages alongside piecework crews synchronized directly from executed BIM 5D quantities, with employer burden and individual pay stubs."
              : "Liquida personal administrativo por jornal junto con cuadrillas a destajo sincronizadas en un clic desde el avance físico BIM 5D y emite volantes de pago."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs">
            <span className="font-bold text-slate-500">
              {isEn ? "Period:" : "Corte:"}
            </span>
            <input
              type="text"
              value={payrollState.periodo}
              onChange={(e) => handlePeriodChange(e.target.value)}
              className="w-28 bg-transparent font-extrabold text-slate-900 focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={handleSync5D}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-sky-300 bg-sky-50 hover:bg-sky-100 text-sky-800 text-xs font-bold transition-colors"
            title={
              isEn
                ? "Pull executed physical quantities from BIM 5D Consolidation for linked piecework crews"
                : "Actualizar cantidades ejecutadas desde Consolidación 5D para cuadrillas a destajo"
            }
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {isEn ? "Sync BIM 5D Quantities" : "Sincronizar Destajo 5D"}
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            {isEn ? "Payroll CSV" : "CSV Nómina"}
          </button>

          <button
            type="button"
            onClick={handlePrintConsolidated}
            className="steel-btn-primary inline-flex items-center gap-1.5 text-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            {isEn ? "Print Sheet (PDF)" : "Planilla PDF"}
          </button>
        </div>
      </div>

      {/* Mode / Notice Bar */}
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
                ? `LinkedIn Demo Sandbox (${currency}): Edit crew days, OT, piecework output, or add crews dynamically. Active conversions use live FX rates.`
                : `Sandbox Interactivo Demo (${currency}): Puedes editar días, horas extra, cantidades de destajo o agregar cuadrillas con conversión multi-moneda en vivo.`
              : isEn
                ? `Active Project Payroll (${safeProyecto.nombre} • ${currency}): Period settlements persist automatically per project.`
                : `Nómina de Proyecto (${safeProyecto.nombre} • ${currency}): Las liquidaciones se guardan automáticamente para esta obra.`}
          </span>
        </div>
        {feedback && (
          <span className="px-2.5 py-0.5 rounded-full bg-white/90 border border-slate-300 text-slate-800 font-bold">
            {feedback}
          </span>
        )}
      </div>

      {/* 4 Executive Payroll KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
        <div className="bento-card flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              {isEn ? "Gross Earned Payroll" : "Devengado Bruto Total"}
            </span>
            <Banknote className="w-4 h-4 text-sky-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 tabular-nums">
            {formatMoney(summary.devengadoBrutoCop)}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600">
            <span>
              {isEn ? "Daily:" : "Jornal:"} {formatMoney(summary.jornalTotalCop)}
            </span>
            <span>
              {isEn ? "Piece:" : "Destajo:"} {formatMoney(summary.destajoTotalCop)}
            </span>
          </div>
        </div>

        <div className="bento-card flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              {isEn ? "Withholding & Advances" : "Deducciones Ley & Préstamos"}
            </span>
            <ShieldAlert className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 tabular-nums">
            {formatMoney(summary.deduccionesCop)}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-600">
            {isEn
              ? "FICA 7.65% statutory + tool/advance deductions"
              : "Salud 4% + Pensión 4% + Préstamos de obra"}
          </div>
        </div>

        <div className="bento-card flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              {isEn ? "Employer Burden (WC/FICA)" : "Carga Empleador (ARL/PILA/Prest.)"}
            </span>
            <Building2 className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 tabular-nums">
            {formatMoney(summary.cargaEmpleadorCop)}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-600">
            {isEn
              ? "Workers' Comp 6.5% + Employer FICA/FUTA 8.25%"
              : "ARL Clase V 6.96% + Pensión/CCF 16% + Prov. 21.83%"}
          </div>
        </div>

        <div className="bento-card flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              {isEn ? "Net Payable & Total Cost" : "Neto a Pagar & Costo Empresa"}
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-700 tabular-nums">
            {formatMoney(summary.netoPagarCop)}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">
              {isEn ? "Total Cost:" : "Costo Real:"}{" "}
              <strong className="text-slate-800">
                {formatMoney(summary.costoTotalEmpresaCop)}
              </strong>
            </span>
            <span className="font-bold text-emerald-700">
              {summary.pagadosCount}/{summary.trabajadores} {isEn ? "paid" : "pag."}
            </span>
          </div>
        </div>
      </div>

      {/* Labor Ratio Bar vs Executed BIM 5D Direct Cost */}
      <div className="bento-card flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-extrabold text-slate-900">
            <Calculator className="w-4 h-4 text-sky-600" />
            {isEn
              ? "BIM 5D Labor-to-Executed Direct Cost Ratio"
              : "Incidencia de Mano de Obra sobre Costo Directo Ejecutado (BIM 5D)"}
          </div>
          <p className="text-[11px] text-slate-600">
            {isEn
              ? `Period Total Employer Burden (${formatMoney(summary.costoTotalEmpresaCop)}) vs. Cumulative Direct Cost Executed (${formatMoney(data.totals?.total_costo_ejecutado || 0)}).`
              : `Costo Real de Nómina del periodo (${formatMoney(summary.costoTotalEmpresaCop)}) frente al Costo Directo Ejecutado (${formatMoney(data.totals?.total_costo_ejecutado || 0)}).`}
          </p>
        </div>
        <div className="w-full md:w-72 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-slate-600">
              {isEn ? "Labor Share" : "Peso Mano de Obra"}
            </span>
            <span className="text-slate-900 tabular-nums">{laborSharePct.toFixed(1)}%</span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
            <div
              className="h-full bg-gradient-to-r from-sky-500 to-emerald-500 rounded-full transition-all"
              style={{ width: `${Math.min(100, laborSharePct)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Payroll Interactive Ledger */}
      <div className="bento-card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              {isEn
                ? `Active Crews & Staff Settlement (${filteredRegistros.length})`
                : `Detalle de Cuadrillas & Personal en Planilla (${filteredRegistros.length})`}
            </h3>
            <p className="text-[11px] text-slate-500">
              {isEn
                ? "Edit days, overtime, or piecework output inline. Click status badge to cycle Draft → Approved → Disbursed."
                : "Edita días, horas extra o cantidad a destajo en línea. Haz clic en el estado para avanzar Borrador → Aprobada → Pagada."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(["all", "jornal", "destajo"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setFilterModalidad(m)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border ${
                  filterModalidad === m
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
              >
                {m === "all"
                  ? isEn
                    ? "All"
                    : "Todos"
                  : m === "jornal"
                    ? isEn
                      ? "Daily Wage"
                      : "Jornal"
                    : isEn
                      ? "Piecework 5D"
                      : "Destajo 5D"}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setShowAddForm((prev) => !prev)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-bold transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              {isEn ? "Add Crew / Staff" : "Agregar Personal / Cuadrilla"}
            </button>
          </div>
        </div>

        {/* Collapsible Add Worker / Crew Form */}
        {showAddForm && (
          <form
            onSubmit={handleAddWorker}
            className="rounded-xl border border-sky-200 bg-sky-50/50 p-3.5 grid grid-cols-1 md:grid-cols-6 gap-2.5 items-end text-xs"
          >
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {isEn ? "Pay Mode" : "Modalidad"}
              </label>
              <select
                value={newModalidad}
                onChange={(e) => setNewModalidad(e.target.value as PayrollModalidad)}
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-slate-900 font-semibold"
              >
                <option value="destajo">{isEn ? "Piecework (Destajo)" : "Destajo (Avance 5D)"}</option>
                <option value="jornal">{isEn ? "Daily Wage" : "Jornal / Fijo"}</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">
                {isEn ? "Role / Crew Title (no PII)" : "Cargo o Nombre de Cuadrilla"}
              </label>
              <input
                type="text"
                required
                value={newNombreRol}
                onChange={(e) => setNewNombreRol(e.target.value)}
                placeholder={
                  isEn ? "e.g., Drywall & Ceiling Crew" : "Ej: Cuadrilla Drywall & Cielo Raso"
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-slate-900"
              />
            </div>

            {newModalidad === "destajo" ? (
              <div className="md:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">
                  {isEn ? "Link BIM 5D Budget Item" : "Vincular Ítem Presupuesto 5D"}
                </label>
                <select
                  value={newMatchItem}
                  onChange={(e) => handleSelect5DItem(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-slate-900"
                >
                  <option value="">{isEn ? "-- Manual piecework --" : "-- Destajo manual --"}</option>
                  {data.df_5d.map((item) => (
                    <option key={item.Item} value={item.Item}>
                      {item.Item} • {localizeActivity(item.Actividad, lang).slice(0, 42)} ({unitLabel(item.Unidad)})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {isEn ? "Days Worked" : "Días Periodo"}
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={newDias}
                  onChange={(e) => setNewDias(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-slate-900 tabular-nums"
                />
              </div>
            )}

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {newModalidad === "destajo"
                  ? `${isEn ? "Rate" : "Tarifa"} (${currency}/${unitLabel(newUnidadPago)})`
                  : `${isEn ? "Daily Rate" : "Jornal"} (${currency})`}
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={newTarifaInputDisplay}
                onChange={(e) => setNewTarifaInputDisplay(e.target.value)}
                placeholder={currency === "COP" ? "22000" : "6.50"}
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-slate-900 tabular-nums"
              />
            </div>

            <div className="md:col-span-6 flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex flex-wrap items-center gap-4">
                <input
                  type="text"
                  value={newCodigo}
                  onChange={(e) => setNewCodigo(e.target.value)}
                  placeholder={isEn ? "Optional Code (CREW-41)" : "Código (opcional, ej: CREW-41)"}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-slate-900 w-44"
                />
                <label className="flex items-center gap-1.5 font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newArlRiesgoV}
                    onChange={(e) => setNewArlRiesgoV(e.target.checked)}
                  />
                  {isEn
                    ? "High-Risk Site Rate (WC 6.5%)"
                    : "Cotiza ARL Riesgo V (6.96%)"}
                </label>
              </div>
              <button type="submit" className="steel-btn-primary inline-flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                {isEn ? "Save to Payroll" : "Guardar en Planilla"}
              </button>
            </div>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500">
                <th className="py-2 pr-2">{isEn ? "Code & Crew" : "Código & Rol"}</th>
                <th className="py-2 px-2">{isEn ? "Rate & Mode" : "Modalidad & Tarifa"}</th>
                <th className="py-2 px-2">{isEn ? "Qty / Days / OT" : "Cant. / Días / H.E."}</th>
                <th className="py-2 px-2 text-right">{isEn ? "Gross Pay" : "Devengado"}</th>
                <th className="py-2 px-2 text-right">{isEn ? "Loans / Deduct." : "Préstamo / Deduc."}</th>
                <th className="py-2 px-2 text-right">{isEn ? "Net Pay" : "Neto Pagar"}</th>
                <th className="py-2 px-2 text-right">{isEn ? "Employer Cost" : "Costo Empresa"}</th>
                <th className="py-2 px-2 text-center">{isEn ? "Status" : "Estado"}</th>
                <th className="py-2 pl-2 text-right">{isEn ? "Stub" : "Volante"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRegistros.map((r) => {
                const calc = computeWorkerPayRow(r, lang);
                const factor = isEn ? unitConversionFactor(r.unidadPago) : 1;
                const displayPieceQty = Number(r.cantidadDestajoMetric || 0) * factor;
                const loanDisplay =
                  currency === "COP"
                    ? Math.round(r.prestamoDescuentoCop)
                    : Number((r.prestamoDescuentoCop / fxRate).toFixed(2));

                return (
                  <tr key={r.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 pr-2 align-top">
                      <div className="font-extrabold text-slate-900">
                        {r.codigo} • {isEn ? r.nombreRolEn : r.nombreRol}
                      </div>
                      <div className="text-[11px] text-slate-600">
                        {isEn ? r.especialidadEn : r.especialidad}
                      </div>
                      {r.actividadMatchItem && (
                        <span className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky-50 border border-sky-200 text-sky-700 text-[10px] font-bold">
                          <Link2 className="w-2.5 h-2.5" />
                          BIM 5D #{r.actividadMatchItem}
                        </span>
                      )}
                    </td>

                    <td className="py-2.5 px-2 align-top whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          r.modalidad === "destajo"
                            ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                            : "bg-slate-100 text-slate-700 border-slate-200"
                        }`}
                      >
                        {r.modalidad === "destajo" ? (
                          <Hammer className="w-2.5 h-2.5" />
                        ) : (
                          <Users className="w-2.5 h-2.5" />
                        )}
                        {r.modalidad === "destajo"
                          ? isEn
                            ? "Piecework"
                            : "Destajo"
                          : isEn
                            ? "Daily Wage"
                            : "Jornal"}
                      </span>
                      <div className="mt-1 font-bold text-slate-800 tabular-nums">
                        {r.modalidad === "destajo"
                          ? formatUnitMoney(r.tarifaBaseCop, r.unidadPago)
                          : `${formatMoney(r.tarifaBaseCop)} / ${isEn ? "day" : "día"}`}
                      </div>
                    </td>

                    <td className="py-2.5 px-2 align-top">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {r.modalidad === "destajo" ? (
                          <label className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded px-1.5 py-1">
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              value={Number(displayPieceQty.toFixed(2))}
                              onChange={(e) => {
                                const rawVal = Math.max(0, Number(e.target.value || 0));
                                const metricVal = rawVal / factor;
                                handleUpdateEntry(r.id, (prev) => ({
                                  ...prev,
                                  cantidadDestajoMetric: metricVal,
                                }));
                              }}
                              className="w-16 bg-transparent font-extrabold text-slate-900 tabular-nums focus:outline-none text-right"
                            />
                            <span className="text-[10px] font-bold text-slate-500">
                              {unitLabel(r.unidadPago)}
                            </span>
                          </label>
                        ) : (
                          <label className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded px-1.5 py-1">
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              max="31"
                              value={r.diasTrabajados}
                              onChange={(e) =>
                                handleUpdateEntry(r.id, (prev) => ({
                                  ...prev,
                                  diasTrabajados: Math.max(0, Number(e.target.value || 0)),
                                }))
                              }
                              className="w-12 bg-transparent font-extrabold text-slate-900 tabular-nums focus:outline-none text-right"
                            />
                            <span className="text-[10px] font-bold text-slate-500">
                              {isEn ? "d" : "días"}
                            </span>
                          </label>
                        )}

                        <label
                          className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded px-1.5 py-1"
                          title={isEn ? "Overtime hours" : "Horas Extra"}
                        >
                          <input
                            type="number"
                            step="1"
                            min="0"
                            value={r.horasExtra}
                            onChange={(e) =>
                              handleUpdateEntry(r.id, (prev) => ({
                                ...prev,
                                horasExtra: Math.max(0, Number(e.target.value || 0)),
                              }))
                            }
                            className="w-10 bg-transparent font-bold text-slate-800 tabular-nums focus:outline-none text-right"
                          />
                          <span className="text-[10px] font-bold text-slate-500">
                            {isEn ? "OT" : "HE"}
                          </span>
                        </label>
                      </div>
                    </td>

                    <td className="py-2.5 px-2 align-top text-right font-bold text-slate-900 tabular-nums whitespace-nowrap">
                      {formatMoney(calc.devengadoBrutoCop)}
                      {calc.recargoExtrasCop > 0 && (
                        <div className="text-[10px] font-medium text-sky-700">
                          +{formatMoney(calc.recargoExtrasCop)} {isEn ? "OT" : "HE"}
                        </div>
                      )}
                    </td>

                    <td className="py-2.5 px-2 align-top text-right whitespace-nowrap">
                      <div className="text-[10px] text-slate-500 tabular-nums">
                        {isEn ? "Tax:" : "SS:"} -{formatMoney(calc.deduccionLeyCop)}
                      </div>
                      <label
                        className="mt-1 inline-flex items-center gap-1 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5"
                        title={
                          isEn
                            ? `Loan / advance deduction (${currency})`
                            : `Descuento préstamo / herramienta (${currency})`
                        }
                      >
                        <span className="text-[10px] text-slate-500">-</span>
                        <input
                          type="number"
                          step={currency === "COP" ? "5000" : "1"}
                          min="0"
                          value={loanDisplay}
                          onChange={(e) => {
                            const valCurr = Math.max(0, Number(e.target.value || 0));
                            const valCop = Math.round(valCurr * fxRate);
                            handleUpdateEntry(r.id, (prev) => ({
                              ...prev,
                              prestamoDescuentoCop: valCop,
                            }));
                          }}
                          className="w-16 bg-transparent font-bold text-rose-700 tabular-nums focus:outline-none text-right text-[11px]"
                        />
                      </label>
                    </td>

                    <td className="py-2.5 px-2 align-top text-right font-black text-emerald-700 tabular-nums whitespace-nowrap">
                      {formatMoney(calc.netoPagarCop)}
                    </td>

                    <td className="py-2.5 px-2 align-top text-right font-bold text-slate-700 tabular-nums whitespace-nowrap">
                      {formatMoney(calc.costoTotalEmpresaCop)}
                      <div className="text-[10px] font-medium text-slate-500">
                        {isEn ? "WC:" : "ARL:"} {formatMoney(calc.arlObraCop)}
                      </div>
                    </td>

                    <td className="py-2.5 px-2 align-top text-center">
                      <button
                        type="button"
                        onClick={() => handleCycleStatus(r.id)}
                        className={`px-2.5 py-1 rounded-full border text-[10px] font-extrabold transition-transform active:scale-95 ${getStatusBadgeClass(
                          r.estado
                        )}`}
                      >
                        {getStatusLabel(r.estado)}
                      </button>
                    </td>

                    <td className="py-2.5 pl-2 align-top text-right">
                      <button
                        type="button"
                        onClick={() => handlePrintPayStub(r)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-[10px] font-bold"
                        title={isEn ? "Print Pay Stub PDF" : "Imprimir Volante PDF"}
                      >
                        <Printer className="w-3 h-3" />
                        {isEn ? "Stub" : "Volante"}
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
  );
}
