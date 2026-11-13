"use client";

import React, { useEffect, useState } from "react";
import {
  Building2,
  CheckCircle2,
  Download,
  FileSignature,
  HardHat,
  XCircle,
} from "lucide-react";
import { downloadPythonBinary, normalizarTexto } from "../lib/calcClient";
import { useAppPreferences } from "../lib/i18n";
import { getColombiaNow } from "../lib/projects";
import {
  ClientContractCfg,
  ConsolidationResult,
  LiquidationParams,
  ProjectConfig,
  SubcontractCfg,
  SubcontractItem,
} from "../lib/types";
import {
  buildExportConsolidatedRows,
  convertUnitPriceCopToDisplay,
  localizeActivity,
  sanitizeDemoProject,
  unitConversionFactor,
} from "../lib/units";

interface TabContratosPDFProps {
  proyecto: ProjectConfig;
  data: ConsolidationResult;
  params: LiquidationParams;
  isDemo?: boolean;
}

function sugerirTarifaMO(actividad: string, pu: number): number {
  const act = normalizarTexto(actividad);
  if (act.includes("cielo") || act.includes("drywall") || act.includes("pvc")) return 18000;
  if (act.includes("plantilla") || act.includes("solado")) return 15000;
  if (act.includes("porcelanato") || act.includes("enchape") || act.includes("piso")) return 25000;
  if (act.includes("bloque") || act.includes("mamposteria")) return 22000;
  if (act.includes("panete") || act.includes("revoco")) return 14000;
  if (act.includes("estuco") || act.includes("pintura")) return 9000;
  return Math.round((pu * 0.45) / 500) * 500;
}

export default function TabContratosPDF({
  proyecto,
  data,
  params,
  isDemo = false,
}: TabContratosPDFProps) {
  const {
    lang,
    currency,
    rates,
    docOpts,
    formatMoney,
    formatConvertedMoney,
    formatQty,
    convertQtyValue,
    unitLabel,
  } = useAppPreferences();
  const isEn = lang === "en";
  const effectiveDemo = isDemo || proyecto.id === "demo_showcase";
  const fx = rates[currency] || 1;

  const { fechaStr } = getColombiaNow();
  const [subTab, setSubTab] = useState<"cliente" | "oficial">("cliente");

  const [cliCfg, setCliCfg] = useState<ClientContractCfg>({
    num_contrato: "JGM-2026-001",
    fecha_firma: fechaStr,
    plazo_dias: 15,
    garantia_meses: 12,
    pct_anticipo: 50,
    pct_corte: 40,
    pct_saldo: 10,
    incluir_iva_u: false,
    notas_adicionales: "",
  });

  const [subCfg, setSubCfg] = useState<SubcontractCfg>({
    num_subcontrato: "SUB-JGM-001",
    nombre_oficial: "Carlos Alberto Pérez",
    cedula_oficial: effectiveDemo ? "DEMO-SUB-01" : "72.345.678",
    telefono_oficial: effectiveDemo ? "+1 (555) 014-8820" : "300 123 4567",
    especialidad: isEn
      ? "Porcelain Flooring, Masonry & Drywall Ceilings"
      : "Pisos, Enchapes, Plantillas y Cielos Rasos",
    pct_retencion: 10,
    plazo_dias: 12,
    fecha_inicio: fechaStr,
    fecha_entrega: fechaStr,
  });

  const [subItems, setSubItems] = useState<SubcontractItem[]>([]);
  const [selectedMap, setSelectedMap] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );

  useEffect(() => {
    const initialItems: SubcontractItem[] = data.df_5d.map((r) => ({
      Item: r.Item,
      Actividad: r.Actividad,
      Unidad: r.Unidad,
      Cantidad_Contratada: r.Cantidad_Contratada,
      Tarifa_Mano_Obra: sugerirTarifaMO(r.Actividad, r.Precio_Unitario),
    }));
    const sel: Record<string, boolean> = {};
    initialItems.forEach((it, idx) => {
      sel[it.Item] = idx < 5;
    });
    setSubItems(initialItems);
    setSelectedMap(sel);
  }, [proyecto.id, data.df_5d.length]);

  const totalDirecto = data.totals.total_ppto_contratado;
  const valAIU =
    totalDirecto * ((params.pct_a + params.pct_i + params.pct_u) / 100);
  const valU = totalDirecto * (params.pct_u / 100);
  const totalContratoCli =
    totalDirecto + valAIU + (cliCfg.incluir_iva_u ? valU * 0.19 : 0);

  const itemsActivosSub = subItems.filter((it) => selectedMap[it.Item]);
  const totalMOSub = itemsActivosSub.reduce(
    (acc, it) => acc + it.Cantidad_Contratada * it.Tarifa_Mano_Obra,
    0
  );

  const handleDownloadCliente = async () => {
    setLoading(true);
    setStatusMsg(null);
    try {
      const exportRows = buildExportConsolidatedRows(
        data.df_5d,
        lang,
        currency,
        rates
      );
      const cleanProj = sanitizeDemoProject(proyecto, effectiveDemo, lang);
      const fname = isEn
        ? `Construction_Agreement_${cliCfg.num_contrato}_${currency}.pdf`
        : `Contrato_Cliente_${cliCfg.num_contrato}_${currency}.pdf`;

      await downloadPythonBinary(
        {
          action: "contrato_cliente_pdf",
          df_5d: exportRows,
          params_liquidacion: params,
          proyecto_actual: cleanProj,
          cfg: cliCfg,
          doc_opts: {
            ...docOpts,
            is_demo: effectiveDemo,
          },
        },
        fname
      );
      setStatusMsg({
        type: "ok",
        text: isEn
          ? `Civil Construction Agreement PDF generated (${currency} • Imperial US units).`
          : `Contrato Civil de Obra generado vía ReportLab (${currency} • Métrico).`,
      });
    } catch (err) {
      setStatusMsg({ type: "err", text: `Error: ${String(err)}` });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadSub = async () => {
    if (itemsActivosSub.length === 0) {
      setStatusMsg({
        type: "err",
        text: isEn
          ? "Select at least one work activity for the subcontract."
          : "Selecciona al menos una actividad para el subcontrato.",
      });
      return;
    }
    setLoading(true);
    setStatusMsg(null);
    try {
      const exportSubItems = itemsActivosSub.map((it) => ({
        Item: it.Item,
        Actividad: localizeActivity(it.Actividad, lang),
        Unidad: unitLabel(it.Unidad),
        Cantidad_Contratada: convertQtyValue(it.Cantidad_Contratada, it.Unidad),
        Tarifa_Mano_Obra: convertUnitPriceCopToDisplay(
          it.Tarifa_Mano_Obra,
          it.Unidad,
          currency,
          rates,
          lang
        ),
      }));
      const cleanProj = sanitizeDemoProject(proyecto, effectiveDemo, lang);
      const fname = isEn
        ? `Piecework_Subcontract_${subCfg.num_subcontrato}_${currency}.pdf`
        : `Subcontrato_${subCfg.num_subcontrato}_${currency}.pdf`;

      await downloadPythonBinary(
        {
          action: "subcontrato_oficial_pdf",
          df_items_sub: exportSubItems,
          proyecto_actual: cleanProj,
          cfg: subCfg,
          doc_opts: {
            ...docOpts,
            is_demo: effectiveDemo,
          },
        },
        fname
      );
      setStatusMsg({
        type: "ok",
        text: isEn
          ? `Piecework Labor Subcontract PDF generated (${currency} • Imperial US units).`
          : `Subcontrato a Destajo generado vía ReportLab (${currency} • Métrico).`,
      });
    } catch (err) {
      setStatusMsg({ type: "err", text: `Error: ${String(err)}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Sub-navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 bento-card">
        <div className="flex items-start gap-3">
          <span className="p-2.5 rounded-xl bg-slate-900 text-white shrink-0">
            <FileSignature className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-base font-extrabold text-slate-900">
              {isEn
                ? "Construction Legal & Subcontracting Hub (PDF Engine)"
                : "Centro de Contratación Legal Civil Colombiana"}
            </h2>
            <p className="text-xs text-slate-500">
              {isEn
                ? `Automated bilingual PDF contracts tailored to active currency (${currency}) and Imperial US units (${effectiveDemo ? "privacy protected in Demo" : "digital stamp enabled"}).`
                : `Generación automática de Contratos PDF con membrete oficial (${currency} • ${effectiveDemo ? "firma privada omitida en Demo" : "con respaldo documental"}).`}
            </p>
          </div>
        </div>

        <div className="flex gap-2 bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setSubTab("cliente")}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              subTab === "cliente"
                ? "steel-btn-primary text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>
              {isEn ? "Owner Prime Contract (AIU)" : "Contrato con Cliente (AIU)"}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab("oficial")}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              subTab === "oficial"
                ? "steel-btn-primary text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <HardHat className="w-3.5 h-3.5" />
            <span>
              {isEn ? "Piecework Subcontract (Labor)" : "Subcontrato Oficiales (Destajo)"}
            </span>
          </button>
        </div>
      </div>

      {statusMsg && (
        <div
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold border ${
            statusMsg.type === "err"
              ? "bg-red-50 border-red-200 text-red-700"
              : "bg-emerald-50 border-emerald-200 text-emerald-800"
          }`}
        >
          {statusMsg.type === "err" ? (
            <XCircle className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {subTab === "cliente" ? (
        <div className="bento-card space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {isEn ? "Contract Reference Code" : "Código del Contrato"}
              </label>
              <input
                value={cliCfg.num_contrato}
                onChange={(e) =>
                  setCliCfg({ ...cliCfg, num_contrato: e.target.value })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono font-bold"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {isEn ? "Execution / Signature Date" : "Fecha de Firma"}
              </label>
              <input
                value={cliCfg.fecha_firma}
                onChange={(e) =>
                  setCliCfg({ ...cliCfg, fecha_firma: e.target.value })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {isEn ? "Contract Duration (Business Days)" : "Plazo de Obra (Días Hábiles)"}
              </label>
              <input
                type="number"
                value={cliCfg.plazo_dias}
                onChange={(e) =>
                  setCliCfg({ ...cliCfg, plazo_dias: Number(e.target.value) })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {isEn ? "% Mobilization Advance" : "% Anticipo a la Firma"}
              </label>
              <input
                type="number"
                value={cliCfg.pct_anticipo}
                onChange={(e) =>
                  setCliCfg({ ...cliCfg, pct_anticipo: Number(e.target.value) })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {isEn ? "% Progress Billings" : "% Corte de Obra"}
              </label>
              <input
                type="number"
                value={cliCfg.pct_corte}
                onChange={(e) =>
                  setCliCfg({ ...cliCfg, pct_corte: Number(e.target.value) })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {isEn ? "% Final Balance on Handover" : "% Saldo Contra Entrega"}
              </label>
              <input
                type="number"
                value={cliCfg.pct_saldo}
                onChange={(e) =>
                  setCliCfg({ ...cliCfg, pct_saldo: Number(e.target.value) })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {isEn ? "Workmanship Warranty (Months)" : "Garantía Técnica (Meses)"}
              </label>
              <input
                type="number"
                value={cliCfg.garantia_meses}
                onChange={(e) =>
                  setCliCfg({ ...cliCfg, garantia_meses: Number(e.target.value) })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono"
              />
            </div>
            <div className="flex items-end pb-2">
              <label className="inline-flex items-center gap-2 font-bold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cliCfg.incluir_iva_u}
                  onChange={(e) =>
                    setCliCfg({ ...cliCfg, incluir_iva_u: e.target.checked })
                  }
                  className="accent-slate-800 w-4 h-4"
                />
                {isEn
                  ? "Include 19% VAT on Profit Fee"
                  : "Incluir IVA 19% sobre Utilidad (Régimen Común)"}
              </label>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              {isEn
                ? "Supplemental Clause / Special Notes (Optional)"
                : "Cláusula Adicional / Notas Especiales (Opcional)"}
            </label>
            <textarea
              rows={2}
              value={cliCfg.notas_adicionales}
              onChange={(e) =>
                setCliCfg({ ...cliCfg, notas_adicionales: e.target.value })
              }
              placeholder={
                isEn
                  ? "e.g., Permitted working hours Monday–Saturday 7:30 a.m. to 5:00 p.m."
                  : "Ej: Horario permitido de obra Lunes a Sábado de 7:30 a.m. a 5:00 p.m."
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </div>

          <div className="steel-subcard rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-[11px] font-bold uppercase text-slate-600">
                {isEn
                  ? `Total Contract Sum to Export (${currency} • Imperial)`
                  : `Valor Total del Contrato a Imprimir (${currency})`}
              </div>
              <div className="text-2xl font-extrabold font-mono text-slate-900">
                {formatMoney(totalContratoCli)}
              </div>
            </div>
            <button
              type="button"
              onClick={handleDownloadCliente}
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl steel-btn-primary font-extrabold"
            >
              <Download className="w-4 h-4" />
              <span>
                {loading
                  ? isEn
                    ? "Generating PDF..."
                    : "Generando PDF..."
                  : isEn
                  ? `Download Owner Contract PDF (${currency})`
                  : `Descargar Contrato Cliente PDF (${currency})`}
              </span>
            </button>
          </div>
        </div>
      ) : (
        <div className="bento-card space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {isEn ? "Subcontract Code" : "Código Subcontrato"}
              </label>
              <input
                value={subCfg.num_subcontrato}
                onChange={(e) =>
                  setSubCfg({ ...subCfg, num_subcontrato: e.target.value })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 font-mono font-bold"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {isEn ? "Trade Foreman / Subcontractor" : "Nombre del Oficial / Contratista M.O."}
              </label>
              <input
                value={subCfg.nombre_oficial}
                onChange={(e) =>
                  setSubCfg({ ...subCfg, nombre_oficial: e.target.value })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {isEn ? "ID / Tax Number" : "Cédula de Ciudadanía"}
              </label>
              <input
                value={subCfg.cedula_oficial}
                onChange={(e) =>
                  setSubCfg({ ...subCfg, cedula_oficial: e.target.value })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 font-mono"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {isEn ? "Contact Phone" : "Teléfono de Contacto"}
              </label>
              <input
                value={subCfg.telefono_oficial}
                onChange={(e) =>
                  setSubCfg({ ...subCfg, telefono_oficial: e.target.value })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">
                {isEn ? "Trade Specialty / Scope" : "Especialidad / Frente Asignado"}
              </label>
              <input
                value={subCfg.especialidad}
                onChange={(e) =>
                  setSubCfg({ ...subCfg, especialidad: e.target.value })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {isEn ? "% Warranty Retainage" : "% Retención Garantía"}
              </label>
              <input
                type="number"
                value={subCfg.pct_retencion}
                onChange={(e) =>
                  setSubCfg({ ...subCfg, pct_retencion: Number(e.target.value) })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 font-mono"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {isEn ? "Duration (Calendar Days)" : "Plazo (Días Calendario)"}
              </label>
              <input
                type="number"
                value={subCfg.plazo_dias}
                onChange={(e) =>
                  setSubCfg({ ...subCfg, plazo_dias: Number(e.target.value) })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 font-mono"
              />
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-100 px-3 py-2 font-bold text-slate-800">
              {isEn
                ? `Piecework Labor Schedule & Unit Rates (${currency} per ${isEn ? "Imperial Unit" : "Metric Unit"})`
                : `Actividades a Destajo y Tarifa Unitaria de Mano de Obra (${currency})`}
            </div>
            <div className="overflow-x-auto max-h-64">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold sticky top-0">
                  <tr>
                    <th className="p-2 w-10 text-center">{isEn ? "Inc." : "Inc."}</th>
                    <th className="p-2 w-14">{isEn ? "Item" : "Ítem"}</th>
                    <th className="p-2">{isEn ? "Work Activity" : "Actividad"}</th>
                    <th className="p-2 w-16 text-center">{isEn ? "Unit" : "Und"}</th>
                    <th className="p-2 w-24 text-right">{isEn ? "Est. Qty" : "Cant."}</th>
                    <th className="p-2 w-36 text-right">
                      {isEn ? `Labor Rate (${currency})` : `Tarifa M.O. (${currency})`}
                    </th>
                    <th className="p-2 w-28 text-right">{isEn ? "Subtotal" : "Subtotal"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {subItems.map((it, idx) => {
                    const checked = Boolean(selectedMap[it.Item]);
                    const convFactor = isEn ? unitConversionFactor(it.Unidad) : 1;
                    const displayRate = convertUnitPriceCopToDisplay(
                      it.Tarifa_Mano_Obra,
                      it.Unidad,
                      currency,
                      rates,
                      lang
                    );
                    const roundedDisplayRate =
                      currency === "COP"
                        ? Math.round(displayRate)
                        : Math.round(displayRate * 100) / 100;
                    const rowSubtotal = it.Cantidad_Contratada * it.Tarifa_Mano_Obra;

                    return (
                      <tr key={it.Item} className={checked ? "bg-slate-200/45" : ""}>
                        <td className="p-2 text-center">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              setSelectedMap((p) => ({
                                ...p,
                                [it.Item]: e.target.checked,
                              }))
                            }
                            className="accent-slate-800"
                          />
                        </td>
                        <td className="p-2 font-mono font-bold">{it.Item}</td>
                        <td className="p-2 font-semibold">
                          {localizeActivity(it.Actividad, lang)}
                        </td>
                        <td className="p-2 text-center font-mono">
                          {unitLabel(it.Unidad)}
                        </td>
                        <td className="p-2 text-right font-mono">
                          {formatQty(it.Cantidad_Contratada, it.Unidad)}
                        </td>
                        <td className="p-1.5">
                          <input
                            type="number"
                            step={currency === "COP" ? "500" : "0.05"}
                            value={roundedDisplayRate}
                            onChange={(e) => {
                              const nextDisplay = Number(e.target.value) || 0;
                              const nextCopMetric = nextDisplay * fx * convFactor;
                              setSubItems((prev) =>
                                prev.map((x, i) =>
                                  i === idx
                                    ? { ...x, Tarifa_Mano_Obra: nextCopMetric }
                                    : x
                                )
                              );
                            }}
                            className="w-full border border-slate-300 rounded px-2 py-1 text-right font-mono font-bold"
                          />
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                          {formatConvertedMoney(
                            rowSubtotal / fx,
                            currency === "COP" ? 0 : 2
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-[11px] font-bold uppercase text-emerald-700">
                {isEn
                  ? `Total Piecework Subcontract (${itemsActivosSub.length} items selected)`
                  : `Total Subcontrato M.O. (${itemsActivosSub.length} ítems seleccionados)`}
              </div>
              <div className="text-2xl font-extrabold font-mono text-emerald-900">
                {formatConvertedMoney(
                  totalMOSub / fx,
                  currency === "COP" ? 0 : 2
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={handleDownloadSub}
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold shadow-md"
            >
              <Download className="w-4 h-4" />
              <span>
                {loading
                  ? isEn
                    ? "Generating PDF..."
                    : "Generando PDF..."
                  : isEn
                  ? `Download Subcontract PDF (${currency})`
                  : `Descargar Subcontrato Oficial PDF (${currency})`}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
