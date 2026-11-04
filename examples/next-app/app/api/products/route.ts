export async function GET() {
  return Response.json([{ id: 1, name: 'Notebook' }]);
}

export async function POST(request: Request) {
  const body = await request.json();
  return Response.json(body, { status: 201 });
}
