import { NextResponse } from "next/server";
import { getCurrentUser } from "@/features/auth/lib/session";
import { biltySchema } from "@/features/bilty/schemas";
import { createBilty, getBiltys } from "@/features/bilty/service/bilty.service";

function toErrorResponse(error: unknown, fallbackMessage: string) {
  const message = error instanceof Error ? error.message : fallbackMessage;

  if (message === "Forbidden") {
    return NextResponse.json({ error: message }, { status: 403 });
  }
  if (message === "Bill number already exists") {
    return NextResponse.json({ error: message }, { status: 409 });
  }
  if (message === "Party is required") {
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const biltys = await getBiltys();
  return NextResponse.json({ biltys }, { status: 200 });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const result = biltySchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid input data", details: result.error.format() },
        { status: 400 }
      );
    }

    const bilty = await createBilty(result.data);
    return NextResponse.json({ bilty }, { status: 201 });
  } catch (error) {
    console.error("Create bilty error:", error);
    return toErrorResponse(error, "Failed to create bilty");
  }
}
