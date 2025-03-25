// app/api/session/[sessionId]/messages/route.ts

import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';

export async function GET(req: Request, { params }: { params: { sessionId: string } }) {
  const { sessionId } = params;

  if (!sessionId) {
    return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
  }

  try {
    const session = await prisma.userSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({
      messages: session.conversationhistory,
      metadata: {
        pdfname: session.pdfname,
        started: session.sessionStartTime,
        ended: session.sessionEndTime,
      },
    });
  } catch (err) {
    console.error("Failed to load session messages:", err);
    return NextResponse.json({ error: 'Failed to fetch session messages' }, { status: 500 });
  }
}
