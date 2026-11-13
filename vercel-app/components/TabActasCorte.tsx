"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  ClipboardList,
  Download,
  FileSpreadsheet,
  ReceiptText,
  XCircle,
} from "lucide-react";
import { downloadPythonBinary } from "../lib/calcClient";
import { useAppPreferences } from "../lib/i18n";
import {
  ConsolidationResult,
  LiquidationParams,
  ProjectConfig,
} from "../lib/types";
import {
  buildExportConsolidatedRows,
  localizeActivity,
  sanitizeDemoProject,
} from "../lib/units";

interface TabActasCorteProps {
  proyecto: ProjectConfig;
  data: ConsolidationResult;
  params: LiquidationParams;
  isDemo?: boolean;
}

export default function TabActasCorte({
  proyecto,
  data,
  params,
  isDemo = false,
}: TabActasCorteProps) {
  const { lang, currency, rates, docOpts, formatMoney, formatQty, unitLabel } =
    useAppPreferences();
  const isEn = lang === "en";
  const [numeroActa, setNumeroActa] = useState("01");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );

  const cd = data.totals.total_costo_ejecutado;
  const valA = cd * (params.pct_a / 100);
  const valI = cd * (params.pct_i / 100);
  const valU = cd * (params.pct_u / 100);
  const valAiu = valA + valI + valU;
  const bruto = cd + valAiu;
  const dedAnt = bruto * (params.pct_anticipo / 100);
  const dedGar = bruto * (params.pct_garantia / 100);
  const ivaU = valU * 0.19;
  const netoPagar = bruto - dedAnt - dedGar + ivaU;

  const ejecutados = data.df_5d.filter((r) => r.Cantidad_Ejecutada > 0);

  const handleDownloadExcel = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const exportRows = buildExportConsolidatedRows(
        data.df_5d,
        lang,
        currency,
        rates
      );
      const cleanProj = sanitizeDemoProject(proyecto, isDemo, lang);
      const fname = isEn
        ? `Payment_Certificate_${numeroActa}_${proyecto.id}_${currency}.xlsx`
        : `Acta_Corte_${numeroActa}_${proyecto.id}_${currency}.xlsx`;

      await downloadPythonBinary(
        {
          action: "acta_corte_excel",
          df_5d: exportRows,
          numero_acta: numeroActa,
          params_liquidacion: params,
          proyecto_actual: cleanProj,
          doc_opts: {
            ...docOpts,
            is_demo: isDemo || proyecto.id === "demo_showcase",
          },
        },
        fname
      );
      setMsg({
        type: "ok",
        text: isEn
          ? `Payment Certificate Excel generated (${currency} • Imperial US units).`
          : `Acta de Corte Excel generada con formato OpenPyXL (${currency} • Sistema Métrico).`,
      });
    } catch (err) {
      setMsg({
        type: "err",
        text: isEn
          ? `Error generating Excel: ${String(err)}`
          : `Error generando Excel: ${String(err)}`,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="bento-card flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="p-2.5 rounded-xl bg-slate-900 text-white shrink-0">
            <FileSpreadsheet className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-base font-extrabold text-slate-900">
              {isEn
                ? "Progress Payment Certificates & Contractual Billing"
                : "Actas de Corte de Obra & Liquidación de Facturación"}
            </h2>
            <p className="text-xs text-slate-500">
              {isEn
                ? `Automated certificate settlement with Indirects (AIU), advance amortization, retainage & 19% VAT on profit fee (${currency} • Imperial).`
                : `Liquidación contractual automática con AIU, amortización de anticipo, retención en garantía e IVA sobre Utilidad (${currency}).`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <label className="font-bold text-slate-700">
            {isEn ? "Cert. No." : "Acta No."}
          </label>
          <input
            value={numeroActa}
            onChange={(e) => setNumeroActa(e.target.value)}
            className="w-16 rounded-lg border border-slate-300 px-2.5 py-2 font-mono font-bold text-center"
          />
          <button
            type="button"
            onClick={handleDownloadExcel}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold shadow-sm disabled:opacity-60"
          >
            <Download className="w-3.5 h-3.5" />
            <span>
              {loading
                ? isEn
                  ? "Generating..."
                  : "Generando..."
                : isEn
                ? `Download Excel Cert (.xlsx • ${currency})`
                : `Descargar Acta Excel (.xlsx • ${currency})`}
            </span>
          </button>
        </div>
      </div>

      {msg && (
        <div
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold border ${
            msg.type === "err"
              ? "bg-red-50 border-red-200 text-red-700"
              : "bg-emerald-50 border-emerald-200 text-emerald-800"
          }`}
        >
          {msg.type === "err" ? (
            <XCircle className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          )}
          <span>{msg.text}</span>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bento-card border-l-4 border-l-slate-700">
          <div className="text-[11px] font-bold uppercase text-slate-500">
            {isEn ? "Direct Earned Subtotal" : "Subtotal Costo Directo"}
          </div>
          <div className="kpi-num text-xl font-extrabold text-slate-900 mt-1">
            {formatMoney(cd)}
          </div>
        </div>
        <div className="bento-card border-l-4 border-l-slate-800">
          <div className="text-[11px] font-bold uppercase text-slate-500">
            {isEn
              ? `Gross Certified (+ AIU ${(params.pct_a + params.pct_i + params.pct_u).toFixed(1)}%)`
              : `Valor Bruto (+ AIU ${(params.pct_a + params.pct_i + params.pct_u).toFixed(1)}%)`}
          </div>
          <div className="kpi-num text-xl font-extrabold text-slate-900 mt-1">
            {formatMoney(bruto)}
          </div>
        </div>
        <div className="bento-card border-l-4 border-l-amber-500">
          <div className="text-[11px] font-bold uppercase text-slate-500">
            {isEn
              ? "Deductions (Advance + Retainage)"
              : "Deducciones (Anticipo + Ret.)"}
          </div>
          <div className="kpi-num text-xl font-extrabold text-amber-700 mt-1">
            - {formatMoney(dedAnt + dedGar)}
          </div>
        </div>
        <div className="bento-card border-l-4 border-l-emerald-500 bg-emerald-50/40">
          <div className="text-[11px] font-bold uppercase text-emerald-700">
            {isEn ? "Net Amount Payable (+ VAT)" : "Valor Neto a Pagar (+ IVA U)"}
          </div>
          <div className="kpi-num text-xl font-extrabold text-emerald-800 mt-1">
            {formatMoney(netoPagar)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-5 bento-card">
          <div className="flex items-center gap-2 mb-3">
            <ReceiptText className="w-4 h-4 text-sky-700" />
            <h3 className="text-sm font-extrabold text-slate-900">
              {isEn
                ? "Financial Liquidation Breakdown"
                : "Desglose de Liquidación Económica"}
            </h3>
          </div>
          <table className="w-full text-xs border-collapse">
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="py-2 font-semibold">
                  {isEn ? "Direct Earned Cost Subtotal" : "Subtotal Costo Directo"}
                </td>
                <td className="py-2 text-right font-mono font-bold">
                  {formatMoney(cd)}
                </td>
              </tr>
              <tr>
                <td className="py-2 text-slate-600">
                  {isEn
                    ? `(+) Administration (${params.pct_a}%)`
                    : `(+) Administración (${params.pct_a}%)`}
                </td>
                <td className="py-2 text-right font-mono">{formatMoney(valA)}</td>
              </tr>
              <tr>
                <td className="py-2 text-slate-600">
                  {isEn
                    ? `(+) Contingencies (${params.pct_i}%)`
                    : `(+) Imprevistos (${params.pct_i}%)`}
                </td>
                <td className="py-2 text-right font-mono">{formatMoney(valI)}</td>
              </tr>
              <tr>
                <td className="py-2 text-slate-600">
                  {isEn
                    ? `(+) Profit Fee (${params.pct_u}%)`
                    : `(+) Utilidad (${params.pct_u}%)`}
                </td>
                <td className="py-2 text-right font-mono">{formatMoney(valU)}</td>
              </tr>
              <tr className="bg-slate-50 font-bold">
                <td className="py-2 px-2">
                  {isEn
                    ? `(=) Gross Cert No. ${numeroActa}`
                    : `(=) Valor Bruto Acta No. ${numeroActa}`}
                </td>
                <td className="py-2 px-2 text-right font-mono">
                  {formatMoney(bruto)}
                </td>
              </tr>
              <tr>
                <td className="py-2 text-red-600">
                  {isEn
                    ? `(-) Advance Amortization (${params.pct_anticipo}%)`
                    : `(-) Amortización Anticipo (${params.pct_anticipo}%)`}
                </td>
                <td className="py-2 text-right font-mono text-red-600">
                  - {formatMoney(dedAnt)}
                </td>
              </tr>
              <tr>
                <td className="py-2 text-red-600">
                  {isEn
                    ? `(-) Warranty Retainage (${params.pct_garantia}%)`
                    : `(-) Retención Garantía (${params.pct_garantia}%)`}
                </td>
                <td className="py-2 text-right font-mono text-red-600">
                  - {formatMoney(dedGar)}
                </td>
              </tr>
              <tr>
                <td className="py-2 text-slate-600">
                  {isEn
                    ? "(+) 19% VAT on Profit Fee"
                    : "(+) IVA 19% sobre Utilidad"}
                </td>
                <td className="py-2 text-right font-mono">{formatMoney(ivaU)}</td>
              </tr>
              <tr className="bg-emerald-50 text-emerald-900 font-extrabold text-sm">
                <td className="py-2.5 px-2">
                  {isEn ? "(=) NET INVOICEABLE AMOUNT" : "(=) NETO A FACTURAR"}
                </td>
                <td className="py-2.5 px-2 text-right font-mono">
                  {formatMoney(netoPagar)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="xl:col-span-7 bento-card overflow-hidden">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardList className="w-4 h-4 text-sky-700" />
            <h3 className="text-sm font-extrabold text-slate-900">
              {isEn
                ? `Executed Work Items Included (${ejecutados.length})`
                : `Ítems Ejecutados Incluidos en el Corte (${ejecutados.length})`}
            </h3>
          </div>
          {ejecutados.length === 0 ? (
            <div className="text-xs text-slate-500 py-8 text-center">
              {isEn
                ? "No executed quantities have been recorded for this project yet."
                : "No hay cantidades ejecutadas registradas en Supabase para este proyecto aún."}
            </div>
          ) : (
            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0">
                  <tr>
                    <th className="p-2">{isEn ? "Item" : "Ítem"}</th>
                    <th className="p-2">{isEn ? "Work Activity" : "Actividad"}</th>
                    <th className="p-2 text-right">
                      {isEn ? "Exec. Qty" : "Cant. Ejec."}
                    </th>
                    <th className="p-2 text-right">
                      {isEn ? `Earned (${currency})` : `Valor Causado (${currency})`}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ejecutados.map((r) => (
                    <tr key={r.Item}>
                      <td className="p-2 font-mono font-bold">{r.Item}</td>
                      <td className="p-2 font-semibold">
                        {localizeActivity(r.Actividad, lang)}
                      </td>
                      <td className="p-2 text-right font-mono whitespace-nowrap">
                        {formatQty(r.Cantidad_Ejecutada, r.Unidad)}{" "}
                        {unitLabel(r.Unidad)}
                      </td>
                      <td className="p-2 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                        {formatMoney(r.Costo_Ejecutado)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
