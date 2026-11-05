import streamlit as st
import pandas as pd
import requests
import math
import io
import numpy as np

# ==============================================================================
# 1. CONFIGURACIÓN DE CONEXIÓN A SUPABASE (API REST)
# ==============================================================================
SUPABASE_URL = "https://ktxbonxgrnpzearsgvtc.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0eGJvbnhncm5wemVhcnNndnRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMyOTI4MDQsImV4cCI6MjEwODg2ODgwNH0.R_lmgkFXALpkmmqbz4rz5XvzqE6VdakUharpVsv-reY"  

# ==============================================================================
# 2. CONFIGURACIÓN DE LA PÁGINA Y TEMA "BENTO GRID" (MINIMALISTA)
# ==============================================================================
st.set_page_config(page_title="JG ConTech | BIM 5D & 4D", page_icon="🏗️", layout="wide")

st.markdown("""
<style>
.stApp { background-color: #fdfcfb; }
#MainMenu {visibility: hidden;}
footer {visibility: hidden;}
header {background: transparent;}

.bento-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.2rem; margin-bottom: 2rem; margin-top: 1rem; }
.bento-card { background: #ffffff; border-radius: 16px; padding: 1.5rem; box-shadow: 0 4px 20px rgba(109, 76, 65, 0.05); border: 1px solid rgba(139, 90, 43, 0.1); transition: transform 0.2s ease, box-shadow 0.2s ease; }
.bento-card:hover { transform: translateY(-3px); box-shadow: 0 8px 25px rgba(109, 76, 65, 0.08); }
.bento-title { font-size: 0.85rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #8d6e63; margin: 0 0 8px 0; display: flex; align-items: center; gap: 6px; }
.bento-value { font-size: clamp(1.5rem, 2vw, 2rem); font-weight: 800; color: #3e2723; margin: 0; line-height: 1.1; }
.bento-sub { font-size: 0.75rem; color: #a1887f; margin-top: 6px; font-weight: 500; }

.table-wrapper { background: #ffffff; border-radius: 16px; padding: 1rem; box-shadow: 0 4px 20px rgba(109, 76, 65, 0.05); border: 1px solid rgba(139, 90, 43, 0.1); overflow-x: auto; margin-bottom: 2rem; }
.pro-table { width: 100%; border-collapse: collapse; font-family: 'Segoe UI', system-ui, sans-serif; font-size: 0.9rem; }
.pro-table thead tr { border-bottom: 2px solid #efebe9; }
.pro-table th { padding: 12px 10px; text-align: center; font-weight: 700; color: #5d4037; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.03em; }
.pro-table th.left, .pro-table td.left { text-align: left; }
.pro-table td { padding: 12px 10px; text-align: center; border-bottom: 1px solid #f5f5f5; color: #4e342e; font-weight: 500; }
.pro-table tbody tr:hover { background-color: #faf9f8; }

.prog-wrapper { display: flex; align-items: center; justify-content: center; gap: 8px; }
.prog-bg { width: 60px; height: 6px; background-color: #efebe9; border-radius: 999px; overflow: hidden; }
.prog-fill { height: 100%; border-radius: 999px; }

.badge { display: inline-block; padding: 4px 10px; border-radius: 8px; font-size: 0.72rem; font-weight: 700; white-space: nowrap; }
.badge-ok { background-color: #e8f5e9; color: #2e7d32; border: 1px solid #c8e6c9; }
.badge-warn { background-color: #fff8e1; color: #f57f17; border: 1px solid #ffecb3; }
.badge-alert { background-color: #ffebee; color: #c62828; border: 1px solid #ffcdd2; }
.badge-idle { background-color: #f5f5f5; color: #757575; border: 1px solid #e0e0e0; }
</style>
""", unsafe_allow_html=True)

# ==============================================================================
# 3. EXTRACCIÓN Y PREPARACIÓN DE DATOS
# ==============================================================================
@st.cache_data(ttl=60)
def obtener_datos_nube():
    headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}
    try:
        req = requests.get(f"{SUPABASE_URL}/rest/v1/bitacora_obra?select=*", headers=headers)
        req.raise_for_status()
        return pd.DataFrame(req.json()) if req.json() else pd.DataFrame()
    except:
        return pd.DataFrame()

df_obra = obtener_datos_nube()

# ==============================================================================
# 4. MENÚ LATERAL (SIDEBAR)
# ==============================================================================
with st.sidebar:
    st.markdown("<h2 style='color: #3e2723; margin-bottom: 0;'>🏗️ JG ConTech</h2>", unsafe_allow_html=True)
    st.markdown("<p style='color: #8d6e63; font-size: 0.85rem; margin-top: 0;'>OS de Gestión de Obra</p>", unsafe_allow_html=True)
    st.markdown("---")
    
    st.markdown("<p style='color: #5d4037; font-weight: 700; font-size: 0.8rem; text-transform: uppercase;'>Navegación</p>", unsafe_allow_html=True)
    menu = st.radio(
        "Módulos:",
        ["🏠 Panel Principal", "💰 Control 5D (Costos)", "📅 Control 4D (Tiempo)", "🧱 Almacén e Insumos", "📋 Bitácora Cloud"],
        label_visibility="collapsed"
    )
    st.markdown("---")
    
    with st.expander("⚙️ Archivos Base (BIM/Project)"):
        st.caption("Presupuesto (Revit CSV)")
        archivo_bim = st.file_uploader("Sube BIM", type=["csv"], key="bim", label_visibility="collapsed")
        st.caption("Cronograma (Project CSV)")
        archivo_cronograma = st.file_uploader("Sube 4D", type=["csv"], key="crono", label_visibility="collapsed")
    
    if st.button("🔄 Sincronizar Nube", use_container_width=True):
        st.cache_data.clear()
        st.rerun()

# ------------------------------------------------------------------------------
# PROCESAMIENTO CENTRAL
# ------------------------------------------------------------------------------
# NUEVA LÍNEA BASE (Casa Modificada)
if archivo_bim is not None:
    df_presupuesto = pd.read_csv(archivo_bim).drop(columns=['Unidad'], errors='ignore')
else:
    df_presupuesto = pd.DataFrame({
        "Actividad": [
            "Construcción de plantilla de concreto", 
            "Muros en mampostería de bloques de concreto", 
            "Pañete y mortero de revoco en muros", 
            "Estuco y pintura vinílica en muros", 
            "Instalación de piso cerámico / enchape", 
            "Instalación de cielo raso", 
            "Instalación de puertas y ventanas", 
            "Montaje de cubierta en Eternit"
        ],
        "Cantidad_Contratada": [15.00, 120.00, 240.00, 240.00, 80.00, 80.00, 8.00, 90.00],
        "Precio_Unitario": [450000, 65000, 25000, 18000, 55000, 45000, 350000, 60000]
    })

if archivo_cronograma is not None:
    df_cronograma = pd.read_csv(archivo_cronograma)
else:
    df_cronograma = pd.DataFrame({
        "Actividad": df_presupuesto["Actividad"], 
        "Fecha_Inicio": ["01/11/2026"] * 8, 
        "Fecha_Fin": ["15/11/2026"] * 8
    })

if not df_obra.empty:
    res_ejec = df_obra.groupby(['actividad'])['cantidad'].sum().reset_index().rename(columns={'cantidad': 'Cantidad_Ejecutada', 'actividad': 'Actividad'})
    inf_tot = pd.merge(df_presupuesto, res_ejec, on='Actividad', how='left').merge(df_cronograma, on='Actividad', how='left')
    
    inf_tot['Cantidad_Ejecutada'] = inf_tot['Cantidad_Ejecutada'].fillna(0)
    inf_tot['Presupuesto_Total'] = inf_tot['Cantidad_Contratada'] * inf_tot['Precio_Unitario']
    inf_tot['Costo_Ejecutado'] = inf_tot['Cantidad_Ejecutada'] * inf_tot['Precio_Unitario']
    inf_tot['Avance_5D_%'] = (inf_tot['Costo_Ejecutado'] / inf_tot['Presupuesto_Total'].replace(0, np.nan) * 100).fillna(0).round(1)

    # Lógica 4D
    inf_tot['Fecha_Inicio'] = pd.to_datetime(inf_tot['Fecha_Inicio'], format='%d/%m/%Y', errors='coerce')
    inf_tot['Fecha_Fin'] = pd.to_datetime(inf_tot['Fecha_Fin'], format='%d/%m/%Y', errors='coerce')
    hoy = pd.Timestamp.now().normalize()
    inf_tot['Duracion'] = (inf_tot['Fecha_Fin'] - inf_tot['Fecha_Inicio']).dt.days + 1
    inf_tot['Dias_Trans'] = (hoy - inf_tot['Fecha_Inicio']).dt.days
    inf_tot['Avance_4D_%'] = (inf_tot['Dias_Trans'] / inf_tot['Duracion'] * 100).clip(lower=0, upper=100).fillna(0)
    inf_tot['SPI'] = np.where(inf_tot['Avance_4D_%'] > 0, inf_tot['Avance_5D_%'] / inf_tot['Avance_4D_%'], np.where(inf_tot['Avance_5D_%'] > 0, 1.0, 0.0))

    t_ppto = inf_tot['Presupuesto_Total'].sum()
    t_ejec = inf_tot['Costo_Ejecutado'].sum()
    a_glob = (t_ejec / t_ppto * 100) if t_ppto > 0 else 0
    spi_g = inf_tot[inf_tot['Avance_4D_%'] > 0]['SPI'].mean()
    if pd.isna(spi_g): spi_g = 1.0

    # ==============================================================================
    # 5. RENDERIZADO DE VISTAS (ENRUTADOR)
    # ==============================================================================
    st.markdown(f"<h3 style='color: #3e2723; margin-top: -20px; margin-bottom: 5px;'>{menu}</h3>", unsafe_allow_html=True)

    if menu == "🏠 Panel Principal":
        estado_spi = "🟢 Óptimo" if spi_g >= 0.95 else ("🟡 Riesgo" if spi_g >= 0.85 else "🔴 Crítico")
        st.markdown(f"""
        <div class="bento-grid">
            <div class="bento-card"><p class="bento-title">📈 Avance Financiero</p><p class="bento-value">{a_glob:.1f}%</p><p class="bento-sub">Desempeño global (5D)</p></div>
            <div class="bento-card"><p class="bento-title">⏱️ Salud Cronograma</p><p class="bento-value">{estado_spi}</p><p class="bento-sub">Índice SPI: {spi_g:.2f}</p></div>
            <div class="bento-card"><p class="bento-title">💵 Ejecución Real</p><p class="bento-value">${t_ejec:,.0f}</p><p class="bento-sub">De ${t_ppto:,.0f} base</p></div>
            <div class="bento-card"><p class="bento-title">📡 Registros de Campo</p><p class="bento-value">{len(df_obra)}</p><p class="bento-sub">Sincronizados en la nube</p></div>
        </div>
        """, unsafe_allow_html=True)

    elif menu == "💰 Control 5D (Costos)":
        filas = "".join([f"<tr><td class='left'><strong>{r['Actividad']}</strong></td><td>{r['Cantidad_Contratada']:,.2f}</td><td><strong>{r['Cantidad_Ejecutada']:,.2f}</strong></td><td>${r['Presupuesto_Total']:,.0f}</td><td><strong>${r['Costo_Ejecutado']:,.0f}</strong></td><td><div class='prog-wrapper'><div class='prog-bg'><div class='prog-fill' style='width:{min(r['Avance_5D_%'], 100)}%; background-color:#66bb6a;'></div></div><span>{r['Avance_5D_%']:.1f}%</span></div></td><td>-</td></tr>" for _, r in inf_tot.iterrows()])
        st.markdown(f'<div class="table-wrapper"><table class="pro-table"><thead><tr><th class="left">Actividad</th><th>Contratada</th><th>Ejecutada</th><th>Presupuesto Base</th><th>Costo Real</th><th>Avance</th><th>Auditoría</th></tr></thead><tbody>{filas}</tbody></table></div>', unsafe_allow_html=True)

    elif menu == "📅 Control 4D (Tiempo)":
        filas = "".join([f"<tr><td class='left'><strong>{r['Actividad']}</strong></td><td>{r['Fecha_Inicio'].strftime('%d/%m/%y') if pd.notnull(r['Fecha_Inicio']) else '-'}</td><td>{r['Fecha_Fin'].strftime('%d/%m/%y') if pd.notnull(r['Fecha_Fin']) else '-'}</td><td>{r['Avance_4D_%']:.1f}%</td><td><strong>{r['Avance_5D_%']:.1f}%</strong></td><td>{r['SPI']:.2f}</td><td>-</td></tr>" for _, r in inf_tot.iterrows()])
        st.markdown(f'<div class="table-wrapper"><table class="pro-table"><thead><tr><th class="left">Actividad (Ruta)</th><th>Inicio (Plan)</th><th>Fin (Plan)</th><th>Meta Hoy</th><th>Avance Real</th><th>SPI</th><th>Estado 4D</th></tr></thead><tbody>{filas}</tbody></table></div>', unsafe_allow_html=True)

    elif menu == "🧱 Almacén e Insumos":
        mat_data = []
        for _, r in inf_tot.iterrows():
            act, c = r['Actividad'].lower(), r['Cantidad_Ejecutada']
            if c > 0:
                if "plantilla" in act:
                    mat_data.extend([{'a': r['Actividad'], 'i': 'Cemento Gris (Bultos 50kg)', 'f': 7.0, 't': c*7}, {'a': r['Actividad'], 'i': 'Arena Lavada (m³)', 'f': 0.56, 't': c*0.56}, {'a': r['Actividad'], 'i': 'Triturado 3/4" (m³)', 'f': 0.84, 't': c*0.84}])
                elif "bloques" in act:
                    mat_data.extend([{'a': r['Actividad'], 'i': 'Bloque de Concreto (Und)', 'f': 12.5, 't': c*12.5}, {'a': r['Actividad'], 'i': 'Cemento Gris de Pega (Bultos)', 'f': 0.15, 't': c*0.15}, {'a': r['Actividad'], 'i': 'Arena de Pega (m³)', 'f': 0.02, 't': c*0.02}])
                elif "pañete" in act:
                    mat_data.extend([{'a': r['Actividad'], 'i': 'Cemento Gris (Bultos 50kg)', 'f': 0.20, 't': c*0.20}, {'a': r['Actividad'], 'i': 'Arena Fina (m³)', 'f': 0.025, 't': c*0.025}])
                elif "estuco" in act:
                    mat_data.extend([{'a': r['Actividad'], 'i': 'Pintura Vinílica (Gal)', 'f': 0.15, 't': c*0.15}, {'a': r['Actividad'], 'i': 'Estuco Plástico (Kg)', 'f': 1.20, 't': c*1.2}])
                elif "piso" in act or "enchape" in act:
                    mat_data.extend([{'a': r['Actividad'], 'i': 'Pegacor Gris (Bultos 25kg)', 'f': 0.25, 't': c*0.25}, {'a': r['Actividad'], 'i': 'Piso Cerámico/Enchape (m²)', 'f': 1.05, 't': c*1.05}])
                elif "cielo raso" in act:
                    mat_data.extend([{'a': r['Actividad'], 'i': 'Láminas Cielo Raso (m²)', 'f': 1.10, 't': c*1.1}, {'a': r['Actividad'], 'i': 'Perfilería (ml)', 'f': 3.0, 't': c*3.0}])
                elif "cubierta" in act:
                    mat_data.extend([{'a': r['Actividad'], 'i': 'Teja Eternit (Und)', 'f': 1.15, 't': c*1.15}, {'a': r['Actividad'], 'i': 'Ganchos/Amarres (Und)', 'f': 3.0, 't': c*3.0}])

        if mat_data:
            filas = "".join([f"<tr><td class='left'>{m['a']}</td><td class='left'><strong>{m['i']}</strong></td><td>{m['f']:.3f}</td><td><strong>{m['t']:.2f}</strong></td></tr>" for m in mat_data])
            st.markdown(f'<div class="table-wrapper"><table class="pro-table"><thead><tr><th class="left">Actividad Origen</th><th class="left">Material Requerido</th><th>Factor</th><th>Total Consumido</th></tr></thead><tbody>{filas}</tbody></table></div>', unsafe_allow_html=True)
        else:
            st.info("Sin registros físicos para calcular insumos.")

    elif menu == "📋 Bitácora Cloud":
        df_m = df_obra.copy()
        df_m['dt'] = pd.to_datetime(df_m['created_at'], utc=True).dt.tz_convert('America/Bogota')
        df_m = df_m.sort_values(by='dt', ascending=False)
        filas = "".join([f"<tr><td><span class='badge badge-idle'>{r['dt'].strftime('%d/%m %I:%M %p')}</span></td><td class='left'><strong>{r['actividad']}</strong></td><td>{r['unidad']}</td><td><strong>{r['cantidad']:.2f}</strong></td></tr>" for _, r in df_m.iterrows()])
        st.markdown(f'<div class="table-wrapper"><table class="pro-table"><thead><tr><th>Sincronización (COL)</th><th class="left">Actividad Reportada</th><th>Unidad</th><th>Cant. Real</th></tr></thead><tbody>{filas}</tbody></table></div>', unsafe_allow_html=True)

else:
    st.info("📡 Conectando a Supabase... Esperando datos.")
