"use client";

import React, { useMemo, useState } from "react";
import {
  AlertCircle,
  BadgeDollarSign,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Edit3,
  FileSpreadsheet,
  FileText,
  Info,
  Landmark,
  Plus,
  Printer,
  ShieldCheck,
  Trash2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  computeClientsSummary,
  computeInvoiceNetCop,
  downloadCsvUtf8,
  escapeHtml,
  openExecutivePrintSheet,
} from "../lib/erpStorage";
import { useAppPreferences } from "../lib/i18n";
import type {
  ClientInvoiceEntry,
  ClientInvoiceStatus,
  ClientInvoiceType,
  ClientsProjectData,
  ConsolidationResult,
  LiquidationParams,
  ProjectConfig,
} from "../lib/types";
import { sanitizeDemoProject } from "../lib/units";

interface TabClientesCarteraProps {
  proyecto: ProjectConfig;
  data: ConsolidationResult;
  params: LiquidationParams;
  clientsState: ClientsProjectData;
  onChangeClients: (next: ClientsProjectData) => void;
  isDemo?: boolean;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function TabClientesCartera({
  proyecto,
  data,
  params,
  clientsState,
  onChangeClients,
  isDemo = false,
}: TabClientesCarteraProps) {
  const { lang, currency, rates, formatMoney } = useAppPreferences();
  const isEn = lang === "en";
  const fxRate = rates[currency] || 1;

  const safeProyecto = useMemo(
    () => sanitizeDemoProject(proyecto, Boolean(isDemo), lang),
    [proyecto, isDemo, lang]
  );

  const summary = useMemo(
    () => computeClientsSummary(clientsState, data, params),
    [clientsState, data, params]
  );

  const [statusFilter, setStatusFilter] = useState<"all" | ClientInvoiceStatus>("all");
  const [feedback, setFeedback] = useState("");
  const [editingProfile, setEditingProfile] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);

  // Profile editor state
  const [profNombre, setProfNombre] = useState(clientsState.clienteNombre);
  const [profNit, setProfNit] = useState(clientsState.clienteIdFiscal);
  const [profRep, setProfRep] = useState(clientsState.representanteRol);
  const [profRepEn, setProfRepEn] = useState(clientsState.representanteRolEn);
  const [profCond, setProfCond] = useState(clientsState.condicionCobro);
  const [profCondEn, setProfCondEn] = useState(clientsState.condicionCobroEn);
  const [profCupoDisp, setProfCupoDisp] = useState(() =>
    String(
      currency === "COP"
        ? Math.round(clientsState.cupoAprobadoCop)
        : Number((clientsState.cupoAprobadoCop / fxRate).toFixed(2))
    )
  );

  // Manual invoice creation state
  const [newTipo, setNewTipo] = useState<ClientInvoiceType>("acta_avance");
  const [newNumero, setNewNumero] = useState("");
  const [newConcepto, setNewConcepto] = useState("");
  const [newFechaEmision, setNewFechaEmision] = useState(todayIsoDate());
  const [newFechaVencimiento, setNewFechaVencimiento] = useState(addDaysIso(15));
  const [newBrutoDisplay, setNewBrutoDisplay] = useState("0");
  const [newAutoDeductions, setNewAutoDeductions] = useState(true);
  const [newManualAmortDisplay, setNewManualAmortDisplay] = useState("0");
  const [newManualRetDisplay, setNewManualRetDisplay] = useState("0");
  const [newManualIvaDisplay, setNewManualIvaDisplay] = useState("0");
  const [newEstado, setNewEstado] = useState<ClientInvoiceStatus>("radicada");
  const [newNotas, setNewNotas] = useState("");

  const notify = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(""), 4500);
  };

  const toDisplayAmount = (cop: number): string => {
    if (currency === "COP") return String(Math.round(cop));
    return (cop / fxRate).toFixed(2);
  };

  const fromDisplayAmount = (raw: string): number => {
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.round(n * fxRate);
  };

  const getTypeLabel = (t: ClientInvoiceType): string => {
    const map: Record<ClientInvoiceType, { es: string; en: string }> = {
      anticipo: { es: "Anticipo", en: "Advance" },
      acta_avance: { es: "Acta de Avance", en: "Progress Cert." },
      adicional: { es: "Obra Adicional", en: "Change Order" },
      liberacion_garantia: { es: "Lib. Garantía", en: "Retainage Release" },
    };
    return isEn ? map[t].en : map[t].es;
  };

  const getStatusLabel = (s: ClientInvoiceStatus): string => {
    const map: Record<ClientInvoiceStatus, { es: string; en: string }> = {
      borrador: { es: "Borrador", en: "Draft" },
      radicada: { es: "Radicada", en: "Submitted" },
      aprobada: { es: "Aprobada", en: "Approved" },
      pagada: { es: "Pagada", en: "Collected" },
      vencida: { es: "Vencida", en: "Overdue" },
    };
    return isEn ? map[s].en : map[s].es;
  };

  const getStatusBadgeClass = (s: ClientInvoiceStatus): string => {
    switch (s) {
      case "pagada":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "aprobada":
        return "bg-sky-50 text-sky-700 border-sky-200";
      case "radicada":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "vencida":
        return "bg-rose-50 text-rose-700 border-rose-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-300";
    }
  };

  const openProfileEditor = () => {
    setProfNombre(clientsState.clienteNombre);
    setProfNit(clientsState.clienteIdFiscal);
    setProfRep(clientsState.representanteRol);
    setProfRepEn(clientsState.representanteRolEn);
    setProfCond(clientsState.condicionCobro);
    setProfCondEn(clientsState.condicionCobroEn);
    setProfCupoDisp(toDisplayAmount(clientsState.cupoAprobadoCop));
    setEditingProfile(true);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    onChangeClients({
      ...clientsState,
      clienteNombre: profNombre.trim() || safeProyecto.contratante,
      clienteIdFiscal: profNit.trim() || "TAX-PENDING",
      representanteRol: profRep.trim() || "Supervisión Técnica",
      representanteRolEn: profRepEn.trim() || "Client Representative",
      condicionCobro: profCond.trim() || "Actas Mensuales • Pago 15 días",
      condicionCobroEn: profCondEn.trim() || "Monthly Progress Certs • Net 15",
      cupoAprobadoCop: fromDisplayAmount(profCupoDisp),
    });
    setEditingProfile(false);
    notify(
      isEn
        ? "Client billing profile updated."
        : "Perfil corporativo del cliente actualizado."
    );
  };

  const nextActaSequentialCode = (): string => {
    const actaCount = clientsState.facturas.filter(
      (f) => f.tipo === "acta_avance" || f.tipo === "adicional"
    ).length;
    const prefix = isDemo ? "ACTA-NB-" : "ACTA-";
    return `${prefix}${String(actaCount + 1).padStart(3, "0")}`;
  };

  const handleGenerateActaFrom5D = () => {
    const unbilledGross = summary.porFacturarDeEjecucionCop;
    if (unbilledGross <= 10) {
      notify(
        isEn
          ? "All executed BIM 5D work is already billed in active certificates."
          : "Todo el avance ejecutado BIM 5D actual ya se encuentra facturado en actas activas."
      );
      return;
    }

    const pctAiuDecimal = (params.pct_a + params.pct_i + params.pct_u) / 100;
    const directIncremental =
      pctAiuDecimal > -0.99 ? unbilledGross / (1 + pctAiuDecimal) : unbilledGross;
    const valUIncremental = directIncremental * (params.pct_u / 100);
    const amortAnt = Math.round(unbilledGross * (params.pct_anticipo / 100));
    const retGar = Math.round(unbilledGross * (params.pct_garantia / 100));
    const ivaU = Math.round(valUIncremental * 0.19);
    const code = nextActaSequentialCode();
    const denomBase = Math.max(1, Number(data.totals?.total_ppto_contratado || 0));
    const overallPct = Math.min(
      100,
      (Number(data.totals?.total_costo_ejecutado || 0) / denomBase) * 100
    ).toFixed(1);

    const draft: ClientInvoiceEntry = {
      id: `cli-acta-${Date.now()}`,
      numero: code,
      fechaEmision: todayIsoDate(),
      fechaVencimiento: addDaysIso(15),
      tipo: "acta_avance",
      concepto: `Borrador Acta de Corte BIM 5D (Avance acumulado ${overallPct}% + AIU)`,
      conceptoEn: `BIM 5D Progress Certificate Draft (${overallPct}% Cumulative + AIU)`,
      valorBrutoCop: Math.round(unbilledGross),
      amortizacionAnticipoCop: amortAnt,
      retencionGarantiaCop: retGar,
      ivaCop: ivaU,
      recaudadoCop: 0,
      estado: "borrador",
      notas: `Auto-calculado desde Avance 5D: Ant ${params.pct_anticipo}%, Gar ${params.pct_garantia}%, IVA 19%/U.`,
    };

    onChangeClients({
      ...clientsState,
      facturas: [draft, ...clientsState.facturas],
    });
    notify(
      isEn
        ? `Certificate draft ${code} generated from unbilled BIM 5D progress.`
        : `Borrador ${code} generado desde el saldo ejecutado por facturar BIM 5D.`
    );
  };

  const handleReleaseRetainage = () => {
    if (summary.fondoGarantiaRetenidoCop <= 0) return;
    const retCount = clientsState.facturas.filter(
      (f) => f.tipo === "liberacion_garantia"
    ).length;
    const code = `GAR-${String(retCount + 1).padStart(3, "0")}`;
    const entry: ClientInvoiceEntry = {
      id: `cli-gar-${Date.now()}`,
      numero: code,
      fechaEmision: todayIsoDate(),
      fechaVencimiento: addDaysIso(15),
      tipo: "liberacion_garantia",
      concepto: "Devolución Fondo de Retención y Garantía Contractual",
      conceptoEn: "Contract Warranty Retainage Release",
      valorBrutoCop: Math.round(summary.fondoGarantiaRetenidoCop),
      amortizacionAnticipoCop: 0,
      retencionGarantiaCop: 0,
      ivaCop: 0,
      recaudadoCop: 0,
      estado: "borrador",
      notas: "Liquidación de fondo retenido de actas radicadas.",
    };
    onChangeClients({
      ...clientsState,
      facturas: [entry, ...clientsState.facturas],
    });
    notify(
      isEn
        ? `Retainage release draft ${code} created.`
        : `Borrador de liberación de garantía ${code} creado.`
    );
  };

  const handleCreateManualInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    const brutoCop = fromDisplayAmount(newBrutoDisplay);
    if (brutoCop <= 0) {
      notify(
        isEn
          ? "Gross amount must be greater than zero."
          : "El valor bruto del documento debe ser mayor a cero."
      );
      return;
    }

    let amortCop = fromDisplayAmount(newManualAmortDisplay);
    let retCop = fromDisplayAmount(newManualRetDisplay);
    let ivaCop = fromDisplayAmount(newManualIvaDisplay);

    if (newAutoDeductions && (newTipo === "acta_avance" || newTipo === "adicional")) {
      const pctAiuDecimal = (params.pct_a + params.pct_i + params.pct_u) / 100;
      const directVal = pctAiuDecimal > -0.99 ? brutoCop / (1 + pctAiuDecimal) : brutoCop;
      const uVal = directVal * (params.pct_u / 100);
      amortCop = Math.round(brutoCop * (params.pct_anticipo / 100));
      retCop = Math.round(brutoCop * (params.pct_garantia / 100));
      ivaCop = Math.round(uVal * 0.19);
    } else if (newAutoDeductions) {
      amortCop = 0;
      retCop = 0;
      ivaCop = 0;
    }

    const seqNum = clientsState.facturas.length + 1;
    const defaultPrefix =
      newTipo === "anticipo"
        ? "ANT-"
        : newTipo === "adicional"
        ? "ADI-"
        : newTipo === "liberacion_garantia"
        ? "GAR-"
        : "ACTA-";
    const numero = newNumero.trim() || `${defaultPrefix}${String(seqNum).padStart(3, "0")}`;
    const conceptoEs =
      newConcepto.trim() || `${getTypeLabel(newTipo)} • ${safeProyecto.nombre}`;

    const entry: ClientInvoiceEntry = {
      id: `cli-doc-${Date.now()}`,
      numero,
      fechaEmision: newFechaEmision || todayIsoDate(),
      fechaVencimiento: newFechaVencimiento || addDaysIso(15),
      tipo: newTipo,
      concepto: conceptoEs,
      conceptoEn: conceptoEs,
      valorBrutoCop: brutoCop,
      amortizacionAnticipoCop: amortCop,
      retencionGarantiaCop: retCop,
      ivaCop,
      recaudadoCop: 0,
      estado: newEstado,
      notas: newNotas.trim() || undefined,
    };

    const net = computeInvoiceNetCop(entry);
    if (entry.estado === "pagada") {
      entry.recaudadoCop = net;
    }

    onChangeClients({
      ...clientsState,
      facturas: [entry, ...clientsState.facturas],
    });
    setNewNumero("");
    setNewConcepto("");
    setNewBrutoDisplay("0");
    setNewNotas("");
    setShowNewForm(false);
    notify(
      isEn
        ? `Billing document ${entry.numero} registered.`
        : `Documento ${entry.numero} registrado en cartera.`
    );
  };

  const handleUpdateInvoice = (
    id: string,
    updater: (inv: ClientInvoiceEntry) => ClientInvoiceEntry
  ) => {
    onChangeClients({
      ...clientsState,
      facturas: clientsState.facturas.map((inv) => (inv.id === id ? updater(inv) : inv)),
    });
  };

  const handleCollectedInputChange = (id: string, rawDisplayValue: string) => {
    const newCop = fromDisplayAmount(rawDisplayValue);
    handleUpdateInvoice(id, (inv) => {
      const net = computeInvoiceNetCop(inv);
      const nextStatus: ClientInvoiceStatus =
        net > 0 && newCop >= net
          ? "pagada"
          : inv.estado === "pagada" && newCop < net
          ? "aprobada"
          : inv.estado;
      return {
        ...inv,
        recaudadoCop: newCop,
        estado: nextStatus,
      };
    });
  };

  const handleCollectFull = (id: string) => {
    handleUpdateInvoice(id, (inv) => ({
      ...inv,
      recaudadoCop: computeInvoiceNetCop(inv),
      estado: "pagada",
    }));
    notify(
      isEn ? "Invoice marked 100% collected." : "Factura recaudada al 100% en caja."
    );
  };

  const handleStatusChange = (id: string, nextStatus: ClientInvoiceStatus) => {
    handleUpdateInvoice(id, (inv) => {
      const net = computeInvoiceNetCop(inv);
      return {
        ...inv,
        estado: nextStatus,
        recaudadoCop:
          nextStatus === "pagada" ? Math.max(inv.recaudadoCop, net) : inv.recaudadoCop,
      };
    });
  };

  const handleDeleteInvoice = (id: string, numero: string) => {
    onChangeClients({
      ...clientsState,
      facturas: clientsState.facturas.filter((inv) => inv.id !== id),
    });
    notify(isEn ? `Removed ${numero}.` : `Documento ${numero} eliminado de la lista.`);
  };

  const handleExportCsv = () => {
    const toCurr = (cop: number) =>
      currency === "COP" ? Math.round(cop) : Number((cop / fxRate).toFixed(2));

    const headers = isEn
      ? [
          "Doc #",
          "Type",
          "Issue Date",
          "Due Date",
          "Description",
          `Gross (${currency})`,
          `Advance Amort. (${currency})`,
          `Retainage (${currency})`,
          `VAT/Fee Tax (${currency})`,
          `Net Receivable (${currency})`,
          `Collected (${currency})`,
          `Balance Due AR (${currency})`,
          "Status",
        ]
      : [
          "Documento",
          "Tipo",
          "Emisión",
          "Vencimiento",
          "Concepto",
          `Valor Bruto (${currency})`,
          `Amort. Anticipo (${currency})`,
          `Ret. Garantía (${currency})`,
          `IVA s/ Utilidad (${currency})`,
          `Neto a Cobrar (${currency})`,
          `Recaudado (${currency})`,
          `Saldo Cartera CxC (${currency})`,
          "Estado",
        ];

    const rows = clientsState.facturas.map((inv) => {
      const net = computeInvoiceNetCop(inv);
      const balance = Math.max(0, net - Number(inv.recaudadoCop || 0));
      return [
        inv.numero,
        getTypeLabel(inv.tipo),
        inv.fechaEmision,
        inv.fechaVencimiento,
        isEn ? inv.conceptoEn : inv.concepto,
        toCurr(inv.valorBrutoCop),
        toCurr(inv.amortizacionAnticipoCop),
        toCurr(inv.retencionGarantiaCop),
        toCurr(inv.ivaCop),
        toCurr(net),
        toCurr(inv.recaudadoCop),
        toCurr(balance),
        getStatusLabel(inv.estado),
      ];
    });

    downloadCsvUtf8(
      `Clientes_Cartera_CxC_${safeProyecto.id}_${currency}.csv`,
      headers,
      rows
    );
    notify(
      isEn
        ? "Accounts Receivable CSV exported."
        : "Archivo CSV de Cartera y Actas exportado."
    );
  };

  const handlePrintConsolidatedStatement = () => {
    const tableRows = clientsState.facturas
      .map((inv) => {
        const net = computeInvoiceNetCop(inv);
        const bal = Math.max(0, net - Number(inv.recaudadoCop || 0));
        return `<tr>
          <td><strong>${escapeHtml(inv.numero)}</strong></td>
          <td>${escapeHtml(getTypeLabel(inv.tipo))}</td>
          <td>${escapeHtml(inv.fechaEmision)} / ${escapeHtml(inv.fechaVencimiento)}</td>
          <td>${escapeHtml(isEn ? inv.conceptoEn : inv.concepto)}</td>
          <td class="num">${escapeHtml(formatMoney(inv.valorBrutoCop))}</td>
          <td class="num">${escapeHtml(formatMoney(inv.amortizacionAnticipoCop + inv.retencionGarantiaCop))}</td>
          <td class="num"><strong>${escapeHtml(formatMoney(net))}</strong></td>
          <td class="num">${escapeHtml(formatMoney(inv.recaudadoCop))}</td>
          <td class="num"><strong>${escapeHtml(formatMoney(bal))}</strong></td>
          <td><span class="pill">${escapeHtml(getStatusLabel(inv.estado))}</span></td>
        </tr>`;
      })
      .join("");

    const bodyHtml = `
      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-label">${isEn ? "Contract Value (incl. AIU)" : "Contrato Total (c/ AIU)"}</div><div class="kpi-val">${escapeHtml(formatMoney(summary.valorContratoTotalCop))}</div></div>
        <div class="kpi"><div class="kpi-label">${isEn ? "Official Net Billed" : "Facturado Neto Oficial"}</div><div class="kpi-val">${escapeHtml(formatMoney(summary.totalFacturadoNetoCop))}</div></div>
        <div class="kpi"><div class="kpi-label">${isEn ? "Collected Cash" : "Recaudado en Caja"}</div><div class="kpi-val">${escapeHtml(formatMoney(summary.totalRecaudadoCop))}</div></div>
        <div class="kpi"><div class="kpi-label">${isEn ? "Accounts Receivable (AR)" : "Saldo Cartera CxC"}</div><div class="kpi-val">${escapeHtml(formatMoney(summary.cuentasPorCobrarCop))}</div></div>
      </div>
      <h2>${isEn ? "Client Profile & Contractual Terms" : "Perfil del Cliente y Condiciones"}</h2>
      <table>
        <tbody>
          <tr><td><strong>${isEn ? "Client Entity" : "Razón Social Cliente"}</strong></td><td>${escapeHtml(clientsState.clienteNombre)} (${escapeHtml(clientsState.clienteIdFiscal)})</td><td><strong>${isEn ? "Payment Terms" : "Condición Cobro"}</strong></td><td>${escapeHtml(isEn ? clientsState.condicionCobroEn : clientsState.condicionCobro)}</td></tr>
          <tr><td><strong>${isEn ? "Unbilled Earned Work (WIP)" : "Ejecutado por Facturar (WIP)"}</strong></td><td>${escapeHtml(formatMoney(summary.porFacturarDeEjecucionCop))}</td><td><strong>${isEn ? "Retainage Escrow" : "Fondo Retención Garantía"}</strong></td><td>${escapeHtml(formatMoney(summary.fondoGarantiaRetenidoCop))}</td></tr>
        </tbody>
      </table>
      <h2>${isEn ? "Billing & Collection Ledger" : "Relación de Actas, Anticipos y Cartera"}</h2>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>${isEn ? "Type" : "Tipo"}</th>
            <th>${isEn ? "Issued / Due" : "Emisión / Vence"}</th>
            <th>${isEn ? "Concept" : "Concepto"}</th>
            <th class="num">${isEn ? "Gross" : "Bruto"}</th>
            <th class="num">${isEn ? "Deduct." : "Deducc."}</th>
            <th class="num">${isEn ? "Net Due" : "Neto"}</th>
            <th class="num">${isEn ? "Collected" : "Recaudado"}</th>
            <th class="num">${isEn ? "Balance AR" : "Saldo CxC"}</th>
            <th>${isEn ? "Status" : "Estado"}</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>`;

    const ok = openExecutivePrintSheet({
      docTitle: isEn
        ? "Client Billing & Accounts Receivable Statement"
        : "Estado de Cuenta de Cartera y Actas de Cobro",
      badge: "ERP AR STATEMENT",
      projectTitle: safeProyecto.nombre,
      clientName: clientsState.clienteNombre,
      periodOrDate: `${todayIsoDate()} • ${currency}`,
      bodyHtml,
      footerNote: isEn
        ? `Approved limit ${formatMoney(clientsState.cupoAprobadoCop)} • WIP ${formatMoney(summary.porFacturarDeEjecucionCop)}`
        : `Cupo aprobado ${formatMoney(clientsState.cupoAprobadoCop)} • Por facturar ${formatMoney(summary.porFacturarDeEjecucionCop)}`,
      lang,
    });
    if (!ok) {
      notify(
        isEn
          ? "Allow browser popups to print/save PDF."
          : "Permite ventanas emergentes en tu navegador para imprimir o guardar PDF."
      );
    }
  };

  const handlePrintSingleInvoice = (inv: ClientInvoiceEntry) => {
    const net = computeInvoiceNetCop(inv);
    const bal = Math.max(0, net - Number(inv.recaudadoCop || 0));
    const bodyHtml = `
      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-label">${isEn ? "Document #" : "Documento #"}</div><div class="kpi-val">${escapeHtml(inv.numero)}</div></div>
        <div class="kpi"><div class="kpi-label">${isEn ? "Gross Value" : "Valor Bruto"}</div><div class="kpi-val">${escapeHtml(formatMoney(inv.valorBrutoCop))}</div></div>
        <div class="kpi"><div class="kpi-label">${isEn ? "Net Payable" : "Neto a Pagar"}</div><div class="kpi-val">${escapeHtml(formatMoney(net))}</div></div>
        <div class="kpi"><div class="kpi-label">${isEn ? "Pending Balance" : "Saldo Pendiente"}</div><div class="kpi-val">${escapeHtml(formatMoney(bal))}</div></div>
      </div>
      <h2>${isEn ? "Financial Liquidation Breakdown" : "Desglose Financiero Contractual"}</h2>
      <table>
        <tbody>
          <tr><td><strong>${isEn ? "Concept" : "Concepto"}</strong></td><td>${escapeHtml(isEn ? inv.conceptoEn : inv.concepto)}</td></tr>
          <tr><td><strong>${isEn ? "Document Type" : "Tipo de Documento"}</strong></td><td>${escapeHtml(getTypeLabel(inv.tipo))}</td></tr>
          <tr><td><strong>${isEn ? "Issued / Due Date" : "Emisión / Vencimiento"}</strong></td><td>${escapeHtml(inv.fechaEmision)} -> ${escapeHtml(inv.fechaVencimiento)}</td></tr>
          <tr><td><strong>(+) ${isEn ? "Gross Certificate Value (incl. AIU)" : "Valor Bruto Acta (incl. AIU)"}</strong></td><td class="num">${escapeHtml(formatMoney(inv.valorBrutoCop))}</td></tr>
          <tr><td><strong>(-) ${isEn ? "Advance Amortization" : "Amortización de Anticipo"}</strong></td><td class="num">-${escapeHtml(formatMoney(inv.amortizacionAnticipoCop))}</td></tr>
          <tr><td><strong>(-) ${isEn ? "Warranty Retainage" : "Fondo Retención y Garantía"}</strong></td><td class="num">-${escapeHtml(formatMoney(inv.retencionGarantiaCop))}</td></tr>
          <tr><td><strong>(+) ${isEn ? "VAT on Contractor Fee (U)" : "IVA 19% sobre Utilidad (U)"}</strong></td><td class="num">+${escapeHtml(formatMoney(inv.ivaCop))}</td></tr>
          <tr><td><strong>(=) ${isEn ? "Net Certificate Payable" : "Valor Neto Exigible al Cliente"}</strong></td><td class="num"><strong>${escapeHtml(formatMoney(net))}</strong></td></tr>
          <tr><td><strong>${isEn ? "Collected to Date" : "Recaudado a la Fecha"}</strong></td><td class="num">${escapeHtml(formatMoney(inv.recaudadoCop))}</td></tr>
          <tr><td><strong>${isEn ? "Status" : "Estado Actual"}</strong></td><td><span class="pill">${escapeHtml(getStatusLabel(inv.estado))}</span></td></tr>
        </tbody>
      </table>
      ${
        inv.notas
          ? `<p style="font-size:11px;color:#475569;"><strong>${isEn ? "Notes:" : "Observaciones:"}</strong> ${escapeHtml(inv.notas)}</p>`
          : ""
      }`;

    const ok = openExecutivePrintSheet({
      docTitle: `${isEn ? "Billing Document" : "Soporte de Cobro"} ${inv.numero}`,
      badge: getTypeLabel(inv.tipo).toUpperCase(),
      projectTitle: safeProyecto.nombre,
      clientName: clientsState.clienteNombre,
      periodOrDate: inv.fechaEmision,
      bodyHtml,
      footerNote: isEn ? clientsState.condicionCobroEn : clientsState.condicionCobro,
      lang,
    });
    if (!ok) {
      notify(
        isEn
          ? "Allow browser popups to print/save PDF."
          : "Permite ventanas emergentes en tu navegador para imprimir o guardar PDF."
      );
    }
  };

  const filteredInvoices = useMemo(() => {
    if (statusFilter === "all") return clientsState.facturas;
    return clientsState.facturas.filter((f) => f.estado === statusFilter);
  }, [clientsState.facturas, statusFilter]);

  const contractDenom = Math.max(1, summary.valorContratoTotalCop);
  const execPct = Math.min(100, Math.round((summary.valorEjecutadoBrutoCop / contractDenom) * 100));
  const billedGrossPct = Math.min(
    100,
    Math.round((summary.totalFacturadoBrutoAvanceCop / contractDenom) * 100)
  );
  const collectionPct =
    summary.totalFacturadoNetoCop > 0
      ? Math.min(
          100,
          Math.round((summary.totalRecaudadoCop / summary.totalFacturadoNetoCop) * 100)
        )
      : 0;

  return (
    <div className="space-y-5">
      {/* Header & Client Entity Card */}
      <div className="bento-card space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-bold uppercase tracking-wider text-emerald-700">
              <Landmark className="w-3.5 h-3.5" />
              {isEn ? "Clients, Billing Certificates & AR" : "Clientes, Actas de Cobro & Cartera (CxC)"}
            </div>
            <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
              {clientsState.clienteNombre}
            </h2>
            <p className="text-xs text-slate-600 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-sky-600" />
                {clientsState.clienteIdFiscal}
              </span>
              <span>•</span>
              <span>{isEn ? clientsState.representanteRolEn : clientsState.representanteRol}</span>
              <span>•</span>
              <span>{isEn ? clientsState.condicionCobroEn : clientsState.condicionCobro}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={openProfileEditor}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-slate-300 bg-white text-slate-800 hover:border-sky-500 transition"
            >
              <Edit3 className="w-3.5 h-3.5" />
              {isEn ? "Edit Client Profile" : "Editar Cliente"}
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-slate-300 bg-white text-slate-800 hover:border-emerald-500 transition"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              {isEn ? "AR CSV" : "CSV Cartera"}
            </button>
            <button
              type="button"
              onClick={handlePrintConsolidatedStatement}
              className="steel-btn-primary inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold"
            >
              <Printer className="w-3.5 h-3.5" />
              {isEn ? "Client AR Statement PDF" : "Estado de Cuenta PDF"}
            </button>
          </div>
        </div>

        {isDemo && (
          <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-lg bg-sky-50 border border-sky-200 text-xs text-sky-900">
            <Info className="w-4 h-4 shrink-0 mt-0.5 text-sky-600" />
            <span>
              {isEn
                ? "Demo Sandbox Mode: Client billing certificates, collections, and progress draft generation run in-memory without exposing private client data or persisting to production cloud."
                : "Modo Demo Sandbox: Las actas, cobros y generación de borradores desde BIM 5D funcionan en memoria sin exponer datos privados reales ni alterar la nube de producción."}
            </span>
          </div>
        )}

        {feedback && (
          <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{feedback}</span>
          </div>
        )}

        {editingProfile && (
          <form
            onSubmit={handleSaveProfile}
            className="p-4 rounded-xl border border-slate-300 bg-slate-50 grid grid-cols-1 md:grid-cols-3 gap-3"
          >
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                {isEn ? "Client Entity Name" : "Razón Social Cliente"}
              </label>
              <input
                type="text"
                value={profNombre}
                onChange={(e) => setProfNombre(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-900"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                {isEn ? "Tax ID / NIT" : "NIT / ID Fiscal"}
              </label>
              <input
                type="text"
                value={profNit}
                onChange={(e) => setProfNit(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-900"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                {isEn ? `Credit Limit (${currency})` : `Cupo Aprobado (${currency})`}
              </label>
              <input
                type="number"
                step="any"
                value={profCupoDisp}
                onChange={(e) => setProfCupoDisp(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-900"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                {isEn ? "Client Supervision Role" : "Interventoría / Supervisión"}
              </label>
              <input
                type="text"
                value={isEn ? profRepEn : profRep}
                onChange={(e) =>
                  isEn ? setProfRepEn(e.target.value) : setProfRep(e.target.value)
                }
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-900"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                {isEn ? "Collection Terms" : "Condición Contractual de Cobro"}
              </label>
              <input
                type="text"
                value={isEn ? profCondEn : profCond}
                onChange={(e) =>
                  isEn ? setProfCondEn(e.target.value) : setProfCond(e.target.value)
                }
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-900"
              />
            </div>
            <div className="md:col-span-3 flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setEditingProfile(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 bg-white text-slate-700"
              >
                {isEn ? "Cancel" : "Cancelar"}
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-sky-600 text-white hover:bg-sky-700"
              >
                {isEn ? "Save Profile" : "Guardar Perfil"}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* 4 Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bento-card flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <span>{isEn ? "Contract Value (w/ AIU)" : "Valor Contrato c/ AIU"}</span>
            <FileText className="w-4 h-4 text-sky-600" />
          </div>
          <div className="mt-2 text-xl font-black text-slate-900 kpi-num">
            {formatMoney(summary.valorContratoTotalCop)}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-600">
            AIU {(params.pct_a + params.pct_i + params.pct_u).toFixed(1)}% •{" "}
            {isEn ? "Limit" : "Cupo"} {formatMoney(clientsState.cupoAprobadoCop)}
          </div>
        </div>

        <div className="bento-card flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <span>{isEn ? "Official Net Billed" : "Facturado Neto Oficial"}</span>
            <ClipboardCheck className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-2 text-xl font-black text-slate-900 kpi-num">
            {formatMoney(summary.totalFacturadoNetoCop)}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-600">
            {summary.facturasCount}{" "}
            {isEn ? "docs • BIM Exec" : "docs • Ejecutado BIM"}{" "}
            {formatMoney(summary.valorEjecutadoBrutoCop)}
          </div>
        </div>

        <div className="bento-card flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <span>{isEn ? "Collected Cash" : "Recaudado en Caja"}</span>
            <Wallet className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-xl font-black text-emerald-700 kpi-num">
            {formatMoney(summary.totalRecaudadoCop)}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-2 text-[11px] text-slate-600">
            <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
              {collectionPct}%
            </span>
            <span>{isEn ? "of official billing collected" : "de facturación oficial cobrada"}</span>
          </div>
        </div>

        <div className="bento-card flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <span>{isEn ? "Accounts Receivable (AR)" : "Cartera por Cobrar CxC"}</span>
            <BadgeDollarSign className="w-4 h-4 text-amber-600" />
          </div>
          <div
            className={`mt-2 text-xl font-black kpi-num ${
              summary.cuentasPorCobrarCop > 0 ? "text-amber-700" : "text-emerald-700"
            }`}
          >
            {formatMoney(summary.cuentasPorCobrarCop)}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600">
            <span>
              {isEn ? "Unbilled WIP" : "Por Facturar WIP"}:{" "}
              <strong className="text-slate-900">
                {formatMoney(summary.porFacturarDeEjecucionCop)}
              </strong>
            </span>
            {summary.facturasVencidasCount > 0 && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-bold">
                <AlertCircle className="w-3 h-3" />
                {summary.facturasVencidasCount} {isEn ? "overdue" : "vencida(s)"}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Contractual Cash Funnel & BIM 5D One-Click Billing Action */}
      <div className="bento-card space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-sky-600" />
              {isEn
                ? "Contract-to-Cash Funnel & BIM 5D Unbilled Progress (WIP)"
                : "Ciclo Contractual de Caja y Obra Ejecutada por Facturar (WIP)"}
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              {isEn
                ? "Matches executed BIM 5D earned value (incl. AIU) against billed progress certificates to detect unbilled cashflow."
                : "Cruza el valor ejecutado real BIM 5D (con AIU) contra las actas radicadas para detectar saldo de obra pendiente por facturar."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {summary.fondoGarantiaRetenidoCop > 0 && (
              <button
                type="button"
                onClick={handleReleaseRetainage}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                {isEn
                  ? `Draft Retainage Release (${formatMoney(summary.fondoGarantiaRetenidoCop)})`
                  : `Liberar Retención (${formatMoney(summary.fondoGarantiaRetenidoCop)})`}
              </button>
            )}
            <button
              type="button"
              onClick={handleGenerateActaFrom5D}
              disabled={summary.porFacturarDeEjecucionCop <= 10}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-45 disabled:cursor-not-allowed transition shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              {summary.porFacturarDeEjecucionCop > 10
                ? isEn
                  ? `Generate Certificate Draft from 5D (${formatMoney(summary.porFacturarDeEjecucionCop)})`
                  : `Generar Borrador Acta desde Avance 5D (${formatMoney(summary.porFacturarDeEjecucionCop)})`
                : isEn
                ? "100% of Executed 5D Progress Billed"
                : "Avance 5D 100% Facturado"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          <div className="steel-subcard rounded-xl p-3.5 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-slate-600">
                {isEn ? "1. Executed BIM 5D vs Contract" : "1. Ejecutado BIM 5D vs Contrato"}
              </span>
              <span className="font-extrabold text-slate-900">{execPct}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-full bg-sky-500 rounded-full transition-all"
                style={{ width: `${execPct}%` }}
              />
            </div>
            <div className="text-[11px] text-slate-600 kpi-num">
              {formatMoney(summary.valorEjecutadoBrutoCop)} /{" "}
              {formatMoney(summary.valorContratoTotalCop)}
            </div>
          </div>

          <div className="steel-subcard rounded-xl p-3.5 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-slate-600">
                {isEn ? "2. Gross Progress Billed" : "2. Avance Facturado en Actas"}
              </span>
              <span className="font-extrabold text-slate-900">{billedGrossPct}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all"
                style={{ width: `${billedGrossPct}%` }}
              />
            </div>
            <div className="text-[11px] text-slate-600 kpi-num">
              {formatMoney(summary.totalFacturadoBrutoAvanceCop)} •{" "}
              {isEn ? "Unbilled WIP" : "Sin facturar"}:{" "}
              <strong className="text-slate-900">
                {formatMoney(summary.porFacturarDeEjecucionCop)}
              </strong>
            </div>
          </div>

          <div className="steel-subcard rounded-xl p-3.5 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-slate-600">
                {isEn ? "3. Net Collection & Retainage" : "3. Recaudo Neto & Fondo Garantía"}
              </span>
              <span className="font-extrabold text-emerald-700">{collectionPct}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${collectionPct}%` }}
              />
            </div>
            <div className="text-[11px] text-slate-600 kpi-num">
              {isEn ? "Retainage Escrow" : "Fondo Retención"}:{" "}
              <strong className="text-slate-900">
                {formatMoney(summary.fondoGarantiaRetenidoCop)}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* Filters, New Invoice Form & Ledger Table */}
      <div className="bento-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                "all",
                "borrador",
                "radicada",
                "aprobada",
                "pagada",
                "vencida",
              ] as const
            ).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                  statusFilter === st
                    ? "bg-slate-900 text-white border-transparent shadow-sm"
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                }`}
              >
                {st === "all" ? (isEn ? "All" : "Todos") : getStatusLabel(st)}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowNewForm((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            {isEn ? "New Invoice / Certificate" : "Nueva Factura / Acta"}
          </button>
        </div>

        {showNewForm && (
          <form
            onSubmit={handleCreateManualInvoice}
            className="p-4 rounded-xl border border-emerald-200 bg-slate-50 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
          >
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                {isEn ? "Document Type" : "Tipo Documento"}
              </label>
              <select
                value={newTipo}
                onChange={(e) => setNewTipo(e.target.value as ClientInvoiceType)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-900"
              >
                <option value="acta_avance">{getTypeLabel("acta_avance")}</option>
                <option value="anticipo">{getTypeLabel("anticipo")}</option>
                <option value="adicional">{getTypeLabel("adicional")}</option>
                <option value="liberacion_garantia">
                  {getTypeLabel("liberacion_garantia")}
                </option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                {isEn ? "Document #" : "Número / Código"}
              </label>
              <input
                type="text"
                placeholder={isEn ? "Auto if blank" : "Auto si vacío"}
                value={newNumero}
                onChange={(e) => setNewNumero(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-900"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                {isEn ? "Issue Date" : "Fecha Emisión"}
              </label>
              <input
                type="date"
                value={newFechaEmision}
                onChange={(e) => setNewFechaEmision(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-900"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                {isEn ? "Due Date" : "Fecha Vencimiento"}
              </label>
              <input
                type="date"
                value={newFechaVencimiento}
                onChange={(e) => setNewFechaVencimiento(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-900"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                {isEn ? "Concept / Scope Description" : "Concepto / Alcance Facturado"}
              </label>
              <input
                type="text"
                value={newConcepto}
                onChange={(e) => setNewConcepto(e.target.value)}
                placeholder={
                  isEn
                    ? "e.g. Monthly Progress Billing #03"
                    : "Ej. Acta parcial de avance obra gris e instalaciones"
                }
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-900"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                {isEn ? `Gross Value (${currency})` : `Valor Bruto (${currency})`}
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={newBrutoDisplay}
                onChange={(e) => setNewBrutoDisplay(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-900 font-bold"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                {isEn ? "Initial Status" : "Estado Inicial"}
              </label>
              <select
                value={newEstado}
                onChange={(e) => setNewEstado(e.target.value as ClientInvoiceStatus)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-900"
              >
                <option value="borrador">{getStatusLabel("borrador")}</option>
                <option value="radicada">{getStatusLabel("radicada")}</option>
                <option value="aprobada">{getStatusLabel("aprobada")}</option>
                <option value="pagada">{getStatusLabel("pagada")}</option>
              </select>
            </div>

            <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap items-center gap-3 pt-1">
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newAutoDeductions}
                  onChange={(e) => setNewAutoDeductions(e.target.checked)}
                />
                {isEn
                  ? `Auto-apply contract deductions (${params.pct_anticipo}% Advance, ${params.pct_garantia}% Retainage, 19% VAT/U)`
                  : `Calcular deducciones contractuales automáticamente (Ant ${params.pct_anticipo}%, Gar ${params.pct_garantia}%, IVA 19%/U)`}
              </label>
            </div>

            {!newAutoDeductions && (
              <>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                    {isEn ? `Advance Amort. (${currency})` : `Amort. Anticipo (${currency})`}
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={newManualAmortDisplay}
                    onChange={(e) => setNewManualAmortDisplay(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                    {isEn ? `Retainage (${currency})` : `Ret. Garantía (${currency})`}
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={newManualRetDisplay}
                    onChange={(e) => setNewManualRetDisplay(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                    {isEn ? `VAT on U (${currency})` : `IVA s/ Utilidad (${currency})`}
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={newManualIvaDisplay}
                    onChange={(e) => setNewManualIvaDisplay(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-900"
                  />
                </div>
              </>
            )}

            <div className="sm:col-span-2 lg:col-span-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewForm(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 bg-white text-slate-700"
              >
                {isEn ? "Cancel" : "Cancelar"}
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700"
              >
                {isEn ? "Save Document" : "Registrar Documento"}
              </button>
            </div>
          </form>
        )}

        {/* Invoices & Collections Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-2.5 pr-3">{isEn ? "Doc / Dates" : "Doc / Fechas"}</th>
                <th className="py-2.5 px-3">{isEn ? "Concept & Type" : "Concepto y Tipo"}</th>
                <th className="py-2.5 px-3 text-right">{isEn ? "Gross" : "Bruto"}</th>
                <th className="py-2.5 px-3 text-right">{isEn ? "Deduct / VAT" : "Deducc / IVA"}</th>
                <th className="py-2.5 px-3 text-right">{isEn ? "Net Due" : "Neto Cobro"}</th>
                <th className="py-2.5 px-3 text-right">
                  {isEn ? `Collected (${currency})` : `Recaudado (${currency})`}
                </th>
                <th className="py-2.5 px-3 text-right">{isEn ? "Balance AR" : "Saldo CxC"}</th>
                <th className="py-2.5 px-3">{isEn ? "Status" : "Estado"}</th>
                <th className="py-2.5 pl-3 text-right">{isEn ? "Actions" : "Acciones"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="py-8 text-center text-slate-500 text-xs"
                  >
                    {isEn
                      ? "No billing documents match this filter."
                      : "No hay documentos o actas para el filtro seleccionado."}
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => {
                  const netCop = computeInvoiceNetCop(inv);
                  const balanceCop = Math.max(0, netCop - Number(inv.recaudadoCop || 0));
                  const totalDeductionsCop =
                    Number(inv.amortizacionAnticipoCop || 0) +
                    Number(inv.retencionGarantiaCop || 0);

                  return (
                    <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 pr-3 align-top whitespace-nowrap">
                        <div className="font-extrabold text-slate-900">
                          {inv.numero}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          {inv.fechaEmision}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {isEn ? "Due:" : "Vence:"} {inv.fechaVencimiento}
                        </div>
                      </td>

                      <td className="py-3 px-3 align-top min-w-[210px]">
                        <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-slate-100 text-slate-700 border border-slate-200 mb-1">
                          {getTypeLabel(inv.tipo)}
                        </span>
                        <div className="font-semibold text-slate-900 leading-snug">
                          {isEn ? inv.conceptoEn : inv.concepto}
                        </div>
                        {inv.notas && (
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {inv.notas}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3 align-top text-right kpi-num whitespace-nowrap text-slate-800 font-medium">
                        {formatMoney(inv.valorBrutoCop)}
                      </td>

                      <td className="py-3 px-3 align-top text-right kpi-num whitespace-nowrap text-[11px]">
                        <div className="text-rose-600">
                          -{formatMoney(totalDeductionsCop)}
                        </div>
                        {inv.ivaCop > 0 && (
                          <div className="text-sky-600">
                            +{formatMoney(inv.ivaCop)} {isEn ? "VAT" : "IVA"}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3 align-top text-right kpi-num whitespace-nowrap font-extrabold text-slate-900">
                        {formatMoney(netCop)}
                      </td>

                      <td className="py-3 px-3 align-top text-right whitespace-nowrap">
                        <div className="flex flex-col items-end gap-1">
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={toDisplayAmount(inv.recaudadoCop)}
                            onChange={(e) =>
                              handleCollectedInputChange(inv.id, e.target.value)
                            }
                            aria-label={`${isEn ? "Collected" : "Recaudado"} ${inv.numero}`}
                            className="w-28 px-2 py-1 rounded border border-slate-300 bg-white text-right text-xs font-bold text-emerald-700 kpi-num"
                          />
                          {balanceCop > 0 && (
                            <button
                              type="button"
                              onClick={() => handleCollectFull(inv.id)}
                              className="text-[10px] font-bold text-emerald-600 hover:underline"
                            >
                              {isEn ? "Collect 100%" : "Cobrar 100%"}
                            </button>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3 align-top text-right kpi-num whitespace-nowrap font-bold">
                        <span
                          className={
                            balanceCop > 0 && inv.estado !== "borrador"
                              ? "text-amber-700"
                              : "text-slate-500"
                          }
                        >
                          {formatMoney(balanceCop)}
                        </span>
                      </td>

                      <td className="py-3 px-3 align-top whitespace-nowrap">
                        <select
                          value={inv.estado}
                          onChange={(e) =>
                            handleStatusChange(inv.id, e.target.value as ClientInvoiceStatus)
                          }
                          aria-label={`${isEn ? "Status" : "Estado"} ${inv.numero}`}
                          className={`px-2 py-1 rounded-full text-[11px] font-bold border ${getStatusBadgeClass(
                            inv.estado
                          )}`}
                        >
                          <option value="borrador" className="bg-white text-slate-900">
                            {getStatusLabel("borrador")}
                          </option>
                          <option value="radicada" className="bg-white text-slate-900">
                            {getStatusLabel("radicada")}
                          </option>
                          <option value="aprobada" className="bg-white text-slate-900">
                            {getStatusLabel("aprobada")}
                          </option>
                          <option value="pagada" className="bg-white text-slate-900">
                            {getStatusLabel("pagada")}
                          </option>
                          <option value="vencida" className="bg-white text-slate-900">
                            {getStatusLabel("vencida")}
                          </option>
                        </select>
                      </td>

                      <td className="py-3 pl-3 align-top text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handlePrintSingleInvoice(inv)}
                            title={isEn ? "Print Certificate PDF" : "Imprimir Acta / Factura PDF"}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-sky-600 hover:border-sky-400 transition"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteInvoice(inv.id, inv.numero)}
                            title={isEn ? "Remove Document" : "Eliminar Documento"}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-rose-600 hover:border-rose-400 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
