import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { userId, pdfname } = await req.json();

    if (!userId || !pdfname) {
      return NextResponse.json({ error: "Missing userId or pdfname" }, { status: 400 });
    }

    const session = await prisma.userSession.create({
      data: {
        userId,
        pdfname,
        sessionStartTime: new Date(),
        conversationhistory: [],
      },
    });

    return NextResponse.json({ success: true, session });
  } catch (error) {
    console.error("❌ Error creating new session:", error);
    return NextResponse.json(
      { error: "Failed to start new session", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
