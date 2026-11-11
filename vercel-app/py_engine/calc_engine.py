import io
import unicodedata
import numpy as np
import pandas as pd


def normalizar_texto(texto):
    """Normaliza texto removiendo tildes/diacríticos y espacios extremos."""
    if not texto or not isinstance(texto, str):
        return ""
    texto = unicodedata.normalize("NFD", texto).encode("ascii", "ignore").decode("utf-8")
    return texto.lower().strip()


def filtrar_bitacora_por_proyecto(df_bitacora, proyecto_actual):
    """
    Filtra estrictamente los registros de bitácora para garantizar aislamiento
    total entre proyectos y evitar cruce de información.
    """
    if df_bitacora is None or df_bitacora.empty:
        return pd.DataFrame()

    proy_id = str(proyecto_actual.get("id", "")).lower()
    proy_nombre = normalizar_texto(str(proyecto_actual.get("nombre", "")))
    es_solo_ppto = (
        proyecto_actual.get("tipo") == "presupuesto"
        or "PRESUPUESTO" in str(proyecto_actual.get("badge", "")).upper()
    )

    indices_validos = []
    for idx, row in df_bitacora.iterrows():
        act_raw = str(row.get("actividad", ""))
        act_txt = normalizar_texto(act_raw)

        # 1. Metrados BIM ([BIM_TAKEOFF]) exclusivos para Casa Mendoza (modo BIM)
        if "bim_takeoff" in act_txt or "takeoff" in act_txt:
            if proy_id == "casa_mendoza" and not es_solo_ppto:
                indices_validos.append(idx)
            continue

        # 2. Etiqueta explícita [proy_id] o [Nombre Proyecto]
        tag_id = f"[{proy_id}]".replace(" ", "")
        tag_nom = f"[{proy_nombre}]" if len(proy_nombre) > 4 else "___nom_invalido___"
        if tag_id in act_txt.replace(" ", "") or tag_nom in act_txt:
            indices_validos.append(idx)
            continue

        # 3. Proyectos base del sistema
        if proy_id == "casa_mendoza":
            if "mendoza" in act_txt or "sabanalarga" in act_txt:
                indices_validos.append(idx)
        elif proy_id == "mezzanine":
            try:
                row_id = int(row.get("id", 0))
            except Exception:
                row_id = 0
            if (
                row_id <= 50
                and "mendoza" not in act_txt
                and "sabanalarga" not in act_txt
                and not act_raw.strip().startswith("[")
            ):
                indices_validos.append(idx)
            elif "mezzanine" in act_txt or "dolmen" in act_txt or "ingendes" in act_txt:
                indices_validos.append(idx)
        else:
            if proy_id in act_txt or (len(proy_nombre) > 4 and proy_nombre in act_txt):
                indices_validos.append(idx)

    if indices_validos:
        return df_bitacora.loc[indices_validos].copy()
    return pd.DataFrame(columns=df_bitacora.columns)


def consolidar_presupuesto_y_ejecucion(df_ppto_base, df_bitacora, proyecto_id="mezzanine", tipo_proyecto="bim"):
    """Cruza el presupuesto contractual con los registros reales de bitácora usando Pandas y NumPy."""
    lista_ppto = [dict(item) for item in (df_ppto_base or [])]
    acumulados = {str(item.get("Item", "")): 0.0 for item in lista_ppto}
    desperdicios = {str(item.get("Item", "")): [] for item in lista_ppto}

    if df_bitacora is not None and not df_bitacora.empty and "actividad" in df_bitacora.columns and "cantidad" in df_bitacora.columns:
        # 1. Sincronización de metrado BIM ([BIM_TAKEOFF]) solo para Casa Mendoza BIM
        if tipo_proyecto != "presupuesto" and proyecto_id == "casa_mendoza":
            for _, row in df_bitacora.iterrows():
                act_txt = normalizar_texto(str(row.get("actividad", "")))
                if "bim_takeoff" in act_txt or "takeoff" in act_txt:
                    try:
                        cant_bim = float(row.get("cantidad", 0) or 0)
                    except Exception:
                        cant_bim = 0.0
                    if cant_bim > 0:
                        for item in lista_ppto:
                            keys = item.get("match_keys", [])
                            if any(k in act_txt for k in keys):
                                item["Cantidad_Contratada"] = cant_bim
                                break

        # 2. Acumulación de avance ejecutado
        for _, row in df_bitacora.iterrows():
            act_raw = str(row.get("actividad", ""))
            act_txt = normalizar_texto(act_raw)
            if "bim_takeoff" in act_txt or "takeoff" in act_txt:
                continue
            try:
                cant = float(row.get("cantidad", 0) or 0)
            except Exception:
                cant = 0.0
            try:
                desp = float(row.get("desperdicio", 0) or 0)
            except Exception:
                desp = 0.0

            matched_item = None
            for item in lista_ppto:
                keys = item.get("match_keys", [])
                if any(k in act_txt for k in keys):
                    matched_item = str(item.get("Item", ""))
                    break

            if matched_item and matched_item in acumulados:
                acumulados[matched_item] += cant
                if desp > 0:
                    desperdicios[matched_item].append(desp)

    filas = []
    for item in lista_ppto:
        it = str(item.get("Item", ""))
        contratado = float(item.get("Cantidad_Contratada", 0) or 0)
        ejecutado = round(acumulados.get(it, 0.0), 2)
        pu = float(item.get("Precio_Unitario", 0) or 0)
        ppto_total = round(contratado * pu, 2)
        costo_ejecutado = round(ejecutado * pu, 2)
        saldo_cantidad = max(0.0, round(contratado - ejecutado, 2))
        saldo_dinero = max(0.0, round(ppto_total - costo_ejecutado, 2))

        pct_avance = round((ejecutado / contratado * 100), 1) if contratado > 0 else 0.0
        desp_prom = round(float(np.mean(desperdicios[it])), 1) if desperdicios.get(it) else 0.0

        mayor_cantidad = max(0.0, round(ejecutado - contratado, 2))
        sobrecosto_cop = round(mayor_cantidad * pu, 2)

        if ejecutado == 0:
            estado = "⚪ Sin Iniciar"
        elif 99.0 <= pct_avance <= 100.0:
            estado = "🟢 Completado"
        elif pct_avance > 100.0:
            estado = "🔴 Mayor Cantidad"
        else:
            estado = "🔵 En Curso"

        filas.append({
            "Item": it,
            "Capitulo": str(item.get("Capitulo", "1. GENERAL")),
            "Actividad": str(item.get("Actividad", "")),
            "Unidad": str(item.get("Unidad", "und")),
            "Cantidad_Contratada": contratado,
            "Cantidad_Ejecutada": ejecutado,
            "Saldo_Cantidad": saldo_cantidad,
            "Mayor_Cantidad": mayor_cantidad,
            "Sobrecosto_COP": sobrecosto_cop,
            "Precio_Unitario": pu,
            "Presupuesto_Total": ppto_total,
            "Costo_Ejecutado": costo_ejecutado,
            "Saldo_Dinero": saldo_dinero,
            "Avance_%": pct_avance,
            "Desperdicio_%": desp_prom,
            "Estado": estado,
        })

    if not filas:
        return pd.DataFrame(columns=[
            "Item", "Capitulo", "Actividad", "Unidad",
            "Cantidad_Contratada", "Cantidad_Ejecutada", "Saldo_Cantidad",
            "Mayor_Cantidad", "Sobrecosto_COP", "Precio_Unitario",
            "Presupuesto_Total", "Costo_Ejecutado", "Saldo_Dinero",
            "Avance_%", "Desperdicio_%", "Estado"
        ])
    return pd.DataFrame(filas)


def _calcular_insumos_desde_df(df_5d, campo_cant):
    """Calcula la explosión paramétrica de insumos con Pandas sobre df_5d."""
    if df_5d is None or df_5d.empty:
        return []
    insumos_calc = []
    for _, r in df_5d.iterrows():
        it = str(r["Item"])
        c_calc = float(r[campo_cant] or 0)
        if c_calc <= 0:
            continue
        act_n = normalizar_texto(str(r["Actividad"]))
        if "bloque" in act_n or "mamposteria" in act_n or it in ["1.1", "6.1"]:
            cant_b = c_calc if r["Unidad"] == "und" else c_calc * 12.5
            insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Bloque de Concreto No. 12 (40x20x10/12)", "Unidad": "Und", "Total_Teorico": cant_b})
            insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Cemento Gris para Pega (Sacos 50kg)", "Unidad": "Sacos", "Total_Teorico": cant_b * 0.015})
            insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Arena Fina para Mortero de Pega", "Unidad": "m³", "Total_Teorico": cant_b * 0.002})
        elif "panete" in act_n or "revoco" in act_n or it in ["1.2", "6.4"]:
            insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Cemento Gris para Pañete (Sacos 50kg)", "Unidad": "Sacos", "Total_Teorico": c_calc * 0.22})
            insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Arena Lavada para Pañete", "Unidad": "m³", "Total_Teorico": c_calc * 0.028})
        elif "plantilla" in act_n or "solado" in act_n or it in ["2.1", "3.1"]:
            insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Concreto Simple f'c=14 MPa (Plantilla)", "Unidad": "m³", "Total_Teorico": c_calc * 0.07})
            insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Cemento Gris para Plantilla (Sacos)", "Unidad": "Sacos", "Total_Teorico": c_calc * 0.45})
        elif "porcelanato" in act_n or "ceramico" in act_n or "enchape" in act_n or it == "2.2":
            insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Porcelanato / Cerámica 51x51 cm (5% desp.)", "Unidad": "m²", "Total_Teorico": c_calc * 1.05})
            insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Pegacor Cerámico (Bultos 25kg)", "Unidad": "Bultos", "Total_Teorico": c_calc * 0.25})
            insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Boquilla para Junta", "Unidad": "kg", "Total_Teorico": c_calc * 0.35})
        elif "cielorraso" in act_n or "cielo raso" in act_n or it == "3.1":
            insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Panel de Cielorraso Suspendido", "Unidad": "m²", "Total_Teorico": c_calc * 1.05})
            insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Perfilería Angular y Perfiles Omega", "Unidad": "ml", "Total_Teorico": c_calc * 1.8})
        elif "estuco" in act_n or "pintura" in act_n or it == "4.1":
            insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Estuco Plástico Listo (Cuñetes)", "Unidad": "Cuñetes", "Total_Teorico": c_calc * 0.08})
            insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Pintura Vinilo Tipo 1 (Galones)", "Unidad": "Gal", "Total_Teorico": c_calc * 0.12})
        elif "cubierta" in act_n or "eternit" in act_n or "teja" in act_n or it == "6.1":
            insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Teja Ondulada Eternit No. 6/8", "Unidad": "m²", "Total_Teorico": c_calc * 1.10})
            insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Ganchos de Fijación con Golilla", "Unidad": "Und", "Total_Teorico": c_calc * 3.0})
        elif "puertas" in act_n or it == "5.1":
            insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Puertas Entamboradas con Marco y Cerradura", "Unidad": "Und", "Total_Teorico": c_calc})
        elif "ventanas" in act_n or it == "5.2":
            insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Ventanas de Aluminio y Vidrio", "Unidad": "Und", "Total_Teorico": c_calc})
        elif any(k in act_n for k in ["concreto", "zapatas", "vigas", "pedestales", "foso"]):
            insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Cemento Gris Tipo UG (Sacos 50kg)", "Unidad": "Sacos", "Total_Teorico": c_calc * 7.0})
            insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Arena Lavada de Río", "Unidad": "m³", "Total_Teorico": c_calc * 0.55})
            insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Gravilla Triturada 3/4 pulg", "Unidad": "m³", "Total_Teorico": c_calc * 0.85})
        elif "acero" in act_n or it in ["4.1", "5.2"]:
            insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Acero Corrugado 60 KSI (Figurado)", "Unidad": "kg", "Total_Teorico": c_calc * 1.05})
            insumos_calc.append({"Actividad": r["Actividad"], "Insumo": "Alambre Negro #18 para Amarre", "Unidad": "kg", "Total_Teorico": c_calc * 0.03})

    if not insumos_calc:
        return []
    df_ins = pd.DataFrame(insumos_calc)
    resumen = df_ins.groupby(["Insumo", "Unidad"])["Total_Teorico"].sum().reset_index()
    resumen = resumen.sort_values(by="Total_Teorico", ascending=False)
    resumen["Total_Teorico"] = resumen["Total_Teorico"].round(2)
    return resumen.to_dict(orient="records")


def _calcular_rendimientos_df(df_obra_activa):
    """Calcula eficiencia diaria de cuadrillas con Pandas groupby sobre df_obra_activa."""
    if df_obra_activa is None or df_obra_activa.empty or "actividad" not in df_obra_activa.columns:
        return []

    metas_apu = {
        "concreto": {"meta_dia": 3.5, "und": "m³/día", "cuadrilla": "Cuadrilla 1: 1 Oficial + 3 Ayudantes"},
        "zapatas": {"meta_dia": 3.5, "und": "m³/día", "cuadrilla": "Cuadrilla 1: 1 Oficial + 3 Ayudantes"},
        "pedestales": {"meta_dia": 2.5, "und": "m³/día", "cuadrilla": "Cuadrilla 1: 1 Oficial + 3 Ayudantes"},
        "vigas": {"meta_dia": 3.0, "und": "m³/día", "cuadrilla": "Cuadrilla 1: 1 Oficial + 3 Ayudantes"},
        "mamposteria": {"meta_dia": 12.0, "und": "m²/día", "cuadrilla": "Cuadrilla 2: 1 Oficial + 1 Ayudante"},
        "bloque": {"meta_dia": 12.0, "und": "m²/día", "cuadrilla": "Cuadrilla 2: 1 Oficial + 1 Ayudante"},
        "panete": {"meta_dia": 18.0, "und": "m²/día", "cuadrilla": "Cuadrilla 2: 1 Oficial + 1 Ayudante"},
        "piso": {"meta_dia": 14.0, "und": "m²/día", "cuadrilla": "Cuadrilla Acabados: 1 Oficial"},
        "cubierta": {"meta_dia": 25.0, "und": "m²/día", "cuadrilla": "Cuadrilla Metálica: 2 Montadores"},
        "acero": {"meta_dia": 250.0, "und": "kg/día", "cuadrilla": "Cuadrilla Armadores: 2 Oficiales"},
    }

    df_clean = df_obra_activa.copy()
    df_clean["cantidad"] = pd.to_numeric(df_clean["cantidad"], errors="coerce").fillna(0.0)
    resumen_act = df_clean.groupby("actividad")["cantidad"].agg(["sum", "count", "mean"]).reset_index()
    resumen_act.columns = ["Actividad", "Total_Producido", "Jornadas_Reportadas", "Promedio_Diario"]

    rendimientos = []
    for _, r in resumen_act.iterrows():
        act_n = normalizar_texto(str(r["Actividad"]))
        meta_info = {"meta_dia": 10.0, "und": "unidades/día", "cuadrilla": "Cuadrilla Estándar"}
        for k, v in metas_apu.items():
            if k in act_n:
                meta_info = v
                break
        prom = round(float(r["Promedio_Diario"]), 2)
        meta = float(meta_info["meta_dia"])
        eficiencia = round((prom / meta * 100), 1) if meta > 0 else 100.0
        if eficiencia >= 105.0:
            desempeno = "🟢 Alto Rendimiento"
        elif eficiencia >= 90.0:
            desempeno = "🔵 En Rango APU"
        else:
            desempeno = "🔴 Rendimiento Bajo"

        rendimientos.append({
            "Actividad": str(r["Actividad"]),
            "Cuadrilla_Asignada": meta_info["cuadrilla"],
            "Total_Producido": round(float(r["Total_Producido"]), 2),
            "Jornadas": int(r["Jornadas_Reportadas"]),
            "Rendimiento_Real": f"{prom} {meta_info['und']}",
            "Meta_APU_Teorica": f"{meta} {meta_info['und']}",
            "Eficiencia_%": eficiencia,
            "Evaluacion": desempeno,
        })
    return rendimientos


def consolidar_todo(proyecto_actual, registros_bitacora):
    """Ejecuta el pipeline completo Pandas + NumPy para todo el tablero gerencial."""
    df_cloud = pd.DataFrame(registros_bitacora or [])
    df_obra_activa = filtrar_bitacora_por_proyecto(df_cloud, proyecto_actual)
    df_5d = consolidar_presupuesto_y_ejecucion(
        proyecto_actual.get("ppto_base", []),
        df_obra_activa,
        proyecto_id=proyecto_actual.get("id", "mezzanine"),
        tipo_proyecto=proyecto_actual.get("tipo", "bim"),
    )

    total_ppto = float(df_5d["Presupuesto_Total"].sum()) if not df_5d.empty else 0.0
    total_exec = float(df_5d["Costo_Ejecutado"].sum()) if not df_5d.empty else 0.0
    total_saldo = float(df_5d["Saldo_Dinero"].sum()) if not df_5d.empty else 0.0
    total_sobrecosto = float(df_5d["Sobrecosto_COP"].sum()) if not df_5d.empty else 0.0
    avance_fin = round((total_exec / total_ppto * 100), 2) if total_ppto > 0 else 0.0

    if not df_5d.empty and total_ppto > 0:
        peso = df_5d["Presupuesto_Total"] / total_ppto
        av_pond = df_5d.apply(lambda r: min(float(r["Avance_%"]), 100.0), axis=1) * peso
        avance_fis = round(float(av_pond.sum()), 2)
    else:
        avance_fis = 0.0

    if not df_5d.empty:
        df_caps = df_5d.groupby("Capitulo", sort=False).agg({
            "Presupuesto_Total": "sum",
            "Costo_Ejecutado": "sum",
            "Saldo_Dinero": "sum",
        }).reset_index()
        df_caps["Avance_%"] = np.where(
            df_caps["Presupuesto_Total"] > 0,
            (df_caps["Costo_Ejecutado"] / df_caps["Presupuesto_Total"] * 100).round(1),
            0.0,
        )
        resumen_caps = df_caps.to_dict(orient="records")
    else:
        resumen_caps = []

    if not df_obra_activa.empty:
        df_obra_clean = df_obra_activa.where(pd.notnull(df_obra_activa), None)
        obra_records = df_obra_clean.to_dict(orient="records")
    else:
        obra_records = []

    return {
        "df_5d": df_5d.to_dict(orient="records"),
        "resumen_caps": resumen_caps,
        "obra_activa": obra_records,
        "totals": {
            "total_ppto_contratado": round(total_ppto, 2),
            "total_costo_ejecutado": round(total_exec, 2),
            "total_saldo_dinero": round(total_saldo, 2),
            "total_sobrecosto_cop": round(total_sobrecosto, 2),
            "avance_financiero_global": avance_fin,
            "avance_fisico_ponderado": avance_fis,
        },
        "rendimientos": _calcular_rendimientos_df(df_obra_activa),
        "insumos_demanda": _calcular_insumos_desde_df(df_5d, "Cantidad_Contratada"),
        "insumos_ejecutado": _calcular_insumos_desde_df(df_5d, "Cantidad_Ejecutada"),
        "engine": "pandas",
    }


def procesar_archivo_presupuesto_bytes(filename, raw_bytes):
    """Procesa un archivo Excel (.xlsx/.xls) o CSV de presupuesto base usando Pandas."""
    try:
        name = str(filename or "").lower()
        buf = io.BytesIO(raw_bytes)
        if name.endswith(".csv"):
            try:
                df = pd.read_csv(buf, sep=None, engine="python", encoding="utf-8")
            except Exception:
                buf.seek(0)
                df = pd.read_csv(buf, sep=";", encoding="latin-1")
        else:
            df = pd.read_excel(buf)

        col_map = {}
        for c in df.columns:
            cn = normalizar_texto(str(c))
            if any(k in cn for k in ["item", "nro", "codigo", "num", "pos"]):
                col_map["item"] = c
            elif any(k in cn for k in ["capitulo", "cap", "etapa", "categoria", "rubro"]):
                col_map["capitulo"] = c
            elif any(k in cn for k in ["actividad", "descripcion", "concepto", "detalle", "nombre"]):
                col_map["actividad"] = c
            elif any(k in cn for k in ["unidad", "und", "unid", "medida", "u.m"]):
                col_map["unidad"] = c
            elif any(k in cn for k in ["cantidad", "cant", "volumen", "metrado"]):
                col_map["cantidad"] = c
            elif any(k in cn for k in ["precio", "vr_unitario", "valor_unitario", "unitario", "p.u", "vr. unit", "costo"]):
                col_map["precio"] = c

        if "actividad" not in col_map or "precio" not in col_map:
            return None, "El archivo debe contener columnas de 'Actividad' (o Descripción) y 'Precio Unitario' (o Valor)."

        items = []
        for idx, row in df.iterrows():
            act = str(row[col_map["actividad"]]).strip()
            if not act or act.lower() in ["nan", "none", ""]:
                continue

            it_val = str(row[col_map["item"]]).strip() if "item" in col_map and not pd.isna(row[col_map["item"]]) else f"{idx+1}"
            cap_val = str(row[col_map["capitulo"]]).strip() if "capitulo" in col_map and not pd.isna(row[col_map["capitulo"]]) else "1. ACTIVIDADES GENERALES"
            und_val = str(row[col_map["unidad"]]).strip() if "unidad" in col_map and not pd.isna(row[col_map["unidad"]]) else "und"

            try:
                cant_val = float(row[col_map["cantidad"]]) if "cantidad" in col_map and not pd.isna(row[col_map["cantidad"]]) else 1.0
            except Exception:
                cant_val = 1.0

            try:
                pu_raw = str(row[col_map["precio"]]).replace("$", "").replace(" ", "").replace(",", "")
                pu_val = float(pu_raw) if not pd.isna(row[col_map["precio"]]) else 0.0
            except Exception:
                pu_val = 0.0

            match_keys = [w for w in normalizar_texto(act).split() if len(w) > 3]
            items.append({
                "Item": it_val,
                "Capitulo": cap_val,
                "Actividad": act,
                "Unidad": und_val,
                "Cantidad_Contratada": cant_val,
                "Precio_Unitario": pu_val,
                "match_keys": match_keys,
            })

        if not items:
            return None, "No se encontraron filas con datos de actividades válidas."

        return items, None
    except Exception as e:
        return None, f"Error al procesar el archivo: {str(e)}"
