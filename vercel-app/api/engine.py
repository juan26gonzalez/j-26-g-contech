import base64
import json
import os
import sys
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

# Garantiza importación limpia de py_engine tanto en Vercel Serverless como en local
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

import numpy as np
import pandas as pd

from py_engine.calc_engine import (
    consolidar_todo,
    procesar_archivo_presupuesto_bytes,
    procesar_msproject_excel_bytes,
    procesar_tabla_revit_bytes,
)
from py_engine.excel_generator import generar_acta_corte_excel, generar_plantilla_excel_presupuesto
from py_engine.pdf_generator import (
    generar_contrato_cliente_pdf,
    generar_presupuesto_pdf,
    generar_subcontrato_oficial_pdf,
)


class handler(BaseHTTPRequestHandler):
    def _send_json(self, status_code, payload):
        body = json.dumps(payload, ensure_ascii=False, allow_nan=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _send_binary(self, status_code, raw_bytes, content_type, filename):
        self.send_response(status_code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
        self.send_header("Content-Length", str(len(raw_bytes)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(raw_bytes)

    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        action = params.get("action", ["health"])[0]

        try:
            if action == "plantilla_excel":
                buf = generar_plantilla_excel_presupuesto()
                self._send_binary(
                    200,
                    buf.getvalue(),
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    "Plantilla_Presupuesto_JGM_ConTech.xlsx",
                )
                return

            self._send_json(200, {
                "ok": True,
                "runtime": "vercel-python-pandas",
                "pandas": pd.__version__,
                "numpy": np.__version__,
            })
        except Exception as exc:
            self._send_json(500, {"ok": False, "error": str(exc)})

    def do_POST(self):
        try:
            content_len = int(self.headers.get("Content-Length", 0) or 0)
            raw_body = self.rfile.read(content_len) if content_len > 0 else b"{}"
            data = json.loads(raw_body.decode("utf-8"))
            action = data.get("action", "")

            if action == "consolidar":
                res = consolidar_todo(
                    data.get("proyecto_actual") or {},
                    data.get("registros_bitacora") or [],
                )
                self._send_json(200, {"ok": True, **res})
                return

            if action == "parse_excel":
                filename = data.get("filename", "presupuesto.xlsx")
                b64 = data.get("file_base64", "")
                raw_file = base64.b64decode(b64)
                items, err = procesar_archivo_presupuesto_bytes(filename, raw_file)
                if err:
                    self._send_json(400, {"ok": False, "error": err})
                    return
                self._send_json(200, {"ok": True, "items": items})
                return

            if action == "parse_revit_schedule":
                filename = data.get("filename", "revit_schedule.txt")
                b64 = data.get("file_base64", "")
                raw_file = base64.b64decode(b64)
                items, err = procesar_tabla_revit_bytes(filename, raw_file)
                if err:
                    self._send_json(400, {"ok": False, "error": err})
                    return
                self._send_json(200, {"ok": True, "items": items})
                return

            if action == "parse_msproject":
                filename = data.get("filename", "cronograma.xlsx")
                b64 = data.get("file_base64", "")
                raw_file = base64.b64decode(b64)
                tasks, err = procesar_msproject_excel_bytes(filename, raw_file)
                if err:
                    self._send_json(400, {"ok": False, "error": err})
                    return
                self._send_json(200, {"ok": True, "tasks": tasks})
                return

            if action == "plantilla_excel":
                buf = generar_plantilla_excel_presupuesto()
                self._send_binary(
                    200,
                    buf.getvalue(),
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    "Plantilla_Presupuesto_JGM_ConTech.xlsx",
                )
                return

            if action == "presupuesto_pdf":
                proy = data.get("proyecto_actual") or {}
                buf = generar_presupuesto_pdf(
                    data.get("df_5d") or [],
                    data.get("params_liquidacion") or {},
                    proy,
                    cfg_honorarios=data.get("cfg_honorarios"),
                )
                self._send_binary(
                    200,
                    buf.getvalue(),
                    "application/pdf",
                    f"Presupuesto_{proy.get('id', 'proy')}.pdf",
                )
                return

            if action == "contrato_cliente_pdf":
                proy = data.get("proyecto_actual") or {}
                cfg = data.get("cfg") or {}
                buf = generar_contrato_cliente_pdf(
                    data.get("df_5d") or [],
                    data.get("params_liquidacion") or {},
                    proy,
                    cfg,
                )
                self._send_binary(
                    200,
                    buf.getvalue(),
                    "application/pdf",
                    f"Contrato_Cliente_{cfg.get('num_contrato', 'JGM')}.pdf",
                )
                return

            if action == "subcontrato_oficial_pdf":
                proy = data.get("proyecto_actual") or {}
                cfg = data.get("cfg") or {}
                buf = generar_subcontrato_oficial_pdf(
                    data.get("df_items_sub") or [],
                    proy,
                    cfg,
                )
                self._send_binary(
                    200,
                    buf.getvalue(),
                    "application/pdf",
                    f"Subcontrato_{cfg.get('num_subcontrato', 'SUB')}.pdf",
                )
                return

            if action == "acta_corte_excel":
                proy = data.get("proyecto_actual") or {}
                num_acta = str(data.get("numero_acta", "01"))
                buf = generar_acta_corte_excel(
                    data.get("df_5d") or [],
                    num_acta,
                    data.get("params_liquidacion") or {},
                    proy,
                )
                self._send_binary(
                    200,
                    buf.getvalue(),
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    f"Acta_Corte_{num_acta}_{proy.get('id', 'proy')}.xlsx",
                )
                return

            self._send_json(400, {"ok": False, "error": f"Acción no soportada: {action}"})
        except Exception as exc:
            self._send_json(500, {"ok": False, "error": str(exc)})
