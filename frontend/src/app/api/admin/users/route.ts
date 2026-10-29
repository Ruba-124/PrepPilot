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
    const { fullName, targetRole, role, email, password } = body;

    if (!fullName || !fullName.trim()) {
      return NextResponse.json({ error: "Full name is required." }, { status: 400 });
    }

    const cleanName = fullName.trim();
    const cleanRole = role === "admin" ? "admin" : "user";
    const cleanTargetRole = targetRole?.trim() || "Software Engineer";

    const adminDb = getSupabaseAdminClient();
    if (!adminDb) {
      return NextResponse.json(
        { error: "Supabase Admin Service Role client is not configured." },
        { status: 500 }
      );
    }

    // Determine email address
    let userEmail = email?.trim()?.toLowerCase();
    if (!userEmail) {
      const slug = cleanName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, ".")
        .replace(/\.+/g, ".")
        .replace(/^\.|\.$/g, "");
      userEmail = `${slug || "candidate"}.${Date.now().toString().slice(-4)}@preppilot.com`;
    }

    const userPassword = password?.trim() || `PrepPilot@${new Date().getFullYear()}!`;

    // 1. Provision user in Supabase Auth so profiles foreign key (auth.users.id) is satisfied
    let userId: string;

    const { data: authCreated, error: authErr } = await adminDb.auth.admin.createUser({
      email: userEmail,
      password: userPassword,
      email_confirm: true,
      user_metadata: {
        full_name: cleanName,
        name: cleanName,
        target_role: cleanTargetRole,
        role: cleanRole,
      },
    });

    if (authErr) {
      // Check if user already exists in auth.users
      if (
        authErr.message?.toLowerCase().includes("already registered") ||
        authErr.message?.toLowerCase().includes("already been registered") ||
        authErr.code === "email_exists"
      ) {
        const { data: existingList } = await adminDb.auth.admin.listUsers();
        const existingUser = existingList?.users?.find(
          (u) => u.email?.toLowerCase() === userEmail.toLowerCase()
        );
        if (existingUser) {
          userId = existingUser.id;
        } else {
          throw authErr;
        }
      } else {
        throw authErr;
      }
    } else if (authCreated?.user) {
      userId = authCreated.user.id;
    } else {
      throw new Error("Failed to create authentication user.");
    }

    // 2. Upsert profile in public.profiles with valid foreign key ID
    const newProfile = {
      id: userId,
      full_name: cleanName,
      target_role: cleanTargetRole,
      role: cleanRole,
      created_at: new Date().toISOString(),
    };

    const { data: profileData, error: profileErr } = await adminDb
      .from("profiles")
      .upsert(newProfile, { onConflict: "id" })
      .select()
      .single();

    if (profileErr) throw profileErr;

    // 3. Log audit action
    await logAdminAuditAction({
      adminUserId: auth.user!.id,
      action: "CREATE_USER_PROFILE",
      targetType: "user",
      targetId: userId,
      metadata: { fullName: cleanName, email: userEmail, role: cleanRole, targetRole: cleanTargetRole },
    });

    return NextResponse.json({
      success: true,
      message: "User profile created successfully.",
      user: {
        id: userId,
        email: userEmail,
        full_name: cleanName,
        targetRole: cleanTargetRole,
        role: cleanRole,
        status: "Active",
        created_at: newProfile.created_at,
        joinedAt: newProfile.created_at,
        programs: 0,
        progress: 0,
        interviewsCount: 0,
      },
    });
  } catch (err: any) {
    console.error("Admin create user API error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to create user profile", details: err.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdminUser();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "User ID is required." }, { status: 400 });
    }

    if (id === auth.user?.id) {
      return NextResponse.json({ error: "You cannot delete your own admin account." }, { status: 400 });
    }

    const adminDb = getSupabaseAdminClient();
    if (!adminDb) {
      return NextResponse.json({ error: "Supabase admin client not available." }, { status: 500 });
    }

    // Clean up dependent records
    await adminDb.from("sessions").delete().eq("user_id", id);
    await adminDb.from("program_enrollments").delete().eq("user_id", id);
    await adminDb.from("profiles").delete().eq("id", id);

    // Delete from auth.users
    await adminDb.auth.admin.deleteUser(id);

    await logAdminAuditAction({
      adminUserId: auth.user!.id,
      action: "DELETE_USER",
      targetType: "user",
      targetId: id,
    });

    return NextResponse.json({ success: true, message: "User deleted successfully." });
  } catch (err: any) {
    console.error("Delete user API error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to delete user", details: err.message },
      { status: 500 }
    );
  }
}
