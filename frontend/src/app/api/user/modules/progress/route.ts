import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-session";
import { getSupabaseAdminClient } from "@/lib/admin-auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthenticated. Please log in to update module progress." },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { moduleId, completed = true } = body;

    if (!moduleId) {
      return NextResponse.json(
        { success: false, error: "Module ID is required." },
        { status: 400 }
      );
    }

    const adminDb = getSupabaseAdminClient();
    const supabase = adminDb || (await createSupabaseServerClient());
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: "Database client is not available." },
        { status: 500 }
      );
    }

    // 1. Verify module exists and resolve its learning path & parent program
    const { data: moduleData, error: modErr } = await supabase
      .from("learning_modules")
      .select("id, title, learning_path_id, learning_paths(id, program_id, title)")
      .eq("id", moduleId)
      .single();

    if (modErr || !moduleData) {
      return NextResponse.json(
        { success: false, error: "Curriculum module not found." },
        { status: 404 }
      );
    }

    const parentPath = moduleData.learning_paths as any;
    const programId = parentPath?.program_id;

    if (!programId) {
      return NextResponse.json(
        { success: false, error: "Module does not belong to a valid programme." },
        { status: 400 }
      );
    }

    // 2. Authorization check: Student must be enrolled in the parent programme!
    const { data: enrollment, error: enrErr } = await supabase
      .from("program_enrollments")
      .select("id, status, progress")
      .eq("user_id", user.id)
      .eq("program_id", programId)
      .maybeSingle();

    if (enrErr || !enrollment) {
      return NextResponse.json(
        {
          success: false,
          error: "You are not enrolled in this training programme. Please enrol first before tracking progress.",
        },
        { status: 403 }
      );
    }

    // 3. Upsert into public.module_progress (strictly for user.id)
    const isCompleted = Boolean(completed);
    const now = new Date().toISOString();

    const progressRecord = {
      user_id: user.id,
      module_id: moduleId,
      status: isCompleted ? "completed" : "in_progress",
      completion_date: isCompleted ? now : null,
      updated_at: now,
    };

    const { error: upsertErr } = await supabase
      .from("module_progress")
      .upsert(progressRecord, { onConflict: "user_id,module_id" });

    if (upsertErr) throw upsertErr;

    // 4. Recalculate Learning Path Progress:
    // Count all modules in this learning path
    const { data: pathModules } = await supabase
      .from("learning_modules")
      .select("id")
      .eq("learning_path_id", parentPath.id);

    const pathModIds = (pathModules || []).map((m) => m.id);
    let pathProgress = 0;

    if (pathModIds.length > 0) {
      const { count: completedInPath } = await supabase
        .from("module_progress")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "completed")
        .in("module_id", pathModIds);

      pathProgress = Math.round(((completedInPath || 0) / pathModIds.length) * 100);
    }

    // 5. Recalculate Overall Programme Progress:
    // Find all learning paths under this program
    const { data: progPaths } = await supabase
      .from("learning_paths")
      .select("id, learning_modules(id)")
      .eq("program_id", programId);

    const allProgModIds: string[] = [];
    (progPaths || []).forEach((lp: any) => {
      if (Array.isArray(lp.learning_modules)) {
        lp.learning_modules.forEach((m: any) => allProgModIds.push(m.id));
      }
    });

    let progProgress = 0;
    if (allProgModIds.length > 0) {
      const { count: completedInProg } = await supabase
        .from("module_progress")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "completed")
        .in("module_id", allProgModIds);

      progProgress = Math.round(((completedInProg || 0) / allProgModIds.length) * 100);
    }

    // Update program_enrollments progress and status
    const enrollmentStatus =
      progProgress === 100 ? "completed" : progProgress > 0 ? "in_progress" : "enrolled";

    await supabase
      .from("program_enrollments")
      .update({
        progress: progProgress,
        status: enrollmentStatus,
      })
      .eq("id", enrollment.id);

    return NextResponse.json({
      success: true,
      message: isCompleted ? "Module marked as completed!" : "Module marked as pending.",
      moduleId,
      isCompleted,
      completionDate: isCompleted ? now : null,
      pathId: parentPath.id,
      pathProgress,
      programId,
      programProgress: progProgress,
      enrollmentStatus,
    });
  } catch (err: any) {
    console.error("Module progress update error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to update module progress", details: err.message },
      { status: 500 }
    );
  }
}
