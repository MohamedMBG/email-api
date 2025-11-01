import jwt from "jsonwebtoken";
import { readBody } from "./_utils.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "POST only" });

  const body = await readBody(req);
  const token = body.token;
  const uid   = body.uid;

  if (!token || !uid) {
    return res.status(400).json({ ok: false, error: "missing token/uid" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
    if (payload.sub !== uid) {
      return res.status(400).json({ ok: false, error: "uid mismatch" });
    }
    return res.json({ ok: true });
  } catch (e) {
    return res.status(400).json({ ok: false, error: "invalid or expired token" });
  }
}
