import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "POST only" });
  const { email, uid } = req.body || {};
  if (!email || !uid) return res.status(400).json({ ok: false, error: "missing email/uid" });

  try {
    const token = jwt.sign({ sub: uid, email }, process.env.JWT_SECRET, { algorithm: "HS256", expiresIn: "1h" });
    const githubPage = process.env.GITHUB_VERIFY_URL;
    const httpsLink  = `${githubPage}?token=${encodeURIComponent(token)}`;
    const schemeLink = `myapp://verify?token=${encodeURIComponent(token)}`;
    const intentLink = `intent://verify?token=${encodeURIComponent(token)}#Intent;scheme=myapp;package=${process.env.ANDROID_PACKAGE};end`;

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD }
    });

    const subject = "Verify your email";
    const text = `Tap one of the links to verify your email:\n\n${schemeLink}\n\n${intentLink}\n\n${httpsLink}\n\nExpires in 60 min.`;
    await transporter.sendMail({ from: process.env.GMAIL_USER, to: email, subject, text });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: "send failed" });
  }
}
