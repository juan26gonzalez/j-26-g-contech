"use client";

import React, { useMemo, useState } from "react";
import {
  Boxes,
  Building2,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Info,
  PackageCheck,
  Plus,
  Printer,
  ShoppingCart,
  Star,
  Truck,
  Wallet,
} from "lucide-react";
import {
  computeOrderTotalCop,
  computeSuppliersSummary,
  downloadCsvUtf8,
  escapeHtml,
  openExecutivePrintSheet,
} from "../lib/erpStorage";
import { useAppPreferences } from "../lib/i18n";
import type {
  ConsolidationResult,
  ProjectConfig,
  PurchaseOrder,
  PurchaseOrderStatus,
  SupplierCategory,
  SuppliersProjectData,
  SupplierVendor,
} from "../lib/types";
import {
  localizeMaterialName,
  sanitizeDemoProject,
  unitConversionFactor,
} from "../lib/units";

type SuppliersSubView = "ordenes" | "directorio" | "demanda_bim";

interface TabProveedoresComprasProps {
  proyecto: ProjectConfig;
  data: ConsolidationResult;
  suppliersState: SuppliersProjectData;
  onChangeSuppliers: (next: SuppliersProjectData) => void;
  isDemo?: boolean;
}

export default function TabProveedoresCompras({
  proyecto,
  data,
  suppliersState,
  onChangeSuppliers,
  isDemo = false,
}: TabProveedoresComprasProps) {
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

  const [subView, setSubView] = useState<SuppliersSubView>("ordenes");
  const [statusFilter, setStatusFilter] = useState<"all" | PurchaseOrderStatus>("all");
  const [feedback, setFeedback] = useState("");
  const [showOrderForm, setShowOrderForm] = useState(false);

  // New PO form state
  const [newOcProveedorId, setNewOcProveedorId] = useState<string>(
    () => suppliersState.proveedores[0]?.id || ""
  );
  const [newOcBimMatch, setNewOcBimMatch] = useState<string>("");
  const [newOcConcepto, setNewOcConcepto] = useState("");
  const [newOcUnidad, setNewOcUnidad] = useState("m²");
  const [newOcQtyDisplay, setNewOcQtyDisplay] = useState("100");
  const [newOcUnitPriceDisplay, setNewOcUnitPriceDisplay] = useState("");
  const [newOcEntrega, setNewOcEntrega] = useState(() =>
    new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
  );
  const [newOcNotes, setNewOcNotes] = useState("");

  // New Supplier form state
  const [supName, setSupName] = useState("");
  const [supTaxId, setSupTaxId] = useState("");
  const [supCat, setSupCat] = useState<SupplierCategory>("acabados");
  const [supSpec, setSupSpec] = useState("");
  const [supTerms, setSupTerms] = useState("Crédito 30 días");
  const [supRetention, setSupRetention] = useState("2.5");

  const summary = useMemo(
    () => computeSuppliersSummary(suppliersState),
    [suppliersState]
  );

  const bimDemandGrouped = useMemo(() => {
    const map = new Map<string, { Insumo: string; Unidad: string; Total: number }>();
    for (const r of data.insumos_demanda) {
      const key = `${r.Insumo}||${r.Unidad}`;
      const prev = map.get(key) || { Insumo: r.Insumo, Unidad: r.Unidad, Total: 0 };
      prev.Total += Number(r.Total_Teorico || 0);
      map.set(key, prev);
    }
    return Array.from(map.values()).sort((a, b) => b.Total - a.Total);
  }, [data.insumos_demanda]);

  const filteredOrders = useMemo(() => {
    if (statusFilter === "all") return suppliersState.ordenes;
    return suppliersState.ordenes.filter((o) => o.estado === statusFilter);
  }, [suppliersState.ordenes, statusFilter]);

  const vendorPayablesMap = useMemo(() => {
    const map = new Map<string, { total: number; paid: number; count: number }>();
    for (const oc of suppliersState.ordenes) {
      const prev = map.get(oc.proveedorId) || { total: 0, paid: 0, count: 0 };
      prev.total += computeOrderTotalCop(oc);
      prev.paid += Math.max(0, Number(oc.pagadoCop || 0));
      prev.count += 1;
      map.set(oc.proveedorId, prev);
    }
    return map;
  }, [suppliersState.ordenes]);

  const notify = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(""), 4500);
  };

  const getCategoryLabel = (cat: SupplierCategory): string => {
    switch (cat) {
      case "concreto":
        return isEn ? "Ready-Mix & Aggregates" : "Concreto & Agregados";
      case "aceros_mamposteria":
        return isEn ? "Steel, CMU & Cement" : "Aceros, Cemento & Mampostería";
      case "acabados":
        return isEn ? "Finishes & Drywall" : "Pisos, Drywall & Pinturas";
      case "cubierta_carpinteria":
        return isEn ? "Roofing & Aluminum Glazing" : "Cubiertas & Carpintería";
      case "equipos_sst":
        return isEn ? "Equipment & HSE PPE" : "Equipos & Dotación SST";
      case "subcontrato":
        return isEn ? "Specialty Subcontractor" : "Subcontratista Especializado";
    }
  };

  const getOrderStatusLabel = (estado: PurchaseOrderStatus): string => {
    switch (estado) {
      case "cotizada":
        return isEn ? "Quoted" : "Cotizada";
      case "emitida":
        return isEn ? "Issued PO" : "Emitida";
      case "en_obra":
        return isEn ? "In Delivery" : "En Obra";
      case "recibida":
        return isEn ? "Received 100%" : "Recibida";
      case "pagada":
        return isEn ? "Paid 100%" : "Pagada";
    }
  };

  const getOrderStatusBadgeClass = (estado: PurchaseOrderStatus): string => {
    switch (estado) {
      case "pagada":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "recibida":
        return "bg-sky-50 text-sky-700 border-sky-200";
      case "en_obra":
        return "bg-indigo-50 text-indigo-700 border-indigo-200";
      case "emitida":
        return "bg-amber-50 text-amber-800 border-amber-200";
      case "cotizada":
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  const handleSelectBimMaterial = (materialName: string) => {
    setNewOcBimMatch(materialName);
    const matched = bimDemandGrouped.find((m) => m.Insumo === materialName);
    if (matched) {
      setNewOcConcepto(localizeMaterialName(matched.Insumo, lang));
      setNewOcUnidad(matched.Unidad || "und");
      const qtyDisplay = convertQtyValue(matched.Total, matched.Unidad);
      setNewOcQtyDisplay(qtyDisplay.toFixed(1));
      if (!newOcUnitPriceDisplay) {
        const baseCop = 42000;
        const unitFactor = isEn ? unitConversionFactor(matched.Unidad) : 1;
        const suggested = baseCop / fxRate / unitFactor;
        setNewOcUnitPriceDisplay(
          currency === "COP" ? String(Math.round(suggested)) : suggested.toFixed(2)
        );
      }
    }
  };

  const handleQuickCreatePoFromBim = (materialName: string, unidad: string, qtyMetric: number) => {
    setSubView("ordenes");
    setShowOrderForm(true);
    setNewOcBimMatch(materialName);
    setNewOcConcepto(localizeMaterialName(materialName, lang));
    setNewOcUnidad(unidad || "und");
    const qtyDisplay = convertQtyValue(qtyMetric, unidad);
    setNewOcQtyDisplay(qtyDisplay.toFixed(1));
    notify(
      isEn
        ? `Pre-loaded BIM quantity for ${localizeMaterialName(materialName, "en")}.`
        : `Cantidad BIM precargada para ${materialName}.`
    );
  };

  const handleAddOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const concept = newOcConcepto.trim();
    if (!concept) return;

    const vendor =
      suppliersState.proveedores.find((p) => p.id === newOcProveedorId) ||
      suppliersState.proveedores[0];

    const uFactor = isEn ? unitConversionFactor(newOcUnidad) : 1;
    const qtyMetric = Math.max(0.01, Number(newOcQtyDisplay || 1) / uFactor);
    const rawUnitPriceDisplay = Math.max(0, Number(newOcUnitPriceDisplay || 0));
    const unitPriceCop =
      rawUnitPriceDisplay > 0 ? Math.round(rawUnitPriceDisplay * fxRate * uFactor) : 45000;

    const prefix = isDemo ? "OC-NB-" : "OC-";
    const codigo = `${prefix}${String(suppliersState.ordenes.length + 101)}`;

    const order: PurchaseOrder = {
      id: `oc-${Date.now()}`,
      codigo,
      fecha: new Date().toISOString().slice(0, 10),
      fechaEntrega: newOcEntrega,
      proveedorId: vendor?.id || "sup-1",
      proveedorNombre: vendor
        ? isEn
          ? vendor.razonSocialEn
          : vendor.razonSocial
        : "General Supplier",
      concepto: concept,
      conceptoEn: concept,
      unidad: newOcUnidad || "und",
      cantidad: Math.round(qtyMetric * 100) / 100,
      precioUnitarioCop: unitPriceCop,
      bimMaterialMatch: newOcBimMatch || undefined,
      porcentajeRecibido: 0,
      pagadoCop: 0,
      estado: "emitida",
      notas: newOcNotes.trim() || undefined,
    };

    onChangeSuppliers({
      ...suppliersState,
      ordenes: [order, ...suppliersState.ordenes],
    });
    setNewOcConcepto("");
    setNewOcBimMatch("");
    setNewOcNotes("");
    setShowOrderForm(false);
    notify(
      isEn
        ? `Purchase Order ${codigo} issued cleanly.`
        : `Orden de Compra ${codigo} emitida correctamente.`
    );
  };

  const handleUpdateOrder = (id: string, updater: (oc: PurchaseOrder) => PurchaseOrder) => {
    onChangeSuppliers({
      ...suppliersState,
      ordenes: suppliersState.ordenes.map((o) => (o.id === id ? updater(o) : o)),
    });
  };

  const handleCycleOrderStatus = (id: string) => {
    const order: PurchaseOrderStatus[] = [
      "cotizada",
      "emitida",
      "en_obra",
      "recibida",
      "pagada",
    ];
    handleUpdateOrder(id, (oc) => {
      const nextEstado = order[(order.indexOf(oc.estado) + 1) % order.length];
      const total = computeOrderTotalCop(oc);
      return {
        ...oc,
        estado: nextEstado,
        porcentajeRecibido:
          nextEstado === "recibida" || nextEstado === "pagada"
            ? 100
            : oc.porcentajeRecibido,
        pagadoCop: nextEstado === "pagada" ? total : oc.pagadoCop,
      };
    });
  };

  const handlePayOrderFull = (id: string) => {
    handleUpdateOrder(id, (oc) => {
      const total = computeOrderTotalCop(oc);
      return {
        ...oc,
        pagadoCop: total,
        porcentajeRecibido: Math.max(oc.porcentajeRecibido, 100),
        estado: "pagada",
      };
    });
    notify(isEn ? "Purchase Order marked 100% paid." : "Orden de Compra liquidada al 100%.");
  };

  const handleAddSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    const name = supName.trim();
    if (!name) return;
    const code = `PROV-${String(suppliersState.proveedores.length + 1).padStart(2, "0")}`;
    const item: SupplierVendor = {
      id: `sup-${Date.now()}`,
      codigo: code,
      razonSocial: name,
      razonSocialEn: name,
      nitTaxId: supTaxId.trim() || "TAX-PENDING",
      categoria: supCat,
      especialidad: supSpec.trim() || getCategoryLabel(supCat),
      especialidadEn: supSpec.trim() || getCategoryLabel(supCat),
      contactoRol: isEn ? "Account Desk" : "Ejecutivo Comercial",
      condicionPago: supTerms.trim() || "Crédito 30 días",
      condicionPagoEn: supTerms.trim() || "Net 30",
      calificacion: 4.8,
      retencionPct: Math.max(0, Number(supRetention || 0)),
    };
    onChangeSuppliers({
      ...suppliersState,
      proveedores: [...suppliersState.proveedores, item],
    });
    setNewOcProveedorId(item.id);
    setSupName("");
    setSupTaxId("");
    setSupSpec("");
    notify(isEn ? `Vendor ${code} registered.` : `Proveedor ${code} registrado.`);
  };

  const handleExportCsv = () => {
    const toCurr = (cop: number) =>
      currency === "COP" ? Math.round(cop) : Number((cop / fxRate).toFixed(2));

    const headers = isEn
      ? [
          "PO Code",
          "Issue Date",
          "Delivery Date",
          "Vendor",
          "Description",
          "Unit",
          "Qty",
          `Total Committed (${currency})`,
          `Paid (${currency})`,
          `Balance Due AP (${currency})`,
          "Received %",
          "Status",
        ]
      : [
          "Código OC",
          "Fecha Emisión",
          "Entrega Est.",
          "Proveedor",
          "Concepto",
          "Unidad",
          "Cantidad",
          `Total Comprometido (${currency})`,
          `Pagado (${currency})`,
          `Saldo por Pagar CxP (${currency})`,
          "% Recibido",
          "Estado",
        ];

    const rows = suppliersState.ordenes.map((oc) => {
      const total = computeOrderTotalCop(oc);
      const balance = Math.max(0, total - Number(oc.pagadoCop || 0));
      return [
        oc.codigo,
        oc.fecha,
        oc.fechaEntrega,
        oc.proveedorNombre,
        isEn ? oc.conceptoEn : oc.concepto,
        unitLabel(oc.unidad),
        convertQtyValue(oc.cantidad, oc.unidad).toFixed(2),
        toCurr(total),
        toCurr(oc.pagadoCop),
        toCurr(balance),
        `${oc.porcentajeRecibido}%`,
        getOrderStatusLabel(oc.estado),
      ];
    });

    downloadCsvUtf8(
      `Proveedores_OC_${safeProyecto.id}_${new Date().toISOString().slice(0, 10)}.csv`,
      headers,
      rows
    );
  };

  const handlePrintPdf = (singleOrder?: PurchaseOrder) => {
    if (singleOrder) {
      const total = computeOrderTotalCop(singleOrder);
      const saldo = Math.max(0, total - Number(singleOrder.pagadoCop || 0));
      const qtyTxt = `${convertQtyValue(singleOrder.cantidad, singleOrder.unidad).toFixed(2)} ${unitLabel(singleOrder.unidad)}`;
      const bodyHtml = `
        <div class="kpi-grid">
          <div class="kpi"><div class="kpi-label">${isEn ? "PO Number" : "Orden Compra"}</div><div class="kpi-val">${escapeHtml(singleOrder.codigo)}</div></div>
          <div class="kpi"><div class="kpi-label">${isEn ? "Total Value" : "Valor Total OC"}</div><div class="kpi-val">${escapeHtml(formatMoney(total, 2))}</div></div>
          <div class="kpi"><div class="kpi-label">${isEn ? "Paid to Date" : "Abonado / Pagado"}</div><div class="kpi-val">${escapeHtml(formatMoney(singleOrder.pagadoCop, 2))}</div></div>
          <div class="kpi"><div class="kpi-label">${isEn ? "Balance Due AP" : "Saldo CxP"}</div><div class="kpi-val">${escapeHtml(formatMoney(saldo, 2))}</div></div>
        </div>
        <h2>${isEn ? "Vendor & Line Item Specification" : "Proveedor & Especificación Técnica de Compra"}</h2>
        <table>
          <tbody>
            <tr><th>${isEn ? "Supplier" : "Proveedor"}</th><td>${escapeHtml(singleOrder.proveedorNombre)}</td></tr>
            <tr><th>${isEn ? "Description" : "Descripción"}</th><td>${escapeHtml(isEn ? singleOrder.conceptoEn : singleOrder.concepto)}</td></tr>
            <tr><th>${isEn ? "Quantity & Rate" : "Cantidad & Tarifa"}</th><td>${escapeHtml(qtyTxt)} @ ${escapeHtml(formatUnitMoney(singleOrder.precioUnitarioCop, singleOrder.unidad))}</td></tr>
            <tr><th>${isEn ? "Delivery Target" : "Fecha Entrega"}</th><td>${escapeHtml(singleOrder.fechaEntrega)} (${singleOrder.porcentajeRecibido}% ${isEn ? "received" : "recibido"})</td></tr>
            <tr><th>${isEn ? "Notes" : "Notas"}</th><td>${escapeHtml(singleOrder.notas || "-")}</td></tr>
          </tbody>
        </table>`;
      const opened = openExecutivePrintSheet({
        docTitle: `${isEn ? "Purchase Order (PO)" : "Orden de Compra Oficial"} • ${singleOrder.codigo}`,
        badge: isEn ? `PROCUREMENT PO • ${currency}` : `ORDEN DE COMPRA • ${currency}`,
        projectTitle: safeProyecto.nombre,
        clientName: safeProyecto.contratante,
        periodOrDate: singleOrder.fecha,
        bodyHtml,
        footerNote: (safeProyecto.firma_residente || "").replace(/\n/g, " — "),
        lang,
      });
      if (!opened) notify(isEn ? "Allow pop-ups to print PO." : "Permite ventanas emergentes para imprimir OC.");
      return;
    }

    const rowsHtml = suppliersState.ordenes
      .map((oc) => {
        const total = computeOrderTotalCop(oc);
        const bal = Math.max(0, total - Number(oc.pagadoCop || 0));
        return `<tr>
          <td><strong>${escapeHtml(oc.codigo)}</strong></td>
          <td>${escapeHtml(oc.proveedorNombre)}</td>
          <td>${escapeHtml(isEn ? oc.conceptoEn : oc.concepto)}</td>
          <td class="num">${escapeHtml(convertQtyValue(oc.cantidad, oc.unidad).toFixed(1))} ${escapeHtml(unitLabel(oc.unidad))}</td>
          <td class="num">${escapeHtml(formatMoney(total, 2))}</td>
          <td class="num">${escapeHtml(formatMoney(bal, 2))}</td>
          <td><span class="pill">${escapeHtml(getOrderStatusLabel(oc.estado))}</span></td>
        </tr>`;
      })
      .join("");

    const bodyHtml = `
      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-label">${isEn ? "Approved Vendors" : "Proveedores"}</div><div class="kpi-val">${summary.proveedoresCount}</div></div>
        <div class="kpi"><div class="kpi-label">${isEn ? "Total Committed" : "Comprometido OC"}</div><div class="kpi-val">${escapeHtml(formatMoney(summary.totalComprometidoCop, 2))}</div></div>
        <div class="kpi"><div class="kpi-label">${isEn ? "Paid Out" : "Pagado"}</div><div class="kpi-val">${escapeHtml(formatMoney(summary.totalPagadoCop, 2))}</div></div>
        <div class="kpi"><div class="kpi-label">${isEn ? "Accounts Payable" : "Cuentas x Pagar"}</div><div class="kpi-val">${escapeHtml(formatMoney(summary.cuentasPorPagarCop, 2))}</div></div>
      </div>
      <h2>${isEn ? "Purchase Orders & Accounts Payable Schedule" : "Control de Órdenes de Compra & Cuentas por Pagar"}</h2>
      <table>
        <thead>
          <tr>
            <th>${isEn ? "Code" : "Código"}</th>
            <th>${isEn ? "Vendor" : "Proveedor"}</th>
            <th>${isEn ? "Item" : "Concepto"}</th>
            <th class="num">${isEn ? "Qty" : "Cant."}</th>
            <th class="num">${isEn ? "Total" : "Total OC"}</th>
            <th class="num">${isEn ? "AP Due" : "Saldo CxP"}</th>
            <th>${isEn ? "Status" : "Estado"}</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>`;

    const opened = openExecutivePrintSheet({
      docTitle: isEn
        ? "Procurement, Purchase Orders & AP Control Report"
        : "Informe Consolidado de Proveedores, OC & Cuentas por Pagar",
      badge: isEn ? `PROCUREMENT AP • ${currency}` : `COMPRAS & PROVEEDORES • ${currency}`,
      projectTitle: safeProyecto.nombre,
      clientName: safeProyecto.contratante,
      periodOrDate: new Date().toISOString().slice(0, 10),
      bodyHtml,
      footerNote: (safeProyecto.firma_residente || "").replace(/\n/g, " — "),
      lang,
    });
    if (!opened) notify(isEn ? "Allow pop-ups to print PDF." : "Permite ventanas emergentes para imprimir PDF.");
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bento-card flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-800 text-[11px] font-bold tracking-wide uppercase">
            <Truck className="w-3.5 h-3.5" />
            {isEn
              ? `SUPPLY CHAIN & PROCUREMENT • BIM 5D TAKE-OFF LINK • ${currency}`
              : `CADENA DE SUMINISTRO & COMPRAS • VÍNCULO INSUMOS BIM 5D • ${currency}`}
          </div>
          <h2 className="text-lg font-extrabold text-slate-900">
            {isEn
              ? "Suppliers, Purchase Orders (POs) & Accounts Payable (AP)"
              : "Proveedores, Órdenes de Compra (OC) & Cuentas por Pagar"}
          </h2>
          <p className="text-xs text-slate-600 max-w-3xl">
            {isEn
              ? "Control vendor commitments, cross-check against BIM material takeoff demand, track site deliveries, and liquidate accounts payable in active currency."
              : "Controla compromisos con proveedores, cruza órdenes contra la explosión paramétrica de insumos BIM, haz seguimiento a entregas en obra y gestiona cartera CxP."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold"
          >
            <Download className="w-3.5 h-3.5" />
            {isEn ? "Export AP CSV" : "CSV Compras"}
          </button>
          <button
            type="button"
            onClick={() => handlePrintPdf()}
            className="steel-btn-primary inline-flex items-center gap-1.5 text-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            {isEn ? "AP Report (PDF)" : "Informe CxP PDF"}
          </button>
        </div>
      </div>

      {/* Sandbox / Project Banner */}
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
                ? `LinkedIn Demo Sandbox (${currency}): Issue POs from BIM material demand, record deliveries, and settle vendor payments in session memory.`
                : `Sandbox Interactivo Demo (${currency}): Emite órdenes de compra desde insumos BIM, actualiza entregas y registra abonos en sesión sin datos sensibles.`
              : isEn
                ? `Active Project Procurement (${safeProyecto.nombre} • ${currency}): Vendors & POs persist cleanly per project.`
                : `Compras de Proyecto (${safeProyecto.nombre} • ${currency}): Proveedores y OC se guardan automáticamente para esta obra.`}
          </span>
        </div>
        {feedback && (
          <span className="px-2.5 py-0.5 rounded-full bg-white border border-slate-300 text-slate-800 font-bold">
            {feedback}
          </span>
        )}
      </div>

      {/* 4 KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
        <div className="bento-card flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              {isEn ? "Total Committed (POs)" : "Total Comprometido (OC)"}
            </span>
            <ShoppingCart className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 tabular-nums">
            {formatMoney(summary.totalComprometidoCop)}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-600">
            {summary.ordenesTotales} {isEn ? "orders •" : "órdenes •"} {summary.ordenesAbiertas}{" "}
            {isEn ? "open" : "activas"}
          </div>
        </div>

        <div className="bento-card flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              {isEn ? "Disbursed to Vendors" : "Total Pagado a Proveedores"}
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-700 tabular-nums">
            {formatMoney(summary.totalPagadoCop)}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-600">
            {summary.totalComprometidoCop > 0
              ? `${Math.round((summary.totalPagadoCop / summary.totalComprometidoCop) * 100)}%`
              : "0%"}{" "}
            {isEn ? "of committed value paid" : "del compromiso cancelado"}
          </div>
        </div>

        <div className="bento-card flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              {isEn ? "Accounts Payable (AP)" : "Saldo por Pagar (CxP)"}
            </span>
            <Wallet className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-amber-700 tabular-nums">
            {formatMoney(summary.cuentasPorPagarCop)}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-600">
            {isEn ? "Pending vendor settlements" : "Obligaciones pendientes de giro"}
          </div>
        </div>

        <div className="bento-card flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              {isEn ? "Delivery & Vendor Score" : "Entrega & Calificación"}
            </span>
            <PackageCheck className="w-4 h-4 text-sky-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 tabular-nums">
              {summary.cumplimientoEntregaPct}%
            </span>
            <span className="inline-flex items-center gap-0.5 text-xs font-bold text-amber-600">
              <Star className="w-3.5 h-3.5 fill-amber-400" />
              {summary.calificacionPromedio.toFixed(1)}
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-600">
            {summary.proveedoresCount}{" "}
            {isEn ? "qualified suppliers" : "proveedores homologados"}
          </div>
        </div>
      </div>

      {/* Sub-navigation */}
      <div className="bento-card p-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {[
            {
              key: "ordenes" as SuppliersSubView,
              icon: FileSpreadsheet,
              label: isEn
                ? `Purchase Orders (${suppliersState.ordenes.length})`
                : `Órdenes de Compra (${suppliersState.ordenes.length})`,
            },
            {
              key: "directorio" as SuppliersSubView,
              icon: Building2,
              label: isEn
                ? `Vendor Directory (${suppliersState.proveedores.length})`
                : `Directorio Proveedores (${suppliersState.proveedores.length})`,
            },
            {
              key: "demanda_bim" as SuppliersSubView,
              icon: Boxes,
              label: isEn
                ? `BIM Takeoff → Buy (${bimDemandGrouped.length})`
                : `Demanda BIM → Comprar (${bimDemandGrouped.length})`,
            },
          ].map((tab) => {
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

        {subView === "ordenes" && (
          <button
            type="button"
            onClick={() => setShowOrderForm((p) => !p)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold"
          >
            <Plus className="w-3.5 h-3.5" />
            {isEn ? "New Purchase Order" : "Nueva Orden de Compra"}
          </button>
        )}
      </div>

      {/* SUB-VIEW 1: PURCHASE ORDERS */}
      {subView === "ordenes" && (
        <div className="space-y-4">
          {showOrderForm && (
            <form
              onSubmit={handleAddOrder}
              className="bento-card border-sky-200 bg-sky-50/40 grid grid-cols-1 md:grid-cols-6 gap-2.5 items-end text-xs"
            >
              <div className="md:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">
                  {isEn ? "Supplier / Vendor" : "Proveedor"}
                </label>
                <select
                  value={newOcProveedorId}
                  onChange={(e) => setNewOcProveedorId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-slate-900 font-semibold"
                >
                  {suppliersState.proveedores.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.codigo} • {isEn ? v.razonSocialEn : v.razonSocial}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">
                  {isEn ? "Auto-fill from BIM Materials" : "Precargar Insumo BIM 5D (Opcional)"}
                </label>
                <select
                  value={newOcBimMatch}
                  onChange={(e) => handleSelectBimMaterial(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-slate-900"
                >
                  <option value="">
                    {isEn ? "-- Manual concept --" : "-- Concepto manual --"}
                  </option>
                  {bimDemandGrouped.map((m) => (
                    <option key={`${m.Insumo}-${m.Unidad}`} value={m.Insumo}>
                      {localizeMaterialName(m.Insumo, lang)} ({convertQtyValue(m.Total, m.Unidad).toFixed(1)} {unitLabel(m.Unidad)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {isEn ? "Qty" : "Cantidad"} ({unitLabel(newOcUnidad)})
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  value={newOcQtyDisplay}
                  onChange={(e) => setNewOcQtyDisplay(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-slate-900 tabular-nums"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {isEn ? "Unit Price" : "Vr. Unit."} ({currency}/{unitLabel(newOcUnidad)})
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={newOcUnitPriceDisplay}
                  onChange={(e) => setNewOcUnitPriceDisplay(e.target.value)}
                  placeholder={currency === "COP" ? "45000" : "10.50"}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-slate-900 tabular-nums"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block font-bold text-slate-700 mb-1">
                  {isEn ? "Material / Service Description" : "Descripción Material / Subcontrato"}
                </label>
                <input
                  type="text"
                  required
                  value={newOcConcepto}
                  onChange={(e) => setNewOcConcepto(e.target.value)}
                  placeholder={
                    isEn ? "e.g., Portland Cement 110lb bags" : "Ej: Cemento Gris Sacos 50 kg"
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {isEn ? "Unit" : "Unidad"}
                </label>
                <input
                  type="text"
                  value={newOcUnidad}
                  onChange={(e) => setNewOcUnidad(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {isEn ? "Target Delivery" : "Fecha Entrega"}
                </label>
                <input
                  type="date"
                  value={newOcEntrega}
                  onChange={(e) => setNewOcEntrega(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-slate-900"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full steel-btn-primary justify-center inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {isEn ? "Issue PO" : "Emitir OC"}
                </button>
              </div>
            </form>
          )}

          <div className="bento-card space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
              <h3 className="text-sm font-bold text-slate-900">
                {isEn
                  ? "Purchase Orders & Accounts Payable Ledger"
                  : "Control de Órdenes de Compra & Cartera CxP"}
              </h3>
              <div className="flex flex-wrap gap-1">
                {(["all", "cotizada", "emitida", "en_obra", "recibida", "pagada"] as const).map(
                  (f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setStatusFilter(f)}
                      className={`px-2 py-1 rounded-md text-[11px] font-bold border ${
                        statusFilter === f
                          ? "bg-slate-900 text-white border-slate-900"
                          : "bg-slate-50 text-slate-700 border-slate-200"
                      }`}
                    >
                      {f === "all" ? (isEn ? "All" : "Todas") : getOrderStatusLabel(f)}
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500">
                    <th className="py-2 pr-2">{isEn ? "PO / Vendor" : "OC / Proveedor"}</th>
                    <th className="py-2 px-2">{isEn ? "Concept & Qty" : "Concepto & Cant."}</th>
                    <th className="py-2 px-2 text-right">{isEn ? "Total PO" : "Total OC"}</th>
                    <th className="py-2 px-2 text-center">{isEn ? "Rec. %" : "% Recibido"}</th>
                    <th className="py-2 px-2 text-right">{isEn ? "Paid" : "Pagado"}</th>
                    <th className="py-2 px-2 text-right">{isEn ? "Balance AP" : "Saldo CxP"}</th>
                    <th className="py-2 px-2 text-center">{isEn ? "Status" : "Estado"}</th>
                    <th className="py-2 pl-2 text-right">{isEn ? "Actions" : "Acción"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.map((oc) => {
                    const totalCop = computeOrderTotalCop(oc);
                    const balCop = Math.max(0, totalCop - Number(oc.pagadoCop || 0));
                    const paidDisplay =
                      currency === "COP"
                        ? Math.round(oc.pagadoCop)
                        : Number((oc.pagadoCop / fxRate).toFixed(2));
                    const qtyDisp = convertQtyValue(oc.cantidad, oc.unidad);

                    return (
                      <tr key={oc.id} className="hover:bg-slate-50/70">
                        <td className="py-2.5 pr-2 align-top">
                          <div className="font-extrabold text-slate-900">{oc.codigo}</div>
                          <div className="text-[11px] font-semibold text-slate-700">
                            {oc.proveedorNombre}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {isEn ? "Due:" : "Entrega:"} {oc.fechaEntrega}
                          </div>
                        </td>
                        <td className="py-2.5 px-2 align-top">
                          <div className="font-bold text-slate-800">
                            {isEn ? oc.conceptoEn : oc.concepto}
                          </div>
                          <div className="text-[11px] text-slate-600 tabular-nums">
                            {qtyDisp.toFixed(1)} {unitLabel(oc.unidad)} •{" "}
                            {formatUnitMoney(oc.precioUnitarioCop, oc.unidad)}
                          </div>
                        </td>
                        <td className="py-2.5 px-2 align-top text-right font-bold text-slate-900 tabular-nums whitespace-nowrap">
                          {formatMoney(totalCop)}
                        </td>
                        <td className="py-2.5 px-2 align-top text-center">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={oc.porcentajeRecibido}
                            onChange={(e) => {
                              const pct = Math.min(100, Math.max(0, Number(e.target.value || 0)));
                              handleUpdateOrder(oc.id, (prev) => ({
                                ...prev,
                                porcentajeRecibido: pct,
                                estado:
                                  pct === 100 && prev.estado !== "pagada"
                                    ? "recibida"
                                    : prev.estado,
                              }));
                            }}
                            className="w-12 rounded border border-slate-200 bg-slate-50 px-1 py-0.5 text-center font-bold text-slate-900 tabular-nums"
                          />
                          <span className="ml-0.5 text-[10px] text-slate-500">%</span>
                        </td>
                        <td className="py-2.5 px-2 align-top text-right whitespace-nowrap">
                          <input
                            type="number"
                            step={currency === "COP" ? "50000" : "10"}
                            min="0"
                            value={paidDisplay}
                            onChange={(e) => {
                              const valCurr = Math.max(0, Number(e.target.value || 0));
                              const valCop = Math.round(valCurr * fxRate);
                              handleUpdateOrder(oc.id, (prev) => ({
                                ...prev,
                                pagadoCop: valCop,
                                estado: valCop >= totalCop && totalCop > 0 ? "pagada" : prev.estado,
                              }));
                            }}
                            className="w-24 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-right font-bold text-emerald-700 tabular-nums"
                          />
                        </td>
                        <td className="py-2.5 px-2 align-top text-right font-extrabold text-amber-700 tabular-nums whitespace-nowrap">
                          {formatMoney(balCop)}
                        </td>
                        <td className="py-2.5 px-2 align-top text-center">
                          <button
                            type="button"
                            onClick={() => handleCycleOrderStatus(oc.id)}
                            className={`px-2 py-0.5 rounded-full border text-[10px] font-extrabold ${getOrderStatusBadgeClass(
                              oc.estado
                            )}`}
                          >
                            {getOrderStatusLabel(oc.estado)}
                          </button>
                        </td>
                        <td className="py-2.5 pl-2 align-top text-right whitespace-nowrap space-x-1">
                          {balCop > 0 && (
                            <button
                              type="button"
                              onClick={() => handlePayOrderFull(oc.id)}
                              className="px-2 py-1 rounded border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[10px] font-bold"
                            >
                              {isEn ? "Pay 100%" : "Pagar"}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handlePrintPdf(oc)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-[10px] font-bold"
                          >
                            <Printer className="w-3 h-3" />
                            OC
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

      {/* SUB-VIEW 2: VENDOR DIRECTORY */}
      {subView === "directorio" && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          <div className="xl:col-span-4 bento-card space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
              <Plus className="w-4 h-4 text-sky-600" />
              <h3 className="text-sm font-bold text-slate-900">
                {isEn ? "Register Qualified Supplier" : "Registrar Proveedor Homologado"}
              </h3>
            </div>
            <form onSubmit={handleAddSupplier} className="space-y-2.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {isEn ? "Company / Trade Name" : "Razón Social"}
                </label>
                <input
                  type="text"
                  required
                  value={supName}
                  onChange={(e) => setSupName(e.target.value)}
                  placeholder={isEn ? "e.g., Metro Rebar Supply Corp" : "Ej: Ferretería & Aceros del Norte"}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-slate-900"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {isEn ? "Tax ID / NIT" : "NIT / Tax ID"}
                  </label>
                  <input
                    type="text"
                    value={supTaxId}
                    onChange={(e) => setSupTaxId(e.target.value)}
                    placeholder="TAX-901-..."
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {isEn ? "Category" : "Categoría"}
                  </label>
                  <select
                    value={supCat}
                    onChange={(e) => setSupCat(e.target.value as SupplierCategory)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-slate-900"
                  >
                    <option value="concreto">{getCategoryLabel("concreto")}</option>
                    <option value="aceros_mamposteria">{getCategoryLabel("aceros_mamposteria")}</option>
                    <option value="acabados">{getCategoryLabel("acabados")}</option>
                    <option value="cubierta_carpinteria">{getCategoryLabel("cubierta_carpinteria")}</option>
                    <option value="equipos_sst">{getCategoryLabel("equipos_sst")}</option>
                    <option value="subcontrato">{getCategoryLabel("subcontrato")}</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {isEn ? "Supply Scope / Specialty" : "Especialidad de Suministro"}
                </label>
                <input
                  type="text"
                  value={supSpec}
                  onChange={(e) => setSupSpec(e.target.value)}
                  placeholder={isEn ? "Rebar, cement, MEP fixtures..." : "Material eléctrico, acero figurado..."}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-slate-900"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {isEn ? "Payment Terms" : "Plazo de Pago"}
                  </label>
                  <input
                    type="text"
                    value={supTerms}
                    onChange={(e) => setSupTerms(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {isEn ? "Withholding %" : "Retención %"}
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={supRetention}
                    onChange={(e) => setSupRetention(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-slate-900 tabular-nums"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full steel-btn-primary justify-center inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                {isEn ? "Save Vendor" : "Guardar Proveedor"}
              </button>
            </form>
          </div>

          <div className="xl:col-span-8 bento-card space-y-3">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2">
              {isEn ? "Qualified Vendors & Subcontractors" : "Directorio de Proveedores & Subcontratos"}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {suppliersState.proveedores.map((v) => {
                const stats = vendorPayablesMap.get(v.id) || { total: 0, paid: 0, count: 0 };
                const due = Math.max(0, stats.total - stats.paid);
                return (
                  <div
                    key={v.id}
                    className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 flex flex-col justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-extrabold text-indigo-700">{v.codigo}</span>
                        <span className="inline-flex items-center gap-0.5 font-bold text-amber-600">
                          <Star className="w-3 h-3 fill-amber-400" />
                          {v.calificacion.toFixed(1)}
                        </span>
                      </div>
                      <h4 className="mt-1 text-xs font-extrabold text-slate-900">
                        {isEn ? v.razonSocialEn : v.razonSocial}
                      </h4>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        {isEn ? v.especialidadEn : v.especialidad}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-2 text-[10px] text-slate-500">
                        <span>{v.nitTaxId}</span>
                        <span>• {isEn ? v.condicionPagoEn : v.condicionPago}</span>
                        <span>• Ret: {v.retencionPct}%</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px]">
                      <span className="text-slate-600">
                        {stats.count} OC • {formatMoney(stats.total)}
                      </span>
                      <span
                        className={`font-extrabold ${
                          due > 0 ? "text-amber-700" : "text-emerald-700"
                        }`}
                      >
                        {due > 0
                          ? `${isEn ? "AP Due:" : "CxP:"} ${formatMoney(due)}`
                          : isEn
                            ? "Settled"
                            : "Al día"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SUB-VIEW 3: BIM TAKEOFF TO PROCUREMENT */}
      {subView === "demanda_bim" && (
        <div className="bento-card space-y-3">
          <div className="border-b border-slate-200 pb-2">
            <h3 className="text-sm font-bold text-slate-900">
              {isEn
                ? "Parametric BIM Material Takeoff → Quick PO Generator"
                : "Explosión de Insumos BIM 5D → Generador Rápido de Compras"}
            </h3>
            <p className="text-[11px] text-slate-500">
              {isEn
                ? "Convert theoretical BIM takeoff quantities directly into issued purchase orders without double data entry."
                : "Convierte las cantidades teóricas de Insumos BIM directamente en órdenes de compra sin redigitar."}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="py-2 pr-2">{isEn ? "BIM Material / SKU" : "Insumo BIM / SKU"}</th>
                  <th className="py-2 px-2">{isEn ? "Unit" : "Unidad"}</th>
                  <th className="py-2 px-2 text-right">{isEn ? "BIM Takeoff Demand" : "Demanda Total BIM"}</th>
                  <th className="py-2 pl-2 text-right">{isEn ? "Procurement" : "Generar Compra"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bimDemandGrouped.map((row) => (
                  <tr key={`${row.Insumo}-${row.Unidad}`} className="hover:bg-slate-50/70">
                    <td className="py-2.5 pr-2 font-bold text-slate-900">
                      {localizeMaterialName(row.Insumo, lang)}
                    </td>
                    <td className="py-2.5 px-2 text-slate-600 font-semibold">
                      {unitLabel(row.Unidad)}
                    </td>
                    <td className="py-2.5 px-2 text-right font-extrabold text-slate-900 tabular-nums">
                      {convertQtyValue(row.Total, row.Unidad).toFixed(2)}
                    </td>
                    <td className="py-2.5 pl-2 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          handleQuickCreatePoFromBim(row.Insumo, row.Unidad, row.Total)
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-800 text-[11px] font-bold"
                      >
                        <Plus className="w-3 h-3" />
                        {isEn ? "Create PO" : "Crear OC"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
