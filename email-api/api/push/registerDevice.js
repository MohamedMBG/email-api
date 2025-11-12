// /api/push/registerDevice.js
export const config = { runtime: "nodejs" };

import { readBody, initAdminOrThrow, getUserFromAuthHeader } from "../_utils.js";
import { getFirestore } from "firebase-admin/firestore";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ ok:false, error:"POST only" });
    initAdminOrThrow();

    const user  = await getUserFromAuthHeader(req); // optional
    const body  = await readBody(req);
    const token = String(body?.token || "").trim();
    if (!token) return res.status(400).json({ ok:false, error:"missing token" });

    const db   = getFirestore();
    const ref  = db.collection("devices").doc(token);
    const prev = await ref.get();
    const existed = prev.exists;

    const device = {
      token,
      uid: user?.uid || null,
      email: (user?.email || "").toLowerCase() || null,
      platform: String(body.platform || ""),
      appVersion: String(body.appVersion || ""),
      role: String(body.role || ""),
      points: typeof body.points === "number" ? body.points : null,
      topics: Array.isArray(body.topics) ? body.topics.slice(0, 20) : [],
      lastActive: new Date(),
      ...(existed ? {} : { createdAt: new Date() }),
    };

    await ref.set(device, { merge: true });
    return res.json({ ok:true, existed });
  } catch (e) {
    return res.status(500).json({ ok:false, error: e?.message || String(e) });
  }
}
