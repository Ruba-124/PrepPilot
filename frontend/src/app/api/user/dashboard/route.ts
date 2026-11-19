import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/admin-auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getAuthenticatedUser } from "@/lib/auth-session";
import { storage } from "@/lib/storage";

export async function GET(request: NextRequest) {
  try {
    const authenticated = await getAuthenticatedUser(request);
    const { searchParams } = new URL(request.url);
    let userId = searchParams.get("userId");

    // If userId not provided in query, use the authenticated user's ID from session cookie
    if (!userId || userId === "null" || userId === "undefined") {
      userId = authenticated?.id || null;
    }

    // If still no userId found and no valid session exists, return 401
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthenticated. Please sign in to view your dashboard." },
        { status: 401 }
      );
    }

    const adminDb = getSupabaseAdminClient();
    const supabase = adminDb || (await createSupabaseServerClient());

    // 1. Fetch user profile from Supabase profiles table
    let profile = null;
    if (supabase) {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      profile = data;
    }

    if (!profile) {
      profile = await storage.getProfile(userId);
    }

    const fullName =
      (profile?.full_name && profile.full_name !== "Candidate" ? profile.full_name : null) ||
      authenticated?.fullName ||
      profile?.full_name ||
      "Candidate";
    const targetRole = profile?.target_role || authenticated?.targetRole || "";

    // 2. Fetch ONLY this candidate's sessions from Supabase PostgreSQL
    let allSessions: any[] = [];
    if (supabase) {
      const { data: dbSessions } = await supabase
        .from("sessions")
        .select("*, questions(*, answers(*))")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (dbSessions) {
        allSessions = dbSessions;
      }
    }

    if (allSessions.length === 0) {
      allSessions = await storage.listSessions(userId);
    }

    const completedSessions = allSessions.filter((s) => s.status === "completed");
    const inProgressSessions = allSessions.filter((s) => s.status === "in_progress");

    const scores = completedSessions
      .map((s) => (s.overall_score != null ? Number(s.overall_score) : null))
      .filter((sc): sc is number => sc !== null);

    const avgScore =
      scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const peakScore = scores.length > 0 ? Math.max(...scores) : 0;
    const certificates = scores.filter((sc) => sc >= 70).length;

    // Aggregate answers across all candidate sessions
    const allAnswers: any[] = [];
    allSessions.forEach((s) => {
      const qs = s.questions || [];
      qs.forEach((q: any) => {
        const ansList = q.answers || [];
        ansList.forEach((a: any) => {
          allAnswers.push({ ...a, category: q.category || "Technical" });
        });
      });
    });

    const questionsDone = allAnswers.length;
    const questionsHighScored = allAnswers.filter(
      (a) => a.score != null && Number(a.score) >= 75
    ).length;

    // 3. Aggregate Areas to Improve (Weaknesses)
    const weaknessMap: Record<string, number> = {};
    allAnswers.forEach((a) => {
      if (Array.isArray(a.weaknesses)) {
        a.weaknesses.forEach((w: string) => {
          const clean = w.trim();
          if (clean) {
            weaknessMap[clean] = (weaknessMap[clean] || 0) + 1;
          }
        });
      }
    });

    const areasToImprove = Object.entries(weaknessMap)
      .map(([text, count]) => ({ text, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    // 4. Aggregate Top Strengths
    const strengthMap: Record<string, number> = {};
    allAnswers.forEach((a) => {
      if (Array.isArray(a.strengths)) {
        a.strengths.forEach((st: string) => {
          const clean = st.trim();
          if (clean) {
            strengthMap[clean] = (strengthMap[clean] || 0) + 1;
          }
        });
      }
    });

    const topStrengths = Object.entries(strengthMap)
      .map(([text, count]) => ({ text, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    // 5. Aggregate Score by Category
    const categoryMap: Record<string, { totalScore: number; count: number }> = {};
    allAnswers.forEach((a) => {
      const cat = a.category || "Technical";
      if (!categoryMap[cat]) {
        categoryMap[cat] = { totalScore: 0, count: 0 };
      }
      if (a.score != null) {
        categoryMap[cat].totalScore += Number(a.score);
        categoryMap[cat].count += 1;
      }
    });

    const scoreByCategory = Object.entries(categoryMap).map(([name, data]) => ({
      name,
      score: data.count > 0 ? Math.round(data.totalScore / data.count) : 0,
      questionCount: data.count,
    }));

    // Default categories if no answers recorded yet
    if (scoreByCategory.length === 0) {
      scoreByCategory.push(
        { name: "Technical", score: 0, questionCount: 0 },
        { name: "System Design", score: 0, questionCount: 0 },
        { name: "General", score: 0, questionCount: 0 },
        { name: "Behavioral", score: 0, questionCount: 0 }
      );
    }

    // 6. Map Interview History
    const interviewHistory = allSessions.map((s) => {
      const sQuestions = s.questions || [];
      const sAnswers = sQuestions.flatMap((q: any) => q.answers || []);
      const highScored = sAnswers.filter((a: any) => a.score != null && Number(a.score) >= 75).length;

      return {
        id: s.id,
        role: s.role || "Technical Candidate",
        domain: s.domain || "General",
        status: s.status,
        createdAt: s.created_at,
        questionsAnswered: sAnswers.length || sQuestions.length,
        highScoreQuestions: highScored,
        overallScore: s.overall_score != null ? Math.round(Number(s.overall_score)) : null,
      };
    });

    // 7. Fetch Student Programme Enrolments & Learning Modules Progress
    let enrolledPrograms: any[] = [];
    let myLearningPaths: any[] = [];
    let completedModulesList: any[] = [];
    let continueLearning: any = null;
    let totalModulesAcrossEnrolled = 0;
    let completedModulesAcrossEnrolled = 0;

    if (supabase) {
      // Fetch enrollments with programs, learning paths, and modules
      const { data: enrollments } = await supabase
        .from("program_enrollments")
        .select("*, programs(*, learning_paths(*, learning_modules(*)))")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      // Fetch user's completed modules
      const { data: userModuleProgress } = await supabase
        .from("module_progress")
        .select("*")
        .eq("user_id", userId);

      const completedModuleIds = new Set<string>();
      const moduleProgressMap = new Map<string, any>();
      (userModuleProgress || []).forEach((mp) => {
        moduleProgressMap.set(mp.module_id, mp);
        if (mp.status === "completed") {
          completedModuleIds.add(mp.module_id);
        }
      });

      enrolledPrograms = (enrollments || []).map((enr: any) => {
        const prog = enr.programs;
        if (!prog) return null;

        const rawPaths = Array.isArray(prog.learning_paths) ? prog.learning_paths : [];
        const activePaths = rawPaths
          .filter((lp: any) => lp.status !== "draft" && lp.status !== "inactive")
          .sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0));

        let progTotalMods = 0;
        let progCompletedMods = 0;

        const transformedPaths = activePaths.map((lp: any) => {
          const rawMods = Array.isArray(lp.learning_modules) ? lp.learning_modules : [];
          const sortedMods = [...rawMods].sort(
            (a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0)
          );

          let pathCompleted = 0;
          const mods = sortedMods.map((m: any, idx: number) => {
            const isCompleted = completedModuleIds.has(m.id);
            const progRecord = moduleProgressMap.get(m.id);

            if (isCompleted) {
              pathCompleted += 1;
              completedModulesList.push({
                id: m.id,
                title: m.title,
                pathTitle: lp.title,
                programTitle: prog.title,
                duration: m.estimated_duration || "45 mins",
                completionDate: progRecord?.completion_date || progRecord?.updated_at || null,
              });
            } else if (!continueLearning) {
              continueLearning = {
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
              title: m.title,
              description: m.description,
              displayOrder: m.display_order ?? idx + 1,
              duration: m.estimated_duration || "45 mins",
              isCompleted,
            };
          });

          progTotalMods += mods.length;
          progCompletedMods += pathCompleted;

          const pathProgress =
            mods.length > 0 ? Math.round((pathCompleted / mods.length) * 100) : 0;

          const pathObj = {
            id: lp.id,
            programId: prog.id,
            programTitle: prog.title,
            title: lp.title,
            description: lp.description,
            domain: lp.domain || prog.domain || "General",
            difficultyLevel: lp.difficulty_level || "Intermediate",
            duration: lp.duration || "4 Weeks",
            totalModules: mods.length,
            completedModules: pathCompleted,
            progress: pathProgress,
          };

          myLearningPaths.push(pathObj);
          return pathObj;
        });

        totalModulesAcrossEnrolled += progTotalMods;
        completedModulesAcrossEnrolled += progCompletedMods;

        const calculatedProgress =
          progTotalMods > 0
            ? Math.round((progCompletedMods / progTotalMods) * 100)
            : Number(enr.progress || 0);

        return {
          id: prog.id,
          enrollmentId: enr.id,
          title: prog.title,
          description: prog.description,
          domain: prog.domain || prog.category || "General",
          difficultyLevel: prog.difficulty_level || "Intermediate",
          duration: prog.duration || "6 Weeks",
          status: enr.status || "enrolled",
          progress: calculatedProgress,
          totalModules: progTotalMods,
          completedModules: progCompletedMods,
          learningPathsCount: transformedPaths.length,
          learningPaths: transformedPaths,
        };
      }).filter(Boolean);
    }

    const overallLearningProgress = {
      enrolledCount: enrolledPrograms.length,
      totalPaths: myLearningPaths.length,
      totalModules: totalModulesAcrossEnrolled,
      completedModules: completedModulesAcrossEnrolled,
      overallProgress:
        totalModulesAcrossEnrolled > 0
          ? Math.round((completedModulesAcrossEnrolled / totalModulesAcrossEnrolled) * 100)
          : 0,
    };

    // 8. Fetch active programmes available for exploration
    let availablePrograms: any[] = [];
    if (supabase) {
      const { data: dbPrograms } = await supabase
        .from("programs")
        .select("id, title, description, domain, category, difficulty_level, duration, status")
        .eq("status", "active")
        .order("created_at", { ascending: false });
      if (dbPrograms) availablePrograms = dbPrograms;
    }

    return NextResponse.json({
      success: true,
      user: {
        id: userId,
        fullName,
        targetRole,
        role: profile?.role || authenticated?.role || "user",
        createdAt: profile?.created_at || new Date().toISOString(),
      },
      stats: {
        interviewsGiven: completedSessions.length,
        avgScore,
        peakScore,
        questionsDone,
        questionsHighScored,
        certificates,
        totalSessions: allSessions.length,
      },
      areasToImprove,
      topStrengths,
      scoreByCategory,
      interviewHistory,
      inProgressSession: inProgressSessions[0] || null,
      recentSessions: completedSessions.slice(0, 5),
      availablePrograms,
      // Enhanced Programme & Learning Path fields for student dashboard
      enrolledPrograms,
      myLearningPaths,
      continueLearning,
      completedModules: completedModulesList,
      overallLearningProgress,
    });
  } catch (err: any) {
    console.error("User dashboard API error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch candidate dashboard", details: err.message },
      { status: 500 }
    );
  }
}
