// /api/push/registerDevice.js
export const config = { runtime: "nodejs" };

import { readBody, initAdminOrThrow, getUserFromAuthHeader } from "../_utils.js";
import { getFirestore } from "firebase-admin/firestore";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ ok:false, error:"POST only" });
    initAdminOrThrow();

    const user = await getUserFromAuthHeader(req); // optional
    const body = await readBody(req);

    const token = String(body?.token || "").trim();
    if (!token) return res.status(400).json({ ok:false, error:"missing token" });

    const device = {
      token,
      uid: user?.uid || null,
      email: (user?.email || "").toLowerCase() || null,
      platform: String(body.platform || ""),       // "android" | "ios" | "web"
      appVersion: String(body.appVersion || ""),
      role: String(body.role || ""),               // "client" | "cashier" | "admin"
      points: typeof body.points === "number" ? body.points : null,
      topics: Array.isArray(body.topics) ? body.topics.slice(0, 20) : [],
      lastActive: new Date(),
      createdAt: new Date(),
    };

    const db = getFirestore();
    await db.collection("devices").doc(token).set(device, { merge: true });

    res.json({ ok:true });
  } catch (e) {
    res.status(500).json({ ok:false, error: e?.message || String(e) });
  }
}
