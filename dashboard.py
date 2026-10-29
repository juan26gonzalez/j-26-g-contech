import streamlit as st
import pandas as pd
import io
import math

# ==============================================================================
# 1. CONFIGURACIÓN DE LA PÁGINA Y ESTILOS VISUALES (CSS PRO)
# ==============================================================================
st.set_page_config(page_title="JG ConTech | Control de Obra BIM", page_icon="🏗️", layout="wide")

st.markdown("""
    <style>
    div[data-testid="stMetric"] {
        background-color: #f8fafc;
        border: 1px solid #e2e8f0;
        padding: 15px 20px;
        border-radius: 10px;
        border-left: 5px solid #1a365d;
        box-shadow: 0 2px 4px rgba(0,0,0,0.04);
        min-height: 135px;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    div[data-testid="stMetric"]:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(0,0,0,0.08);
    }
    div.stDownloadButton > button {
        background-color: #1a365d;
        color: white;
        border-radius: 8px;
        padding: 10px 24px;
        font-weight: bold;
        border: none;
        width: 100%;
    }
    div.stDownloadButton > button:hover {
        background-color: #2b6cb0;
        color: white;
    }
    </style>
""", unsafe_allow_html=True)

# ==============================================================================
# 2. BARRA LATERAL (Identidad de Marca, Conexión BIM y Bitácora)
# ==============================================================================
with st.sidebar:
    st.markdown("## 🏗️ **JG ConTech**")
    st.caption("Plataforma BIM 5D & Explosión de Insumos")
    st.divider()
    
    st.markdown("### 📋 Ficha del Proyecto")
    st.markdown("**Obra:** Mejoramiento de Habitación / Casa")
    st.markdown("**Ing. Residente:** Ing. Juan")
    st.markdown("**Estado:** 🟢 En ejecución")
    st.divider()
    
    st.markdown("### 🏢 1. Presupuesto Base (BIM)")
    archivo_bim = st.file_uploader("Sube Cantidades de Revit (CSV)", type=["csv"], key="bim")
    
    st.markdown("### 📂 2. Avance de Campo")
    archivo_subido = st.file_uploader("Sube la Bitácora Diaria (CSV)", type=["csv"], key="obra")
    
    st.divider()
    st.caption("© 2026 JG ConTech - Todos los derechos reservados.")

# ==============================================================================
# 3. ENCABEZADO PRINCIPAL
# ==============================================================================
st.title("📊 Centro de Mando Financiero y Almacén (BIM 5D)")
st.markdown("Integración automatizada entre cantidades de **Autodesk Revit**, control presupuestal y explosión de materiales de obra.")

# ==============================================================================
# 4. DATOS MAESTROS (Lectura de Revit o Presupuesto por Defecto)
# ==============================================================================
if archivo_bim is not None:
    df_presupuesto = pd.read_csv(archivo_bim)
    if 'Unidad' in df_presupuesto.columns:
        df_presupuesto = df_presupuesto.drop(columns=['Unidad'])
    st.success("✅ **Conexión BIM Activa:** Cantidades estructurales y arquitectónicas sincronizadas desde Autodesk Revit.")
else:
    datos_presupuesto = {
        "Actividad": [
            "Concreto en zapatas y cimentación",
            "Concreto en columnas estructurales",
            "Concreto en vigas de amarre y aéreas",
            "Construcción de plantilla de concreto",
            "Instalación de piso cerámico",
            "Pintura vinílica en muros",
            "Instalación de guardaescobas"
        ],
        "Cantidad_Contratada": [3.50, 2.80, 3.20, 5.00, 25.00, 80.00, 20.00],
        "Precio_Unitario": [680000, 850000, 790000, 450000, 55000, 15000, 12000]
    }
    df_presupuesto = pd.DataFrame(datos_presupuesto)

# ==============================================================================
# 5. PROCESAMIENTO DE DATOS Y PESTAÑAS INTERACTIVAS
# ==============================================================================
if archivo_subido is not None:
    df_obra = pd.read_csv(archivo_subido)
    resumen_ejecutado = df_obra.groupby(['Actividad', 'Unidad'])['Cantidad'].sum().reset_index()
    resumen_ejecutado = resumen_ejecutado.rename(columns={'Cantidad': 'Cantidad_Ejecutada'})

    informe_total = pd.merge(df_presupuesto, resumen_ejecutado, on='Actividad', how='left')
    informe_total['Cantidad_Ejecutada'] = informe_total['Cantidad_Ejecutada'].fillna(0)

    informe_total['Presupuesto_Total'] = informe_total['Cantidad_Contratada'] * informe_total['Precio_Unitario']
    informe_total['Costo_Ejecutado'] = informe_total['Cantidad_Ejecutada'] * informe_total['Precio_Unitario']
    informe_total['Saldo_Por_Cobrar'] = informe_total['Presupuesto_Total'] - informe_total['Costo_Ejecutado']
    informe_total['Avance_Financiero_%'] = (informe_total['Costo_Ejecutado'] / informe_total['Presupuesto_Total']) * 100
    informe_total['Avance_Financiero_%'] = informe_total['Avance_Financiero_%'].fillna(0).round(2)

    # CREACIÓN DE PESTAÑAS (Finanzas vs Ingeniería de Materiales)
    tab_finanzas, tab_materiales = st.tabs([
        "💰 1. Control Financiero y Avance", 
        "🧱 2. Explosión de Materiales (Almacén)"
    ])

    # --------------------------------------------------------------------------
    # PESTAÑA 1: CONTROL FINANCIERO
    # --------------------------------------------------------------------------
    with tab_finanzas:
        st.markdown("### Resumen Ejecutivo Global")
        col1, col2, col3, col4 = st.columns(4)

        total_ppto = informe_total['Presupuesto_Total'].sum()
        total_ejec = informe_total['Costo_Ejecutado'].sum()
        total_saldo = informe_total['Saldo_Por_Cobrar'].sum()
        avance_global = (total_ejec / total_ppto) * 100 if total_ppto > 0 else 0
        pendiente_global = 100 - avance_global

        col1.metric("💼 Presupuesto Total", f"${total_ppto:,.0f}", "Meta Base / BIM", delta_color="off")
        col2.metric("🔨 Costo Ejecutado", f"${total_ejec:,.0f}", f"{avance_global:.1f}% de la obra")
        col3.metric("⏳ Saldo por Ejecutar", f"${total_saldo:,.0f}", f"-{pendiente_global:.1f}% pendiente", delta_color="off")
        col4.metric("📈 Avance Financiero", f"{avance_global:.1f}%", "En ejecución")

        st.write("")

        actividades_disponibles = informe_total['Actividad'].tolist()
        seleccion = st.multiselect(
            "🔍 Filtrar ítems de obra específicos:",
            options=actividades_disponibles,
            default=actividades_disponibles
        )
        
        df_filtrado = informe_total[informe_total['Actividad'].isin(seleccion)]

        col_tabla, col_grafico = st.columns([1.35, 1])

        with col_tabla:
            st.markdown("### Desglose Financiero por Ítem")
            columnas_gerenciales = ['Actividad', 'Cantidad_Contratada', 'Cantidad_Ejecutada', 'Presupuesto_Total', 'Costo_Ejecutado', 'Saldo_Por_Cobrar', 'Avance_Financiero_%']
            
            st.dataframe(
                df_filtrado[columnas_gerenciales],
                use_container_width=True,
                hide_index=True,
                column_config={
                    "Actividad": st.column_config.TextColumn("Ítem de Obra"),
                    "Cantidad_Contratada": st.column_config.NumberColumn("Cant. BIM", format="%.2f"),
                    "Cantidad_Ejecutada": st.column_config.NumberColumn("Cant. Obra", format="%.2f"),
                    "Presupuesto_Total": st.column_config.NumberColumn("Presupuesto", format="$%,.0f"),
                    "Costo_Ejecutado": st.column_config.NumberColumn("Ejecutado", format="$%,.0f"),
                    "Saldo_Por_Cobrar": st.column_config.NumberColumn("Saldo", format="$%,.0f"),
                    "Avance_Financiero_%": st.column_config.ProgressColumn(
                        "Avance (%)",
                        format="%.1f%%",
                        min_value=0,
                        max_value=100,
                    ),
                }
            )

        with col_grafico:
            st.markdown("### Curva de Avance por Actividad (%)")
            st.bar_chart(data=df_filtrado, x='Actividad', y='Avance_Financiero_%', color="#1a365d")

    # --------------------------------------------------------------------------
    # PESTAÑA 2: EXPLOSIÓN DE MATERIALES (DOSIFICACIÓN DE INGENIERÍA)
    # --------------------------------------------------------------------------
    with tab_materiales:
        st.markdown("### 🧮 Cálculo Automático de Insumos según Cantidades BIM")
        st.caption("Dosificación calculada para Concreto de 3000 PSI (21 MPa), cuantía estructural promedio y rendimientos estándar de acabados.")

        # Control deslizante para factor de desperdicio
        desperdicio_pct = st.slider("⚙️ Porcentaje de desperdicio de materiales a incluir (%):", min_value=0, max_value=15, value=5)
        factor_desp = 1 + (desperdicio_pct / 100)

        # Extraer cantidades contratadas de cada actividad desde el DataFrame
        def obtener_cant(texto_clave):
            filas = informe_total[informe_total['Actividad'].str.contains(texto_clave, case=False, na=False)]
            return filas['Cantidad_Contratada'].sum()

        m3_zapatas = obtener_cant("zapatas")
        m3_columnas = obtener_cant("columnas")
        m3_vigas = obtener_cant("vigas")
        m3_plantilla = obtener_cant("plantilla")
        
        m3_concreto_estructural = m3_zapatas + m3_columnas + m3_vigas
        m3_concreto_total = m3_concreto_estructural + m3_plantilla

        m2_ceramica = obtener_cant("cerámico")
        m2_pintura = obtener_cant("pintura")

        # Fórmulas de Dosificación de Ingeniería Civil
        bultos_cemento = math.ceil(m3_concreto_total * 7.0 * factor_desp) # 7 bultos (50kg) por m³
        arena_m3 = round(m3_concreto_total * 0.56 * factor_desp, 2)       # 0.56 m³ por m³ de concreto
        grava_m3 = round(m3_concreto_total * 0.84 * factor_desp, 2)       # 0.84 m³ por m³ de concreto
        acero_kg = math.ceil(m3_concreto_estructural * 95.0 * factor_desp)# ~95 kg/m³ en estructura

        cajas_ceramica = math.ceil((m2_ceramica * factor_desp) / 1.50)    # Cajas de 1.5 m²
        bultos_pegacor = math.ceil((m2_ceramica * factor_desp) / 5.0)     # Rendimiento 5 m² por bulto de 25kg
        galones_pintura = math.ceil((m2_pintura * factor_desp) / 20.0)    # 20 m² por galón (a 2 manos)

        # Tarjetas de resumen de compras principales
        c_mat1, c_mat2, c_mat3, c_mat4 = st.columns(4)
        c_mat1.metric("🧱 Cemento Gris (50 kg)", f"{bultos_cemento:,} bultos", f"Para {m3_concreto_total:.1f} m³ totales", delta_color="off")
        c_mat2.metric("🏗️ Acero de Refuerzo", f"{acero_kg:,} kg", f"En {m3_concreto_estructural:.1f} m³ estruct.", delta_color="off")
        c_mat3.metric("🔲 Piso Cerámico", f"{cajas_ceramica:,} cajas", f"Cubre {m2_ceramica:.1f} m²", delta_color="off")
        c_mat4.metric("🪣 Pintura Vinílica", f"{galones_pintura:,} galones", f"Para {m2_pintura:.1f} m² (2 manos)", delta_color="off")

        st.write("")

        # Tabla detallada de requisición de almacén
        df_insumos = pd.DataFrame({
            "Insumo / Material": [
                "Cemento Portland Gris (Bulto x 50 kg)",
                "Arena Lavada de Río",
                "Grava / Triturado de 3/4\"",
                "Acero Figurado Corrugado (60,000 PSI)",
                "Cerámica para Piso (Caja x 1.5 m²)",
                "Mortero Adhesivo / Pegacor (Bulto x 25 kg)",
                "Pintura Vinílica Tipo 1 (Galón)"
            ],
            "Unidad de Compra": ["Bultos", "m³", "m³", "Kilogramos (kg)", "Cajas", "Bultos", "Galones"],
            "Cantidad Neta + Desperdicio": [
                bultos_cemento, arena_m3, grava_m3, acero_kg, cajas_ceramica, bultos_pegacor, galones_pintura
            ],
            "Destino en Obra": [
                "Zapatas, Columnas, Vigas y Plantillas",
                "Mezcla total de concretos",
                "Mezcla total de concretos",
                "Refuerzo de Zapatas, Columnas y Vigas",
                "Acabado de pisos interiores",
                "Instalación de piso cerámico",
                "Acabado de muros (2 manos)"
            ]
        })

        st.markdown("### 📦 Lista Oficial de Requisición para Ferretería / Proveedor")
        st.dataframe(df_insumos, use_container_width=True, hide_index=True)

    # --------------------------------------------------------------------------
    # EXPORTACIÓN EXCEL MULTIPESTAÑA (Finanzas + Materiales)
    # --------------------------------------------------------------------------
    st.divider()
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
        df_filtrado.to_excel(writer, index=False, sheet_name='Control Financiero 5D')
        df_insumos.to_excel(writer, index=False, sheet_name='Explosion de Materiales')
    
    st.download_button(
        label="📥 Descargar Informe Completo (Finanzas + Lista de Materiales) en Excel (.xlsx)",
        data=buffer.getvalue(),
        file_name="Reporte_Integral_BIM_JG.xlsx",
        mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )

else:
    st.info("👈 **Bienvenido al Sistema JG ConTech BIM 5D.** Sube el archivo de cantidades de Revit y la bitácora de campo en el panel izquierdo para iniciar.")
