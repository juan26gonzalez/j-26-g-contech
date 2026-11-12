"use client";

import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
} from "lucide-react";
import {
  AuthSession,
  loadRememberedEmail,
  saveRememberedEmail,
  sendPasswordRecovery,
  signInWithPassword,
} from "../lib/auth";
import { BITACORA_APP_URL } from "../lib/projects";

interface LoginGateProps {
  onAuthenticated: (session: AuthSession) => void;
}

export default function LoginGate({ onAuthenticated }: LoginGateProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberEmail, setRememberEmail] = useState(true);
  const [recoveryMode, setRecoveryMode] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    const saved = loadRememberedEmail();
    if (saved) {
      setEmail(saved);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    setSubmitting(true);

    try {
      if (recoveryMode) {
        await sendPasswordRecovery(email);
        setSuccessMsg(
          "Se envió un correo con instrucciones para restablecer tu contraseña."
        );
      } else {
        const session = await signInWithPassword(email, password);
        saveRememberedEmail(email, rememberEmail);
        onAuthenticated(session);
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Error de autenticación."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md bento-card !p-0 overflow-hidden shadow-2xl border border-slate-400/75">
        {/* Cabecera Ejecutiva Gunmetal CNC */}
        <div className="steel-panel-dark px-6 py-6 text-center text-white border-b border-slate-600/80">
          <div className="flex items-center justify-center gap-2 mb-4 flex-wrap">
            <span className="bg-white/10 border border-white/20 text-slate-200 text-[10px] font-bold tracking-wider px-2.5 py-0.5 rounded-full">
              REVIT 2027 BIM 5D
            </span>
            <span className="inline-flex items-center gap-1 bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
              <ShieldCheck className="w-3 h-3" /> SUPABASE AUTH
            </span>
          </div>

          <img
            src="/logo-mark.png"
            alt="JGM ConTech"
            className="w-20 h-20 rounded-2xl border border-slate-400/60 shadow-xl mx-auto mb-3 bg-slate-900 object-cover"
          />

          <h1 className="text-2xl font-extrabold tracking-tight text-white">
            JGM ConTech
          </h1>
          <p className="text-xs sm:text-sm font-medium text-slate-300 mt-1">
            Gerencia BIM 5D • Acceso Seguro
          </p>
        </div>

        {/* Formulario */}
        <div className="p-6 sm:p-7 bg-gradient-to-b from-white to-slate-50/90">
          <p className="text-xs text-slate-600 font-medium text-center mb-5 bg-slate-100 border border-slate-200 rounded-xl px-3 py-2">
            {recoveryMode
              ? "Ingresa tu correo registrado para recibir el enlace de recuperación."
              : "Inicia sesión con tus mismas credenciales de Bitácora de Obra."}
          </p>

          {errorMsg && (
            <div className="mb-4 rounded-xl bg-rose-50 p-3 text-xs sm:text-sm font-semibold text-rose-700 border border-rose-200">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="mb-4 rounded-xl bg-emerald-50 p-3 text-xs sm:text-sm font-semibold text-emerald-800 border border-emerald-200">
              {successMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="bim-login-email"
                className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1.5"
              >
                Correo Electrónico
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="bim-login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@jgmcontech.com"
                  required
                  autoComplete="email"
                  className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-700/15"
                />
              </div>
            </div>

            {!recoveryMode && (
              <div>
                <label
                  htmlFor="bim-login-password"
                  className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1.5"
                >
                  Contraseña
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="bim-login-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-10 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-700/15"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={
                      showPassword ? "Ocultar contraseña" : "Ver contraseña"
                    }
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {!recoveryMode && (
              <div className="flex items-center justify-between text-xs pt-0.5">
                <label className="inline-flex items-center gap-2 text-slate-600 font-medium cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberEmail}
                    onChange={(e) => setRememberEmail(e.target.checked)}
                    className="rounded border-slate-300 text-slate-800 focus:ring-slate-700"
                  />
                  Recordar correo
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setRecoveryMode(true);
                    setErrorMsg("");
                    setSuccessMsg("");
                  }}
                  className="font-semibold text-slate-600 hover:text-slate-900 underline underline-offset-2"
                >
                  ¿Olvidaste tu clave?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full steel-btn-primary rounded-xl py-3 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {submitting
                ? recoveryMode
                  ? "Enviando enlace..."
                  : "Verificando credenciales..."
                : recoveryMode
                ? "Enviar Enlace de Recuperación"
                : "🔒 Iniciar Sesión en Gerencia BIM 5D"}
            </button>

            {recoveryMode && (
              <button
                type="button"
                onClick={() => {
                  setRecoveryMode(false);
                  setErrorMsg("");
                  setSuccessMsg("");
                }}
                className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 py-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Volver al inicio de sesión
              </button>
            )}
          </form>

          <div className="mt-6 pt-4 border-t border-slate-200/80 flex flex-col items-center gap-2 text-center">
            <a
              href={BITACORA_APP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold text-slate-700 hover:text-slate-950 transition-colors"
            >
              📱 Ir a Bitácora de Campo App ↗
            </a>
            <p className="text-[11px] text-slate-500 font-medium">
              JGM ConTech • Control Financiero 5D &amp; Cronograma 4D • Barranquilla
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
