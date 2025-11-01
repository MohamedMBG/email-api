import jwt from "jsonwebtoken";
import admin from "firebase-admin";
import { readBody } from "./_utils.js";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "POST only" });

  const body = await readBody(req);
  const token = body.token;
  if (!token) return res.status(400).json({ ok: false, error: "missing token" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
    const email = payload.email.toLowerCase();

    // Reuse or create the Firebase user
    let uid;
    try {
      const user = await admin.auth().getUserByEmail(email);
      uid = user.uid; // Existing user
    } catch (e) {
      if (e.code === "auth/user-not-found") {
        const newUser = await admin.auth().createUser({ email, emailVerified: true });
        uid = newUser.uid; // New user
      } else throw e;
    }

    // Create Firebase custom token
    const customToken = await admin.auth().createCustomToken(uid);
    return res.json({ ok: true, email, customToken });
  } catch (e) {
    console.error("verify error:", e);
    return res.status(400).json({ ok: false, error: "invalid or expired token" });
  }
}
