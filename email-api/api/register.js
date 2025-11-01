import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { readBody } from "./_utils.js";

const REQUIRED_ENV_VARS = [
  "JWT_SECRET",
  "GMAIL_USER",
  "GMAIL_APP_PASSWORD",
  "GITHUB_VERIFY_URL"
];

function ensureEnv() {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing environment variables: ${missing.join(", ")}`);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "POST only" });
  }

  try {
    ensureEnv();

    const body = await readBody(req);
    const email = body?.email?.trim();
    if (!email) {
      return res.status(400).json({ ok: false, error: "missing email" });
    }

    const token = jwt.sign(
      { email: email.toLowerCase() },
      process.env.JWT_SECRET,
      {
        algorithm: "HS256",
        expiresIn: "1h"
      }
    );

    const verificationUrl = `${process.env.GITHUB_VERIFY_URL}?token=${encodeURIComponent(token)}`;

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });

    const mailOptions = {
      from: process.env.MAIL_FROM || process.env.GMAIL_USER,
      to: email,
      subject: "Verify your email",
      text: `Click the link below to verify your email address.\n\n${verificationUrl}\n\nThis link expires in 1 hour.`
    };

    await transporter.sendMail(mailOptions);

    return res.json({ ok: true });
  } catch (error) {
    console.error("register error:", error);
    const message = error?.message || "send failed";
    const status = message.toLowerCase().includes("missing environment") ? 500 : 500;
    return res.status(status).json({ ok: false, error: message });
  }
}
