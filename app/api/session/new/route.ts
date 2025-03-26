import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { userId, pdfname } = await req.json();

    if (!userId || !pdfname) {
      return NextResponse.json({ error: "Missing userId or pdfname" }, { status: 400 });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Extract just the filename from the path if it contains slashes
    const filename = pdfname.split('/').pop()?.split('\\').pop() || pdfname;

    const session = await prisma.userSession.create({
      data: {
        userId,
        pdfname: filename,
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
