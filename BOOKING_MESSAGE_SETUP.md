# Automatic customer booking messages

The booking-request workflow works without a messaging provider, but the
operator will be told to contact the customer manually.

For automatic SMS, add these Vercel environment variables and redeploy:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER` (the Twilio sending number, including country code)

If SMS is not configured or cannot be sent, the system can use email when
these variables are present:

- `RESEND_API_KEY`
- `BOOKING_EMAIL_FROM` (a verified sender)
- `BOOKING_EMAIL_REPLY_TO` (optional)

Never put these private values into source files or upload them in a ZIP.
