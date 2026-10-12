// Mail sending sits behind a tiny interface so the provider can be swapped (spec section 3).
import { Resend } from "resend";
import { emailEnabled, env } from "@/lib/env";

export interface MailMessage {
  to: string[];
  subject: string;
  html: string;
  text: string;
}

export interface Mailer {
  send(m: MailMessage): Promise<{ id: string }>;
}

class ResendMailer implements Mailer {
  private client = new Resend(env().RESEND_API_KEY);
  async send(m: MailMessage) {
    const { data, error } = await this.client.emails.send({ from: env().EMAIL_FROM as string, to: m.to, subject: m.subject, html: m.html, text: m.text });
    if (error || !data) throw new Error(`Resend: ${error?.message ?? "no response"}`);
    return { id: data.id };
  }
}

let mailer: Mailer | null = null;

export function getMailer(): Mailer {
  if (!emailEnabled()) throw new Error("Email is not configured. Add RESEND_API_KEY and EMAIL_FROM.");
  return (mailer ??= new ResendMailer());
}

export { emailEnabled };
