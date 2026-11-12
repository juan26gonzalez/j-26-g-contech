import { SUPABASE_KEY, SUPABASE_URL } from "./projects";

export interface AuthUser {
  id: string;
  email?: string;
  user_metadata?: {
    full_name?: string;
    name?: string;
    role?: string;
  };
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_at: number; // Unix seconds
  user: AuthUser;
}

const SESSION_STORAGE_KEY = "jgm_contech_bim5d_session_v1";
const LAST_EMAIL_STORAGE_KEY = "jgm_contech_bim5d_last_email_v1";

function getAuthHeaders(bearerToken?: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${bearerToken || SUPABASE_KEY}`,
  };
}

export function translateAuthError(rawMsg?: string, errorCode?: string): string {
  const code = (errorCode || "").toLowerCase();
  const msg = (rawMsg || "").toLowerCase();

  if (
    code === "invalid_credentials" ||
    msg.includes("invalid login credentials")
  ) {
    return "Correo electrónico o contraseña incorrectos.";
  }
  if (code === "email_not_confirmed" || msg.includes("email not confirmed")) {
    return "Tu correo aún no ha sido confirmado en Supabase.";
  }
  if (
    code === "over_request_rate_limit" ||
    msg.includes("rate limit") ||
    msg.includes("too many requests")
  ) {
    return "Demasiados intentos seguidos. Espera unos segundos e intenta de nuevo.";
  }
  if (code === "user_banned" || msg.includes("banned")) {
    return "Esta cuenta se encuentra suspendida temporalmente.";
  }
  if (msg.includes("failed to fetch") || msg.includes("network")) {
    return "Sin conexión con el servidor de autenticación Supabase.";
  }
  return rawMsg || "No se pudo verificar las credenciales.";
}

export function saveStoredSession(session: AuthSession | null): void {
  if (typeof window === "undefined") return;
  try {
    if (!session) {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    } else {
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    }
  } catch {
    // Ignorar errores de almacenamiento privado
  }
}

export function loadStoredSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed?.access_token || !parsed?.user?.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function loadRememberedEmail(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(LAST_EMAIL_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

export function saveRememberedEmail(email: string, remember: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (remember && email.trim()) {
      window.localStorage.setItem(LAST_EMAIL_STORAGE_KEY, email.trim());
    } else {
      window.localStorage.removeItem(LAST_EMAIL_STORAGE_KEY);
    }
  } catch {
    // Ignorar errores de storage
  }
}

function normalizeTokenResponse(data: Record<string, unknown>): AuthSession {
  const nowSec = Math.floor(Date.now() / 1000);
  const expiresIn = Number(data.expires_in || 3600);
  const expiresAt = Number(data.expires_at || nowSec + expiresIn);
  return {
    access_token: String(data.access_token || ""),
    refresh_token: String(data.refresh_token || ""),
    expires_at: expiresAt,
    user: (data.user as AuthUser) || { id: "" },
  };
}

export async function signInWithPassword(
  email: string,
  password: string
): Promise<AuthSession> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ email: email.trim(), password }),
  });

  const payload = (await res.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;

  if (!res.ok) {
    throw new Error(
      translateAuthError(
        String(payload.msg || payload.error_description || payload.error || ""),
        String(payload.error_code || "")
      )
    );
  }

  const session = normalizeTokenResponse(payload);
  if (!session.access_token || !session.user?.id) {
    throw new Error("Respuesta de sesión inválida del servidor.");
  }

  saveStoredSession(session);
  return session;
}

export async function refreshAuthSession(
  refreshToken: string
): Promise<AuthSession | null> {
  if (!refreshToken) return null;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
      {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ refresh_token: refreshToken }),
      }
    );
    if (!res.ok) {
      saveStoredSession(null);
      return null;
    }
    const payload = (await res.json()) as Record<string, unknown>;
    const session = normalizeTokenResponse(payload);
    if (!session.access_token) {
      saveStoredSession(null);
      return null;
    }
    saveStoredSession(session);
    return session;
  } catch {
    return null;
  }
}

export async function restoreAndValidateSession(): Promise<AuthSession | null> {
  const stored = loadStoredSession();
  if (!stored) return null;

  const nowSec = Math.floor(Date.now() / 1000);
  // Si el token ya expiró o está a menos de 2 minutos de expirar, refrescar primero
  if (!stored.expires_at || stored.expires_at - nowSec < 120) {
    const refreshed = await refreshAuthSession(stored.refresh_token);
    if (refreshed) return refreshed;
    if (stored.expires_at && stored.expires_at <= nowSec) {
      saveStoredSession(null);
      return null;
    }
  }

  // Validar token activo contra Supabase Auth /user
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: "GET",
      headers: getAuthHeaders(stored.access_token),
    });

    if (res.ok) {
      const user = (await res.json()) as AuthUser;
      const updated: AuthSession = { ...stored, user };
      saveStoredSession(updated);
      return updated;
    }

    if (res.status === 401 || res.status === 403) {
      const refreshed = await refreshAuthSession(stored.refresh_token);
      if (refreshed) return refreshed;
      saveStoredSession(null);
      return null;
    }
  } catch {
    // Error de red temporal: conservar sesión si el token local sigue vigente
    if (stored.expires_at > nowSec) {
      return stored;
    }
  }

  return null;
}

export async function signOutSession(session: AuthSession | null): Promise<void> {
  saveStoredSession(null);
  if (!session?.access_token) return;
  try {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: "POST",
      headers: getAuthHeaders(session.access_token),
    });
  } catch {
    // Ignorar error de red al cerrar sesión
  }
}

export async function sendPasswordRecovery(email: string): Promise<void> {
  const cleanEmail = email.trim();
  if (!cleanEmail) {
    throw new Error("Ingresa tu correo electrónico para recuperar la clave.");
  }

  const res = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ email: cleanEmail }),
  });

  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    throw new Error(
      translateAuthError(
        String(payload.msg || payload.error_description || ""),
        String(payload.error_code || "")
      )
    );
  }
}
