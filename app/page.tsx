export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    return Response.redirect('/begin', 307);
}

export default function RootPage() {
    return null;
}