import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser, getSupabaseAdminClient, logAdminAuditAction } from "@/lib/admin-auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  const auth = await requireAdminUser();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode });
  }

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const roleFilter = searchParams.get("role") || "all"; // 'user' | 'admin' | 'all'
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const offset = (page - 1) * limit;

    const adminDb = getSupabaseAdminClient();
    const supabase = adminDb || (await createSupabaseServerClient());

    // 1. Fetch all Auth users to resolve real emails and ensure profile consistency
    const authMap = new Map<string, any>();
    if (adminDb) {
      try {
        const { data: authData } = await adminDb.auth.admin.listUsers({ perPage: 1000 });
        if (authData?.users) {
          authData.users.forEach((u) => authMap.set(u.id, u));

          // Auto-sync any auth user whose profile row is missing or has null full_name
          const { data: currentProfiles } = await adminDb
            .from("profiles")
            .select("id, full_name, target_role, role");
          const existingProfileMap = new Map((currentProfiles || []).map((p) => [p.id, p]));

          const toSync: any[] = [];
          for (const u of authData.users) {
            const p = existingProfileMap.get(u.id);
            const metaName = u.user_metadata?.full_name || u.user_metadata?.name;
            const metaTarget = u.user_metadata?.target_role;
            const metaRole = u.user_metadata?.role || "user";

            if (!p) {
              toSync.push({
                id: u.id,
                full_name: metaName || u.email?.split("@")[0] || "Candidate",
                target_role: metaTarget || "Full Stack Engineer",
                role: metaRole,
                created_at: u.created_at || new Date().toISOString(),
              });
            } else if (!p.full_name && metaName) {
              toSync.push({
                id: u.id,
                full_name: metaName,
                target_role: p.target_role || metaTarget || "Full Stack Engineer",
                role: p.role || metaRole,
              });
            }
          }

          if (toSync.length > 0) {
            await adminDb.from("profiles").upsert(toSync, { onConflict: "id" });
          }
        }
      } catch (authErr) {
        console.warn("Could not list auth users for email resolution:", authErr);
      }
    }

    let query = supabase.from("profiles").select("*", { count: "exact" });

    if (roleFilter !== "all" && (roleFilter === "user" || roleFilter === "admin")) {
      query = query.eq("role", roleFilter);
    }

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,target_role.ilike.%${search}%`);
    }

    query = query.order("created_at", { ascending: false }).range(offset, offset + limit - 1);

    const { data: profiles, count, error } = await query;

    if (error) throw error;

    // Fetch session summary stats for these profiles
    const userIds = profiles?.map((p) => p.id) || [];
    let sessionMap: Record<string, { count: number; avgScore: number }> = {};

    if (userIds.length > 0) {
      const { data: sessions } = await supabase
        .from("sessions")
        .select("user_id, overall_score")
        .in("user_id", userIds);

      if (sessions) {
        sessions.forEach((s) => {
          if (!sessionMap[s.user_id]) {
            sessionMap[s.user_id] = { count: 0, avgScore: 0 };
          }
          sessionMap[s.user_id].count += 1;
        });
      }
    }

    const formattedUsers = (profiles || []).map((p) => {
      const authUser = authMap.get(p.id);
      const name = p.full_name || authUser?.user_metadata?.full_name || authUser?.user_metadata?.name || "Unnamed Candidate";
      const email = authUser?.email || p.email || `${name.toLowerCase().replace(/\s+/g, ".")}@preppilot.com`;
      const targetRole = p.target_role || authUser?.user_metadata?.target_role || "General Candidate";
      const role = p.role || authUser?.user_metadata?.role || "user";

      return {
        id: p.id,
        full_name: name,
        name: name,
        email: email,
        role: role,
        target_role: targetRole,
        targetRole: targetRole,
        status: "Active",
        created_at: p.created_at || authUser?.created_at || new Date().toISOString(),
        joinedAt: p.created_at || authUser?.created_at || new Date().toISOString(),
        programs: sessionMap[p.id]?.count ? 1 : 0,
        progress: sessionMap[p.id]?.count ? 75 : 0,
        interviewsCount: sessionMap[p.id]?.count || 0,
        resumeUrl: p.resume_url,
      };
    });

    return NextResponse.json({
      success: true,
      users: formattedUsers,
      pagination: {
        total: count || formattedUsers.length,
        page,
        limit,
        totalPages: Math.ceil((count || formattedUsers.length) / limit),
      },
    });
  } catch (err: any) {
    console.error("Admin users list API error:", err);
    return NextResponse.json(
      { error: "Failed to fetch user list", details: err.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminUser();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode });
  }

  try {
    const body = await request.json();
    const { fullName, targetRole, role, email } = body;

    if (!fullName) {
      return NextResponse.json({ error: "Full name is required." }, { status: 400 });
    }

    const adminDb = getSupabaseAdminClient();
    const supabase = adminDb || (await createSupabaseServerClient());

    const newProfileId = crypto.randomUUID();
    const newProfile = {
      id: newProfileId,
      full_name: fullName,
      target_role: targetRole || "Software Engineer",
      role: role === "admin" ? "admin" : "user",
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from("profiles").insert(newProfile).select().single();

    if (error) throw error;

    await logAdminAuditAction({
      adminUserId: auth.user!.id,
      action: "CREATE_USER_PROFILE",
      targetType: "user",
      targetId: newProfileId,
      metadata: { fullName, role, targetRole },
    });

    return NextResponse.json({
      success: true,
      message: "User profile created in database.",
      user: data || newProfile,
    });
  } catch (err: any) {
    console.error("Admin create user API error:", err);
    return NextResponse.json(
      { error: "Failed to create user profile", details: err.message },
      { status: 500 }
    );
  }
}
