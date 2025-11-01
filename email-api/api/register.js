import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { readBody } from "./_utils.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "POST only" });

  const body = await readBody(req);
  const email = body.email;
  const uid   = body.uid;

  if (!email || !uid) {
    return res.status(400).json({ ok: false, error: "missing email/uid" });
  }

  try {
    const token = jwt.sign(
      { sub: uid, email },
      process.env.JWT_SECRET,
      { algorithm: "HS256", expiresIn: "1h" }
    );

    const githubPage = process.env.GITHUB_VERIFY_URL;
    if (!githubPage) return res.status(500).json({ ok: false, error: "server: GITHUB_VERIFY_URL not set" });

    const httpsLink  = `${githubPage}?token=${encodeURIComponent(token)}`;
    const schemeLink = `myapp://verify?token=${encodeURIComponent(token)}`;
    const intentLink = `intent://verify?token=${encodeURIComponent(token)}#Intent;scheme=myapp;package=${process.env.ANDROID_PACKAGE};end`;

    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_APP_PASSWORD;
    if (!user || !pass) return res.status(500).json({ ok: false, error: "server: Gmail env not set" });

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: { user, pass }
    });

    // Uncomment to debug SMTP connectivity in logs:
    // await transporter.verify();

    const subject = "Verify your email";
    const text =
`Tap a link to verify:

Open in app:
${schemeLink}

Android intent fallback:
${intentLink}

HTTPS (redirects to app):
${httpsLink}

This link expires in 60 minutes.`;

    await transporter.sendMail({
      from: process.env.MAIL_FROM || user,
      to: email,
      subject,
      text
    });

    return res.json({ ok: true });
  } catch (e) {
    console.error("register error:", e?.message || e);
    return res.status(500).json({ ok: false, error: "server: send failed" });
  }
}
