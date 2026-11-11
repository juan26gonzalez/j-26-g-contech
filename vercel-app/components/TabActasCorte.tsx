"use client";

import React, { useState } from "react";
import { downloadPythonBinary } from "../lib/calcClient";
import { formatCOP, formatNum } from "../lib/projects";
import {
  ConsolidationResult,
  LiquidationParams,
  ProjectConfig,
} from "../lib/types";

interface TabActasCorteProps {
  proyecto: ProjectConfig;
  data: ConsolidationResult;
  params: LiquidationParams;
}

export default function TabActasCorte({
  proyecto,
  data,
  params,
}: TabActasCorteProps) {
  const [numeroActa, setNumeroActa] = useState("01");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

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
      await downloadPythonBinary(
        {
          action: "acta_corte_excel",
          df_5d: data.df_5d,
          numero_acta: numeroActa,
          params_liquidacion: params,
          proyecto_actual: proyecto,
        },
        `Acta_Corte_${numeroActa}_${proyecto.id}.xlsx`
      );
      setMsg("✅ Acta de Corte Excel generada con formato OpenPyXL.");
    } catch (err) {
      setMsg(`❌ Error generando Excel: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="bento-card flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-extrabold text-slate-900">
            📑 Actas de Corte de Obra & Liquidación de Facturación
          </h2>
          <p className="text-xs text-slate-500">
            Liquidación contractual automática con AIU, amortización de anticipo, retención en garantía e IVA sobre Utilidad.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <label className="font-bold text-slate-700">Acta No.</label>
          <input
            value={numeroActa}
            onChange={(e) => setNumeroActa(e.target.value)}
            className="w-16 rounded-lg border border-slate-300 px-2.5 py-2 font-mono font-bold text-center"
          />
          <button
            type="button"
            onClick={handleDownloadExcel}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold shadow-sm"
          >
            {loading ? "⏳ Generando..." : "📊 Descargar Acta Excel (.xlsx)"}
          </button>
        </div>
      </div>

      {msg && (
        <div
          className={`rounded-xl px-4 py-2.5 text-xs font-bold border ${
            msg.startsWith("❌")
              ? "bg-red-50 border-red-200 text-red-700"
              : "bg-emerald-50 border-emerald-200 text-emerald-800"
          }`}
        >
          {msg}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bento-card border-l-4 border-l-slate-700">
          <div className="text-[11px] font-bold uppercase text-slate-500">
            Subtotal Costo Directo
          </div>
          <div className="kpi-num text-xl font-extrabold text-slate-900 mt-1">
            {formatCOP(cd)}
          </div>
        </div>
        <div className="bento-card border-l-4 border-l-blue-600">
          <div className="text-[11px] font-bold uppercase text-slate-500">
            Valor Bruto (+ AIU {(params.pct_a + params.pct_i + params.pct_u).toFixed(1)}%)
          </div>
          <div className="kpi-num text-xl font-extrabold text-blue-800 mt-1">
            {formatCOP(bruto)}
          </div>
        </div>
        <div className="bento-card border-l-4 border-l-amber-500">
          <div className="text-[11px] font-bold uppercase text-slate-500">
            Deducciones (Anticipo + Ret.)
          </div>
          <div className="kpi-num text-xl font-extrabold text-amber-700 mt-1">
            - {formatCOP(dedAnt + dedGar)}
          </div>
        </div>
        <div className="bento-card border-l-4 border-l-emerald-500 bg-emerald-50/40">
          <div className="text-[11px] font-bold uppercase text-emerald-700">
            Valor Neto a Pagar (+ IVA U)
          </div>
          <div className="kpi-num text-xl font-extrabold text-emerald-800 mt-1">
            {formatCOP(netoPagar)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-5 bento-card">
          <h3 className="text-sm font-extrabold text-slate-900 mb-3">
            🧾 Desglose de Liquidación Económica
          </h3>
          <table className="w-full text-xs border-collapse">
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="py-2 font-semibold">Subtotal Costo Directo</td>
                <td className="py-2 text-right font-mono font-bold">{formatCOP(cd)}</td>
              </tr>
              <tr>
                <td className="py-2 text-slate-600">(+) Administración ({params.pct_a}%)</td>
                <td className="py-2 text-right font-mono">{formatCOP(valA)}</td>
              </tr>
              <tr>
                <td className="py-2 text-slate-600">(+) Imprevistos ({params.pct_i}%)</td>
                <td className="py-2 text-right font-mono">{formatCOP(valI)}</td>
              </tr>
              <tr>
                <td className="py-2 text-slate-600">(+) Utilidad ({params.pct_u}%)</td>
                <td className="py-2 text-right font-mono">{formatCOP(valU)}</td>
              </tr>
              <tr className="bg-slate-50 font-bold">
                <td className="py-2 px-2">(=) Valor Bruto Acta No. {numeroActa}</td>
                <td className="py-2 px-2 text-right font-mono">{formatCOP(bruto)}</td>
              </tr>
              <tr>
                <td className="py-2 text-red-600">
                  (-) Amortización Anticipo ({params.pct_anticipo}%)
                </td>
                <td className="py-2 text-right font-mono text-red-600">
                  - {formatCOP(dedAnt)}
                </td>
              </tr>
              <tr>
                <td className="py-2 text-red-600">
                  (-) Retención Garantía ({params.pct_garantia}%)
                </td>
                <td className="py-2 text-right font-mono text-red-600">
                  - {formatCOP(dedGar)}
                </td>
              </tr>
              <tr>
                <td className="py-2 text-slate-600">(+) IVA 19% sobre Utilidad</td>
                <td className="py-2 text-right font-mono">{formatCOP(ivaU)}</td>
              </tr>
              <tr className="bg-emerald-50 text-emerald-900 font-extrabold text-sm">
                <td className="py-2.5 px-2">(=) NETO A FACTURAR</td>
                <td className="py-2.5 px-2 text-right font-mono">{formatCOP(netoPagar)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="xl:col-span-7 bento-card overflow-hidden">
          <h3 className="text-sm font-extrabold text-slate-900 mb-3">
            📋 Ítems Ejecutados Incluidos en el Corte ({ejecutados.length})
          </h3>
          {ejecutados.length === 0 ? (
            <div className="text-xs text-slate-500 py-8 text-center">
              No hay cantidades ejecutadas registradas en Supabase para este proyecto aún.
            </div>
          ) : (
            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0">
                  <tr>
                    <th className="p-2">Ítem</th>
                    <th className="p-2">Actividad</th>
                    <th className="p-2 text-right">Cant. Ejec.</th>
                    <th className="p-2 text-right">Valor Causado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ejecutados.map((r) => (
                    <tr key={r.Item}>
                      <td className="p-2 font-mono font-bold">{r.Item}</td>
                      <td className="p-2 font-semibold">{r.Actividad}</td>
                      <td className="p-2 text-right font-mono">
                        {formatNum(r.Cantidad_Ejecutada)} {r.Unidad}
                      </td>
                      <td className="p-2 text-right font-mono font-bold text-emerald-700">
                        {formatCOP(r.Costo_Ejecutado)}
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
