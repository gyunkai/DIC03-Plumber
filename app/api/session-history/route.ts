import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { user_id } = await req.json();

    if (!user_id) {
      return NextResponse.json({ error: "Missing user ID" }, { status: 400 });
    }

    const sessions = await prisma.userSession.findMany({
      where: { userId: user_id },
      orderBy: { sessionStartTime: "desc" },
      select: {
        id: true,
        userId: true,
        pdfname: true,
        sessionStartTime: true,
        sessionEndTime: true,
        conversationhistory: true, 
      },
    });
    console.log("📨 Received user_id for session history:", user_id);

    return NextResponse.json({ success: true, sessions });
  } catch (error) {
    console.error("Failed to fetch session history:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
