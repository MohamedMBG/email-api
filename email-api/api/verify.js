export const config = { runtime: "nodejs" };

import jwt from "jsonwebtoken";
import * as admin from "firebase-admin";
import { readBody } from "./_utils.js";

let adminInited = false;
function safeInitAdmin() {
  if (adminInited) return { ok: true };
  try {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) return { ok:false, error:"FIREBASE_SERVICE_ACCOUNT missing" };

    let svc;
    try { svc = JSON.parse(raw); }
    catch { return { ok:false, error:"FIREBASE_SERVICE_ACCOUNT is not valid JSON" }; }

    if (!svc.private_key || !svc.client_email) return { ok:false, error:"service account missing private_key or client_email" };
    if (typeof svc.private_key === "string") svc.private_key = svc.private_key.replace(/\\n/g, "\n");

    if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(svc) });
    adminInited = true;
    return { ok:true };
  } catch (e) {
    return { ok:false, error:"admin init exception: " + (e?.message || String(e)) };
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok:false, error:"POST only" });

  let body;
  try { body = await readBody(req); }
  catch { return res.status(400).json({ ok:false, error:"invalid JSON body" }); }

  const token = (body?.token || "").trim();
  if (!token) return res.status(400).json({ ok:false, error:"missing token" });

  let email;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms:["HS256"] });
    email = String(payload.email || "").toLowerCase().trim();
    if (!email) return res.status(400).json({ ok:false, error:"invalid token payload" });
  } catch {
    return res.status(400).json({ ok:false, error:"invalid or expired token" });
  }

  const init = safeInitAdmin();
  if (!init.ok) return res.status(500).json({ ok:false, error:"admin init failed: " + init.error });

  let uid;
  try {
    const user = await admin.auth().getUserByEmail(email);
    if (user.disabled) return res.status(403).json({ ok:false, error:"account_disabled" });
    uid = user.uid;
  } catch (e) {
    if (e.code === "auth/user-not-found") {
      try {
        const created = await admin.auth().createUser({ email, emailVerified: true });
        uid = created.uid;
      } catch (ce) {
        return res.status(500).json({ ok:false, error:"createUser failed: " + (ce?.message || String(ce)) });
      }
    } else {
      return res.status(500).json({ ok:false, error:"getUserByEmail failed: " + (e?.message || String(e)) });
    }
  }

  try {
    const customToken = await admin.auth().createCustomToken(uid);
    return res.json({ ok:true, email, customToken });
  } catch (e) {
    return res.status(500).json({ ok:false, error:"createCustomToken failed: " + (e?.message || String(e)) });
  }
}
