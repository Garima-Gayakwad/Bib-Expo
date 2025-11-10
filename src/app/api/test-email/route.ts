import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET() {
  try {
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { success: false, error: "RESEND_API_KEY is missing" },
        { status: 500 }
      );
    }

    if (!process.env.EMAIL_FROM) {
      return NextResponse.json(
        { success: false, error: "EMAIL_FROM is missing" },
        { status: 500 }
      );
    }

    const data = await resend.emails.send({
      from: process.env.EMAIL_FROM,
      to: "vvinit594@gmail.com",
      subject: "Test Email - Bib Expo Dev Mode",
      text: "If you received this, Resend is working perfectly.",
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send test email";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
