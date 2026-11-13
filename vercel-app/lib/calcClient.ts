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

export function normalizarUnidad(und?: string): string {
  const u = normalizarTexto(String(und || ""));
  if (u.includes("m3") || u.includes("m³")) return "m3";
  if (u.includes("m2") || u.includes("m²")) return "m2";
  if (u.includes("ml") || u.includes("metro lineal")) return "ml";
  if (u.includes("kg")) return "kg";
  if (
    u.includes("und") ||
    u.includes("unid") ||
    u.includes("pto") ||
    u.includes("glb")
  ) {
    return "und";
  }
  return u;
}

function normalizarFechaKey(fechaVal: unknown, fallbackIdx: number): string {
  const txt = String(fechaVal || "").trim();
  if (!txt) return `row_${fallbackIdx}`;
  if (txt.includes("/")) {
    const parts = txt.split("/");
    if (parts.length === 3 && parts[2].length === 4) {
      return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
    }
  }
  return txt.slice(0, 10);
}

export interface MetaApuSpec {
  meta_dia: number;
  und: string;
  cuadrilla: string;
}

export function resolverMetaApu(
  actividad: string,
  unidad: string = ""
): MetaApuSpec {
  const actN = normalizarTexto(actividad);
  const uNorm = normalizarUnidad(unidad);
  const hasAny = (keys: string[]) => keys.some((k) => actN.includes(k));

  if (hasAny(["cubierta", "eternit", "techo", "teja", "caballete"])) {
    return {
      meta_dia: 20.0,
      und: "m²/día",
      cuadrilla: "Cuadrilla Metálica: 2 Montadores",
    };
  }
  if (hasAny(["ventana", "ventaneria", "window"]) && hasAny(["puerta", "door"])) {
    return {
      meta_dia: 3.0,
      und: "und/día",
      cuadrilla: "Cuadrilla Carpintería & Aluminio: 1 Oficial + 1 Ayud",
    };
  }
  if (hasAny(["puerta", "door"])) {
    return {
      meta_dia: 2.5,
      und: "und/día",
      cuadrilla: "Cuadrilla Carpintería: 1 Oficial + 1 Ayud",
    };
  }
  if (hasAny(["ventana", "ventaneria", "window"])) {
    return {
      meta_dia: 3.5,
      und: "und/día",
      cuadrilla: "Cuadrilla Aluminio: 1 Oficial + 1 Ayud",
    };
  }
  if (
    hasAny(["cielorraso", "cielo raso", "drywall", "superboard", "ceiling"]) &&
    hasAny(["frescasa", "aislamiento", "aislante", "fibra de vidrio"])
  ) {
    return {
      meta_dia: 13.0,
      und: "m²/día",
      cuadrilla: "Cuadrilla Liviana: 1 Of + 1 Ayud",
    };
  }
  if (hasAny(["frescasa", "aislamiento", "aislante", "fibra de vidrio"])) {
    return {
      meta_dia: 26.0,
      und: "m²/día",
      cuadrilla: "Cuadrilla Aislamiento: 1 Of + 1 Ayud",
    };
  }
  if (
    hasAny(["cielorraso", "cielo raso", "drywall", "superboard", "ceiling"])
  ) {
    return {
      meta_dia: 14.0,
      und: "m²/día",
      cuadrilla: "Cuadrilla Liviana: 1 Of + 1 Ayud",
    };
  }
  if (hasAny(["guardaescoba", "zocalo"])) {
    return {
      meta_dia: 25.0,
      und: "ml/día",
      cuadrilla: "Cuadrilla Acabados: 1 Oficial",
    };
  }
  if (
    hasAny(["porcelanato", "enchape", "ceramico", "ceramica", "baldosa"]) &&
    hasAny(["plantilla", "solado"])
  ) {
    return {
      meta_dia: 9.0,
      und: "m²/día",
      cuadrilla: "Cuadrilla Enchape: 1 Oficial + 1 Ayud",
    };
  }
  if (
    hasAny(["porcelanato", "enchape", "ceramico", "ceramica", "baldosa", "piso"]) &&
    !actN.includes("plantilla")
  ) {
    return {
      meta_dia: 10.5,
      und: "m²/día",
      cuadrilla: "Cuadrilla Enchape: 1 Oficial + 1 Ayud",
    };
  }
  if (hasAny(["estuco"]) && hasAny(["pintura", "vinil"])) {
    return {
      meta_dia: 20.0,
      und: "m²/día",
      cuadrilla: "Cuadrilla Pintura: 1 Oficial + 1 Ayud",
    };
  }
  if (hasAny(["estuco", "pintura", "vinil"])) {
    return {
      meta_dia: 28.0,
      und: "m²/día",
      cuadrilla: "Cuadrilla Pintura: 1 Oficial + 1 Ayud",
    };
  }
  if (hasAny(["panete", "revoco", "revoque", "repello"])) {
    return {
      meta_dia: 14.0,
      und: "m²/día",
      cuadrilla: "Cuadrilla Pañete: 1 Oficial + 1 Ayud",
    };
  }
  if (hasAny(["mamposteria", "levante", "bloque", "ladrillo", "muro"])) {
    return {
      meta_dia: 10.5,
      und: "m²/día",
      cuadrilla: "Cuadrilla Mampostería: 1 Oficial + 1 Ayud",
    };
  }
  if (hasAny(["plantilla", "solado"])) {
    if (uNorm === "m3") {
      return {
        meta_dia: 3.5,
        und: "m³/día",
        cuadrilla: "Cuadrilla Obra Gris: 1 Oficial + 3 Ayud",
      };
    }
    return {
      meta_dia: 18.0,
      und: "m²/día",
      cuadrilla: "Cuadrilla Obra Gris: 1 Oficial + 2 Ayud",
    };
  }
  if (hasAny(["losa", "placa", "metaldeck", "entrepiso"])) {
    if (uNorm === "m3") {
      return {
        meta_dia: 4.0,
        und: "m³/día",
        cuadrilla: "Cuadrilla Estructura: 1 Oficial + 4 Ayud",
      };
    }
    return {
      meta_dia: 22.0,
      und: "m²/día",
      cuadrilla: "Cuadrilla Estructura: 1 Oficial + 4 Ayud",
    };
  }
  if (
    hasAny(["sanitario", "lavamanos", "ducha", "lavadero", "lavaplatos", "aparato"])
  ) {
    return {
      meta_dia: 3.0,
      und: "und/día",
      cuadrilla: "Cuadrilla Hidrosanitaria: 1 Oficial",
    };
  }
  if (hasAny(["acero", "hierro", "varilla", "malla"])) {
    return {
      meta_dia: 240.0,
      und: "kg/día",
      cuadrilla: "Cuadrilla Armadores: 2 Oficiales",
    };
  }
  if (hasAny(["demolicion", "retiro"])) {
    if (uNorm === "m2") {
      return {
        meta_dia: 16.0,
        und: "m²/día",
        cuadrilla: "Cuadrilla Preliminares: 2 Ayudantes",
      };
    }
    return {
      meta_dia: 4.0,
      und: "m³/día",
      cuadrilla: "Cuadrilla Preliminares: 2 Ayudantes",
    };
  }
  if (actN.includes("excavacion")) {
    return {
      meta_dia: 3.5,
      und: "m³/día",
      cuadrilla: "Cuadrilla Excavación: 2 Ayudantes",
    };
  }
  if (hasAny(["cerramiento", "polisombra"])) {
    return {
      meta_dia: 35.0,
      und: "ml/día",
      cuadrilla: "Cuadrilla Preliminares: 1 Of + 1 Ayud",
    };
  }
  if (hasAny(["replanteo", "trazado", "localizacion"])) {
    return {
      meta_dia: 80.0,
      und: "m²/día",
      cuadrilla: "Comisión Topografía / Oficial",
    };
  }
  if (hasAny(["pedestal", "columna"])) {
    return {
      meta_dia: 2.4,
      und: "m³/día",
      cuadrilla: "Cuadrilla Estructura: 1 Oficial + 3 Ayud",
    };
  }
  if (hasAny(["zapata", "cimentacion", "foso"])) {
    if (uNorm === "m2") {
      return {
        meta_dia: 18.0,
        und: "m²/día",
        cuadrilla: "Cuadrilla Obra Gris: 1 Oficial + 2 Ayud",
      };
    }
    return {
      meta_dia: 3.2,
      und: "m³/día",
      cuadrilla: "Cuadrilla Estructura: 1 Oficial + 3 Ayud",
    };
  }
  if (hasAny(["viga", "dintel", "concreto"])) {
    if (uNorm === "m2") {
      return {
        meta_dia: 18.0,
        und: "m²/día",
        cuadrilla: "Cuadrilla Obra Gris: 1 Oficial + 2 Ayud",
      };
    }
    return {
      meta_dia: 3.0,
      und: "m³/día",
      cuadrilla: "Cuadrilla Estructura: 1 Oficial + 3 Ayud",
    };
  }

  if (uNorm === "m2") {
    return {
      meta_dia: 15.0,
      und: "m²/día",
      cuadrilla: "Cuadrilla General: 1 Oficial + 1 Ayud",
    };
  }
  if (uNorm === "m3") {
    return {
      meta_dia: 3.5,
      und: "m³/día",
      cuadrilla: "Cuadrilla Obra Gris: 1 Oficial + 3 Ayud",
    };
  }
  if (uNorm === "ml") {
    return {
      meta_dia: 25.0,
      und: "ml/día",
      cuadrilla: "Cuadrilla Acabados: 1 Oficial",
    };
  }
  if (uNorm === "kg") {
    return {
      meta_dia: 200.0,
      und: "kg/día",
      cuadrilla: "Cuadrilla Armadores: 2 Oficiales",
    };
  }
  return {
    meta_dia: 4.0,
    und: "und/día",
    cuadrilla: "Cuadrilla Estándar: 1 Oficial",
  };
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

    // Ignorar cargas maestras de cronograma MS Project (no son volúmenes ejecutados)
    if (actTxt.includes("msproject_sync")) {
      continue;
    }

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

  const findBestItemMatch = (actTxt: string): string | null => {
    let bestItem: string | null = null;
    let bestScore = 0;
    const isFrescasa =
      actTxt.includes("frescasa") ||
      actTxt.includes("aislamiento") ||
      actTxt.includes("aislante") ||
      actTxt.includes("fibra de vidrio");

    for (const item of listaPpto) {
      const keys = item.match_keys || [];
      if (isFrescasa && (item.Item === "3.1" || normalizarTexto(item.Actividad).includes("cielo raso suspendido"))) {
        continue;
      }
      let score = 0;
      for (const k of keys) {
        if (actTxt.includes(k)) score += Math.max(k.length, 3);
      }
      if (score > bestScore) {
        bestScore = score;
        bestItem = item.Item;
      }
    }
    return bestItem;
  };

  if (proyecto.tipo !== "presupuesto" && proyecto.id === "casa_mendoza") {
    for (const row of obraActiva) {
      const actTxt = normalizarTexto(String(row.actividad || ""));
      if (actTxt.includes("bim_takeoff") || actTxt.includes("takeoff")) {
        const cantBim = Number(row.cantidad || 0);
        if (cantBim > 0) {
          const matchedCode = findBestItemMatch(actTxt);
          const matched = listaPpto.find((it) => it.Item === matchedCode);
          if (matched) matched.Cantidad_Contratada = cantBim;
        }
      }
    }
  }

  for (const row of obraActiva) {
    const actTxt = normalizarTexto(String(row.actividad || ""));
    if (actTxt.includes("bim_takeoff") || actTxt.includes("takeoff")) continue;
    const cant = Number(row.cantidad || 0) || 0;
    const desp = Number(row.desperdicio || 0) || 0;

    const matchedItem = findBestItemMatch(actTxt);
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

    let estado = "En Curso";
    if (ejecutado === 0) estado = "Sin Iniciar";
    else if (pctAvance >= 99.0 && pctAvance <= 100.0) estado = "Completado";
    else if (pctAvance > 100.0) estado = "Mayor Cantidad";

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

  // Rendimientos reales por jornada (agrupados por fecha única, excluyendo BIM_TAKEOFF / MSPROJECT_SYNC)
  const actStats = new Map<
    string,
    { display: string; unidad: string; sum: number; dias: Set<string> }
  >();
  obraActiva.forEach((r, idx) => {
    const actRaw = String(r.actividad || "").trim();
    const actNorm = normalizarTexto(actRaw);
    if (!actNorm) return;
    if (
      actNorm.includes("bim_takeoff") ||
      actNorm.includes("takeoff") ||
      actNorm.includes("msproject_sync") ||
      actNorm === "test"
    ) {
      return;
    }
    const cant = Number(r.cantidad || 0) || 0;
    if (cant <= 0) return;

    const display = actRaw.replace(/^\s*\[[^\]]+\]\s*/g, "").trim() || actRaw;
    const key = normalizarTexto(display);
    const und = String(r.unidad || "");
    const fechaKey = normalizarFechaKey(r.fecha, idx);

    const prev = actStats.get(key) || {
      display,
      unidad: und,
      sum: 0,
      dias: new Set<string>(),
    };
    prev.sum += cant;
    prev.dias.add(fechaKey);
    if (!prev.unidad && und) prev.unidad = und;
    actStats.set(key, prev);
  });

  const rendimientos: RendimientoRow[] = [];
  actStats.forEach((st) => {
    const jornadas = Math.max(1, st.dias.size);
    const totalProd = Math.round(st.sum * 100) / 100;
    const prom = Math.round((totalProd / jornadas) * 100) / 100;
    const metaInfo = resolverMetaApu(st.display, st.unidad);
    const eficiencia =
      metaInfo.meta_dia > 0
        ? Math.round((prom / metaInfo.meta_dia) * 1000) / 10
        : 100;
    const evaluacion =
      eficiencia >= 105
        ? "Alto Rendimiento"
        : eficiencia >= 90
        ? "En Rango APU"
        : "Rendimiento Bajo";
    rendimientos.push({
      Actividad: st.display,
      Cuadrilla_Asignada: metaInfo.cuadrilla,
      Total_Producido: totalProd,
      Jornadas: jornadas,
      Rendimiento_Real: `${prom} ${metaInfo.und}`,
      Meta_APU_Teorica: `${metaInfo.meta_dia} ${metaInfo.und}`,
      "Eficiencia_%": eficiencia,
      Evaluacion: evaluacion,
    });
  });
  rendimientos.sort((a, b) => a.Actividad.localeCompare(b.Actividad));

  // Insumos
  const calcInsumos = (campo: "Cantidad_Contratada" | "Cantidad_Ejecutada"): InsumoRow[] => {
    const list: InsumoRow[] = [];
    for (const r of df5d) {
      const cCalc = Number(r[campo] || 0);
      if (cCalc <= 0) continue;
      const actN = normalizarTexto(r.Actividad);
      if (actN.includes("cubierta") || actN.includes("eternit") || actN.includes("teja") || actN.includes("caballete")) {
        list.push({ Actividad: r.Actividad, Insumo: "Teja Ondulada Eternit No. 6/8", Unidad: "m²", Total_Teorico: cCalc * 1.1 });
        list.push({ Actividad: r.Actividad, Insumo: "Caballete Articulado Cubierta Eternit", Unidad: "ml", Total_Teorico: cCalc * 0.12 });
        list.push({ Actividad: r.Actividad, Insumo: "Ganchos de Fijación con Golilla", Unidad: "Und", Total_Teorico: cCalc * 3.0 });
      } else if (actN.includes("ventaneria") || actN.includes("ventana") || actN.includes("puerta")) {
        if ((actN.includes("ventaneria") || actN.includes("ventana")) && actN.includes("puerta")) {
          const nWin = Math.round(cCalc * 0.57);
          const nDoor = Math.max(0, cCalc - nWin);
          if (nWin > 0) list.push({ Actividad: r.Actividad, Insumo: "Ventanas de Aluminio y Vidrio", Unidad: "Und", Total_Teorico: nWin });
          if (nDoor > 0) list.push({ Actividad: r.Actividad, Insumo: "Puertas Entamboradas con Marco y Cerradura", Unidad: "Und", Total_Teorico: nDoor });
        } else if (actN.includes("puerta")) {
          list.push({ Actividad: r.Actividad, Insumo: "Puertas Entamboradas con Marco y Cerradura", Unidad: "Und", Total_Teorico: cCalc });
        } else {
          list.push({ Actividad: r.Actividad, Insumo: "Ventanas de Aluminio y Vidrio", Unidad: "Und", Total_Teorico: cCalc });
        }
      } else if (actN.includes("bloque") || actN.includes("mamposteria")) {
        const cantB = r.Unidad === "und" ? cCalc : cCalc * 12.5;
        list.push({ Actividad: r.Actividad, Insumo: "Bloque de Concreto No. 12 (40x20x10/12)", Unidad: "Und", Total_Teorico: cantB });
        list.push({ Actividad: r.Actividad, Insumo: "Cemento Gris para Pega (Sacos 50kg)", Unidad: "Sacos", Total_Teorico: cantB * 0.015 });
        list.push({ Actividad: r.Actividad, Insumo: "Arena Fina para Mortero de Pega", Unidad: "m³", Total_Teorico: cantB * 0.002 });
      } else if (actN.includes("panete") || actN.includes("revoco")) {
        list.push({ Actividad: r.Actividad, Insumo: "Cemento Gris para Pañete (Sacos 50kg)", Unidad: "Sacos", Total_Teorico: cCalc * 0.22 });
        list.push({ Actividad: r.Actividad, Insumo: "Arena Lavada para Pañete", Unidad: "m³", Total_Teorico: cCalc * 0.028 });
      } else if (actN.includes("estuco") || actN.includes("pintura")) {
        list.push({ Actividad: r.Actividad, Insumo: "Estuco Plástico Listo (Cuñetes)", Unidad: "Cuñetes", Total_Teorico: cCalc * 0.08 });
        list.push({ Actividad: r.Actividad, Insumo: "Pintura Vinilo Tipo 1 (Galones)", Unidad: "Gal", Total_Teorico: cCalc * 0.12 });
      } else if (actN.includes("porcelanato") || actN.includes("enchape")) {
        list.push({ Actividad: r.Actividad, Insumo: "Porcelanato / Cerámica 51x51 cm (5% desp.)", Unidad: "m²", Total_Teorico: cCalc * 1.05 });
        list.push({ Actividad: r.Actividad, Insumo: "Pegacor Cerámico (Bultos 25kg)", Unidad: "Bultos", Total_Teorico: cCalc * 0.25 });
        list.push({ Actividad: r.Actividad, Insumo: "Boquilla para Junta", Unidad: "kg", Total_Teorico: cCalc * 0.35 });
        if (actN.includes("plantilla")) {
          list.push({ Actividad: r.Actividad, Insumo: "Concreto Simple f'c=14 MPa (Plantilla)", Unidad: "m³", Total_Teorico: cCalc * 0.07 });
          list.push({ Actividad: r.Actividad, Insumo: "Cemento Gris para Plantilla (Sacos)", Unidad: "Sacos", Total_Teorico: cCalc * 0.45 });
        }
      } else if (actN.includes("plantilla") || actN.includes("solado")) {
        list.push({ Actividad: r.Actividad, Insumo: "Concreto Simple f'c=14 MPa (Plantilla)", Unidad: "m³", Total_Teorico: cCalc * 0.07 });
        list.push({ Actividad: r.Actividad, Insumo: "Cemento Gris para Plantilla (Sacos)", Unidad: "Sacos", Total_Teorico: cCalc * 0.45 });
      } else if (actN.includes("cielo raso") || actN.includes("cielorraso") || actN.includes("frescasa") || actN.includes("aislamiento")) {
        if (actN.includes("cielo raso") || actN.includes("cielorraso") || actN.includes("drywall")) {
          list.push({ Actividad: r.Actividad, Insumo: "Panel de Cielorraso Suspendido", Unidad: "m²", Total_Teorico: cCalc * 1.05 });
          list.push({ Actividad: r.Actividad, Insumo: "Perfilería Angular y Perfiles Omega", Unidad: "ml", Total_Teorico: cCalc * 1.8 });
        }
        if (actN.includes("frescasa") || actN.includes("aislamiento") || actN.includes("fibra de vidrio")) {
          const areaDesp = cCalc * 1.05;
          list.push({ Actividad: r.Actividad, Insumo: "Rollo Frescasa Eco 2-1/2\" (7.62×1.22m = 9.30 m², +5% desp.)", Unidad: "Rollos", Total_Teorico: areaDesp / 9.2964 });
          list.push({ Actividad: r.Actividad, Insumo: "Aislamiento Fibra de Vidrio Frescasa Eco (Área c/ 5% desp.)", Unidad: "m²", Total_Teorico: areaDesp });
        }
      } else if (actN.includes("concreto") || actN.includes("zapata") || actN.includes("columna") || actN.includes("viga") || actN.includes("pedestal") || actN.includes("losa") || actN.includes("placa")) {
        const vol = r.Unidad === "m²" ? cCalc * 0.11 : cCalc;
        list.push({ Actividad: r.Actividad, Insumo: "Cemento Gris Tipo UG (Sacos 50kg)", Unidad: "Sacos", Total_Teorico: vol * 7.0 });
        list.push({ Actividad: r.Actividad, Insumo: "Arena Lavada de Río", Unidad: "m³", Total_Teorico: vol * 0.55 });
        list.push({ Actividad: r.Actividad, Insumo: "Gravilla Triturada 3/4 pulg", Unidad: "m³", Total_Teorico: vol * 0.85 });
      } else if (actN.includes("acero")) {
        list.push({ Actividad: r.Actividad, Insumo: "Acero Corrugado 60 KSI (Figurado)", Unidad: "kg", Total_Teorico: cCalc * 1.05 });
        list.push({ Actividad: r.Actividad, Insumo: "Alambre Negro #18 para Amarre", Unidad: "kg", Total_Teorico: cCalc * 0.03 });
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
