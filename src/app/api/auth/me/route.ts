import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      memberships: user.memberships.map((m) => ({
        id: m.id,
        orgRole: m.orgRole,
        organization: {
          id: m.organization.id,
          name: m.organization.name,
          slug: m.organization.slug,
          type: m.organization.type,
        },
      })),
    },
  });
}
