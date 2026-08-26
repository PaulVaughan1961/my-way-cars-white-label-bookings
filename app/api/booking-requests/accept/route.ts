import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  customerEmail,
  escapeHtml,
  notifyCustomer,
} from "@/lib/bookingRequestNotifications";

type BookingRequest = {
  id: string;
  notes: string | null;
  return_group_id: string | null;
  passenger_name: string | null;
  passenger_phone: string | null;
  pickup_address: string | null;
  dropoff_address: string | null;
  pickup_datetime: string | null;
  status: string | null;
};

function appendAudit(notes: string | null, line: string) {
  const current = notes?.trim() ?? "";
  return current ? `${current}\n${line}` : line;
}

function legLabel(selected: BookingRequest, linked: BookingRequest[]) {
  if (linked.length < 2) return "journey";
  const ordered = [...linked].sort(
    (a, b) =>
      new Date(a.pickup_datetime ?? 0).getTime() -
      new Date(b.pickup_datetime ?? 0).getTime()
  );
  return ordered[0]?.id === selected.id ? "outward journey" : "return journey";
}

function journeyDescription(booking: BookingRequest) {
  const when = booking.pickup_datetime
    ? new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Europe/London",
      }).format(new Date(booking.pickup_datetime))
    : "date and time not supplied";
  return `${when}, from ${booking.pickup_address ?? "pickup not supplied"} to ${booking.dropoff_address ?? "drop-off not supplied"}`;
}

export async function POST(request: Request) {
  try {
    const token = request.headers
      .get("authorization")
      ?.replace(/^Bearer\s+/i, "");
    if (!token) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });
    }

    const supabase = createClient(url, key, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return NextResponse.json({ error: "Your operator session has expired." }, { status: 401 });
    }
    const { data: operator } = await supabase
      .from("operator_users")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!operator) {
      return NextResponse.json({ error: "Operator access required" }, { status: 403 });
    }

    const { bookingId } = (await request.json()) as { bookingId?: string };
    if (!bookingId) {
      return NextResponse.json({ error: "A booking is required" }, { status: 400 });
    }

    const fields =
      "id,notes,return_group_id,passenger_name,passenger_phone,pickup_address,dropoff_address,pickup_datetime,status";
    const { data, error } = await supabase
      .from("bookings")
      .select(fields)
      .eq("id", bookingId)
      .single();
    if (error || !data) {
      return NextResponse.json({ error: "Booking request not found" }, { status: 404 });
    }
    const selected = data as BookingRequest;
    let linked = [selected];
    if (selected.return_group_id) {
      const result = await supabase
        .from("bookings")
        .select(fields)
        .eq("return_group_id", selected.return_group_id);
      if (result.error) throw result.error;
      linked = (result.data as BookingRequest[]) ?? [selected];
    }

    const label = legLabel(selected, linked);
    const audit = `Customer notification pending: ${label} accepted`;
    const updatedNotes = appendAudit(selected.notes, audit);
    const update = await supabase
      .from("bookings")
      .update({ status: "Scheduled", notes: updatedNotes })
      .eq("id", selected.id);
    if (update.error) throw update.error;

    const other = linked.find((booking) => booking.id !== selected.id);
    const otherStatus = other?.status ?? "";
    const suffix =
      other && otherStatus === "Pending Approval"
        ? ` Your ${label === "outward journey" ? "return journey" : "outward journey"} is still being reviewed.`
        : other && otherStatus === "Scheduled"
        ? " Both parts of your return booking are now confirmed."
        : "";
    const detail = journeyDescription(selected);
    const plainText = `My Way Cars: Your ${label} is confirmed: ${detail}.${suffix} We will send driver details separately.`;
    const passenger = selected.passenger_name?.trim() || "Customer";
    const notice = await notifyCustomer({
      phone: selected.passenger_phone,
      email: customerEmail(selected.notes),
      subject: "My Way Cars booking confirmation",
      plainText,
      html: `<p>Dear ${escapeHtml(passenger)},</p><p>Your <strong>${escapeHtml(label)}</strong> is confirmed.</p><p>${escapeHtml(detail)}</p><p>${escapeHtml(suffix.trim())}</p><p>We will send driver details separately.</p><p>Kind regards,<br>My Way Cars</p>`,
    });

    await supabase
      .from("bookings")
      .update({
        notes: appendAudit(
          updatedNotes.replace(audit, `Request accepted: ${label}`),
          `Customer notification: ${notice.detail}`
        ),
      })
      .eq("id", selected.id);

    const message =
      notice.channel === "manual"
        ? `${label[0].toUpperCase() + label.slice(1)} accepted. ${notice.detail}; please notify the customer manually.`
        : `${label[0].toUpperCase() + label.slice(1)} accepted and customer ${notice.channel} sent.`;
    return NextResponse.json({ notification: notice.channel, message });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to accept request" },
      { status: 500 }
    );
  }
}
