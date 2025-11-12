// /api/push/send.js
export const config = { runtime: "nodejs" };

import { readBody, initAdminOrThrow, buildDevicesQuery, chunk } from "../_utils.js";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ ok:false, error:"POST only" });
    initAdminOrThrow();

    const body = await readBody(req);
    const { title, message, data, filters, dryRun } = body || {};
    if (!title || !message) return res.status(400).json({ ok:false, error:"missing title or message" });

    const db = getFirestore();
    const q = buildDevicesQuery(db, { ...(filters || {}), limit: body.limit || 20000 });
    const snap = await q.get();

    const tokens = snap.docs.map(d => d.id);
    if (!tokens.length) return res.json({ ok:true, sent:0, success:0, failure:0, cleaned:0 });

    if (dryRun) return res.json({ ok:true, dryRun:true, tokens: tokens.length });

    const messaging = getMessaging();
    const batches = chunk(tokens, 500);
    let success = 0, failure = 0;
    const invalidTokens = [];

    for (const group of batches) {
      const resp = await messaging.sendEachForMulticast({
        tokens: group,
        notification: { title, body: message },
        data: Object.fromEntries(Object.entries(data || {}).map(([k,v]) => [k, String(v)])),
        android: { priority: "high" },
        apns: { headers: { "apns-priority": "10" } }
      });

      success += resp.successCount;
      failure += resp.failureCount;

      resp.responses.forEach((r, idx) => {
        if (!r.success) {
          const code = r?.error?.code || "";
          if (code.includes("registration-token-not-registered") || code.includes("invalid-argument")) {
            invalidTokens.push(group[idx]);
          }
        }
      });
    }

    // cleanup invalid tokens from top-level devices
    if (invalidTokens.length) {
      const batch = db.batch();
      invalidTokens.forEach(t => batch.delete(db.collection("devices").doc(t)));
      await batch.commit();
    }

    res.json({ ok:true, sent: tokens.length, success, failure, cleaned: invalidTokens.length });
  } catch (e) {
    res.status(500).json({ ok:false, error: e?.message || String(e) });
  }
}
