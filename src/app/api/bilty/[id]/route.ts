import { NextResponse } from "next/server";
import { getCurrentUser } from "@/features/auth/lib/session";
import { biltySchema } from "@/features/bilty/schemas";
import {
  deleteBilty,
  getBiltyById,
  updateBilty,
} from "@/features/bilty/service/bilty.service";

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
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
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
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
