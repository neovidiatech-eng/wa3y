import nodemailer from "nodemailer";

export const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT) || 465,
  secure: Number(process.env.MAIL_PORT) === 465,
  pool: true, // تفعيل التجميع لإعادة استخدام الاتصال وتجنب الـ timeout
  maxConnections: 5,
  maxMessages: 100,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
  // timeout كبير لتجنب disconnect
  connectionTimeout: 10000,
}); 

// فحص الاتصال عند التشغيل لضمان استجابة السيرفر
transporter.verify((error, success) => {
  if (error) {
    console.error("❌ SMTP Connection Error:", error.message);
    if (!process.env.MAIL_USER) console.error("   - MAIL_USER is missing or empty");
    if (!process.env.MAIL_PASS) console.error("   - MAIL_PASS is missing or empty");
  } else {
    console.log("📧 SMTP Server is ready to take messages");
  }
});


