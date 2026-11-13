"use client";

import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  Compass,
  Eye,
  EyeOff,
  Globe,
  Lock,
  Mail,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import {
  AuthSession,
  createDemoSession,
  loadRememberedEmail,
  saveRememberedEmail,
  sendPasswordRecovery,
  signInWithPassword,
} from "../lib/auth";
import { useAppPreferences } from "../lib/i18n";
import { BITACORA_APP_URL } from "../lib/projects";

interface LoginGateProps {
  onAuthenticated: (session: AuthSession) => void;
}

export default function LoginGate({ onAuthenticated }: LoginGateProps) {
  const { lang, setLang, tr } = useAppPreferences();
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
          lang === "en"
            ? "Recovery instructions sent to your email address."
            : "Se envió un correo con instrucciones para restablecer tu contraseña."
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
        <div className="steel-panel-dark px-6 py-6 text-center text-white border-b border-slate-600/80 relative">
          {/* Language Switcher ES / EN */}
          <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="bg-white/10 border border-white/20 text-slate-200 text-[10px] font-bold tracking-wider px-2.5 py-0.5 rounded-full">
                ISO 19650 • BIM 5D
              </span>
              <span className="inline-flex items-center gap-1 bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                <ShieldCheck className="w-3 h-3" /> {tr.login.securityBadge}
              </span>
            </div>

            <div className="inline-flex items-center rounded-full bg-slate-900/70 border border-slate-500/50 p-0.5 text-[10px] font-bold">
              <Globe className="w-3 h-3 text-slate-300 ml-1.5 mr-1" />
              <button
                type="button"
                onClick={() => setLang("es")}
                className={`px-2 py-0.5 rounded-full transition-colors ${
                  lang === "es"
                    ? "bg-white text-slate-900"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                ES
              </button>
              <button
                type="button"
                onClick={() => setLang("en")}
                className={`px-2 py-0.5 rounded-full transition-colors ${
                  lang === "en"
                    ? "bg-white text-slate-900"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                EN
              </button>
            </div>
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
            {tr.login.subtitle}
          </p>
        </div>

        {/* Formulario */}
        <div className="p-6 sm:p-7 bg-gradient-to-b from-white to-slate-50/90">
          {/* Botón Destacado Modo Demo LinkedIn */}
          <div className="mb-5 rounded-2xl bg-slate-900 text-white p-3.5 shadow-md border border-slate-700">
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 mb-1.5 text-center">
              {tr.login.demoDivider}
            </div>
            <button
              type="button"
              onClick={() => onAuthenticated(createDemoSession())}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs py-2.5 px-3 transition-colors shadow"
            >
              <Compass className="w-4 h-4" />
              <span>{tr.login.demoBtn}</span>
            </button>
            <p className="text-[10px] text-slate-300 text-center mt-1.5 leading-snug">
              {tr.login.demoHint}
            </p>
          </div>

          <div className="relative flex py-1 items-center mb-4">
            <div className="flex-grow border-t border-slate-200" />
            <span className="flex-shrink mx-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {lang === "en" ? "Client / Team Access" : "Acceso Corporativo"}
            </span>
            <div className="flex-grow border-t border-slate-200" />
          </div>

          <p className="text-xs text-slate-600 font-medium text-center mb-4 bg-slate-100 border border-slate-200 rounded-xl px-3 py-2">
            {recoveryMode ? tr.login.helperRecovery : tr.login.helperLogin}
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
                {tr.login.emailLabel}
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
                  {tr.login.passwordLabel}
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
                  {tr.login.rememberEmail}
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
                  {tr.login.forgotPassword}
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full steel-btn-primary rounded-xl py-3 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              <Lock className="w-4 h-4" />
              <span>
                {submitting
                  ? recoveryMode
                    ? tr.login.sendingRecoveryBtn
                    : tr.login.signingInBtn
                  : recoveryMode
                  ? tr.login.sendRecoveryBtn
                  : tr.login.signInBtn}
              </span>
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
                <ArrowLeft className="w-3.5 h-3.5" /> {tr.login.backToLogin}
              </button>
            )}
          </form>

          <div className="mt-6 pt-4 border-t border-slate-200/80 flex flex-col items-center gap-2 text-center">
            <a
              href={BITACORA_APP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-950 transition-colors"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>{tr.login.openBitacoraLink}</span>
            </a>
            <p className="text-[11px] text-slate-500 font-medium">
              {tr.login.footerNote}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
