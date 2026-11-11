import {
  BitacoraRow,
  ConsolidatedRow,
  ConsolidationResult,
  InsumoRow,
  ProjectConfig,
  RendimientoRow,
  ResumenCapitulo,
} from "./types";

export function normalizarTexto(texto: string): string {
  if (!texto) return "";
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function filtrarBitacoraPorProyecto(
  registros: BitacoraRow[],
  proyecto: ProjectConfig
): BitacoraRow[] {
  if (!registros || registros.length === 0) return [];
  const proyId = (proyecto.id || "").toLowerCase();
  const proyNombre = normalizarTexto(proyecto.nombre || "");
  const esSoloPpto =
    proyecto.tipo === "presupuesto" ||
    (proyecto.badge || "").toUpperCase().includes("PRESUPUESTO");

  const validos: BitacoraRow[] = [];
  for (const row of registros) {
    const actRaw = String(row.actividad || "");
    const actTxt = normalizarTexto(actRaw);

    if (actTxt.includes("bim_takeoff") || actTxt.includes("takeoff")) {
      if (proyId === "casa_mendoza" && !esSoloPpto) {
        validos.push(row);
      }
      continue;
    }

    const tagId = `[${proyId.replace(/\s+/g, "")}]`;
    const tagNom = proyNombre.length > 4 ? `[${proyNombre}]` : "___nom_invalido___";
    if (actTxt.replace(/\s+/g, "").includes(tagId) || actTxt.includes(tagNom)) {
      validos.push(row);
      continue;
    }

    if (proyId === "casa_mendoza") {
      if (actTxt.includes("mendoza") || actTxt.includes("sabanalarga")) {
        validos.push(row);
      }
    } else if (proyId === "mezzanine") {
      const rowId = Number(row.id || 0);
      if (
        rowId <= 50 &&
        !actTxt.includes("mendoza") &&
        !actTxt.includes("sabanalarga") &&
        !actRaw.trim().startsWith("[")
      ) {
        validos.push(row);
      } else if (
        actTxt.includes("mezzanine") ||
        actTxt.includes("dolmen") ||
        actTxt.includes("ingendes")
      ) {
        validos.push(row);
      }
    } else {
      if (
        (proyId && actTxt.includes(proyId)) ||
        (proyNombre.length > 4 && actTxt.includes(proyNombre))
      ) {
        validos.push(row);
      }
    }
  }
  return validos;
}

export function calcularConsolidacionLocal(
  proyecto: ProjectConfig,
  registros: BitacoraRow[]
): ConsolidationResult {
  const obraActiva = filtrarBitacoraPorProyecto(registros, proyecto);
  const listaPpto = (proyecto.ppto_base || []).map((i) => ({
    ...i,
    match_keys: i.match_keys ? [...i.match_keys] : [],
  }));

  const acumulados: Record<string, number> = {};
  const desperdicios: Record<string, number[]> = {};
  for (const item of listaPpto) {
    acumulados[item.Item] = 0;
    desperdicios[item.Item] = [];
  }

  if (proyecto.tipo !== "presupuesto" && proyecto.id === "casa_mendoza") {
    for (const row of obraActiva) {
      const actTxt = normalizarTexto(String(row.actividad || ""));
      if (actTxt.includes("bim_takeoff") || actTxt.includes("takeoff")) {
        const cantBim = Number(row.cantidad || 0);
        if (cantBim > 0) {
          for (const item of listaPpto) {
            const keys = item.match_keys || [];
            if (keys.some((k) => actTxt.includes(k))) {
              item.Cantidad_Contratada = cantBim;
              break;
            }
          }
        }
      }
    }
  }

  for (const row of obraActiva) {
    const actTxt = normalizarTexto(String(row.actividad || ""));
    if (actTxt.includes("bim_takeoff") || actTxt.includes("takeoff")) continue;
    const cant = Number(row.cantidad || 0) || 0;
    const desp = Number(row.desperdicio || 0) || 0;

    let matchedItem: string | null = null;
    for (const item of listaPpto) {
      const keys = item.match_keys || [];
      if (keys.some((k) => actTxt.includes(k))) {
        matchedItem = item.Item;
        break;
      }
    }
    if (matchedItem && matchedItem in acumulados) {
      acumulados[matchedItem] += cant;
      if (desp > 0) desperdicios[matchedItem].push(desp);
    }
  }

  const df5d: ConsolidatedRow[] = listaPpto.map((item) => {
    const contratado = Number(item.Cantidad_Contratada || 0);
    const ejecutado = Math.round((acumulados[item.Item] || 0) * 100) / 100;
    const pu = Number(item.Precio_Unitario || 0);
    const pptoTotal = Math.round(contratado * pu * 100) / 100;
    const costoEjecutado = Math.round(ejecutado * pu * 100) / 100;
    const saldoCant = Math.max(0, Math.round((contratado - ejecutado) * 100) / 100);
    const saldoDin = Math.max(0, Math.round((pptoTotal - costoEjecutado) * 100) / 100);
    const pctAvance =
      contratado > 0 ? Math.round((ejecutado / contratado) * 1000) / 10 : 0;
    const arrDesp = desperdicios[item.Item] || [];
    const despProm =
      arrDesp.length > 0
        ? Math.round((arrDesp.reduce((a, b) => a + b, 0) / arrDesp.length) * 10) / 10
        : 0;
    const mayorCant = Math.max(0, Math.round((ejecutado - contratado) * 100) / 100);
    const sobrecosto = Math.round(mayorCant * pu * 100) / 100;

    let estado = "🔵 En Curso";
    if (ejecutado === 0) estado = "⚪ Sin Iniciar";
    else if (pctAvance >= 99.0 && pctAvance <= 100.0) estado = "🟢 Completado";
    else if (pctAvance > 100.0) estado = "🔴 Mayor Cantidad";

    return {
      Item: item.Item,
      Capitulo: item.Capitulo || "1. GENERAL",
      Actividad: item.Actividad,
      Unidad: item.Unidad || "und",
      Cantidad_Contratada: contratado,
      Cantidad_Ejecutada: ejecutado,
      Saldo_Cantidad: saldoCant,
      Mayor_Cantidad: mayorCant,
      Sobrecosto_COP: sobrecosto,
      Precio_Unitario: pu,
      Presupuesto_Total: pptoTotal,
      Costo_Ejecutado: costoEjecutado,
      Saldo_Dinero: saldoDin,
      "Avance_%": pctAvance,
      "Desperdicio_%": despProm,
      Estado: estado,
    };
  });

  const totalPpto = df5d.reduce((acc, r) => acc + r.Presupuesto_Total, 0);
  const totalExec = df5d.reduce((acc, r) => acc + r.Costo_Ejecutado, 0);
  const totalSaldo = df5d.reduce((acc, r) => acc + r.Saldo_Dinero, 0);
  const totalSobrecosto = df5d.reduce((acc, r) => acc + r.Sobrecosto_COP, 0);
  const avanceFin =
    totalPpto > 0 ? Math.round((totalExec / totalPpto) * 10000) / 100 : 0;

  let avanceFis = 0;
  if (totalPpto > 0) {
    const pond = df5d.reduce((acc, r) => {
      const peso = r.Presupuesto_Total / totalPpto;
      return acc + Math.min(r["Avance_%"], 100) * peso;
    }, 0);
    avanceFis = Math.round(pond * 100) / 100;
  }

  const capMap = new Map<string, ResumenCapitulo>();
  for (const r of df5d) {
    const prev = capMap.get(r.Capitulo) || {
      Capitulo: r.Capitulo,
      Presupuesto_Total: 0,
      Costo_Ejecutado: 0,
      Saldo_Dinero: 0,
      "Avance_%": 0,
    };
    prev.Presupuesto_Total += r.Presupuesto_Total;
    prev.Costo_Ejecutado += r.Costo_Ejecutado;
    prev.Saldo_Dinero += r.Saldo_Dinero;
    capMap.set(r.Capitulo, prev);
  }
  const resumenCaps: ResumenCapitulo[] = Array.from(capMap.values()).map((c) => ({
    ...c,
    "Avance_%":
      c.Presupuesto_Total > 0
        ? Math.round((c.Costo_Ejecutado / c.Presupuesto_Total) * 1000) / 10
        : 0,
  }));

  // Rendimientos
  const metasApu: Record<string, { meta_dia: number; und: string; cuadrilla: string }> = {
    bloque: { meta_dia: 14.0, und: "m²/día", cuadrilla: "Cuadrilla Mampostería: 1 Of + 1 Ayud" },
    mamposteria: { meta_dia: 14.0, und: "m²/día", cuadrilla: "Cuadrilla Mampostería: 1 Of + 1 Ayud" },
    panete: { meta_dia: 18.0, und: "m²/día", cuadrilla: "Cuadrilla Pañete: 1 Of + 1 Ayud" },
    plantilla: { meta_dia: 20.0, und: "m²/día", cuadrilla: "Cuadrilla Pisos: 1 Of + 2 Ayud" },
    porcelanato: { meta_dia: 12.0, und: "m²/día", cuadrilla: "Cuadrilla Enchape: 1 Oficial Especialista" },
    estuco: { meta_dia: 30.0, und: "m²/día", cuadrilla: "Cuadrilla Pintura: 2 Pintores" },
    pintura: { meta_dia: 30.0, und: "m²/día", cuadrilla: "Cuadrilla Pintura: 2 Pintores" },
    cielo: { meta_dia: 15.0, und: "m²/día", cuadrilla: "Cuadrilla Liviana: 1 Of + 1 Ayud" },
    cubierta: { meta_dia: 25.0, und: "m²/día", cuadrilla: "Cuadrilla Metálica: 2 Montadores" },
    acero: { meta_dia: 250.0, und: "kg/día", cuadrilla: "Cuadrilla Armadores: 2 Oficiales" },
  };

  const actStats = new Map<string, { sum: number; count: number }>();
  for (const r of obraActiva) {
    const act = String(r.actividad || "").trim();
    if (!act || normalizarTexto(act).includes("bim_takeoff")) continue;
    const prev = actStats.get(act) || { sum: 0, count: 0 };
    prev.sum += Number(r.cantidad || 0) || 0;
    prev.count += 1;
    actStats.set(act, prev);
  }
  const rendimientos: RendimientoRow[] = [];
  actStats.forEach((st, act) => {
    const actN = normalizarTexto(act);
    let metaInfo = { meta_dia: 10.0, und: "unidades/día", cuadrilla: "Cuadrilla Estándar" };
    for (const [k, v] of Object.entries(metasApu)) {
      if (actN.includes(k)) {
        metaInfo = v;
        break;
      }
    }
    const prom = Math.round((st.sum / Math.max(1, st.count)) * 100) / 100;
    const eficiencia = Math.round((prom / metaInfo.meta_dia) * 1000) / 10;
    const evaluacion =
      eficiencia >= 105
        ? "🟢 Alto Rendimiento"
        : eficiencia >= 90
        ? "🔵 En Rango APU"
        : "🔴 Rendimiento Bajo";
    rendimientos.push({
      Actividad: act,
      Cuadrilla_Asignada: metaInfo.cuadrilla,
      Total_Producido: Math.round(st.sum * 100) / 100,
      Jornadas: st.count,
      Rendimiento_Real: `${prom} ${metaInfo.und}`,
      Meta_APU_Teorica: `${metaInfo.meta_dia} ${metaInfo.und}`,
      "Eficiencia_%": eficiencia,
      Evaluacion: evaluacion,
    });
  });

  // Insumos
  const calcInsumos = (campo: "Cantidad_Contratada" | "Cantidad_Ejecutada"): InsumoRow[] => {
    const list: InsumoRow[] = [];
    for (const r of df5d) {
      const cCalc = Number(r[campo] || 0);
      if (cCalc <= 0) continue;
      const actN = normalizarTexto(r.Actividad);
      const it = r.Item;
      if (actN.includes("bloque") || actN.includes("mamposteria") || it === "1.1" || it === "6.1") {
        const cantB = r.Unidad === "und" ? cCalc : cCalc * 12.5;
        list.push({ Actividad: r.Actividad, Insumo: "Bloque de Concreto No. 12 (40x20x10/12)", Unidad: "Und", Total_Teorico: cantB });
        list.push({ Actividad: r.Actividad, Insumo: "Cemento Gris para Pega (Sacos 50kg)", Unidad: "Sacos", Total_Teorico: cantB * 0.015 });
        list.push({ Actividad: r.Actividad, Insumo: "Arena Fina para Mortero de Pega", Unidad: "m³", Total_Teorico: cantB * 0.002 });
      } else if (actN.includes("panete") || actN.includes("revoco") || it === "1.2" || it === "6.4") {
        list.push({ Actividad: r.Actividad, Insumo: "Cemento Gris para Pañete (Sacos 50kg)", Unidad: "Sacos", Total_Teorico: cCalc * 0.22 });
        list.push({ Actividad: r.Actividad, Insumo: "Arena Lavada para Pañete", Unidad: "m³", Total_Teorico: cCalc * 0.028 });
      } else if (actN.includes("plantilla") || actN.includes("solado") || it === "2.1" || it === "3.1") {
        list.push({ Actividad: r.Actividad, Insumo: "Cemento Gris Base Piso (Sacos 50kg)", Unidad: "Sacos", Total_Teorico: cCalc * 0.35 });
        list.push({ Actividad: r.Actividad, Insumo: "Triturado / Grava de 3/4\"", Unidad: "m³", Total_Teorico: cCalc * 0.065 });
      } else if (actN.includes("porcelanato") || actN.includes("enchape") || actN.includes("piso") || it === "2.2") {
        list.push({ Actividad: r.Actividad, Insumo: "Porcelanato / Baldosa Cerámica (+5% desp)", Unidad: "m²", Total_Teorico: cCalc * 1.05 });
        list.push({ Actividad: r.Actividad, Insumo: "Pegante Blanco Especializado (Sacos 25kg)", Unidad: "Sacos", Total_Teorico: cCalc * 0.2 });
      } else if (actN.includes("concreto") || actN.includes("zapata") || actN.includes("viga") || actN.includes("pedestal") || actN.includes("losa") || actN.includes("placa")) {
        const vol = r.Unidad === "m²" ? cCalc * 0.11 : cCalc;
        list.push({ Actividad: r.Actividad, Insumo: "Concreto Premezclado / Obra 3000-3500 PSI", Unidad: "m³", Total_Teorico: vol * 1.03 });
        list.push({ Actividad: r.Actividad, Insumo: "Cemento Estructural (Equiv. Sacos 50kg)", Unidad: "Sacos", Total_Teorico: vol * 7.5 });
      } else if (actN.includes("estuco") || actN.includes("pintura") || it === "4.1") {
        list.push({ Actividad: r.Actividad, Insumo: "Estuco Plástico Blanco (Cuñetes 28kg)", Unidad: "Cuñetes", Total_Teorico: cCalc * 0.045 });
        list.push({ Actividad: r.Actividad, Insumo: "Pintura Vinílica Tipo 1 (Cuñetes 5 Gal)", Unidad: "Cuñetes", Total_Teorico: cCalc * 0.015 });
      } else if (actN.includes("cielo raso") || actN.includes("cielorraso") || it === "3.1") {
        list.push({ Actividad: r.Actividad, Insumo: "Lámina Drywall / PVC 1.22x2.44m", Unidad: "Láminas", Total_Teorico: cCalc / 2.9768 });
        list.push({ Actividad: r.Actividad, Insumo: "Perfilería Galvanizada (Omegas/Viguetas)", Unidad: "ml", Total_Teorico: cCalc * 3.1 });
      } else if (actN.includes("acero")) {
        list.push({ Actividad: r.Actividad, Insumo: "Acero Estructural / Corrugado (+3% traslape)", Unidad: "kg", Total_Teorico: cCalc * 1.03 });
      }
    }
    return list;
  };

  return {
    df_5d: df5d,
    resumen_caps: resumenCaps,
    obra_activa: obraActiva,
    totals: {
      total_ppto_contratado: Math.round(totalPpto * 100) / 100,
      total_costo_ejecutado: Math.round(totalExec * 100) / 100,
      total_saldo_dinero: Math.round(totalSaldo * 100) / 100,
      total_sobrecosto_cop: Math.round(totalSobrecosto * 100) / 100,
      avance_financiero_global: avanceFin,
      avance_fisico_ponderado: avanceFis,
    },
    rendimientos,
    insumos_demanda: calcInsumos("Cantidad_Contratada"),
    insumos_ejecutado: calcInsumos("Cantidad_Ejecutada"),
    engine: "client-ts",
  };
}

export async function callPythonJson<T>(payload: Record<string, unknown>): Promise<T> {
  const res = await fetch("/api/engine", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok || data.ok === false) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data as T;
}

export async function downloadPythonBinary(
  payload: Record<string, unknown>,
  fallbackFilename: string
): Promise<void> {
  const res = await fetch("/api/engine", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`;
    try {
      const errJson = await res.json();
      if (errJson.error) errMsg = errJson.error;
    } catch {
      // text response
    }
    throw new Error(errMsg);
  }
  const blob = await res.blob();
  const disp = res.headers.get("Content-Disposition") || "";
  const match = /filename="?([^"]+)"?/i.exec(disp);
  const filename = match?.[1] || fallbackFilename;
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export async function downloadPlantillaExcel(): Promise<void> {
  try {
    const res = await fetch("/api/engine?action=plantilla_excel");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Plantilla_Presupuesto_JGM_ConTech.xlsx";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    throw new Error(`No se pudo descargar la plantilla Excel: ${String(err)}`);
  }
}

export function parseCsvLocalFallback(text: string): {
  items: ProjectConfig["ppto_base"];
  error?: string;
} {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    return { items: [], error: "El archivo CSV debe contener encabezado y al menos una fila." };
  }
  const sep = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(sep).map((h) => normalizarTexto(h));
  const findCol = (keys: string[]) => headers.findIndex((h) => keys.some((k) => h.includes(k)));
  const idxItem = findCol(["item", "nro", "codigo", "num"]);
  const idxCap = findCol(["capitulo", "cap", "etapa", "rubro"]);
  const idxAct = findCol(["actividad", "descripcion", "concepto", "detalle"]);
  const idxUnd = findCol(["unidad", "und", "medida"]);
  const idxCant = findCol(["cantidad", "cant", "metrado"]);
  const idxPu = findCol(["precio", "valor_unitario", "unitario", "costo"]);

  if (idxAct === -1 || idxPu === -1) {
    return {
      items: [],
      error: "Faltan columnas obligatorias: Actividad y Precio Unitario.",
    };
  }
  const items: ProjectConfig["ppto_base"] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
    const act = cols[idxAct] || "";
    if (!act) continue;
    const puRaw = (cols[idxPu] || "0").replace(/[$ ,\s]/g, "");
    const cantRaw = idxCant >= 0 ? (cols[idxCant] || "1").replace(/,/g, ".") : "1";
    const matchKeys = normalizarTexto(act)
      .split(/\s+/)
      .filter((w) => w.length > 3);
    items.push({
      Item: idxItem >= 0 && cols[idxItem] ? cols[idxItem] : String(i),
      Capitulo:
        idxCap >= 0 && cols[idxCap] ? cols[idxCap] : "1. ACTIVIDADES GENERALES",
      Actividad: act,
      Unidad: idxUnd >= 0 && cols[idxUnd] ? cols[idxUnd] : "und",
      Cantidad_Contratada: Number(cantRaw) || 1,
      Precio_Unitario: Number(puRaw) || 0,
      match_keys: matchKeys,
    });
  }
  return { items };
}
