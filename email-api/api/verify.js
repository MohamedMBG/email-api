// /api/verify.js
export const config = { runtime: "nodejs" }; // ensure NOT Edge on Vercel

import jwt from "jsonwebtoken";
import admin from "firebase-admin";
import { readBody } from "./_utils.js";

function initAdminOrThrow() {
  if (admin.apps.length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT missing");

  let svc;
  try {
    svc = JSON.parse(raw);
  } catch (e) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT is not valid JSON");
  }

  if (!svc.private_key || !svc.client_email) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT missing private_key or client_email");
  }
  if (typeof svc.private_key === "string") {
    // fix \n vs \\n issues
    svc.private_key = svc.private_key.replace(/\\n/g, "\n");
  }

  admin.initializeApp({ credential: admin.credential.cert(svc) });
}

export default async function handler(req, res) {
  // Only POST
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "POST only" });
  }

  try {
    // Parse body
    let body;
    try {
      body = await readBody(req);
    } catch (e) {
      return res.status(400).json({ ok: false, error: "invalid JSON body" });
    }

    // Get token
    const token = (body?.token || "").trim();
    if (!token) return res.status(400).json({ ok: false, error: "missing token" });

    // Verify JWT (must match the secret used in /api/register)
    let email;
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
      email = String(payload.email || "").toLowerCase().trim();
      if (!email) return res.status(400).json({ ok: false, error: "invalid token payload" });
    } catch (e) {
      return res.status(400).json({ ok: false, error: "invalid or expired token" });
    }

    // Init Firebase Admin
    try {
      initAdminOrThrow();
    } catch (e) {
      return res.status(500).json({ ok: false, error: "admin init failed: " + (e?.message || e) });
    }

    // Reuse or create user
    let uid;
    try {
      const user = await admin.auth().getUserByEmail(email);
      if (user.disabled) {
        return res.status(403).json({ ok: false, error: "account_disabled" });
      }
      uid = user.uid;
    } catch (e) {
      if (e.code === "auth/user-not-found") {
        try {
          const created = await admin.auth().createUser({ email, emailVerified: true });
          uid = created.uid;
        } catch (ce) {
          return res.status(500).json({ ok: false, error: "createUser failed: " + (ce?.message || ce) });
        }
      } else {
        return res.status(500).json({ ok: false, error: "getUserByEmail failed: " + (e?.message || e) });
      }
    }

    // Mint custom token
    try {
      const customToken = await admin.auth().createCustomToken(uid);
      return res.json({ ok: true, email, customToken });
    } catch (e) {
      return res.status(500).json({ ok: false, error: "createCustomToken failed: " + (e?.message || e) });
    }
  } catch (e) {
    // Last-resort guard
    return res.status(500).json({ ok: false, error: "server error: " + (e?.message || e) });
  }
}
