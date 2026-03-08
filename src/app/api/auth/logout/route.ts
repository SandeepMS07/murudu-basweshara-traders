import { NextResponse } from "next/server";
import { logoutUser } from "@/features/auth/services/auth.service";

export async function POST(request: Request) {
  try {
    await logoutUser();
    return NextResponse.json({ message: "Logged out successfully" }, { status: 200 });
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
