import jwt from "jsonwebtoken";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "POST only" });
  const { token, uid } = req.body || {};
  if (!token || !uid) return res.status(400).json({ ok: false, error: "missing token/uid" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
    if (payload.sub !== uid) return res.status(400).json({ ok: false, error: "uid mismatch" });
    res.json({ ok: true });
  } catch {
    res.status(400).json({ ok: false, error: "invalid or expired token" });
  }
}
