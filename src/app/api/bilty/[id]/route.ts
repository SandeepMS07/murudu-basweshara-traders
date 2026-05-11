import { NextResponse } from "next/server";
import { getCurrentUser } from "@/features/auth/lib/session";
import { biltySchema } from "@/features/bilty/schemas";
import {
  deleteBilty,
  getBiltyById,
  updateBilty,
} from "@/features/bilty/service/bilty.service";

function toErrorResponse(error: unknown, fallbackMessage: string) {
  const message = error instanceof Error ? error.message : fallbackMessage;

  if (message === "Forbidden") {
    return NextResponse.json({ error: message }, { status: 403 });
  }
  if (message === "Bilty not found" || message === "Not found") {
    return NextResponse.json({ error: message }, { status: 404 });
  }
  if (message === "Bill number already exists") {
    return NextResponse.json({ error: message }, { status: 409 });
  }
  if (message === "Party is required") {
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const bilty = await getBiltyById(id);
  if (!bilty) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ bilty }, { status: 200 });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const result = biltySchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid input data", details: result.error.format() },
        { status: 400 }
      );
    }

    const bilty = await updateBilty(id, result.data);
    return NextResponse.json({ bilty }, { status: 200 });
  } catch (error) {
    console.error("Update bilty error:", error);
    return toErrorResponse(error, "Failed to update bilty");
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const bilty = await getBiltyById(id);
    if (!bilty) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await deleteBilty(id);
    return NextResponse.json({ message: "Deleted successfully" }, { status: 200 });
  } catch (error) {
    console.error("Delete bilty error:", error);
    return toErrorResponse(error, "Failed to delete bilty");
  }
}
