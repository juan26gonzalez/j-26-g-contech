"use client";

import React, { useMemo, useState } from "react";
import {
  Briefcase,
  CheckCircle2,
  DollarSign,
  Download,
  IdCard,
  Lock,
  Pencil,
  Plus,
  Save,
  Table2,
  X,
  XCircle,
} from "lucide-react";
import { downloadPythonBinary, normalizarTexto } from "../lib/calcClient";
import { useAppPreferences } from "../lib/i18n";
import { DEFAULT_HONORARIOS } from "../lib/projects";
import {
  BudgetItem,
  ConsolidationResult,
  HonorariosConfig,
  LiquidationParams,
  ProjectConfig,
} from "../lib/types";
import {
  buildExportConsolidatedRows,
  localizeActivity,
  localizeChapter,
  localizeStatus,
  sanitizeDemoProject,
} from "../lib/units";

interface TabPresupuestoAPUProps {
  proyecto: ProjectConfig;
  data: ConsolidationResult;
  params: LiquidationParams;
  onUpdateProyecto: (updated: ProjectConfig) => void;
  isDemo?: boolean;
}

function StatusDot({ estado, lang }: { estado: string; lang: "es" | "en" }) {
  const clean = estado.replace(/^[^A-Za-z0-9]+/, "").trim();
  const isDone = /completado|completed/i.test(clean);
  const isOver = /mayor|overrun/i.test(clean);
  const isNone = /sin iniciar|not started/i.test(clean);
  const dotCls = isDone
    ? "bg-emerald-500"
    : isOver
    ? "bg-rose-500"
    : isNone
    ? "bg-slate-400"
    : "bg-sky-500";
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-semibold">
      <span className={`w-2 h-2 rounded-full ${dotCls}`} />
      <span>{localizeStatus(clean, lang)}</span>
    </span>
  );
}

export default function TabPresupuestoAPU({
  proyecto,
  data,
  params,
  onUpdateProyecto,
  isDemo = false,
}: TabPresupuestoAPUProps) {
  const {
    lang,
    currency,
    rates,
    docOpts,
    formatMoney,
    formatUnitMoney,
    formatQty,
    unitLabel,
  } = useAppPreferences();
  const isEn = lang === "en";
  const effectiveDemo = isDemo || proyecto.id === "demo_showcase";

  const [hon, setHon] = useState<HonorariosConfig>(
    proyecto.honorarios_consultoria || DEFAULT_HONORARIOS
  );
  const [showEditItems, setShowEditItems] = useState(false);
  const [showEditSigners, setShowEditSigners] = useState(false);
  const [draftItems, setDraftItems] = useState<BudgetItem[]>(proyecto.ppto_base);
  const [draftSigners, setDraftSigners] = useState({
    contratante: proyecto.contratante,
    cedula_cliente: proyecto.cedula_cliente || "",
    ubicacion: proyecto.ubicacion,
    contratista: effectiveDemo ? "JGM ConTech Engineering Team" : proyecto.contratista,
    cedula_contratista: effectiveDemo ? "" : proyecto.cedula_contratista || "",
    cargo_contratista:
      proyecto.cargo_contratista ||
      (isEn ? "Lead Project Engineer" : "Ingeniero Residente de Obra"),
  });

  const [filterCap, setFilterCap] = useState<string>("ALL");
  const [filterEstado, setFilterEstado] = useState<string>("ALL");
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [pdfStatus, setPdfStatus] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  React.useEffect(() => {
    setHon(proyecto.honorarios_consultoria || DEFAULT_HONORARIOS);
    setDraftItems(proyecto.ppto_base);
    setDraftSigners({
      contratante: proyecto.contratante,
      cedula_cliente: proyecto.cedula_cliente || "",
      ubicacion: proyecto.ubicacion,
      contratista: effectiveDemo ? "JGM ConTech Engineering Team" : proyecto.contratista,
      cedula_contratista: effectiveDemo ? "" : proyecto.cedula_contratista || "",
      cargo_contratista:
        proyecto.cargo_contratista ||
        (isEn ? "Lead Project Engineer" : "Ingeniero Residente de Obra"),
    });
    setFilterCap("ALL");
    setFilterEstado("ALL");
    setShowEditItems(false);
  }, [proyecto.id, proyecto.ppto_base, effectiveDemo]);

  const totalDirecto = data.totals.total_ppto_contratado;
  const valHon =
    hon.modo_calculo === "porcentaje"
      ? totalDirecto * (hon.porcentaje / 100)
      : hon.valor_fijo;
  const ivaHon = hon.incluir_iva_hon ? valHon * 0.19 : 0;
  const totalHon = valHon + ivaHon;

  const capitulos = useMemo(
    () => ["ALL", ...Array.from(new Set(data.df_5d.map((r) => r.Capitulo)))],
    [data.df_5d]
  );
  const estados = useMemo(
    () => ["ALL", ...Array.from(new Set(data.df_5d.map((r) => r.Estado)))],
    [data.df_5d]
  );

  const filteredRows = useMemo(
    () =>
      data.df_5d.filter(
        (r) =>
          (filterCap === "ALL" || r.Capitulo === filterCap) &&
          (filterEstado === "ALL" || r.Estado === filterEstado)
      ),
    [data.df_5d, filterCap, filterEstado]
  );

  const handleSaveHon = (nextHon: HonorariosConfig) => {
    setHon(nextHon);
    onUpdateProyecto({ ...proyecto, honorarios_consultoria: nextHon });
  };

  const handleSaveItems = () => {
    const cleaned = draftItems
      .filter((r) => r.Actividad.trim().length > 0)
      .map((r) => ({
        ...r,
        Cantidad_Contratada: Number(r.Cantidad_Contratada) || 0,
        Precio_Unitario: Number(r.Precio_Unitario) || 0,
        match_keys:
          r.match_keys && r.match_keys.length > 0
            ? r.match_keys
            : normalizarTexto(r.Actividad)
                .split(/\s+/)
                .filter((w) => w.length > 3),
      }));
    onUpdateProyecto({ ...proyecto, ppto_base: cleaned });
    setShowEditItems(false);
  };

  const handleSaveSigners = () => {
    onUpdateProyecto({
      ...proyecto,
      ...draftSigners,
      cedula_contratista: effectiveDemo ? "" : draftSigners.cedula_contratista,
    });
    setShowEditSigners(false);
  };

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    setPdfStatus(null);
    try {
      const exportRows = buildExportConsolidatedRows(
        data.df_5d,
        lang,
        currency,
        rates
      );
      const cleanProj = sanitizeDemoProject(proyecto, effectiveDemo, lang);
      const filename = isEn
        ? `Construction_Budget_${proyecto.id}_${currency}.pdf`
        : `Presupuesto_${proyecto.id}_${currency}.pdf`;

      await downloadPythonBinary(
        {
          action: "presupuesto_pdf",
          df_5d: exportRows,
          params_liquidacion: params,
          proyecto_actual: cleanProj,
          cfg_honorarios: hon,
          doc_opts: {
            ...docOpts,
            is_demo: effectiveDemo,
          },
        },
        filename
      );
      setPdfStatus({
        type: "ok",
        text: isEn
          ? `PDF schedule exported cleanly (${currency} • Imperial units).`
          : `PDF generado y descargado correctamente (${currency} • Métrico).`,
      });
    } catch (err) {
      setPdfStatus({
        type: "err",
        text: isEn
          ? `Error generating PDF: ${String(err)}`
          : `Error generando PDF: ${String(err)}`,
      });
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Toolbar Header */}
      <div className="bento-card flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="p-2.5 rounded-xl bg-slate-900 text-white shrink-0">
            <DollarSign className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-base font-extrabold text-slate-900">
              {isEn
                ? "5D Economic Control, Unit Rates (APU) & PDF Estimate Export"
                : "Control Económico 5D, APU y Emisión de Presupuesto PDF"}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isEn
                ? `Edit quantities and unit rates live, configure consulting fees, and export official contractual BOQ PDFs (${currency} • Imperial).`
                : `Edita cantidades y precios unitarios en vivo, configura honorarios de consultoría y genera el documento contractual en PDF (${currency}).`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowEditItems((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-300 bg-white hover:bg-slate-50 text-slate-800"
          >
            <Pencil className="w-3.5 h-3.5" />
            <span>
              {showEditItems
                ? isEn
                  ? "Close APU Editor"
                  : "Cerrar Editor APU"
                : isEn
                ? "Edit WBS / Unit Rates"
                : "Editar Capítulos / APU"}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setShowEditSigners((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-300 bg-white hover:bg-slate-50 text-slate-800"
          >
            <IdCard className="w-3.5 h-3.5" />
            <span>{isEn ? "Signers & Project Info" : "Firmantes & Cédulas"}</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold steel-btn-primary disabled:opacity-60"
          >
            <Download className="w-3.5 h-3.5" />
            <span>
              {downloadingPdf
                ? isEn
                  ? "Generating PDF..."
                  : "Generando PDF..."
                : isEn
                ? `Download Budget PDF (${currency})`
                : `Descargar Presupuesto PDF (${currency})`}
            </span>
          </button>
        </div>
      </div>

      {pdfStatus && (
        <div
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold border ${
            pdfStatus.type === "err"
              ? "bg-red-50 border-red-200 text-red-700"
              : "bg-emerald-50 border-emerald-200 text-emerald-800"
          }`}
        >
          {pdfStatus.type === "err" ? (
            <XCircle className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          )}
          <span>{pdfStatus.text}</span>
        </div>
      )}

      {/* Inline Editor: Firmantes */}
      {showEditSigners && (
        <div className="bento-card border-2 border-slate-400/70 space-y-3 text-xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-extrabold text-slate-900">
              <IdCard className="w-4 h-4 text-sky-700" />
              <span>
                {isEn
                  ? "Contractual Signatories & Document Header"
                  : "Identificación Contractual y Firmantes del Documento"}
              </span>
            </div>
            {effectiveDemo && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                <Lock className="w-3 h-3" />
                {isEn
                  ? "Private ID & signature disabled in Demo"
                  : "Firma e ID privados protegidos en Demo"}
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {isEn ? "Client / Owner" : "Cliente / Contratante"}
              </label>
              <input
                value={draftSigners.contratante}
                onChange={(e) =>
                  setDraftSigners({ ...draftSigners, contratante: e.target.value })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 bg-white"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {isEn ? "Client Tax ID / Reg." : "C.C. / NIT Cliente"}
              </label>
              <input
                value={draftSigners.cedula_cliente}
                onChange={(e) =>
                  setDraftSigners({ ...draftSigners, cedula_cliente: e.target.value })
                }
                placeholder={isEn ? "e.g., EIN / Tax ID" : "Ej: NIT / Identificación"}
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 bg-white"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {isEn ? "Project Location" : "Ubicación Exacta"}
              </label>
              <input
                value={draftSigners.ubicacion}
                onChange={(e) =>
                  setDraftSigners({ ...draftSigners, ubicacion: e.target.value })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 bg-white"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {isEn ? "Engineer / Contractor" : "Ingeniero / Contratista"}
              </label>
              <input
                value={draftSigners.contratista}
                onChange={(e) =>
                  setDraftSigners({ ...draftSigners, contratista: e.target.value })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 bg-white"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {isEn ? "Professional License / ID" : "Cédula y Matrícula Profesional"}
              </label>
              <input
                value={effectiveDemo ? "" : draftSigners.cedula_contratista}
                disabled={effectiveDemo}
                placeholder={
                  effectiveDemo
                    ? isEn
                      ? "Hidden in public Demo"
                      : "Protegido en modo Demo"
                    : ""
                }
                onChange={(e) =>
                  setDraftSigners({
                    ...draftSigners,
                    cedula_contratista: e.target.value,
                  })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 bg-white disabled:bg-slate-100 disabled:text-slate-400"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {isEn ? "Title / Role" : "Cargo / Título"}
              </label>
              <input
                value={draftSigners.cargo_contratista}
                onChange={(e) =>
                  setDraftSigners({
                    ...draftSigners,
                    cargo_contratista: e.target.value,
                  })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 bg-white"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowEditSigners(false)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-bold"
            >
              {isEn ? "Cancel" : "Cancelar"}
            </button>
            <button
              type="button"
              onClick={handleSaveSigners}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg steel-btn-primary font-bold"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isEn ? "Save Signatories" : "Guardar Identificación"}</span>
            </button>
          </div>
        </div>
      )}

      {/* Inline Editor: Items APU */}
      {showEditItems && (
        <div className="bento-card border-2 border-emerald-200 bg-emerald-50/20 space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 font-extrabold text-slate-900">
              <Pencil className="w-4 h-4 text-emerald-700" />
              <span>
                {isEn
                  ? "Direct BOQ Editor — Metric Base Storage (Auto-converts to Imperial & Live FX)"
                  : "Editor Directo de Actividades, Cantidades y Precios Unitarios (Base COP / SI)"}
              </span>
            </span>
            <button
              type="button"
              onClick={() =>
                setDraftItems((prev) => [
                  ...prev,
                  {
                    Item: `${prev.length + 1}.1`,
                    Capitulo: prev[prev.length - 1]?.Capitulo || "1. GENERAL",
                    Actividad: isEn ? "New work item" : "Nueva actividad",
                    Unidad: "m²",
                    Cantidad_Contratada: 1,
                    Precio_Unitario: 0,
                  },
                ])
              }
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isEn ? "Add Line Item" : "Agregar Ítem"}</span>
            </button>
          </div>

          <div className="overflow-x-auto max-h-72 border border-slate-200 rounded-xl bg-white">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-100 sticky top-0 font-bold text-slate-700">
                <tr>
                  <th className="p-2 w-16">{isEn ? "Item" : "Ítem"}</th>
                  <th className="p-2 w-40">{isEn ? "Chapter" : "Capítulo"}</th>
                  <th className="p-2">{isEn ? "Activity" : "Actividad Constructiva"}</th>
                  <th className="p-2 w-16">{isEn ? "Unit" : "Und"}</th>
                  <th className="p-2 w-24 text-right">{isEn ? "Qty (SI)" : "Cant."}</th>
                  <th className="p-2 w-28 text-right">{isEn ? "Rate (COP)" : "P. Unit ($)"}</th>
                  <th className="p-2 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {draftItems.map((row, idx) => (
                  <tr key={idx}>
                    <td className="p-1.5">
                      <input
                        value={row.Item}
                        onChange={(e) =>
                          setDraftItems((p) =>
                            p.map((x, i) => (i === idx ? { ...x, Item: e.target.value } : x))
                          )
                        }
                        className="w-full border border-slate-200 rounded px-1.5 py-1"
                      />
                    </td>
                    <td className="p-1.5">
                      <input
                        value={row.Capitulo}
                        onChange={(e) =>
                          setDraftItems((p) =>
                            p.map((x, i) => (i === idx ? { ...x, Capitulo: e.target.value } : x))
                          )
                        }
                        className="w-full border border-slate-200 rounded px-1.5 py-1"
                      />
                    </td>
                    <td className="p-1.5">
                      <input
                        value={row.Actividad}
                        onChange={(e) =>
                          setDraftItems((p) =>
                            p.map((x, i) => (i === idx ? { ...x, Actividad: e.target.value } : x))
                          )
                        }
                        className="w-full border border-slate-200 rounded px-1.5 py-1"
                      />
                    </td>
                    <td className="p-1.5">
                      <input
                        value={row.Unidad}
                        onChange={(e) =>
                          setDraftItems((p) =>
                            p.map((x, i) => (i === idx ? { ...x, Unidad: e.target.value } : x))
                          )
                        }
                        className="w-full border border-slate-200 rounded px-1.5 py-1 text-center"
                      />
                    </td>
                    <td className="p-1.5">
                      <input
                        type="number"
                        step="0.01"
                        value={row.Cantidad_Contratada}
                        onChange={(e) =>
                          setDraftItems((p) =>
                            p.map((x, i) =>
                              i === idx ? { ...x, Cantidad_Contratada: Number(e.target.value) } : x
                            )
                          )
                        }
                        className="w-full border border-slate-200 rounded px-1.5 py-1 text-right font-mono"
                      />
                    </td>
                    <td className="p-1.5">
                      <input
                        type="number"
                        step="100"
                        value={row.Precio_Unitario}
                        onChange={(e) =>
                          setDraftItems((p) =>
                            p.map((x, i) =>
                              i === idx ? { ...x, Precio_Unitario: Number(e.target.value) } : x
                            )
                          )
                        }
                        className="w-full border border-slate-200 rounded px-1.5 py-1 text-right font-mono"
                      />
                    </td>
                    <td className="p-1.5 text-center">
                      <button
                        type="button"
                        onClick={() =>
                          setDraftItems((p) => p.filter((_, i) => i !== idx))
                        }
                        className="text-red-500 hover:text-red-700 font-bold p-1"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowEditItems(false)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-bold"
            >
              {isEn ? "Discard" : "Descartar"}
            </button>
            <button
              type="button"
              onClick={handleSaveItems}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 text-white font-bold"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isEn ? "Apply Changes" : "Aplicar Cambios al Proyecto"}</span>
            </button>
          </div>
        </div>
      )}

      {/* Honorarios por Consultoría Técnica */}
      <div className="bento-card border-l-4 border-l-slate-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <Briefcase className="w-4 h-4 text-slate-800 mt-0.5 shrink-0" />
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                {isEn
                  ? "Technical Consulting Honorarium (BOQ & APU)"
                  : "Honorarios por Consultoría Técnica (Presupuesto y APU)"}
              </h3>
              <p className="text-xs text-slate-500">
                {isEn
                  ? "Bill the cost-engineering study if third-party executes work, or rebate 100% upon construction contract award."
                  : "Cobra el estudio de costos si el cliente ejecuta con un tercero, o bonifícalo al 100% si te adjudica la obra."}
              </p>
            </div>
          </div>
          <label className="inline-flex items-center gap-2 cursor-pointer bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold">
            <input
              type="checkbox"
              checked={hon.incluir}
              onChange={(e) => handleSaveHon({ ...hon, incluir: e.target.checked })}
              className="accent-slate-800 w-4 h-4"
            />
            <span>
              {isEn
                ? "Include Consulting Fee Block in PDF"
                : "Incluir Bloque de Honorarios en el PDF"}
            </span>
          </label>
        </div>

        {hon.incluir && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-200 text-xs">
            <div className="space-y-2">
              <label className="block font-bold text-slate-700">
                {isEn ? "Commercial Scenario in PDF" : "Escenario Comercial en PDF"}
              </label>
              <select
                value={hon.escenario}
                onChange={(e) =>
                  handleSaveHon({
                    ...hon,
                    escenario: e.target.value as "anexo_aiu" | "solo_consultoria",
                  })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white font-semibold"
              >
                <option value="anexo_aiu">
                  {isEn
                    ? "1. Hybrid Proposal (AIU Execution + Consulting Fee Fallback)"
                    : "1. Propuesta Mixta (Ejecución con AIU + Honorarios si no adjudica)"}
                </option>
                <option value="solo_consultoria">
                  {isEn
                    ? "2. Consulting Only (Market Reference Estimate + Fee)"
                    : "2. Solo Consultoría APU (Presupuesto de referencia + Honorarios)"}
                </option>
              </select>

              <label className="block font-bold text-slate-700 pt-1">
                {isEn ? "Fee Calculation Mode" : "Modalidad de Tarifa"}
              </label>
              <select
                value={hon.modo_calculo}
                onChange={(e) =>
                  handleSaveHon({
                    ...hon,
                    modo_calculo: e.target.value as "fijo" | "porcentaje",
                  })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white font-semibold"
              >
                <option value="fijo">
                  {isEn ? "Fixed Base Fee (COP equiv.)" : "Tarifa Fija en COP"}
                </option>
                <option value="porcentaje">
                  {isEn
                    ? "Percentage (%) of Direct Cost"
                    : "Porcentaje (%) sobre Costo Directo"}
                </option>
              </select>
            </div>

            <div className="space-y-2">
              {hon.modo_calculo === "fijo" ? (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {isEn
                      ? "Fixed Consulting Fee (Base COP)"
                      : "Valor Fijo Honorarios ($ COP)"}
                  </label>
                  <input
                    type="number"
                    step="50000"
                    value={hon.valor_fijo}
                    onChange={(e) =>
                      handleSaveHon({ ...hon, valor_fijo: Number(e.target.value) })
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono font-bold bg-white"
                  />
                </div>
              ) : (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {isEn
                      ? "Percentage of Direct Cost (%)"
                      : "Porcentaje sobre Costo Directo (%)"}
                  </label>
                  <input
                    type="number"
                    step="0.25"
                    value={hon.porcentaje}
                    onChange={(e) =>
                      handleSaveHon({ ...hon, porcentaje: Number(e.target.value) })
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono font-bold bg-white"
                  />
                </div>
              )}

              <div className="pt-1 space-y-1.5">
                <label className="flex items-center gap-2 font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={hon.bonificable}
                    onChange={(e) =>
                      handleSaveHon({ ...hon, bonificable: e.target.checked })
                    }
                    className="accent-slate-800"
                  />
                  {isEn
                    ? "100% Rebate if construction awarded"
                    : "Bonificable 100% si adjudica la obra"}
                </label>
                <label className="flex items-center gap-2 font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={hon.incluir_iva_hon}
                    onChange={(e) =>
                      handleSaveHon({ ...hon, incluir_iva_hon: e.target.checked })
                    }
                    className="accent-slate-800"
                  />
                  {isEn
                    ? "Add 19% VAT on consulting fee"
                    : "Sumar IVA (19%) sobre honorarios"}
                </label>
                <label className="flex items-center gap-2 font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={hon.incluir_visita}
                    onChange={(e) =>
                      handleSaveHon({ ...hon, incluir_visita: e.target.checked })
                    }
                    className="accent-slate-800"
                  />
                  {isEn
                    ? "Include optional site inspection visit rate"
                    : "Incluir tarifa opcional de visita técnica"}
                </label>
                {hon.incluir_visita && (
                  <input
                    type="number"
                    step="10000"
                    value={hon.valor_visita}
                    onChange={(e) =>
                      handleSaveHon({ ...hon, valor_visita: Number(e.target.value) })
                    }
                    placeholder={isEn ? "Per-visit rate (COP)" : "Tarifa por visita ($ COP)"}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 font-mono bg-white"
                  />
                )}
              </div>
            </div>

            <div className="steel-subcard rounded-xl p-4 flex flex-col justify-center space-y-2">
              <div className="text-[11px] font-bold uppercase text-slate-500">
                {isEn ? "Consulting Settlement Preview" : "Vista Previa Liquidación Consultoría"}
              </div>
              <div className="flex justify-between">
                <span>{isEn ? "Reference Direct Cost:" : "Costo Directo Referencia:"}</span>
                <span className="font-mono font-bold">{formatMoney(totalDirecto)}</span>
              </div>
              <div className="flex justify-between">
                <span>{isEn ? "Consulting Fee:" : "Honorarios Consultoría:"}</span>
                <span className="font-mono font-bold text-slate-900">
                  {formatMoney(valHon)}
                </span>
              </div>
              {hon.incluir_iva_hon && (
                <div className="flex justify-between">
                  <span>{isEn ? "19% VAT on Fee:" : "IVA 19% Consultoría:"}</span>
                  <span className="font-mono">{formatMoney(ivaHon)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-slate-300 text-sm font-extrabold text-slate-900">
                <span>{isEn ? "Total Payable:" : "Total a Cobrar:"}</span>
                <span className="font-mono">{formatMoney(totalHon)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filters & 5D Matrix Table */}
      <div className="bento-card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-extrabold text-sm text-slate-900">
            <Table2 className="w-4 h-4 text-sky-700" />
            <span>
              {isEn
                ? `Official 5D Budget Matrix (${filteredRows.length} items • Imperial / ${currency})`
                : `Matriz Oficial de Presupuesto 5D (${filteredRows.length} actividades • Métrico / ${currency})`}
            </span>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <select
              value={filterCap}
              onChange={(e) => setFilterCap(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 bg-slate-50 font-semibold"
            >
              {capitulos.map((c) => (
                <option key={c} value={c}>
                  {isEn ? "WBS: " : "Cap: "}
                  {c === "ALL" ? (isEn ? "ALL" : "TODOS") : localizeChapter(c, lang)}
                </option>
              ))}
            </select>
            <select
              value={filterEstado}
              onChange={(e) => setFilterEstado(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 bg-slate-50 font-semibold"
            >
              {estados.map((s) => (
                <option key={s} value={s}>
                  {isEn ? "Status: " : "Estado: "}
                  {s === "ALL" ? (isEn ? "ALL" : "TODOS") : localizeStatus(s, lang)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-900 text-white font-bold">
              <tr>
                <th className="py-2.5 px-2.5">{isEn ? "Item" : "Ítem"}</th>
                <th className="py-2.5 px-2.5">{isEn ? "WBS Chapter" : "Capítulo"}</th>
                <th className="py-2.5 px-2.5 min-w-[220px]">
                  {isEn ? "Work Activity Description" : "Actividad Constructiva"}
                </th>
                <th className="py-2.5 px-2 text-center">{isEn ? "Unit" : "Und"}</th>
                <th className="py-2.5 px-2 text-right">{isEn ? "Contract Qty" : "Cant. Contr."}</th>
                <th className="py-2.5 px-2 text-right">{isEn ? "Exec. Qty" : "Cant. Ejec."}</th>
                <th className="py-2.5 px-2 text-right">{isEn ? "Unit Rate" : "P. Unitario"}</th>
                <th className="py-2.5 px-2 text-right">{isEn ? "Budget Total" : "Total Ppto"}</th>
                <th className="py-2.5 px-2 text-right">{isEn ? "Earned" : "Ejecutado"}</th>
                <th className="py-2.5 px-2 text-right">% Av.</th>
                <th className="py-2.5 px-2.5">{isEn ? "Status" : "Estado"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.map((r) => (
                <tr key={`${r.Item}-${r.Actividad}`} className="hover:bg-slate-50">
                  <td className="py-2 px-2.5 font-mono font-bold text-slate-700">
                    {r.Item}
                  </td>
                  <td className="py-2 px-2.5 text-[11px] font-semibold text-slate-500">
                    {localizeChapter(r.Capitulo, lang)}
                  </td>
                  <td className="py-2 px-2.5 font-semibold text-slate-900">
                    {localizeActivity(r.Actividad, lang)}
                  </td>
                  <td className="py-2 px-2 text-center font-mono">
                    {unitLabel(r.Unidad)}
                  </td>
                  <td className="py-2 px-2 text-right font-mono">
                    {formatQty(r.Cantidad_Contratada, r.Unidad)}
                  </td>
                  <td className="py-2 px-2 text-right font-mono text-slate-900 font-bold">
                    {formatQty(r.Cantidad_Ejecutada, r.Unidad)}
                  </td>
                  <td className="py-2 px-2 text-right font-mono whitespace-nowrap">
                    {formatUnitMoney(r.Precio_Unitario, r.Unidad)}
                  </td>
                  <td className="py-2 px-2 text-right font-mono font-semibold whitespace-nowrap">
                    {formatMoney(r.Presupuesto_Total)}
                  </td>
                  <td className="py-2 px-2 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                    {formatMoney(r.Costo_Ejecutado)}
                  </td>
                  <td className="py-2 px-2 text-right font-mono font-bold">
                    {r["Avance_%"].toFixed(1)}%
                  </td>
                  <td className="py-2 px-2.5">
                    <StatusDot estado={r.Estado} lang={lang} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
