import streamlit as st
import pandas as pd
import requests
import math
import io

# ==============================================================================
# 1. CONFIGURACIÓN DE CONEXIÓN A SUPABASE (API REST)
# ==============================================================================
SUPABASE_URL = "https://ktxbonxgrnpzearsgvtc.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0eGJvbnhncm5wemVhcnNndnRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMyOTI4MDQsImV4cCI6MjEwODg2ODgwNH0.R_lmgkFXALpkmmqbz4rz5XvzqE6VdakUharpVsv-reY"

# ==============================================================================
# 2. CONFIGURACIÓN DE LA PÁGINA Y ESTILOS CORPORATIVOS (UI/UX PRO)
# ==============================================================================
st.set_page_config(page_title="JG ConTech | Control de Obra BIM", page_icon="🏗️", layout="wide")

st.markdown("""
<style>
/* Contenedor de Tarjetas KPI Responsivas (Nunca corta los números con ...) */
.kpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
    gap: 16px;
    margin-bottom: 24px;
}
.kpi-card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-left: 5px solid #10b981;
    border-radius: 12px;
    padding: 16px 18px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
}
.kpi-card.blue { border-left-color: #2563eb; }
.kpi-card.amber { border-left-color: #f59e0b; }
.kpi-card.purple { border-left-color: #8b5cf6; }
.kpi-title {
    font-size: 0.82rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #64748b;
    margin: 0 0 6px 0;
}
.kpi-value {
    font-size: clamp(1.25rem, 1.8vw, 1.65rem);
    font-weight: 800;
    color: #0f172a;
    margin: 0;
    white-space: nowrap;
}
.kpi-sub {
    font-size: 0.75rem;
    color: #94a3b8;
    margin-top: 4px;
}

/* Tabla Directiva Pro con Números Centrados */
.table-container {
    overflow-x: auto;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.04);
    margin-bottom: 20px;
}
.pro-table {
    width: 100%;
    border-collapse: collapse;
    font-family: 'Segoe UI', Roboto, Helvetica, sans-serif;
    font-size: 0.9rem;
    background-color: #ffffff;
}
.pro-table thead tr {
    background-color: #0f172a;
    color: #ffffff;
    text-transform: uppercase;
    font-size: 0.78rem;
    letter-spacing: 0.05em;
}
.pro-table th {
    padding: 14px 12px;
    text-align: center;
    font-weight: 600;
}
.pro-table th.left, .pro-table td.left {
    text-align: left;
    padding-left: 16px;
}
.pro-table td {
    padding: 12px;
    text-align: center;
    border-bottom: 1px solid #f1f5f9;
    color: #334155;
    font-weight: 500;
}
.pro-table tbody tr:hover {
    background-color: #f8fafc;
}
.pro-table tfoot tr {
    background-color: #f1f5f9;
    font-weight: 800;
    color: #0f172a;
    border-top: 2px solid #cbd5e1;
}

/* Barra de progreso dentro de la celda */
.prog-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
}
.prog-bg {
    width: 70px;
    height: 8px;
    background-color: #e2e8f0;
    border-radius: 999px;
    overflow: hidden;
}
.prog-fill {
    height: 100%;
    border-radius: 999px;
}

/* Insignias de Estado (Semáforo) */
.badge {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 700;
    white-space: nowrap;
}
.badge-ok { background-color: #dcfce7; color: #166534; }
.badge-warn { background-color: #fef3c7; color: #92400e; }
.badge-alert { background-color: #fee2e2; color: #991b1b; }
.badge-idle { background-color: #f1f5f9; color: #475569; }
</style>
""", unsafe_allow_html=True)

# ==============================================================================
# 3. BARRA LATERAL
# ==============================================================================
with st.sidebar:
    st.markdown("## 🏗️ **JG ConTech**")
    st.caption("Plataforma BIM 5D Cloud")
    st.divider()
    st.markdown("### 🏢 1. Presupuesto Base (BIM)")
    archivo_bim = st.file_uploader("Sube Cantidades de Revit (CSV)", type=["csv"], key="bim")
    st.divider()
    st.markdown("### ☁️ 2. Datos de Campo")
    st.success("🟢 Conectado en tiempo real a Supabase (API REST)")
    if st.button("🔄 Refrescar datos de la nube", type="primary", use_container_width=True):
        st.cache_data.clear()
        st.rerun()

st.title("📊 Centro de Mando Financiero y Almacén (BIM 5D Cloud)")

# ==============================================================================
# 4. EXTRACCIÓN DE DATOS DE LA NUBE
# ==============================================================================
@st.cache_data(ttl=60)
def obtener_datos_nube():
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }
    url = f"{SUPABASE_URL}/rest/v1/bitacora_obra?select=*"
    try:
        respuesta = requests.get(url, headers=headers)
        respuesta.raise_for_status()
        datos = respuesta.json()
        return pd.DataFrame(datos) if datos else pd.DataFrame()
    except Exception as e:
        st.error(f"Error de conexión con Supabase: {e}")
        return pd.DataFrame()

df_obra = obtener_datos_nube()

if archivo_bim is not None:
    df_presupuesto = pd.read_csv(archivo_bim)
    if 'Unidad' in df_presupuesto.columns:
        df_presupuesto = df_presupuesto.drop(columns=['Unidad'])
else:
    datos_presupuesto = {
        "Actividad": [
            "Concreto en zapatas y cimentación", "Concreto en columnas estructurales",
            "Concreto en vigas de amarre y aéreas", "Construcción de plantilla de concreto",
            "Instalación de piso cerámico", "Pintura vinílica en muros",
            "Instalación de guardaescobas", "Instalación de puertas interiores y baño",
            "Instalación de aparatos sanitarios y lavaplatos", "Red de tubería hidrosanitaria PVC"
        ],
        "Cantidad_Contratada": [3.50, 2.80, 3.20, 5.00, 25.00, 80.00, 20.00, 4.00, 3.00, 18.00],
        "Precio_Unitario": [680000, 850000, 790000, 450000, 55000, 15000, 12000, 320000, 480000, 35000]
    }
    df_presupuesto = pd.DataFrame(datos_presupuesto)

# ==============================================================================
# 5. MOTOR DE CÁLCULO Y VISUALIZACIÓN EJECUTIVA
# ==============================================================================
if not df_obra.empty:
    resumen_ejecutado = df_obra.groupby(['actividad', 'unidad'])['cantidad'].sum().reset_index()
    resumen_ejecutado = resumen_ejecutado.rename(columns={'cantidad': 'Cantidad_Ejecutada', 'actividad': 'Actividad'})

    informe_total = pd.merge(df_presupuesto, resumen_ejecutado, on='Actividad', how='left')
    informe_total['Cantidad_Ejecutada'] = informe_total['Cantidad_Ejecutada'].fillna(0)
    informe_total['Presupuesto_Total'] = informe_total['Cantidad_Contratada'] * informe_total['Precio_Unitario']
    informe_total['Costo_Ejecutado'] = informe_total['Cantidad_Ejecutada'] * informe_total['Precio_Unitario']
    informe_total['Saldo_Por_Cobrar'] = informe_total['Presupuesto_Total'] - informe_total['Costo_Ejecutado']
    
    # Cálculo seguro de avance
    informe_total['Avance_Financiero_%'] = (
        informe_total['Costo_Ejecutado'] / informe_total['Presupuesto_Total'].replace(0, pd.NA)
    ) * 100
    informe_total['Avance_Financiero_%'] = informe_total['Avance_Financiero_%'].fillna(0).round(1)

    tab_finanzas, tab_materiales, tab_registros = st.tabs([
        "💰 Control Financiero", "🧱 Explosión de Materiales", "📋 Registros en Vivo"
    ])

    # --------------------------------------------------------------------------
    # PESTAÑA 1: CONTROL FINANCIERO PRO
    # --------------------------------------------------------------------------
    with tab_finanzas:
        total_ppto = informe_total['Presupuesto_Total'].sum()
        total_ejec = informe_total['Costo_Ejecutado'].sum()
        total_saldo = informe_total['Saldo_Por_Cobrar'].sum()
        avance_global = (total_ejec / total_ppto) * 100 if total_ppto > 0 else 0

        # 1. Tarjetas KPI con fuente elástica (Sin recortes "...")
        html_kpis = (
            f'<div class="kpi-grid">'
            f'<div class="kpi-card blue"><p class="kpi-title">Presupuesto Base Total</p><p class="kpi-value">${total_ppto:,.0f}</p><p class="kpi-sub">Línea base contractual BIM</p></div>'
            f'<div class="kpi-card"><p class="kpi-title">Costo Real Ejecutado</p><p class="kpi-value">${total_ejec:,.0f}</p><p class="kpi-sub">Valorizado según avance en campo</p></div>'
            f'<div class="kpi-card amber"><p class="kpi-title">Saldo por Ejecutar</p><p class="kpi-value">${total_saldo:,.0f}</p><p class="kpi-sub">Remanente presupuestal</p></div>'
            f'<div class="kpi-card purple"><p class="kpi-title">Avance Financiero Global</p><p class="kpi-value">{avance_global:.1f}%</p><p class="kpi-sub">Ejecutado vs. Contratado</p></div>'
            f'</div>'
        )
        st.markdown(html_kpis, unsafe_allow_html=True)

        # 2. Construcción de la Tabla Directiva con números centrados y semáforo
        filas_html = ""
        for _, row in informe_total.iterrows():
            act = row['Actividad']
            c_cont = row['Cantidad_Contratada']
            c_ejec = row['Cantidad_Ejecutada']
            v_unit = row['Precio_Unitario']
            p_tot = row['Presupuesto_Total']
            c_tot = row['Costo_Ejecutado']
            avance = row['Avance_Financiero_%']

            # Lógica de Semáforo de Control de Obra
            if c_cont == 0 and c_ejec > 0:
                estado_badge = '<span class="badge badge-alert">🔴 Obra Adicional</span>'
                color_barra = "#ef4444"
                ancho_barra = 100
                texto_avance = "N/A (Extra)"
            elif c_ejec > c_cont and c_cont > 0:
                estado_badge = '<span class="badge badge-warn">⚠️ Sobre-ejecución</span>'
                color_barra = "#f59e0b"
                ancho_barra = 100
                texto_avance = f"{avance:.1f}%"
            elif c_ejec == 0:
                estado_badge = '<span class="badge badge-idle">⚪ Sin Iniciar</span>'
                color_barra = "#cbd5e1"
                ancho_barra = 0
                texto_avance = "0.0%"
            elif avance == 100:
                estado_badge = '<span class="badge badge-ok">✅ Completado</span>'
                color_barra = "#10b981"
                ancho_barra = 100
                texto_avance = "100%"
            else:
                estado_badge = '<span class="badge badge-ok">🟢 En Ejecución</span>'
                color_barra = "#10b981"
                ancho_barra = min(avance, 100)
                texto_avance = f"{avance:.1f}%"

            barra_html = (
                f'<div class="prog-wrapper">'
                f'<div class="prog-bg"><div class="prog-fill" style="width:{ancho_barra}%; background-color:{color_barra};"></div></div>'
                f'<span>{texto_avance}</span>'
                f'</div>'
            )

            filas_html += (
                f'<tr>'
                f'<td class="left"><strong>{act}</strong></td>'
                f'<td>{c_cont:,.2f}</td>'
                f'<td><strong>{c_ejec:,.2f}</strong></td>'
                f'<td>${v_unit:,.0f}</td>'
                f'<td>${p_tot:,.0f}</td>'
                f'<td><strong>${c_tot:,.0f}</strong></td>'
                f'<td>{barra_html}</td>'
                f'<td>{estado_badge}</td>'
                f'</tr>'
            )

        tabla_completa = (
            f'<div class="table-container">'
            f'<table class="pro-table">'
            f'<thead><tr>'
            f'<th class="left">Actividad de Obra</th>'
            f'<th>Cant. Contratada</th>'
            f'<th>Cant. Ejecutada</th>'
            f'<th>Vr. Unitario</th>'
            f'<th>Presupuesto Total</th>'
            f'<th>Costo Ejecutado</th>'
            f'<th>Avance</th>'
            f'<th>Estado</th>'
            f'</tr></thead>'
            f'<tbody>{filas_html}</tbody>'
            f'<tfoot><tr>'
            f'<td class="left">TOTALES DEL PROYECTO</td>'
            f'<td>-</td><td>-</td><td>-</td>'
            f'<td>${total_ppto:,.0f}</td>'
            f'<td>${total_ejec:,.0f}</td>'
            f'<td>{avance_global:.1f}%</td>'
            f'<td>-</td>'
            f'</tr></tfoot>'
            f'</table></div>'
        )
        st.markdown(tabla_completa, unsafe_allow_html=True)

        # 3. Botón de descarga de Acta Financiera en Excel
        buffer_excel = io.BytesIO()
        with pd.ExcelWriter(buffer_excel, engine='openpyxl') as writer:
            informe_total.to_excel(writer, index=False, sheet_name='Control_Financiero_5D')
        st.download_button(
            label="📥 Descargar Corte Financiero Oficial (.xlsx)",
            data=buffer_excel.getvalue(),
            file_name="Corte_Financiero_BIM5D.xlsx",
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )

    # --------------------------------------------------------------------------
    # PESTAÑA 2: EXPLOSIÓN DE MATERIALES PRO
    # --------------------------------------------------------------------------
    with tab_materiales:
        st.markdown("### 🧱 Requerimientos de Almacén (Según Cantidades Ejecutadas)")
        
        materiales_data = []
        for _, row in informe_total.iterrows():
            actividad = row['Actividad']
            cant = row['Cantidad_Ejecutada']
            
            if cant > 0:
                if "Concreto" in actividad or "plantilla" in actividad:
                    materiales_data.append({'Actividad': actividad, 'Insumo Requerido': 'Cemento Gris (Bultos 50kg)', 'Factor Unitario': 7.00, 'Total Consumido': cant * 7})
                    materiales_data.append({'Actividad': actividad, 'Insumo Requerido': 'Arena Lavada (m³)', 'Factor Unitario': 0.56, 'Total Consumido': cant * 0.56})
                    materiales_data.append({'Actividad': actividad, 'Insumo Requerido': 'Triturado 3/4" (m³)', 'Factor Unitario': 0.84, 'Total Consumido': cant * 0.84})
                elif "Pintura" in actividad:
                    materiales_data.append({'Actividad': actividad, 'Insumo Requerido': 'Pintura Vinílica Tipo 1 (Galones)', 'Factor Unitario': 0.15, 'Total Consumido': cant * 0.15})
                    materiales_data.append({'Actividad': actividad, 'Insumo Requerido': 'Estuco Plástico (Kg)', 'Factor Unitario': 1.20, 'Total Consumido': cant * 1.2})
                elif "cerámico" in actividad:
                    materiales_data.append({'Actividad': actividad, 'Insumo Requerido': 'Pegacor Gris (Bultos 25kg)', 'Factor Unitario': 0.25, 'Total Consumido': cant * 0.25})
                    materiales_data.append({'Actividad': actividad, 'Insumo Requerido': 'Piso Cerámico (Cajas)', 'Factor Unitario': 1.05, 'Total Consumido': cant * 1.05})
                elif "puertas" in actividad or "sanitarios" in actividad:
                    materiales_data.append({'Actividad': actividad, 'Insumo Requerido': 'Silicona / Sellante Antifúngico (Tubos)', 'Factor Unitario': 0.50, 'Total Consumido': cant * 0.5})

        if materiales_data:
            df_materiales = pd.DataFrame(materiales_data)
            bultos_cemento = df_materiales[df_materiales['Insumo Requerido'].str.contains('Cemento')]['Total Consumido'].sum()
            
            filas_mat = ""
            for _, m in df_materiales.iterrows():
                filas_mat += (
                    f'<tr>'
                    f'<td class="left"><strong>{m["Actividad"]}</strong></td>'
                    f'<td class="left">{m["Insumo Requerido"]}</td>'
                    f'<td>{m["Factor Unitario"]:.2f}</td>'
                    f'<td><strong>{m["Total Consumido"]:.2f}</strong></td>'
                    f'</tr>'
                )
            tabla_mat_html = (
                f'<div class="table-container"><table class="pro-table">'
                f'<thead><tr><th class="left">Actividad Origen</th><th class="left">Insumo / Material de Almacén</th><th>Rendimiento Unitario</th><th>Total Requerido</th></tr></thead>'
                f'<tbody>{filas_mat}</tbody></table></div>'
            )
            st.markdown(tabla_mat_html, unsafe_allow_html=True)

            if bultos_cemento > 0:
                st.info(f"📦 **Consolidado de Cemento en Obra:** Se han requerido **{math.ceil(bultos_cemento)} bultos de 50kg** para las estructuras vaciadas hasta la fecha.")
        else:
            st.info("💡 Aún no hay avance físico registrado para calcular explosión de insumos.")

    # --------------------------------------------------------------------------
    # PESTAÑA 3: REGISTROS EN VIVO PRO
    # --------------------------------------------------------------------------
    with tab_registros:
        st.markdown("### 📡 Bitácora de Campo Sincronizada (Hora Oficial de Colombia)")
        df_mostrar = df_obra.copy()
        df_mostrar['created_at_dt'] = pd.to_datetime(df_mostrar['created_at'], utc=True).dt.tz_convert('America/Bogota')
        df_mostrar = df_mostrar.sort_values(by='created_at_dt', ascending=False)
        df_mostrar['Hora_Colombia'] = df_mostrar['created_at_dt'].dt.strftime('%d/%m/%Y %I:%M %p')

        filas_reg = ""
        for _, r in df_mostrar.iterrows():
            filas_reg += (
                f'<tr>'
                f'<td><span class="badge badge-idle">🕒 {r["Hora_Colombia"]}</span></td>'
                f'<td>{r["fecha"]}</td>'
                f'<td class="left"><strong>{r["actividad"]}</strong></td>'
                f'<td>{r["unidad"]}</td>'
                f'<td><strong>{r["cantidad"]:,.2f}</strong></td>'
                f'<td>{r["desperdicio"]:,.2f}</td>'
                f'</tr>'
            )
        tabla_reg_html = (
            f'<div class="table-container"><table class="pro-table">'
            f'<thead><tr><th>Marca de Tiempo (Servidor)</th><th>Fecha Reporte</th><th class="left">Actividad Ejecutada</th><th>Unidad</th><th>Cant. Neta</th><th>Cant. + Desperdicio (5%)</th></tr></thead>'
            f'<tbody>{filas_reg}</tbody></table></div>'
        )
        st.markdown(tabla_reg_html, unsafe_allow_html=True)

else:
    st.info("📡 Conectado a la base de datos, pero aún no hay registros de obra subidos desde la aplicación web.")
