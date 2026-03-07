import { admin, db } from "../../../lib/firebaseAdmin.js";

function formatDateYYYYMMDD(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseUidFromBody(body) {
  if (!body) return null;

  if (typeof body === "string") {
    try {
      const parsed = JSON.parse(body);
      return typeof parsed?.uid === "string" ? parsed.uid.trim() : null;
    } catch {
      return null;
    }
  }

  return typeof body.uid === "string" ? body.uid.trim() : null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const uid = parseUidFromBody(req.body);

    if (!uid) {
      return res.status(400).json({ error: "uid is required" });
    }

    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = userSnap.data() || {};
    const birthday = user.birthday;

    if (typeof birthday !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) {
      return res.status(400).json({ error: "Invalid or missing birthday field" });
    }

    const [, birthMonth, birthDay] = birthday.split("-");
    const now = new Date();
    const todayMonth = String(now.getMonth() + 1).padStart(2, "0");
    const todayDay = String(now.getDate()).padStart(2, "0");
    const todayDateString = formatDateYYYYMMDD(now);

    if (birthMonth !== todayMonth || birthDay !== todayDay) {
      return res.status(400).json({ error: "Today is not the user's birthday" });
    }

    if (user.lastBirthdayReward === todayDateString) {
      return res.status(400).json({ error: "Birthday reward already claimed today" });
    }

    await userRef.update({
      points: admin.firestore.FieldValue.increment(15),
      lastBirthdayReward: todayDateString,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({
      success: true,
      message: "Birthday reward claimed",
    });
  } catch (error) {
    console.error("Birthday reward error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
