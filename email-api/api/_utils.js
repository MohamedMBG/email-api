// /api/_utils.js
export async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  const ct = (req.headers["content-type"] || "").toLowerCase();

  if (ct.includes("application/json")) { try { return JSON.parse(raw || "{}"); } catch { return {}; } }
  if (ct.includes("application/x-www-form-urlencoded")) {
    const p = new URLSearchParams(raw); const o = {};
    for (const [k,v] of p.entries()) o[k]=v; return o;
  }
  try { return JSON.parse(raw || "{}"); } catch { return {}; }
}

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

export function initAdminOrThrow() {
  if (getApps().length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT missing");
  const svc = JSON.parse(raw);
  if (typeof svc.private_key === "string") svc.private_key = svc.private_key.replace(/\\n/g, "\n");
  initializeApp({ credential: cert(svc) });
}

// Optional: lets you attach uid/email to devices if client sends ID token
export async function getUserFromAuthHeader(req) {
  try {
    initAdminOrThrow();
    const h = req.headers.authorization || req.headers.Authorization || "";
    const [, token] = String(h).split(" ");
    if (!token) return null;
    return await getAuth().verifyIdToken(token); // { uid, email, ... }
  } catch { return null; }
}

export function chunk(arr, size = 500) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Build query on top-level "devices" (NO city)
export function buildDevicesQuery(db, filters = {}) {
  let q = db.collection("devices");

  if (filters.platform)   q = q.where("platform", "==", String(filters.platform));   // "android" | "ios" | "web"
  if (filters.role)       q = q.where("role", "==", String(filters.role));           // "client" | "cashier" | "admin"
  if (filters.appVersion) q = q.where("appVersion", "==", String(filters.appVersion));

  if (Array.isArray(filters.topics) && filters.topics.length) {
    q = q.where("topics", "array-contains-any", filters.topics.slice(0, 10));
  }

  if (typeof filters.minPoints === "number") q = q.where("points", ">=", filters.minPoints);
  if (typeof filters.maxPoints === "number") q = q.where("points", "<=", filters.maxPoints);

  if (typeof filters.activeSince === "number") {
    const since = new Date(Date.now() - filters.activeSince); // ms window
    q = q.where("lastActive", ">=", since);
  }

  const cap = Math.min(filters.limit || 5000, 25000); // safety cap
  return q.limit(cap);
}

export { getAuth, getFirestore, getMessaging };
