import io
from datetime import datetime
import pandas as pd
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter


def generar_plantilla_excel_presupuesto():
    """Genera la plantilla Excel estándar para carga masiva de presupuestos base."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Presupuesto_Base"
    headers = ["Item", "Capitulo", "Actividad", "Unidad", "Cantidad", "Precio_Unitario"]
    ws.append(headers)
    sample_data = [
        ["1.1", "1. PRELIMINARES", "Campamento y cerramiento provisional en polisombra", "gl", 1.0, 2500000],
        ["1.2", "1. PRELIMINARES", "Demolición de muros existentes e=0.15", "m2", 45.0, 32000],
        ["2.1", "2. MAMPOSTERIA", "Levante de muro en bloque cemento No. 12", "m2", 120.0, 48000],
        ["2.2", "2. MAMPOSTERIA", "Pañete y revoque interior relación 1:4", "m2", 240.0, 25000],
        ["3.1", "3. PISOS Y ENCHAPES", "Plantilla de concreto simple e=7cm", "m2", 85.0, 34000],
        ["3.2", "3. PISOS Y ENCHAPES", "Instalación de piso porcelanato 60x60", "m2", 85.0, 58000],
        ["4.1", "4. PINTURA", "Estuco plástico y pintura vinílica dos manos", "m2", 240.0, 18000],
    ]
    for row in sample_data:
        ws.append(row)
    for col_idx in range(1, 7):
        cell = ws.cell(row=1, column=col_idx)
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
        cell.alignment = Alignment(horizontal="center")
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf


def generar_acta_corte_excel(
    df_5d_in,
    numero_acta,
    params_liquidacion,
    info_proyecto=None,
    doc_opts=None,
):
    """Genera el acta oficial de cobro contractual en Excel (.xlsx) con soporte ES/EN, unidades y moneda."""
    opts = doc_opts or {}
    lang = str(opts.get("lang", "es")).lower()
    is_en = lang == "en"
    currency = str(opts.get("currency", "COP")).upper()
    if currency not in ("COP", "USD", "EUR"):
        currency = "COP"
    unit_system = str(opts.get("unit_system", "imperial" if is_en else "metric")).lower()
    proy_id = str((info_proyecto or {}).get("id", ""))
    is_demo = bool(opts.get("is_demo", False)) or (proy_id == "demo_showcase")

    df_5d = pd.DataFrame(df_5d_in or [])
    if df_5d.empty:
        df_5d = pd.DataFrame(
            columns=[
                "Item",
                "Capitulo",
                "Actividad",
                "Unidad",
                "Cantidad_Ejecutada",
                "Precio_Unitario",
                "Costo_Ejecutado",
                "Avance_%",
            ]
        )

    if info_proyecto is None:
        info_proyecto = {
            "nombre": "JGM ConTech Showcase Project",
            "ubicacion": "Barranquilla / Miami / Madrid",
            "contratante": "Client / Owner",
            "contratista": "JGM ConTech Engineering Team" if is_demo else "Ingeniería JGM ConTech",
            "firma_residente": (
                "PROJECT DIRECTOR • JGM CONTECH"
                if is_en
                else "DIRECCIÓN DE PROYECTO • JGM CONTECH"
            ),
            "firma_interventor": (
                "OWNER'S REPRESENTATIVE"
                if is_en
                else "INTERVENTOR TÉCNICO DELEGADO"
            ),
        }

    num_fmt_money = (
        '"US$"#,##0.00'
        if currency == "USD"
        else ('"€"#,##0.00' if currency == "EUR" else '"$"#,##0')
    )
    unit_sys_label = (
        "IMPERIAL (ft², yd³, ft, lb)" if unit_system == "imperial" else "METRIC SI (m², m³, ml, kg)"
    )

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = (f"Pay Cert {numero_acta}" if is_en else f"Acta de Corte {numero_acta}")[:31]
    ws.views.sheetView[0].showGridLines = True

    font_title = Font(name="Calibri", size=14, bold=True, color="FFFFFF")
    font_header = Font(name="Calibri", size=9, bold=True, color="FFFFFF")
    font_bold = Font(name="Calibri", size=9, bold=True, color="0F172A")
    font_normal = Font(name="Calibri", size=9, color="1E293B")

    fill_navy = PatternFill(start_color="0F172A", end_color="0F172A", fill_type="solid")
    fill_blue = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
    fill_gray = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")
    fill_highlight = PatternFill(start_color="ECFDF5", end_color="ECFDF5", fill_type="solid")

    border_thin = Border(
        left=Side(style="thin", color="CBD5E1"),
        right=Side(style="thin", color="CBD5E1"),
        top=Side(style="thin", color="CBD5E1"),
        bottom=Side(style="thin", color="CBD5E1"),
    )

    ws.merge_cells("A1:H1")
    t = ws["A1"]
    t.value = (
        f"JGM CONTECH • PROGRESS PAYMENT CERTIFICATE & BILLING NO. {numero_acta}"
        if is_en
        else f"JGM CONTECH • ACTA DE CORTE DE OBRA Y FACTURACIÓN NO. {numero_acta}"
    )
    t.font = font_title
    t.fill = fill_navy
    t.alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[1].height = 35

    proy_nom = str(info_proyecto.get("nombre", "")).upper()
    ubic = str(info_proyecto.get("ubicacion", "")).upper()
    contr = str(info_proyecto.get("contratante", "")).upper()
    contra = str(info_proyecto.get("contratista", "")).upper()
    date_str = datetime.now().strftime("%Y-%m-%d" if is_en else "%d/%m/%Y")

    ws["A2"] = (
        f"PROJECT: {proy_nom} — {ubic}"
        if is_en
        else f"CONTRATO: {proy_nom} - {ubic}"
    )
    ws["A2"].font = font_bold
    ws["A3"] = (
        f"OWNER: {contr} • CONTRACTOR: {contra}"
        if is_en
        else f"CONTRATANTE: {contr} • CONTRATISTA: {contra}"
    )
    ws["A3"].font = font_normal
    ws["A4"] = (
        f"CUTOFF DATE: {date_str} • CURRENCY: {currency} • UNITS: {unit_sys_label} • STATUS: APPROVED FOR BILLING"
        if is_en
        else f"FECHA DE CORTE: {date_str} • MONEDA: {currency} • SISTEMA: {unit_sys_label} • ESTADO: APROBADO PARA FACTURACIÓN"
    )
    ws["A4"].font = font_normal

    headers = (
        ["Item", "WBS Chapter", "Work Activity Description", "Unit", "Period Qty", f"Unit Price ({currency})", f"Earned Value ({currency})", "% Prog."]
        if is_en
        else ["Ítem", "Capítulo", "Actividad Constructiva", "Und", "Cant. Periodo", f"P. Unitario ({currency})", f"Valor Ejecutado ({currency})", "% Avance"]
    )
    for col_idx, h in enumerate(headers, start=1):
        cell = ws.cell(row=6, column=col_idx, value=h)
        cell.font = font_header
        cell.fill = fill_blue
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = border_thin
    ws.row_dimensions[6].height = 24

    r_idx = 7
    cant_col = "Ejecutado_Cant" if "Ejecutado_Cant" in df_5d.columns else "Cantidad_Ejecutada"
    if cant_col not in df_5d.columns:
        df_5d[cant_col] = 0.0
    df_5d[cant_col] = pd.to_numeric(df_5d[cant_col], errors="coerce").fillna(0.0)
    df_5d["Precio_Unitario"] = pd.to_numeric(df_5d.get("Precio_Unitario", 0), errors="coerce").fillna(0.0)
    df_5d["Costo_Ejecutado"] = pd.to_numeric(df_5d.get("Costo_Ejecutado", 0), errors="coerce").fillna(0.0)
    pct_col = "Pct_Avance" if "Pct_Avance" in df_5d.columns else "Avance_%"
    if pct_col not in df_5d.columns:
        df_5d[pct_col] = 0.0
    df_5d[pct_col] = pd.to_numeric(df_5d[pct_col], errors="coerce").fillna(0.0)

    df_ejecutados = df_5d[df_5d[cant_col] > 0]
    for _, r in df_ejecutados.iterrows():
        ws.cell(row=r_idx, column=1, value=r.get("Item", "")).alignment = Alignment(horizontal="center")
        ws.cell(row=r_idx, column=2, value=r.get("Capitulo", ""))
        ws.cell(row=r_idx, column=3, value=r.get("Actividad", ""))
        ws.cell(row=r_idx, column=4, value=r.get("Unidad", "ea" if is_en else "und")).alignment = Alignment(horizontal="center")

        c5 = ws.cell(row=r_idx, column=5, value=float(r.get(cant_col, 0)))
        c5.number_format = "#,##0.00"
        c6 = ws.cell(row=r_idx, column=6, value=float(r.get("Precio_Unitario", 0)))
        c6.number_format = num_fmt_money
        c7 = ws.cell(row=r_idx, column=7, value=float(r.get("Costo_Ejecutado", 0)))
        c7.number_format = num_fmt_money
        c8 = ws.cell(row=r_idx, column=8, value=float(r.get(pct_col, 0)) / 100.0)
        c8.number_format = "0.0%"

        for c in range(1, 9):
            ws.cell(row=r_idx, column=c).border = border_thin
            ws.cell(row=r_idx, column=c).font = font_normal
        r_idx += 1

    costo_directo = float(df_5d["Costo_Ejecutado"].sum()) if not df_5d.empty else 0.0
    pct_a = float(params_liquidacion.get("pct_a", 8.0)) / 100.0
    pct_i = float(params_liquidacion.get("pct_i", 2.0)) / 100.0
    pct_u = float(params_liquidacion.get("pct_u", 5.0)) / 100.0
    pct_anticipo = float(params_liquidacion.get("pct_anticipo", 15.0)) / 100.0
    pct_garantia = float(params_liquidacion.get("pct_garantia", 5.0)) / 100.0

    val_a = costo_directo * pct_a
    val_i = costo_directo * pct_i
    val_u = costo_directo * pct_u
    val_aiu = val_a + val_i + val_u
    val_bruto = costo_directo + val_aiu
    ded_anticipo = val_bruto * pct_anticipo
    ded_garantia = val_bruto * pct_garantia
    iva_utilidad = val_u * 0.19
    neto_cobrar = val_bruto - ded_anticipo - ded_garantia + iva_utilidad

    r_idx += 1
    if is_en:
        liquidacion_filas = [
            ("SUBTOTAL DIRECT EARNED WORK VALUE", costo_directo, False),
            (f"(+) ADMINISTRATION FEE ({params_liquidacion.get('pct_a', 8.0)}%)", val_a, False),
            (f"(+) CONTINGENCIES ({params_liquidacion.get('pct_i', 2.0)}%)", val_i, False),
            (f"(+) CONTRACTOR PROFIT FEE ({params_liquidacion.get('pct_u', 5.0)}%)", val_u, False),
            ("(=) GROSS CERTIFICATE AMOUNT (Direct + AIU)", val_bruto, True),
            (f"(-) ADVANCE MOBILIZATION AMORTIZATION ({params_liquidacion.get('pct_anticipo', 15.0)}%)", -ded_anticipo, False),
            (f"(-) WARRANTY RETAINAGE ({params_liquidacion.get('pct_garantia', 5.0)}%)", -ded_garantia, False),
            ("(+) VAT (19% ON CONTRACTOR FEE)", iva_utilidad, False),
            (f"(=) NET AMOUNT PAYABLE ({currency})", neto_cobrar, True),
        ]
    else:
        liquidacion_filas = [
            ("SUBTOTAL COSTO DIRECTO EJECUTADO", costo_directo, False),
            (f"(+) ADMINISTRACIÓN ({params_liquidacion.get('pct_a', 8.0)}%)", val_a, False),
            (f"(+) IMPREVISTOS ({params_liquidacion.get('pct_i', 2.0)}%)", val_i, False),
            (f"(+) UTILIDAD ({params_liquidacion.get('pct_u', 5.0)}%)", val_u, False),
            ("(=) VALOR BRUTO DEL ACTA DE OBRA", val_bruto, True),
            (f"(-) AMORTIZACIÓN ANTICIPO ({params_liquidacion.get('pct_anticipo', 15.0)}%)", -ded_anticipo, False),
            (f"(-) RETENCIÓN DE GARANTÍA ({params_liquidacion.get('pct_garantia', 5.0)}%)", -ded_garantia, False),
            ("(+) IVA DEL 19% SOBRE LA UTILIDAD", iva_utilidad, False),
            (f"(=) VALOR NETO A CONSIGNAR / PAGAR ({currency})", neto_cobrar, True),
        ]

    for concepto, valor, es_total in liquidacion_filas:
        ws.merge_cells(start_row=r_idx, start_column=1, end_row=r_idx, end_column=6)
        c_lbl = ws.cell(row=r_idx, column=1, value=concepto)
        c_lbl.font = font_bold if es_total else font_normal
        c_lbl.alignment = Alignment(horizontal="right")

        c_val = ws.cell(row=r_idx, column=7, value=valor)
        c_val.number_format = num_fmt_money
        c_val.font = font_bold if es_total else font_normal

        if es_total:
            is_net = ("NET AMOUNT" in concepto) or ("NETO" in concepto)
            for c in range(1, 9):
                ws.cell(row=r_idx, column=c).fill = fill_highlight if is_net else fill_gray
                ws.cell(row=r_idx, column=c).border = border_thin
        r_idx += 1

    r_idx += 2
    ws.merge_cells(start_row=r_idx, start_column=2, end_row=r_idx, end_column=4)
    ws.cell(row=r_idx, column=2, value="___________________________________").alignment = Alignment(horizontal="center")
    ws.merge_cells(start_row=r_idx, start_column=6, end_row=r_idx, end_column=8)
    ws.cell(row=r_idx, column=6, value="___________________________________").alignment = Alignment(horizontal="center")

    default_residente = (
        ("PROJECT DIRECTOR\nJGM ConTech Showcase" if is_en else "DIRECCIÓN DE PROYECTO\nJGM ConTech")
        if is_demo
        else info_proyecto.get("firma_residente", "ING. RESIDENTE DE OBRA")
    )
    default_interventor = (
        ("OWNER'S REPRESENTATIVE\nTechnical Supervision" if is_en else "SUPERVISOR / INTERVENTOR")
        if is_demo
        else info_proyecto.get("firma_interventor", "INTERVENTOR / SUPERVISOR")
    )

    r_idx += 1
    ws.merge_cells(start_row=r_idx, start_column=2, end_row=r_idx, end_column=4)
    ws.cell(row=r_idx, column=2, value=default_residente).alignment = Alignment(horizontal="center", wrap_text=True)
    ws.merge_cells(start_row=r_idx, start_column=6, end_row=r_idx, end_column=8)
    ws.cell(row=r_idx, column=6, value=default_interventor).alignment = Alignment(horizontal="center", wrap_text=True)

    for col in ws.columns:
        col_letter = get_column_letter(col[0].column)
        ws.column_dimensions[col_letter].width = 16
    ws.column_dimensions["C"].width = 40
    ws.column_dimensions["B"].width = 24

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer
