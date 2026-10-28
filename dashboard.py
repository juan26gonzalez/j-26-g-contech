import streamlit as st
import pandas as pd
import io

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
    st.caption("Plataforma BIM 5D & Control de Obra Civil")
    st.divider()
    
    st.markdown("### 📋 Ficha del Proyecto")
    st.markdown("**Obra:** Mejoramiento de Habitación / Modelo BIM")
    st.markdown("**Ing. Residente:** Ing. Juan")
    st.markdown("**Estado:** 🟢 En ejecución")
    st.divider()
    
    st.markdown("### 🏢 1. Presupuesto Base (BIM)")
    archivo_bim = st.file_uploader("Sube Cantidades de Revit (Opcional)", type=["csv"], key="bim")
    
    st.markdown("### 📂 2. Avance de Campo")
    archivo_subido = st.file_uploader("Sube la Bitácora Diaria (CSV)", type=["csv"], key="obra")
    
    st.divider()
    st.caption("© 2026 JG ConTech - Todos los derechos reservados.")

# ==============================================================================
# 3. ENCABEZADO PRINCIPAL
# ==============================================================================
st.title("📊 Centro de Mando Financiero y Avance Físico (BIM 5D)")
st.markdown("Integración automatizada entre cantidades extraídas de **Autodesk Revit** y bitácoras de ejecución en campo.")

# ==============================================================================
# 4. DATOS MAESTROS (Lectura de Revit o Presupuesto por Defecto)
# ==============================================================================
if archivo_bim is not None:
    df_presupuesto = pd.read_csv(archivo_bim)
    # Si el CSV de Revit trae columna 'Unidad', la quitamos aquí para no duplicarla en el cruce
    if 'Unidad' in df_presupuesto.columns:
        df_presupuesto = df_presupuesto.drop(columns=['Unidad'])
    st.success("✅ **Conexión BIM Activa:** Presupuesto actualizado directamente con las cantidades del modelo 3D de Autodesk Revit.")
else:
    datos_presupuesto = {
        "Actividad": [
            "Construcción de plantilla de concreto",
            "Instalación de piso cerámico",
            "Pintura vinílica en muros",
            "Instalación de guardaescobas"
        ],
        "Cantidad_Contratada": [5.00, 25.00, 80.00, 20.00],
        "Precio_Unitario": [450000, 55000, 15000, 12000]
    }
    df_presupuesto = pd.DataFrame(datos_presupuesto)

# ==============================================================================
# 5. MOTOR MATEMÁTICO Y VISUALIZACIÓN
# ==============================================================================
if archivo_subido is not None:
    df_obra = pd.read_csv(archivo_subido)
    resumen_ejecutado = df_obra.groupby(['Actividad', 'Unidad'])['Cantidad'].sum().reset_index()
    resumen_ejecutado = resumen_ejecutado.rename(columns={'Cantidad': 'Cantidad_Ejecutada'})

    # Cruce de bases de datos (Presupuesto BIM vs Realidad en Obra)
    informe_total = pd.merge(df_presupuesto, resumen_ejecutado, on='Actividad', how='left')
    informe_total['Cantidad_Ejecutada'] = informe_total['Cantidad_Ejecutada'].fillna(0)

    # Cálculos financieros
    informe_total['Presupuesto_Total'] = informe_total['Cantidad_Contratada'] * informe_total['Precio_Unitario']
    informe_total['Costo_Ejecutado'] = informe_total['Cantidad_Ejecutada'] * informe_total['Precio_Unitario']
    informe_total['Saldo_Por_Cobrar'] = informe_total['Presupuesto_Total'] - informe_total['Costo_Ejecutado']
    informe_total['Avance_Financiero_%'] = (informe_total['Costo_Ejecutado'] / informe_total['Presupuesto_Total']) * 100
    informe_total['Avance_Financiero_%'] = informe_total['Avance_Financiero_%'].round(2)

    # --- SECCIÓN DE KPIs SIMÉTRICOS ---
    st.markdown("### 1. Resumen Ejecutivo Global")
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

    # --- FILTRO INTERACTIVO GERENCIAL ---
    actividades_disponibles = informe_total['Actividad'].tolist()
    seleccion = st.multiselect(
        "🔍 Filtrar ítems de obra específicos:",
        options=actividades_disponibles,
        default=actividades_disponibles
    )
    
    df_filtrado = informe_total[informe_total['Actividad'].isin(seleccion)]

    # --- SECCIÓN DE TABLA Y GRÁFICO ---
    col_tabla, col_grafico = st.columns([1.35, 1])

    with col_tabla:
        st.markdown("### 2. Desglose Financiero por Ítem")
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

        buffer = io.BytesIO()
        with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
            df_filtrado.to_excel(writer, index=False, sheet_name='Control Financiero BIM')
        
        st.download_button(
            label="📥 Descargar Informe Oficial BIM en Excel (.xlsx)",
            data=buffer.getvalue(),
            file_name="Control_Financiero_BIM_JG.xlsx",
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )

    with col_grafico:
        st.markdown("### 3. Curva de Avance por Actividad (%)")
        st.bar_chart(data=df_filtrado, x='Actividad', y='Avance_Financiero_%', color="#1a365d")

else:
    st.info("👈 **Bienvenido al Sistema JG ConTech BIM 5D.** Sube el archivo de cantidades de Revit (opcional) y la bitácora de campo en el panel izquierdo para iniciar.")
