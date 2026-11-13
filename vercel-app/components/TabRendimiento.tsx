"use client";

import React from "react";
import { BarChart3, Ruler, Users } from "lucide-react";
import { resolverMetaApu } from "../lib/calcClient";
import { useAppPreferences } from "../lib/i18n";
import { ConsolidationResult } from "../lib/types";
import {
  convertRateValue,
  convertUnitLabel,
  localizeActivity,
  localizeCrew,
  localizeStatus,
} from "../lib/units";

interface TabRendimientoProps {
  data: ConsolidationResult;
}

function StatusPill({ status, lang }: { status: string; lang: "es" | "en" }) {
  const clean = status.replace(/^[^A-Za-z0-9]+/, "").trim();
  const isHigh = /alto|high/i.test(clean);
  const isLow = /bajo|low|below/i.test(clean);
  const dotCls = isHigh
    ? "bg-emerald-500"
    : isLow
    ? "bg-rose-500"
    : "bg-sky-500";
  const textCls = isHigh
    ? "text-emerald-700"
    : isLow
    ? "text-rose-700"
    : "text-sky-700";

  return (
    <span className={`inline-flex items-center gap-1.5 font-bold whitespace-nowrap ${textCls}`}>
      <span className={`w-2 h-2 rounded-full ${dotCls}`} />
      <span>{localizeStatus(clean, lang)}</span>
    </span>
  );
}

function formatRateText(rateStr: string, lang: "es" | "en"): string {
  const parts = String(rateStr || "").trim().split(/\s+/);
  const rawVal = Number(parts[0]);
  const rawUnit = parts.slice(1).join(" ") || "und/día";
  if (!Number.isFinite(rawVal)) return rateStr;
  const convertedVal = convertRateValue(rawVal, rawUnit, lang);
  const convertedUnit = convertUnitLabel(rawUnit, lang);
  return `${convertedVal.toLocaleString("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  })} ${convertedUnit}`;
}

export default function TabRendimiento({ data }: TabRendimientoProps) {
  const { lang, formatQty, unitLabel } = useAppPreferences();
  const isEn = lang === "en";
  const { rendimientos, df_5d = [] } = data;
  const hasReal = rendimientos.length > 0;
  const avgEff = hasReal
    ? rendimientos.reduce((a, r) => a + r["Eficiencia_%"], 0) / rendimientos.length
    : null;
  const alertas = rendimientos.filter((r) => r["Eficiencia_%"] < 90).length;

  return (
    <div className="space-y-5">
      <div className="bento-card flex items-start gap-3">
        <span className="p-2.5 rounded-xl bg-slate-900 text-white shrink-0">
          <Users className="w-5 h-5" />
        </span>
        <div>
          <h2 className="text-base font-extrabold text-slate-900">
            {isEn
              ? "Labor Productivity & Crew Efficiency vs. APU Baseline"
              : "Productividad de Mano de Obra & Eficiencia de Cuadrillas vs. APU"}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {isEn
              ? "Daily field log audit (excluding baseline [BIM_TAKEOFF] and MS Project sync rows) benchmarked against standard construction crew outputs."
              : "Auditoría diaria real (excluyendo metrados base [BIM_TAKEOFF] y cronogramas MS Project) frente a rendimientos constructivos reales."}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bento-card border-l-4 border-l-slate-800">
          <div className="text-[11px] font-bold uppercase text-slate-500">
            {isEn ? "Active Crews Logged" : "Frentes con Registro Diario"}
          </div>
          <div className="kpi-num text-2xl font-extrabold text-slate-900 mt-1">
            {rendimientos.length}
          </div>
        </div>
        <div className="bento-card border-l-4 border-l-emerald-500">
          <div className="text-[11px] font-bold uppercase text-slate-500">
            {isEn ? "Global Crew Efficiency" : "Eficiencia Global Cuadrillas"}
          </div>
          <div className="kpi-num text-2xl font-extrabold text-emerald-700 mt-1">
            {avgEff !== null ? `${avgEff.toFixed(1)}%` : "—"}
          </div>
        </div>
        <div className="bento-card border-l-4 border-l-amber-500">
          <div className="text-[11px] font-bold uppercase text-slate-500">
            {isEn ? "Underperforming Crews (<90%)" : "Frentes Bajo Rendimiento (<90%)"}
          </div>
          <div className="kpi-num text-2xl font-extrabold text-amber-700 mt-1">
            {alertas}
          </div>
        </div>
      </div>

      <div className="bento-card">
        <div className="mb-3 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-sky-700 shrink-0" />
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">
              {isEn
                ? "Actual Productivity Reported in Field Log"
                : "Desempeño Real Reportado en Bitácora de Campo"}
            </h3>
            <p className="text-[11px] text-slate-500">
              {isEn
                ? "Grouped by work activity and distinct reporting shifts logged on site."
                : "Agrupado por actividad y días calendario únicos reportados en obra."}
            </p>
          </div>
        </div>

        {!hasReal ? (
          <div className="py-8 px-4 text-center text-xs text-slate-600 bg-slate-50 rounded-xl border border-dashed border-slate-300">
            {isEn
              ? "No daily crew shifts have been logged in Field Log for this project yet. Real average productivity per shift will appear here once field logs are submitted."
              : "Aún no hay jornadas diarias de avance físico reportadas en Bitácora para este proyecto. Cuando registres cantidades ejecutadas en campo, aquí verás el rendimiento promedio real por jornada."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-900 text-white font-bold">
                <tr>
                  <th className="p-2.5">{isEn ? "Reported Activity" : "Actividad Reportada"}</th>
                  <th className="p-2.5">{isEn ? "Assigned Crew" : "Cuadrilla Asignada"}</th>
                  <th className="p-2.5 text-right">{isEn ? "Cum. Output" : "Prod. Acumulada"}</th>
                  <th className="p-2.5 text-center">{isEn ? "Shifts" : "Jornadas"}</th>
                  <th className="p-2.5 text-right">{isEn ? "Actual Avg. Rate" : "Rend. Real Prom."}</th>
                  <th className="p-2.5 text-right">{isEn ? "APU Target" : "Meta APU"}</th>
                  <th className="p-2.5 text-right">{isEn ? "% Efficiency" : "% Eficiencia"}</th>
                  <th className="p-2.5">{isEn ? "Rating" : "Evaluación"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rendimientos.map((r) => {
                  const baseUnit = String(r.Meta_APU_Teorica || "").split(/\s+/)[1]?.split("/")[0] || "und";
                  return (
                    <tr key={r.Actividad} className="hover:bg-slate-50">
                      <td className="p-2.5 font-bold text-slate-900">
                        {localizeActivity(r.Actividad, lang)}
                      </td>
                      <td className="p-2.5 text-slate-600">
                        {localizeCrew(r.Cuadrilla_Asignada, lang)}
                      </td>
                      <td className="p-2.5 text-right font-mono font-semibold whitespace-nowrap">
                        {formatQty(r.Total_Producido, baseUnit)} {unitLabel(baseUnit)}
                      </td>
                      <td className="p-2.5 text-center font-mono">{r.Jornadas}</td>
                      <td className="p-2.5 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                        {formatRateText(r.Rendimiento_Real, lang)}
                      </td>
                      <td className="p-2.5 text-right font-mono text-slate-600 whitespace-nowrap">
                        {formatRateText(r.Meta_APU_Teorica, lang)}
                      </td>
                      <td className="p-2.5 text-right font-mono font-extrabold">
                        {r["Eficiencia_%"].toFixed(1)}%
                      </td>
                      <td className="p-2.5">
                        <StatusPill status={r.Evaluacion} lang={lang} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {df_5d.length > 0 && (
        <div className="bento-card">
          <div className="mb-3 flex items-center gap-2">
            <Ruler className="w-4 h-4 text-sky-700 shrink-0" />
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                {isEn
                  ? "APU Construction Productivity Baseline (Active BOQ)"
                  : "Línea Base de Rendimientos Constructivos APU (Presupuesto Vigente)"}
              </h3>
              <p className="text-[11px] text-slate-500">
                {isEn
                  ? "Standard daily output targets per crew and estimated work shifts required for contracted quantities."
                  : "Estándares diarios realistas por cuadrilla tipo y duración estimada para ejecutar el metrado contratado del proyecto."}
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-800 text-white font-bold">
                <tr>
                  <th className="p-2.5">{isEn ? "Item" : "Ítem"}</th>
                  <th className="p-2.5">{isEn ? "Contract Activity" : "Actividad Contractual"}</th>
                  <th className="p-2.5 text-right">{isEn ? "Takeoff Qty" : "Metrado"}</th>
                  <th className="p-2.5">{isEn ? "Standard Crew" : "Cuadrilla Estándar"}</th>
                  <th className="p-2.5 text-right">{isEn ? "APU Daily Target" : "Meta Diaria APU"}</th>
                  <th className="p-2.5 text-right">{isEn ? "Est. Shifts (1 Crew)" : "Jornadas Est. (1 Cuadr.)"}</th>
                  <th className="p-2.5 text-right">{isEn ? "Actual Progress" : "Ejecución Actual"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {df_5d.map((item) => {
                  const meta = resolverMetaApu(item.Actividad, item.Unidad);
                  const cant = Number(item.Cantidad_Contratada || 0);
                  const estDias =
                    meta.meta_dia > 0 && cant > 0
                      ? Math.max(1, Math.ceil(cant / meta.meta_dia))
                      : 0;
                  const metaDisplayVal = convertRateValue(meta.meta_dia, meta.und, lang);
                  const metaDisplayUnit = convertUnitLabel(meta.und, lang);
                  return (
                    <tr key={`${item.Item}-${item.Actividad}`} className="hover:bg-slate-50">
                      <td className="p-2.5 font-mono font-bold text-slate-700">
                        {item.Item}
                      </td>
                      <td className="p-2.5 font-semibold text-slate-900">
                        {localizeActivity(item.Actividad, lang)}
                      </td>
                      <td className="p-2.5 text-right font-mono text-slate-700 whitespace-nowrap">
                        {formatQty(cant, item.Unidad)} {unitLabel(item.Unidad)}
                      </td>
                      <td className="p-2.5 text-slate-600">
                        {localizeCrew(meta.cuadrilla, lang)}
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                        {metaDisplayVal.toLocaleString("en-US", {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 2,
                        })}{" "}
                        {metaDisplayUnit}
                      </td>
                      <td className="p-2.5 text-right font-mono text-slate-700">
                        {estDias} {isEn ? "days" : "días"}
                      </td>
                      <td className="p-2.5 text-right font-mono font-semibold text-slate-800">
                        {Number(item["Avance_%"] || 0).toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
