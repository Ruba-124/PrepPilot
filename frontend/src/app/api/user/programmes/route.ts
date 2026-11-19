import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-session";
import { getSupabaseAdminClient } from "@/lib/admin-auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthenticated. Please log in to view programmes." },
        { status: 401 }
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

    // 1. Fetch all ACTIVE programmes published by admin (never draft or inactive)
    const { data: dbPrograms, error: progErr } = await supabase
      .from("programs")
      .select("*, learning_paths(*, learning_modules(*))")
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (progErr) throw progErr;

    // 2. Fetch student's enrollments from program_enrollments table
    const { data: enrollments, error: enrErr } = await supabase
      .from("program_enrollments")
      .select("*")
      .eq("user_id", user.id);

    if (enrErr) throw enrErr;

    const enrollmentMap = new Map<string, any>();
    (enrollments || []).forEach((e) => {
      enrollmentMap.set(e.program_id, e);
    });

    // 3. Fetch student's module progress from module_progress table
    const { data: userModuleProgress, error: mpErr } = await supabase
      .from("module_progress")
      .select("*")
      .eq("user_id", user.id);

    if (mpErr) throw mpErr;

    const completedModuleIds = new Set<string>();
    const moduleProgressMap = new Map<string, any>();
    (userModuleProgress || []).forEach((mp) => {
      moduleProgressMap.set(mp.module_id, mp);
      if (mp.status === "completed") {
        completedModuleIds.add(mp.module_id);
      }
    });

    // 4. Transform programmes with real progress, path summaries, and modules
    let totalModulesAcrossEnrolled = 0;
    let completedModulesAcrossEnrolled = 0;
    const myLearningPathsList: any[] = [];
    const completedModulesList: any[] = [];
    let nextPendingModule: any = null;

    const availablePrograms = (dbPrograms || []).map((prog: any) => {
      const isEnrolled = enrollmentMap.has(prog.id);
      const enrollment = enrollmentMap.get(prog.id) || null;

      // Extract and sort active learning paths
      const rawPaths = Array.isArray(prog.learning_paths) ? prog.learning_paths : [];
      const activePaths = rawPaths
        .filter((lp: any) => lp.status !== "draft" && lp.status !== "inactive")
        .sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0));

      let programTotalModules = 0;
      let programCompletedModules = 0;

      const learningPaths = activePaths.map((lp: any) => {
        const rawMods = Array.isArray(lp.learning_modules) ? lp.learning_modules : [];
        const sortedMods = [...rawMods].sort(
          (a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0)
        );

        let pathCompletedCount = 0;
        const modules = sortedMods.map((m: any, idx: number) => {
          const isCompleted = completedModuleIds.has(m.id);
          const progRecord = moduleProgressMap.get(m.id);

          if (isCompleted) {
            pathCompletedCount += 1;
            if (isEnrolled) {
              completedModulesList.push({
                id: m.id,
                title: m.title,
                pathId: lp.id,
                pathTitle: lp.title,
                programId: prog.id,
                programTitle: prog.title,
                duration: m.estimated_duration || "45 mins",
                completionDate: progRecord?.completion_date || progRecord?.updated_at || null,
              });
            }
          } else if (isEnrolled && !nextPendingModule) {
            nextPendingModule = {
              id: m.id,
              title: m.title,
              description: m.description,
              duration: m.estimated_duration || "45 mins",
              displayOrder: m.display_order ?? idx + 1,
              pathId: lp.id,
              pathTitle: lp.title,
              programId: prog.id,
              programTitle: prog.title,
              learningObjectives: Array.isArray(m.learning_objectives) ? m.learning_objectives : [],
              resourceUrl: m.resource_url || null,
            };
          }

          return {
            id: m.id,
            learningPathId: m.learning_path_id,
            title: m.title,
            description: m.description || "",
            learningObjectives: Array.isArray(m.learning_objectives) ? m.learning_objectives : [],
            resourceUrl: m.resource_url || null,
            estimatedDuration: m.estimated_duration || "45 mins",
            displayOrder: m.display_order ?? idx + 1,
            isCompleted,
            completionDate: progRecord?.completion_date || null,
          };
        });

        programTotalModules += modules.length;
        programCompletedModules += pathCompletedCount;

        const pathProgress =
          modules.length > 0 ? Math.round((pathCompletedCount / modules.length) * 100) : 0;

        const pathObj = {
          id: lp.id,
          programId: prog.id,
          programTitle: prog.title,
          title: lp.title,
          description: lp.description || "",
          domain: lp.domain || prog.domain || "General",
          difficultyLevel: lp.difficulty_level || "Intermediate",
          duration: lp.duration || "4 Weeks",
          modulesCount: modules.length,
          completedCount: pathCompletedCount,
          progress: pathProgress,
          modules,
        };

        if (isEnrolled) {
          myLearningPathsList.push(pathObj);
        }

        return pathObj;
      });

      if (isEnrolled) {
        totalModulesAcrossEnrolled += programTotalModules;
        completedModulesAcrossEnrolled += programCompletedModules;
      }

      const calculatedProgramProgress =
        programTotalModules > 0
          ? Math.round((programCompletedModules / programTotalModules) * 100)
          : Number(enrollment?.progress || 0);

      return {
        id: prog.id,
        title: prog.title,
        description: prog.description || "",
        domain: prog.domain || prog.category || "General",
        category: prog.category || prog.domain || "General",
        difficultyLevel: prog.difficulty_level || "Intermediate",
        duration: prog.duration || "6 Weeks",
        thumbnailUrl: prog.thumbnail_url || null,
        status: prog.status,
        createdAt: prog.created_at,
        isEnrolled,
        enrollmentId: enrollment?.id || null,
        enrollmentStatus: enrollment?.status || (isEnrolled ? "enrolled" : null),
        progress: calculatedProgramProgress,
        totalModulesCount: programTotalModules,
        completedModulesCount: programCompletedModules,
        learningPathsCount: learningPaths.length,
        learningPaths,
      };
    });

    const enrolledPrograms = availablePrograms.filter((p) => p.isEnrolled);

    const overallProgress =
      totalModulesAcrossEnrolled > 0
        ? Math.round((completedModulesAcrossEnrolled / totalModulesAcrossEnrolled) * 100)
        : 0;

    return NextResponse.json({
      success: true,
      availablePrograms,
      enrolledPrograms,
      myLearningPaths: myLearningPathsList,
      completedModules: completedModulesList,
      nextPendingModule,
      stats: {
        enrolledCount: enrolledPrograms.length,
        totalPaths: myLearningPathsList.length,
        totalModules: totalModulesAcrossEnrolled,
        completedModules: completedModulesAcrossEnrolled,
        overallProgress,
      },
    });
  } catch (err: any) {
    console.error("Student programmes GET error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch student programmes", details: err.message },
      { status: 500 }
    );
  }
}
