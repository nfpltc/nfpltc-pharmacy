import { cookies } from "next/headers"
import { supabaseAdmin } from "./supabaseAdmin"

const COOKIE = "portal_session"
const SECRET = () => process.env.PORTAL_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "fallback-dev-secret"

// Simple HMAC-based session token (no heavy JWT library needed)
async function sign(payload: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey("raw", enc.encode(SECRET()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload))
  return btoa(payload) + "." + btoa(String.fromCharCode(...new Uint8Array(sig)))
}

async function verify(token: string): Promise<string | null> {
  const [b64payload, b64sig] = token.split(".")
  if (!b64payload || !b64sig) return null
  const payload = atob(b64payload)
  const expected = await sign(payload)
  if (expected !== token) return null
  try {
    const data = JSON.parse(payload)
    if (data.exp && Date.now() > data.exp) return null
    return data.uid
  } catch { return null }
}

// Hash password with Web Crypto (no bcrypt dependency needed on Edge)
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, "0")).join("")
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"])
  const derived = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" }, keyMaterial, 256)
  const hashHex = Array.from(new Uint8Array(derived)).map(b => b.toString(16).padStart(2, "0")).join("")
  return `pbkdf2:${saltHex}:${hashHex}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [, saltHex, hashHex] = stored.split(":")
  if (!saltHex || !hashHex) return false
  const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map(b => parseInt(b, 16)))
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"])
  const derived = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" }, keyMaterial, 256)
  const checkHex = Array.from(new Uint8Array(derived)).map(b => b.toString(16).padStart(2, "0")).join("")
  return checkHex === hashHex
}

export async function createSession(userId: string): Promise<void> {
  const payload = JSON.stringify({ uid: userId, exp: Date.now() + 30 * 24 * 60 * 60 * 1000 }) // 30 days
  const token = await sign(payload)
  const jar = await cookies()
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  })
}

export async function getPortalUser() {
  const jar = await cookies()
  const token = jar.get(COOKIE)?.value
  if (!token) return null
  const userId = await verify(token)
  if (!userId) return null

  const sb = supabaseAdmin()
  const { data } = await sb
    .from("portal_users")
    .select("id, account_number, email, phone, status, created_at, last_login_at")
    .eq("id", userId)
    .eq("status", "active")
    .maybeSingle()
  return data
}

export async function destroySession(): Promise<void> {
  const jar = await cookies()
  jar.delete(COOKIE)
}
