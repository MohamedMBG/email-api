// /api/push/preview.js
export const config = { runtime: "nodejs" };

import { readBody, initAdminOrThrow, buildDevicesQuery } from "../_utils.js";
import { getFirestore } from "firebase-admin/firestore";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ ok:false, error:"POST only" });
    initAdminOrThrow();

    const body = await readBody(req);
    const filters = body?.filters || {};

    const db = getFirestore();
    const q = buildDevicesQuery(db, { ...filters, limit: body.limit || 5000 });
    const snap = await q.get();

    const count = snap.size;
    const sample = snap.docs.slice(0, 15).map(d => {
      const v = d.data();
      return { platform: v.platform || null, role: v.role || null, email: v.email || null };
    });

    res.json({ ok:true, count, sample });
  } catch (e) {
    res.status(500).json({ ok:false, error: e?.message || String(e) });
  }
}
