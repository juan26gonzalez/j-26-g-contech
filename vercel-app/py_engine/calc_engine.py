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


def _decode_revit_text(raw_bytes):
    """Decodifica archivos exportados de Revit (.txt/.csv) soportando UTF-16 LE/BE, UTF-8 y Latin-1."""
    for enc in ["utf-8-sig", "utf-16", "utf-16-le", "utf-16-be", "latin-1"]:
        try:
            text = raw_bytes.decode(enc)
            if "\x00" not in text and len(text.strip()) > 0:
                return text
        except Exception:
            continue
    return raw_bytes.decode("latin-1", errors="ignore")


def _parse_area_num(raw_val):
    if raw_val is None or (isinstance(raw_val, float) and np.isnan(raw_val)):
        return np.nan
    s = str(raw_val).lower()
    for token in ["m²", "m2", "und", "ml", "m³", "m3", " "]:
        s = s.replace(token, "")
    s = s.strip()
    if not s:
        return np.nan
    if "," in s and "." not in s:
        s = s.replace(",", ".")
    else:
        s = s.replace(",", "")
    try:
        return float(s)
    except Exception:
        return np.nan


def _normalize_revit_room_py(raw_suffix):
    n = " ".join(normalizar_texto(raw_suffix).split())
    if not n:
        return "General / Sin Habitación"
    if n in ("h mom", "mom") or "mama" in n:
        return "Habitación Mamá"
    if "esteban" in n:
        return "Habitación Esteban"
    if "nan" in n:
        return "Habitación Nan & I"
    if "abuelo" in n:
        return "Habitación Abuelos"
    if "lisbeth" in n:
        return "Habitación Lisbeth"
    if "huesped" in n:
        return "Habitación Huésped"
    if "sala" in n:
        return "Sala"
    if "cocina" in n:
        return "Cocina"
    if "bano 1" in n or n == "bano":
        return "Baño 1"
    if "puerta 1" in n or "entrada 1" in n:
        return "Entrada / Puerta 1"
    if "puerta 2" in n or "entrada 2" in n:
        return "Entrada / Puerta 2"
    return " ".join(w.capitalize() for w in str(raw_suffix).strip().split())


def _classify_revit_row_py(raw_comment, raw_family=""):
    c_norm = normalizar_texto(raw_comment)
    f_norm = normalizar_texto(raw_family)
    combined = f"{f_norm} {c_norm}"

    is_wall_tile = (
        any(w in combined for w in ["pared", "muro", "azulejo", "salpicadero", "backsplash", "wall", "ceramica"])
        and any(t in combined for t in ["enchape", "ceramica", "porcelanato", "azulejo", "revestimiento", "salpicadero", "tile"])
        and "piso" not in c_norm
    )

    act_key = "otro"
    act_label = str(raw_family).strip() or "Actividad BIM Revit"
    if "plantilla" in combined or "solado" in combined:
        act_key = "plantilla"
        act_label = "Plantilla de concreto 7cm"
    elif is_wall_tile:
        act_key = "enchape_pared"
        act_label = "Enchape pared cerámica / porcelanato"
    elif "enchape" in combined or "porcelanato" in combined or "piso " in combined:
        act_key = "enchape"
        act_label = "Enchape piso porcelanato baño 51x51" if "bano" in combined else "Enchape piso porcelanato 51x51"
    elif "cielo raso" in combined or "cielorraso" in combined or "ceiling" in combined:
        act_key = "cielorraso"
        act_label = "Cielo raso"
    elif "mamposteria" in combined or "bloque" in combined or "muro" in combined:
        act_key = "mamposteria"
        act_label = "Muros mampostería bloque No. 12"
    elif "panete" in combined or "revoco" in combined:
        act_key = "panete"
        act_label = "Pañete y mortero de revoco"
    elif "estuco" in combined or "pintura" in combined:
        act_key = "pintura"
        act_label = "Estuco y pintura vinílica"
    elif "cubierta" in combined or "eternit" in combined or "teja" in combined:
        act_key = "cubierta"
        act_label = "Cubierta teja Eternit"
    elif "ventana" in combined or "puerta" in combined:
        act_key = "carpinteria"
        act_label = "Ventanería aluminio y vidrio" if "ventana" in combined else "Puertas interiores y acceso"

    prefixes = [
        "plantilla de concreto 7cm",
        "plantilla de concreto 7 cm",
        "plantilla de concreto",
        "enchape de pared",
        "enchape pared",
        "enchape de muro",
        "enchape muro",
        "ceramica pared",
        "azulejo",
        "enchape piso",
        "enchape",
        "cielorraso",
        "cielo raso",
        "mamposteria bloque",
        "muros",
        "muro",
        "panete",
        "pintura",
    ]
    cleaned_suffix = str(raw_comment).strip()
    low = normalizar_texto(cleaned_suffix)
    for pref in prefixes:
        if low.startswith(pref):
            cleaned_suffix = cleaned_suffix[len(pref):].strip()
            break

    room = _normalize_revit_room_py(cleaned_suffix or raw_comment)
    return act_key, act_label, room


def procesar_tabla_revit_bytes(filename, raw_bytes):
    """Parsea Schedules nativos de Revit (.txt tabulado, .csv o .xlsx) desmenuzados por Comments/Habitación usando Pandas."""
    try:
        name = str(filename or "").lower()
        if name.endswith(".xlsx") or name.endswith(".xls"):
            df_raw = pd.read_excel(io.BytesIO(raw_bytes), header=None, dtype=str)
        else:
            text = _decode_revit_text(raw_bytes)
            lines = [ln.rstrip("\r\n") for ln in text.splitlines() if ln.strip()]
            if not lines:
                return None, "El archivo de Revit está vacío."
            sep = "\t"
            for probe in lines[:8]:
                if "\t" in probe:
                    sep = "\t"
                    break
                if ";" in probe:
                    sep = ";"
                    break
                if "," in probe:
                    sep = ","
                    break
            rows = [[c.strip().strip('"') for c in ln.split(sep)] for ln in lines]
            df_raw = pd.DataFrame(rows)

        header_idx = None
        col_comment = None
        col_area = None
        col_family = None

        for i in range(min(len(df_raw), 18)):
            row_vals = [normalizar_texto(str(v or "")) for v in df_raw.iloc[i].tolist()]
            if len(row_vals) == 1 and row_vals[0].startswith("<"):
                continue
            c_idx = next((idx for idx, v in enumerate(row_vals) if any(k in v for k in ["comments", "comentarios", "hubicacion", "ubicacion", "habitacion", "zona", "frente"])), None)
            a_idx = next((idx for idx, v in enumerate(row_vals) if any(k in v for k in ["area", "cantidad", "metrado", "count", "cant"])), None)
            if c_idx is not None and a_idx is not None:
                header_idx = i
                col_comment = c_idx
                col_area = a_idx
                col_family = next((idx for idx, v in enumerate(row_vals) if any(k in v for k in ["family and type", "familia y tipo", "floor assembly", "material: name", "material: descripcion", "type", "tipo", "actividad"])), None)
                break

        if header_idx is None:
            return None, "No se detectaron columnas válidas de Revit (ej. Comments / Hubicación y Área)."

        df_body = df_raw.iloc[header_idx + 1:].copy()
        records = []
        for _, row in df_body.iterrows():
            comment = str(row.iloc[col_comment] if col_comment < len(row) else "").strip()
            if not comment or comment.lower() in ("nan", "none"):
                continue
            c_norm = normalizar_texto(comment)
            if c_norm.startswith("grand total") or c_norm.startswith("total ") or c_norm in ("comments", "hubicacion", "ubicacion"):
                continue
            if ":" in comment and comment.split(":")[-1].strip().isdigit():
                continue

            area_raw = row.iloc[col_area] if col_area < len(row) else ""
            area_val = _parse_area_num(area_raw)
            if np.isnan(area_val) or area_val <= 0:
                continue

            family_val = str(row.iloc[col_family]).strip() if col_family is not None and col_family < len(row) and str(row.iloc[col_family]).lower() != "nan" else ""
            act_key, act_label, room = _classify_revit_row_py(comment, family_val)
            slug_room = "".join(ch if ch.isalnum() else "-" for ch in normalizar_texto(room)).strip("-") or "zona"
            records.append({
                "id": f"{slug_room}-{act_key}",
                "room": room,
                "activityKey": act_key,
                "activityLabel": act_label,
                "sourceComment": comment,
                "unit": "und" if act_key == "carpinteria" else "m²",
                "quantity": float(area_val),
            })

        if not records:
            return None, "No se encontraron filas con áreas válidas mayores a cero."

        df_agg = pd.DataFrame(records)
        grouped = df_agg.groupby(["id", "room", "activityKey", "activityLabel", "unit"], as_index=False).agg({
            "quantity": "sum",
            "sourceComment": "first",
        })
        grouped["quantity"] = grouped["quantity"].round(2)
        return grouped.to_dict(orient="records"), None
    except Exception as e:
        return None, f"Error leyendo tabla Revit: {str(e)}"


def _parse_msp_date_py(val):
    """Convierte fechas exportadas por MS Project (incl. días de la semana en español o datetime) a YYYY-MM-DD."""
    import re
    if val is None:
        return None
    s = str(val).strip()
    if not s or s.lower() in ("nan", "nat", "none", "-"):
        return None
    # Remover prefijos de día en español/inglés: "jue 15/10/26", "mon 2026-10-15"
    s = re.sub(r"^[a-záéíóú]+\.?\s+", "", s, flags=re.IGNORECASE).strip()
    dt = pd.to_datetime(s, dayfirst=True, errors="coerce")
    if pd.isna(dt):
        dt = pd.to_datetime(s, errors="coerce")
    if pd.isna(dt):
        return None
    return dt.strftime("%Y-%m-%d")


def _parse_msp_duration_days_py(val, start_iso, end_iso):
    import re
    s = str(val or "").strip().lower()
    m = re.search(r"(\d+(?:[.,]\d+)?)\s*(d|dia|días|dias|day|days|h|hr|hrs|sem|wk)", s)
    if m:
        num = float(m.group(1).replace(",", "."))
        unit = m.group(2)
        if unit.startswith("h"):
            return max(0, round(num / 8.0))
        if unit.startswith(("sem", "wk")):
            return max(1, round(num * 7))
        return max(0, round(num))
    if start_iso and end_iso:
        try:
            d1 = pd.Timestamp(start_iso)
            d2 = pd.Timestamp(end_iso)
            return max(0, int((d2 - d1).days))
        except Exception:
            pass
    return 1


def procesar_msproject_excel_bytes(filename, raw_bytes):
    """Lee cronogramas de MS Project exportados a Excel (.xlsx/.xls) o CSV."""
    try:
        name = str(filename or "").lower()
        if name.endswith(".xlsx") or name.endswith(".xls"):
            df_raw = pd.read_excel(io.BytesIO(raw_bytes), header=None, dtype=str)
        else:
            text = _decode_revit_text(raw_bytes)
            lines = [ln for ln in text.splitlines() if ln.strip()]
            sep = ";" if any(";" in ln for ln in lines[:5]) else ("\t" if any("\t" in ln for ln in lines[:5]) else ",")
            df_raw = pd.read_csv(io.StringIO(text), sep=sep, header=None, dtype=str)

        header_idx = None
        cols_norm = []
        for i in range(min(len(df_raw), 15)):
            row_vals = [normalizar_texto(str(v or "")) for v in df_raw.iloc[i].tolist()]
            has_name = any(k in v for v in row_vals for k in ["nombre", "task name", "actividad", "name", "tarea"])
            has_start = any(k in v for v in row_vals for k in ["comienzo", "inicio", "start"])
            if has_name and has_start:
                header_idx = i
                cols_norm = row_vals
                break

        if header_idx is None:
            return None, "No se detectaron columnas de MS Project (ej. Nombre, Comienzo/Inicio, Fin)."

        df = df_raw.iloc[header_idx + 1:].copy()
        df.columns = cols_norm[: len(df.columns)]

        def find_col(patterns):
            for c in df.columns:
                if any(p in c for p in patterns):
                    return c
            return None

        c_name = find_col(["nombre", "task name", "actividad", "name", "tarea"])
        c_start = find_col(["comienzo", "inicio", "start"])
        c_end = find_col(["fin", "finish", "termino"])
        c_wbs = find_col(["edt", "wbs", "esquema"])
        c_dur = find_col(["duracion", "duration"])
        c_pred = find_col(["predecesora", "predecessor"])
        c_crit = find_col(["critica", "critical"])
        c_pct = find_col(["% completado", "% completo", "completado", "percent", "avance"])
        c_resp = find_col(["recurso", "resource", "responsable"])
        c_id = find_col(["id", "uid"])

        tasks = []
        for idx, row in df.iterrows():
            nombre = str(row.get(c_name, "") or "").strip()
            if not nombre or nombre.lower() in ("nan", "none"):
                continue
            inicio = _parse_msp_date_py(row.get(c_start)) if c_start else None
            fin = _parse_msp_date_py(row.get(c_end)) if c_end else inicio
            if not inicio:
                continue
            if not fin:
                fin = inicio

            dur = _parse_msp_duration_days_py(row.get(c_dur), inicio, fin) if c_dur else _parse_msp_duration_days_py("", inicio, fin)
            wbs = str(row.get(c_wbs, "") or "").strip() if c_wbs else ""
            if not wbs or wbs.lower() == "nan":
                wbs = str(len(tasks) + 1)

            raw_id = str(row.get(c_id, "") or "").strip() if c_id else ""
            tid = raw_id if raw_id and raw_id.lower() != "nan" else str(len(tasks) + 1)

            pred_raw = str(row.get(c_pred, "") or "").strip() if c_pred else ""
            preds = []
            if pred_raw and pred_raw.lower() != "nan":
                import re
                preds = [p.strip() for p in re.split(r"[,;\s]+", pred_raw) if p.strip()]

            crit_raw = normalizar_texto(str(row.get(c_crit, "") or "")) if c_crit else ""
            is_crit = crit_raw in ("si", "yes", "true", "1", "s")
            raw_pct_str = str(row.get(c_pct, "0") or "") if c_pct else "0"
            pct_val = _parse_area_num(raw_pct_str.replace("%", "")) if c_pct else 0.0
            if np.isnan(pct_val):
                pct_val = 0.0
            elif "%" not in raw_pct_str and 0 < pct_val < 1:
                pct_val = pct_val * 100.0
            resp = str(row.get(c_resp, "") or "").strip() if c_resp else ""
            if resp.lower() == "nan":
                resp = ""

            tasks.append({
                "id": tid,
                "uid": tid,
                "wbs": wbs,
                "nombre": nombre,
                "inicio": inicio,
                "fin": fin,
                "duracionDias": int(dur),
                "pesoPct": max(1.0, float(dur)),
                "rutaCritica": bool(is_crit),
                "esHito": dur == 0,
                "predecesoras": preds,
                "responsable": resp or "MS Project",
                "pctManual": round(float(pct_val), 1),
            })

        if not tasks:
            return None, "No se encontraron tareas con fechas válidas en el archivo Excel/CSV."

        total_w = sum(t["pesoPct"] for t in tasks if not t.get("esHito")) or 1.0
        for t in tasks:
            if not t.get("esHito"):
                t["pesoPct"] = round((t["pesoPct"] / total_w) * 100.0, 2)
            else:
                t["pesoPct"] = 0.0

        return tasks, None
    except Exception as e:
        return None, f"Error leyendo archivo MS Project: {str(e)}"
