import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser, getSupabaseAdminClient, logAdminAuditAction } from "@/lib/admin-auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";

// Helper to normalize difficulty values into allowed DB enum constraints
function normalizeDifficulty(val?: string): string {
  if (!val) return "Intermediate";
  const lower = val.toLowerCase().trim();
  if (lower === "beginner" || lower === "foundational") return "Foundational";
  if (lower === "advanced") return "Advanced";
  if (lower === "all" || lower === "all levels" || lower === "all-levels") return "All Levels";
  return "Intermediate";
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminUser();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode });
  }

  try {
    const adminDb = getSupabaseAdminClient();
    const supabase = adminDb || (await createSupabaseServerClient());

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.toLowerCase().trim();
    const category = searchParams.get("category");
    const status = searchParams.get("status");
    const difficulty = searchParams.get("difficulty");

    // 1. Fetch all programs from Supabase
    let query = supabase.from("programs").select("*").order("created_at", { ascending: false });

    if (status && status !== "all") {
      query = query.eq("status", status.toLowerCase());
    }
    if (category && category !== "all") {
      query = query.or(`category.ilike.%${category}%,domain.ilike.%${category}%`);
    }

    const { data: dbPrograms, error } = await query;
    if (error) throw error;

    // 2. Fetch student enrollment statistics per programme
    const { data: enrollments } = await supabase
      .from("program_enrollments")
      .select("program_id, status");

    const enrollmentMap: Record<string, { count: number; completed: number }> = {};
    (enrollments || []).forEach((e) => {
      if (!enrollmentMap[e.program_id]) {
        enrollmentMap[e.program_id] = { count: 0, completed: 0 };
      }
      enrollmentMap[e.program_id].count += 1;
      if (e.status === "completed") {
        enrollmentMap[e.program_id].completed += 1;
      }
    });

    // 3. Fetch count of child learning paths per programme (graceful fallback if table is newly seeded)
    const pathCountMap: Record<string, number> = {};
    try {
      const { data: paths } = await supabase.from("learning_paths").select("program_id");
      (paths || []).forEach((p) => {
        if (p.program_id) {
          pathCountMap[p.program_id] = (pathCountMap[p.program_id] || 0) + 1;
        }
      });
    } catch (err) {
      console.warn("Could not query learning_paths count:", err);
    }

    // 4. Transform and hydrate programmes
    let formattedPrograms = (dbPrograms || []).map((p) => {
      const stats = enrollmentMap[p.id] || { count: 0, completed: 0 };
      const completionRate = stats.count > 0 ? Math.round((stats.completed / stats.count) * 100) : 0;
      const normalizedDiff = normalizeDifficulty(p.difficulty_level);

      return {
        id: p.id,
        title: p.title,
        description: p.description || "",
        domain: p.domain || p.category || "General",
        category: p.category || p.domain || "General",
        difficultyLevel: normalizedDiff,
        duration: p.duration || "8 Weeks",
        thumbnailUrl: p.thumbnail_url || null,
        status: p.status || "active",
        enrolledCount: stats.count,
        completionRate,
        learningPathsCount: pathCountMap[p.id] || 0,
        createdAt: p.created_at,
        updatedAt: p.updated_at || p.created_at,
      };
    });

    // Client-side in-memory search and difficulty filtering if provided
    if (search) {
      formattedPrograms = formattedPrograms.filter(
        (p) =>
          p.title.toLowerCase().includes(search) ||
          p.description.toLowerCase().includes(search) ||
          p.category.toLowerCase().includes(search)
      );
    }

    if (difficulty && difficulty !== "all") {
      const targetDiff = normalizeDifficulty(difficulty);
      formattedPrograms = formattedPrograms.filter((p) => p.difficultyLevel === targetDiff);
    }

    return NextResponse.json({
      success: true,
      programs: formattedPrograms,
      totalCount: formattedPrograms.length,
    });
  } catch (err: any) {
    console.error("Admin programs GET API error:", err);
    return NextResponse.json(
      { error: "Failed to fetch programmes", details: err.message },
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
    const {
      title,
      description,
      domain,
      category,
      difficultyLevel,
      difficulty_level,
      duration,
      thumbnailUrl,
      thumbnail_url,
      status,
      action,
    } = body;

    const adminDb = getSupabaseAdminClient();
    const supabase = adminDb || (await createSupabaseServerClient());

    if (!title || !title.trim()) {
      return NextResponse.json({ error: "Programme title is required." }, { status: 400 });
    }

    const cleanTitle = title.trim();
    const cleanCategory = (category || domain || "General").trim();
    const cleanDifficulty = normalizeDifficulty(difficultyLevel || difficulty_level);
    const cleanDuration = (duration || "8 Weeks").trim();
    const cleanStatus = ["active", "inactive", "draft"].includes(status?.toLowerCase())
      ? status.toLowerCase()
      : "active";
    const cleanThumbnail = (thumbnailUrl || thumbnail_url || "").trim() || null;

    const newProgram = {
      title: cleanTitle,
      description: (description || "").trim(),
      domain: cleanCategory,
      category: cleanCategory,
      difficulty_level: cleanDifficulty,
      duration: cleanDuration,
      thumbnail_url: cleanThumbnail,
      status: cleanStatus,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from("programs").insert(newProgram).select().single();
    if (error) throw error;

    await logAdminAuditAction({
      adminUserId: auth.user!.id,
      action: "CREATE_PROGRAM",
      targetType: "program",
      targetId: data?.id,
      metadata: { title: cleanTitle, category: cleanCategory, status: cleanStatus },
    });

    return NextResponse.json({
      success: true,
      message: "Programme created successfully.",
      program: {
        id: data.id,
        title: data.title,
        description: data.description,
        domain: data.domain,
        category: data.category,
        difficultyLevel: normalizeDifficulty(data.difficulty_level),
        duration: data.duration,
        thumbnailUrl: data.thumbnail_url,
        status: data.status,
        enrolledCount: 0,
        completionRate: 0,
        learningPathsCount: 0,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      },
    });
  } catch (err: any) {
    console.error("Admin program POST API error:", err);
    return NextResponse.json(
      { error: "Failed to create programme", details: err.message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminUser();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode });
  }

  try {
    const body = await request.json();
    const {
      id,
      title,
      description,
      domain,
      category,
      difficultyLevel,
      difficulty_level,
      duration,
      thumbnailUrl,
      thumbnail_url,
      status,
    } = body;

    if (!id) {
      return NextResponse.json({ error: "Programme ID is required." }, { status: 400 });
    }

    const adminDb = getSupabaseAdminClient();
    const supabase = adminDb || (await createSupabaseServerClient());

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (title !== undefined) {
      if (!title.trim()) {
        return NextResponse.json({ error: "Programme title cannot be empty." }, { status: 400 });
      }
      updates.title = title.trim();
    }

    if (description !== undefined) {
      updates.description = description.trim();
    }

    if (category !== undefined || domain !== undefined) {
      const cat = (category || domain || "General").trim();
      updates.category = cat;
      updates.domain = cat;
    }

    if (difficultyLevel !== undefined || difficulty_level !== undefined) {
      updates.difficulty_level = normalizeDifficulty(difficultyLevel || difficulty_level);
    }

    if (duration !== undefined) {
      updates.duration = duration.trim() || "8 Weeks";
    }

    if (thumbnailUrl !== undefined || thumbnail_url !== undefined) {
      const thumb = (thumbnailUrl || thumbnail_url || "").trim();
      updates.thumbnail_url = thumb || null;
    }

    if (status !== undefined) {
      const lower = status.toLowerCase();
      if (!["active", "inactive", "draft"].includes(lower)) {
        return NextResponse.json(
          { error: "Status must be either 'active', 'inactive', or 'draft'." },
          { status: 400 }
        );
      }
      updates.status = lower;
    }

    const { data, error } = await supabase
      .from("programs")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    await logAdminAuditAction({
      adminUserId: auth.user!.id,
      action: "UPDATE_PROGRAM",
      targetType: "program",
      targetId: id,
      metadata: updates,
    });

    return NextResponse.json({
      success: true,
      message: "Programme updated successfully.",
      program: {
        id: data.id,
        title: data.title,
        description: data.description,
        domain: data.domain,
        category: data.category,
        difficultyLevel: normalizeDifficulty(data.difficulty_level),
        duration: data.duration,
        thumbnailUrl: data.thumbnail_url,
        status: data.status,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      },
    });
  } catch (err: any) {
    console.error("Admin program PATCH API error:", err);
    return NextResponse.json(
      { error: "Failed to update programme", details: err.message },
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
    const action = searchParams.get("action"); // 'deactivate' or null
    const force = searchParams.get("force") === "true";

    if (!id) {
      return NextResponse.json({ error: "Programme ID is required." }, { status: 400 });
    }

    const adminDb = getSupabaseAdminClient();
    const supabase = adminDb || (await createSupabaseServerClient());

    // 1. Check if students are enrolled in this programme
    const { count: enrolledCount } = await supabase
      .from("program_enrollments")
      .select("*", { count: "exact", head: true })
      .eq("program_id", id);

    // 2. Safe Alternative: Deactivate rather than deleting
    if (action === "deactivate") {
      const { data, error } = await supabase
        .from("programs")
        .update({ status: "inactive", updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      await logAdminAuditAction({
        adminUserId: auth.user!.id,
        action: "DEACTIVATE_PROGRAM",
        targetType: "program",
        targetId: id,
      });

      return NextResponse.json({
        success: true,
        message: "Programme successfully deactivated. Existing student records are preserved.",
        actionTaken: "deactivated",
        program: data,
      });
    }

    // 3. Safety Guard: Prevent accidental hard deletion if students are actively enrolled
    if (enrolledCount && enrolledCount > 0 && !force) {
      return NextResponse.json(
        {
          error: `Cannot permanently delete this programme because ${enrolledCount} candidate(s) are actively enrolled. We recommend deactivating the programme instead to preserve their training records.`,
          enrolledCount,
          canDeactivate: true,
        },
        { status: 409 }
      );
    }

    // 4. Safe Cascade Cleanup: Delete enrollments & learning paths first
    await supabase.from("program_enrollments").delete().eq("program_id", id);
    try {
      await supabase.from("learning_paths").delete().eq("program_id", id);
    } catch {}

    // 5. Delete program
    const { error } = await supabase.from("programs").delete().eq("id", id);
    if (error) throw error;

    await logAdminAuditAction({
      adminUserId: auth.user!.id,
      action: "DELETE_PROGRAM",
      targetType: "program",
      targetId: id,
      metadata: { force, previousEnrolledCount: enrolledCount || 0 },
    });

    return NextResponse.json({
      success: true,
      message: "Programme and its child records were permanently deleted.",
      actionTaken: "deleted",
    });
  } catch (err: any) {
    console.error("Admin program DELETE API error:", err);
    return NextResponse.json(
      { error: "Failed to delete programme", details: err.message },
      { status: 500 }
    );
  }
}
