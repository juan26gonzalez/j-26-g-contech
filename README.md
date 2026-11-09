# 🏢 JGM ConTech | Plataforma Gerencial BIM 5D & Control Financiero

![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)
![Streamlit](https://img.shields.io/badge/Streamlit-Cloud-FF4B4B.svg)
![Supabase](https://img.shields.io/badge/Supabase-Realtime_Cloud-3ECF8E.svg)
![Autodesk Revit](https://img.shields.io/badge/Revit_API-2027-0696D7.svg)
![Pandas](https://img.shields.io/badge/Pandas-Data_Analytics-150458.svg)

Plataforma ejecutiva **ConTech (Construction Technology)** de inteligencia gerencial para el control financiero, contractual y físico en proyectos de ingeniería civil y edificación. 

Integrada en tiempo real con la aplicación de campo **JGM ConTech Bitácora** ([jagm2000-jgmcontech-bitacora.vercel.app](https://jagm2000-jgmcontech-bitacora.vercel.app)) y modelos BIM 5D de **Autodesk Revit**.

🔗 **Servidor en Producción (Streamlit Cloud):** [https://jg-contech.streamlit.app/](https://jg-contech.streamlit.app/)

---

## 🏛️ Proyecto Oficial de Operación
* **Obra:** Construcción de Mezzanine 3 Niveles (Estructura Metálica y Concreto).
* **Entidad / Interventoría:** DOLMEN S.A. E.S.P.
* **Contratista Constructor:** INGENDES S.A.S.
* **Ubicación:** Sede Administrativa Barranquilla, Atlántico, Colombia.
* **Presupuesto Oficial Contratado:** **$298,903,920 COP** (20 ítems contractuales APU en 7 capítulos).

---

## 🚀 Arquitectura del Ecosistema Integrado

```
 ┌────────────────────────────────────────┐       ┌────────────────────────────────────────┐
 │   JGM CONTECH • BITÁCORA DE CAMPO      │       │     MODELO BIM 5D (AUTODESK REVIT)     │
 │  (Next.js 14, PWA, GPS Forense, PWA)   │       │   (Cómputos Geométricos de Obra APU)   │
 └───────────────────┬────────────────────┘       └───────────────────┬────────────────────┘
                     │                                                │
                     │  Reportes Diarios (Online / Offline)           │  Cantidades Contractuales
                     ▼                                                ▼
 ┌─────────────────────────────────────────────────────────────────────────────────────────┐
 │                                   SUPABASE CLOUD DB                                     │
 │                          (PostgreSQL / API REST en Tiempo Real)                         │
 └───────────────────────────────────────────┬─────────────────────────────────────────────┘
                                             │
                                             │  Sincronización en Vivo
                                             ▼
 ┌─────────────────────────────────────────────────────────────────────────────────────────┐
 │                   JGM CONTECH • CENTRO DE CONTROL GERENCIAL (BIM 5D)                    │
 │               (Streamlit Cloud • Python • Pandas • OpenPyXL • Bento Grid)               │
 ├─────────────────────────────────────────────────────────────────────────────────────────┤
 │ 1. 🏠 Panel Ejecutivo: KPIs Bento Grid (Presupuesto, Costo Causado, Saldos, Avance %)   │
 │ 2. 💰 Control Financiero 5D: Matriz de cruce inteligente APU con subtotales por capítulo│
 │ 3. 📈 Curva S & Salud de Plazo 4D: Valor Ganado (EVM, PV, EV, AC, SPI, CPI)             │
 │ 4. 🧱 Insumos & Materiales BIM: Explosión paramétrica de consumo teórico vs almacén     │
 │ 5. 📡 Auditoría Bitácora Cloud: Trazabilidad forense con marcas de tiempo Colombia      │
 │ 6. 📥 Exportador Corporativo: Generación en memoria de informes Excel (.xlsx) formales  │
 └─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tecnologías y Dependencias
* **Lenguaje:** Python 3.11+
* **Framework Web:** Streamlit & Inyección CSS3 Corporativa (Bento Grid, Paleta Navy/Slate/Blue/Emerald).
* **Motor de Datos:** Pandas, NumPy, Normalización Unicode para homologación de textos de obra.
* **Base de Datos en Tiempo Real:** Supabase Cloud REST API.
* **Generación de Reportes:** OpenPyXL (libros multi-hoja con estilos institucionales).
* **BIM:** Autodesk Revit 2027, Dynamo Visual Programming.

---

**Desarrollado por:**  
**Ing. Juan González** — *Ingeniero Civil | Desarrollador ConTech & Automatización BIM*  
Barranquilla, Colombia
