"use client";

import React, { useMemo, useState } from "react";
import { downloadPythonBinary, normalizarTexto } from "../lib/calcClient";
import { DEFAULT_HONORARIOS, formatCOP, formatNum } from "../lib/projects";
import {
  BudgetItem,
  ConsolidationResult,
  HonorariosConfig,
  LiquidationParams,
  ProjectConfig,
} from "../lib/types";

interface TabPresupuestoAPUProps {
  proyecto: ProjectConfig;
  data: ConsolidationResult;
  params: LiquidationParams;
  onUpdateProyecto: (updated: ProjectConfig) => void;
}

export default function TabPresupuestoAPU({
  proyecto,
  data,
  params,
  onUpdateProyecto,
}: TabPresupuestoAPUProps) {
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
    contratista: proyecto.contratista,
    cedula_contratista:
      proyecto.cedula_contratista || "C.C. 1001867834 • M.P. 021037-0828864 ATL",
    cargo_contratista: proyecto.cargo_contratista || "Ingeniero Residente de Obra",
  });

  const [filterCap, setFilterCap] = useState<string>("TODOS");
  const [filterEstado, setFilterEstado] = useState<string>("TODOS");
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [pdfStatus, setPdfStatus] = useState<string | null>(null);

  // Sync local draft when switching project
  React.useEffect(() => {
    setHon(proyecto.honorarios_consultoria || DEFAULT_HONORARIOS);
    setDraftItems(proyecto.ppto_base);
    setDraftSigners({
      contratante: proyecto.contratante,
      cedula_cliente: proyecto.cedula_cliente || "",
      ubicacion: proyecto.ubicacion,
      contratista: proyecto.contratista,
      cedula_contratista:
        proyecto.cedula_contratista || "C.C. 1001867834 • M.P. 021037-0828864 ATL",
      cargo_contratista: proyecto.cargo_contratista || "Ingeniero Residente de Obra",
    });
    setFilterCap("TODOS");
    setFilterEstado("TODOS");
    setShowEditItems(false);
  }, [proyecto.id, proyecto.ppto_base]);

  const totalDirecto = data.totals.total_ppto_contratado;
  const valHon =
    hon.modo_calculo === "porcentaje"
      ? totalDirecto * (hon.porcentaje / 100)
      : hon.valor_fijo;
  const ivaHon = hon.incluir_iva_hon ? valHon * 0.19 : 0;
  const totalHon = valHon + ivaHon;

  const capitulos = useMemo(
    () => ["TODOS", ...Array.from(new Set(data.df_5d.map((r) => r.Capitulo)))],
    [data.df_5d]
  );
  const estados = useMemo(
    () => ["TODOS", ...Array.from(new Set(data.df_5d.map((r) => r.Estado)))],
    [data.df_5d]
  );

  const filteredRows = useMemo(
    () =>
      data.df_5d.filter(
        (r) =>
          (filterCap === "TODOS" || r.Capitulo === filterCap) &&
          (filterEstado === "TODOS" || r.Estado === filterEstado)
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
    });
    setShowEditSigners(false);
  };

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    setPdfStatus(null);
    try {
      await downloadPythonBinary(
        {
          action: "presupuesto_pdf",
          df_5d: data.df_5d,
          params_liquidacion: params,
          proyecto_actual: proyecto,
          cfg_honorarios: hon,
        },
        `Presupuesto_${proyecto.id}.pdf`
      );
      setPdfStatus("PDF generado y descargado correctamente vía ReportLab.");
    } catch (err) {
      setPdfStatus(`Error generando PDF: ${String(err)}`);
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Toolbar Header */}
      <div className="bento-card flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-extrabold text-slate-900">
            💰 Control Económico 5D, APU y Emisión de Presupuesto PDF
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Edita cantidades y precios unitarios en vivo, configura honorarios de consultoría y genera el documento contractual en PDF.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowEditItems((v) => !v)}
            className="px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-300 bg-white hover:bg-slate-50 text-slate-800"
          >
            ✏️ {showEditItems ? "Cerrar Editor APU" : "Editar Capítulos / APU"}
          </button>
          <button
            type="button"
            onClick={() => setShowEditSigners((v) => !v)}
            className="px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-300 bg-white hover:bg-slate-50 text-slate-800"
          >
            🪪 Firmantes & Cédulas
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            className="px-4 py-2 rounded-xl text-xs font-extrabold bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white shadow-sm"
          >
            {downloadingPdf ? "⏳ Generando PDF..." : "📥 Descargar Presupuesto PDF"}
          </button>
        </div>
      </div>

      {pdfStatus && (
        <div
          className={`rounded-xl px-4 py-2.5 text-xs font-bold border ${
            pdfStatus.startsWith("Error")
              ? "bg-red-50 border-red-200 text-red-700"
              : "bg-emerald-50 border-emerald-200 text-emerald-800"
          }`}
        >
          {pdfStatus}
        </div>
      )}

      {/* Inline Editor: Firmantes */}
      {showEditSigners && (
        <div className="bento-card border-2 border-blue-200 bg-blue-50/30 space-y-3 text-xs">
          <div className="font-extrabold text-slate-900">
            🪪 Identificación Contractual y Firmantes del Documento
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Cliente / Contratante
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
                C.C. / NIT Cliente
              </label>
              <input
                value={draftSigners.cedula_cliente}
                onChange={(e) =>
                  setDraftSigners({ ...draftSigners, cedula_cliente: e.target.value })
                }
                placeholder="Ej: C.C. 1.002.345.678"
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 bg-white"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Ubicación Exacta
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
                Ingeniero / Contratista
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
                Cédula y Matrícula Profesional
              </label>
              <input
                value={draftSigners.cedula_contratista}
                onChange={(e) =>
                  setDraftSigners({ ...draftSigners, cedula_contratista: e.target.value })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 bg-white"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Cargo / Título
              </label>
              <input
                value={draftSigners.cargo_contratista}
                onChange={(e) =>
                  setDraftSigners({ ...draftSigners, cargo_contratista: e.target.value })
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
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSaveSigners}
              className="px-4 py-1.5 rounded-lg bg-blue-600 text-white font-bold"
            >
              💾 Guardar Identificación
            </button>
          </div>
        </div>
      )}

      {/* Inline Editor: Items APU */}
      {showEditItems && (
        <div className="bento-card border-2 border-emerald-200 bg-emerald-50/20 space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-slate-900">
              ✏️ Editor Directo de Actividades, Cantidades y Precios Unitarios
            </span>
            <button
              type="button"
              onClick={() =>
                setDraftItems((prev) => [
                  ...prev,
                  {
                    Item: `${prev.length + 1}.1`,
                    Capitulo: prev[prev.length - 1]?.Capitulo || "1. GENERAL",
                    Actividad: "Nueva actividad",
                    Unidad: "m²",
                    Cantidad_Contratada: 1,
                    Precio_Unitario: 0,
                  },
                ])
              }
              className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold"
            >
              ➕ Agregar Ítem
            </button>
          </div>

          <div className="overflow-x-auto max-h-72 border border-slate-200 rounded-xl bg-white">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-100 sticky top-0 font-bold text-slate-700">
                <tr>
                  <th className="p-2 w-16">Ítem</th>
                  <th className="p-2 w-40">Capítulo</th>
                  <th className="p-2">Actividad Constructiva</th>
                  <th className="p-2 w-16">Und</th>
                  <th className="p-2 w-24 text-right">Cant.</th>
                  <th className="p-2 w-28 text-right">P. Unit ($)</th>
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
                        className="text-red-500 font-bold"
                      >
                        ✕
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
              Descartar
            </button>
            <button
              type="button"
              onClick={handleSaveItems}
              className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white font-bold"
            >
              ✅ Aplicar Cambios al Proyecto
            </button>
          </div>
        </div>
      )}

      {/* Honorarios por Consultoría Técnica */}
      <div className="bento-card border border-blue-200 bg-gradient-to-r from-white to-blue-50/40 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">
              💼 Honorarios por Consultoría Técnica (Presupuesto y APU)
            </h3>
            <p className="text-xs text-slate-500">
              Cobra el estudio de costos si el cliente ejecuta con un tercero, o bonifícalo al 100% si te adjudica la obra.
            </p>
          </div>
          <label className="inline-flex items-center gap-2 cursor-pointer bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold">
            <input
              type="checkbox"
              checked={hon.incluir}
              onChange={(e) => handleSaveHon({ ...hon, incluir: e.target.checked })}
              className="accent-blue-600 w-4 h-4"
            />
            <span>Incluir Bloque de Honorarios en el PDF</span>
          </label>
        </div>

        {hon.incluir && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-200 text-xs">
            <div className="space-y-2">
              <label className="block font-bold text-slate-700">
                Escenario Comercial en PDF
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
                  1. Propuesta Mixta (Ejecución con AIU + Honorarios si no adjudica)
                </option>
                <option value="solo_consultoria">
                  2. Solo Consultoría APU (Presupuesto de referencia + Honorarios)
                </option>
              </select>

              <label className="block font-bold text-slate-700 pt-1">
                Modalidad de Tarifa
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
                <option value="fijo">Tarifa Fija en COP</option>
                <option value="porcentaje">Porcentaje (%) sobre Costo Directo</option>
              </select>
            </div>

            <div className="space-y-2">
              {hon.modo_calculo === "fijo" ? (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Valor Fijo Honorarios ($ COP)
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
                    Porcentaje sobre Costo Directo (%)
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
                    className="accent-blue-600"
                  />
                  Bonificable 100% si adjudica la obra
                </label>
                <label className="flex items-center gap-2 font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={hon.incluir_iva_hon}
                    onChange={(e) =>
                      handleSaveHon({ ...hon, incluir_iva_hon: e.target.checked })
                    }
                    className="accent-blue-600"
                  />
                  Sumar IVA (19%) sobre honorarios
                </label>
                <label className="flex items-center gap-2 font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={hon.incluir_visita}
                    onChange={(e) =>
                      handleSaveHon({ ...hon, incluir_visita: e.target.checked })
                    }
                    className="accent-blue-600"
                  />
                  Incluir tarifa opcional de visita técnica
                </label>
                {hon.incluir_visita && (
                  <input
                    type="number"
                    step="10000"
                    value={hon.valor_visita}
                    onChange={(e) =>
                      handleSaveHon({ ...hon, valor_visita: Number(e.target.value) })
                    }
                    placeholder="Tarifa por visita ($ COP)"
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 font-mono bg-white"
                  />
                )}
              </div>
            </div>

            <div className="bg-white border border-blue-200 rounded-xl p-4 flex flex-col justify-center space-y-2">
              <div className="text-[11px] font-bold uppercase text-slate-500">
                Vista Previa Liquidación Consultoría
              </div>
              <div className="flex justify-between">
                <span>Costo Directo Referencia:</span>
                <span className="font-mono font-bold">{formatCOP(totalDirecto)}</span>
              </div>
              <div className="flex justify-between">
                <span>Honorarios Consultoría:</span>
                <span className="font-mono font-bold text-blue-700">{formatCOP(valHon)}</span>
              </div>
              {hon.incluir_iva_hon && (
                <div className="flex justify-between">
                  <span>IVA 19% Consultoría:</span>
                  <span className="font-mono">{formatCOP(ivaHon)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-slate-200 text-sm font-extrabold text-blue-900">
                <span>Total a Cobrar:</span>
                <span className="font-mono">{formatCOP(totalHon)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filters & 5D Matrix Table */}
      <div className="bento-card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="font-extrabold text-sm text-slate-900">
            📊 Matriz Oficial de Presupuesto 5D ({filteredRows.length} actividades)
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <select
              value={filterCap}
              onChange={(e) => setFilterCap(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 bg-slate-50 font-semibold"
            >
              {capitulos.map((c) => (
                <option key={c} value={c}>
                  Cap: {c}
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
                  Estado: {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-900 text-white font-bold">
              <tr>
                <th className="py-2.5 px-2.5">Ítem</th>
                <th className="py-2.5 px-2.5">Capítulo</th>
                <th className="py-2.5 px-2.5 min-w-[220px]">Actividad Constructiva</th>
                <th className="py-2.5 px-2 text-center">Und</th>
                <th className="py-2.5 px-2 text-right">Cant. Contr.</th>
                <th className="py-2.5 px-2 text-right">Cant. Ejec.</th>
                <th className="py-2.5 px-2 text-right">P. Unitario</th>
                <th className="py-2.5 px-2 text-right">Total Ppto</th>
                <th className="py-2.5 px-2 text-right">Ejecutado</th>
                <th className="py-2.5 px-2 text-right">% Av.</th>
                <th className="py-2.5 px-2.5">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.map((r) => (
                <tr key={`${r.Item}-${r.Actividad}`} className="hover:bg-slate-50">
                  <td className="py-2 px-2.5 font-mono font-bold text-slate-700">
                    {r.Item}
                  </td>
                  <td className="py-2 px-2.5 text-[11px] font-semibold text-slate-500">
                    {r.Capitulo}
                  </td>
                  <td className="py-2 px-2.5 font-semibold text-slate-900">
                    {r.Actividad}
                  </td>
                  <td className="py-2 px-2 text-center font-mono">{r.Unidad}</td>
                  <td className="py-2 px-2 text-right font-mono">
                    {formatNum(r.Cantidad_Contratada)}
                  </td>
                  <td className="py-2 px-2 text-right font-mono text-blue-700 font-bold">
                    {formatNum(r.Cantidad_Ejecutada)}
                  </td>
                  <td className="py-2 px-2 text-right font-mono">
                    {formatCOP(r.Precio_Unitario)}
                  </td>
                  <td className="py-2 px-2 text-right font-mono font-semibold">
                    {formatCOP(r.Presupuesto_Total)}
                  </td>
                  <td className="py-2 px-2 text-right font-mono font-bold text-emerald-700">
                    {formatCOP(r.Costo_Ejecutado)}
                  </td>
                  <td className="py-2 px-2 text-right font-mono font-bold">
                    {r["Avance_%"].toFixed(1)}%
                  </td>
                  <td className="py-2 px-2.5 whitespace-nowrap font-semibold">
                    {r.Estado}
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
