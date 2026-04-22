import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";

async function trySendEmail(to: string, subject: string, text: string) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM ?? "no-reply@digitalheroes.dev";

  if (!host || !user || !pass) {
    return false;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from,
    to,
    subject,
    text,
  });

  return true;
}

export async function notifyUser(userId: string, email: string, subject: string, message: string) {
  await prisma.notification.create({
    data: {
      userId,
      subject,
      message,
    },
  });

  try {
    await trySendEmail(email, subject, message);
  } catch {
    // Keep app workflow non-blocking when SMTP is unavailable.
  }
}
