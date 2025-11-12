export const config = { runtime: "nodejs" };

import { initAdminOrThrow } from "../_utils.js";
import { getFirestore } from "firebase-admin/firestore";
import { getApps } from "firebase-admin/app";

export default async function handler(req, res) {
  try {
    initAdminOrThrow();
    const app = getApps()[0];
    const db = getFirestore();

    // Write a known doc
    await db.collection("devices").doc("DEBUG_TOKEN").set({
      token: "DEBUG_TOKEN",
      platform: "android",
      role: "client",
      createdAt: new Date(),
      lastActive: new Date(),
    }, { merge: true });

    // Read it back
    const snap = await db.collection("devices").doc("DEBUG_TOKEN").get();

    res.json({
      ok: true,
      wrote: snap.exists,
      data: snap.exists ? snap.data() : null,
      // Key line: which project this function is actually using
      projectId:
        app?.options?.credential?.projectId ||
        process.env.GCLOUD_PROJECT ||
        process.env.FIREBASE_PROJECT_ID ||
        "UNKNOWN"
    });
  } catch (e) {
    res.status(500).json({ ok:false, error: String(e) });
  }
}
