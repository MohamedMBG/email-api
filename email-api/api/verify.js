import jwt from "jsonwebtoken";
import admin from "firebase-admin";
import { readBody } from "./_utils.js";

if (!admin.apps.length) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccount) {
    throw new Error("Missing environment variable: FIREBASE_SERVICE_ACCOUNT");
  }

  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(serviceAccount))
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "POST only" });
  }

  try {
    const body = await readBody(req);
    const token = body?.token;
    if (!token) {
      return res.status(400).json({ ok: false, error: "missing token" });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"]
    });

    const email = payload?.email?.toLowerCase?.();
    if (!email) {
      return res.status(400).json({ ok: false, error: "invalid token payload" });
    }

    const auth = admin.auth();
    let uid;

    try {
      const existingUser = await auth.getUserByEmail(email);
      uid = existingUser.uid;
    } catch (error) {
      if (error.code === "auth/user-not-found") {
        const newUser = await auth.createUser({
          email,
          emailVerified: true
        });
        uid = newUser.uid;
      } else {
        throw error;
      }
    }

    const customToken = await auth.createCustomToken(uid);

    return res.json({ ok: true, email, customToken });
  } catch (error) {
    console.error("verify error:", error);
    const status = error?.name === "JsonWebTokenError" || error?.name === "TokenExpiredError" ? 400 : 500;
    return res.status(status).json({ ok: false, error: "invalid or expired token" });
  }
}
