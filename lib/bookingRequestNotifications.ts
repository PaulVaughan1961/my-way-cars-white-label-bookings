type NoticeResult = {
  channel: "sms" | "email" | "manual";
  detail: string;
};

export function customerEmail(notes: string | null) {
  return notes?.match(/^Customer email:\s*(.+)$/im)?.[1]?.trim() || null;
}

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function ukPhone(value: string | null) {
  const phone = (value ?? "").replace(/[^\d+]/g, "");
  if (phone.startsWith("07")) return `+44${phone.slice(1)}`;
  if (phone.startsWith("0044")) return `+${phone.slice(2)}`;
  return phone || null;
}

export async function notifyCustomer({
  phone,
  email,
  subject,
  plainText,
  html,
}: {
  phone: string | null;
  email: string | null;
  subject: string;
  plainText: string;
  html: string;
}): Promise<NoticeResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromPhone = process.env.TWILIO_PHONE_NUMBER;
  const toPhone = ukPhone(phone);

  if (accountSid && authToken && fromPhone && toPhone) {
    const body = new URLSearchParams({
      From: fromPhone,
      To: toPhone,
      Body: plainText,
    });
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${accountSid}:${authToken}`
          ).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      }
    );
    if (response.ok) {
      return { channel: "sms", detail: `SMS sent to ${toPhone}` };
    }
  }

  if (email && process.env.RESEND_API_KEY && process.env.BOOKING_EMAIL_FROM) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.BOOKING_EMAIL_FROM,
        to: [email],
        reply_to: process.env.BOOKING_EMAIL_REPLY_TO || undefined,
        subject,
        html,
      }),
    });
    if (response.ok) {
      return { channel: "email", detail: `Email sent to ${email}` };
    }
  }

  return {
    channel: "manual",
    detail: toPhone || email
      ? "Automatic customer messaging is not configured"
      : "No customer phone number or email was supplied",
  };
}
