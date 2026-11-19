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

// Helper to format module objectives as array of strings
function parseObjectives(raw: any): string[] {
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof raw === "string") {
    return raw
      .split(/[\n,]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
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
    const programId = searchParams.get("programId");
    const domain = searchParams.get("domain");
    const status = searchParams.get("status");

    // 1. Fetch all parent programmes for filter dropdowns and lookups
    const { data: dbPrograms } = await supabase
      .from("programs")
      .select("id, title, domain, category, status")
      .order("title", { ascending: true });

    const availablePrograms = (dbPrograms || []).map((p) => ({
      id: p.id,
      title: p.title,
      domain: p.domain || p.category || "General",
      status: p.status,
    }));

    // 2. Fetch learning paths joined with programs and ordered child modules
    let query = supabase
      .from("learning_paths")
      .select("*, programs(id, title, domain), learning_modules(*)")
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (programId && programId !== "all") {
      query = query.eq("program_id", programId);
    }
    if (status && status !== "all") {
      query = query.eq("status", status.toLowerCase());
    }
    if (domain && domain !== "All") {
      query = query.ilike("domain", `%${domain}%`);
    }

    const { data: dbPaths, error: pathErr } = await query;
    if (pathErr) throw pathErr;

    // 3. Fetch enrollment stats mapped by program_id
    const { data: enrollments } = await supabase
      .from("program_enrollments")
      .select("program_id, progress, status");

    const enrollmentMap: Record<string, { count: number; totalProgress: number }> = {};
    (enrollments || []).forEach((e) => {
      if (!enrollmentMap[e.program_id]) {
        enrollmentMap[e.program_id] = { count: 0, totalProgress: 0 };
      }
      enrollmentMap[e.program_id].count += 1;
      enrollmentMap[e.program_id].totalProgress += Number(e.progress || 0);
    });

    // 4. Transform and hydrate learning paths
    let learningPaths = (dbPaths || []).map((lp: any) => {
      const stats = enrollmentMap[lp.program_id] || { count: 0, totalProgress: 0 };
      const avgProgress = stats.count > 0 ? Math.round(stats.totalProgress / stats.count) : 0;

      // Sort modules by display_order ascending
      const rawModules = Array.isArray(lp.learning_modules) ? lp.learning_modules : [];
      const sortedModules = [...rawModules].sort(
        (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)
      );

      const formattedModules = sortedModules.map((m: any, idx: number) => ({
        id: m.id,
        learningPathId: m.learning_path_id,
        title: m.title,
        description: m.description || "",
        learningObjectives: Array.isArray(m.learning_objectives) ? m.learning_objectives : [],
        content: m.content || "",
        resourceUrl: m.resource_url || null,
        estimatedDuration: m.estimated_duration || "45 mins",
        displayOrder: m.display_order ?? idx + 1,
        createdAt: m.created_at,
        updatedAt: m.updated_at,
      }));

      return {
        id: lp.id,
        programId: lp.program_id,
        programTitle: lp.programs?.title || "Unassigned Programme",
        title: lp.title,
        description: lp.description || "",
        domain: lp.domain || lp.programs?.domain || "General",
        difficultyLevel: normalizeDifficulty(lp.difficulty_level),
        duration: lp.duration || "4 Weeks",
        status: lp.status || "active",
        displayOrder: lp.display_order || 0,
        modulesCount: formattedModules.length,
        modules: formattedModules,
        assignedUsers: stats.count,
        avgProgress,
        createdAt: lp.created_at,
        updatedAt: lp.updated_at,
      };
    });

    // Client-side search across title, description, domain and parent program title
    if (search) {
      learningPaths = learningPaths.filter(
        (p) =>
          p.title.toLowerCase().includes(search) ||
          p.description.toLowerCase().includes(search) ||
          p.domain.toLowerCase().includes(search) ||
          p.programTitle.toLowerCase().includes(search)
      );
    }

    return NextResponse.json({
      success: true,
      learningPaths,
      programs: availablePrograms,
      totalCount: learningPaths.length,
    });
  } catch (err: any) {
    console.error("Admin learning paths GET error:", err);
    return NextResponse.json(
      { error: "Failed to fetch learning paths", details: err.message },
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
      programId,
      program_id,
      title,
      description,
      domain,
      difficultyLevel,
      difficulty_level,
      duration,
      status,
      displayOrder,
      display_order,
      modules,
    } = body;

    const assignedProgramId = programId || program_id;
    if (!assignedProgramId) {
      return NextResponse.json(
        { error: "A valid Programme must be selected for this Learning Path." },
        { status: 400 }
      );
    }

    if (!title || !title.trim()) {
      return NextResponse.json(
        { error: "Learning Path title is required." },
        { status: 400 }
      );
    }

    const adminDb = getSupabaseAdminClient();
    const supabase = adminDb || (await createSupabaseServerClient());

    // 1. Verify parent program exists
    const { data: parentProg, error: progErr } = await supabase
      .from("programs")
      .select("id, title, domain, category")
      .eq("id", assignedProgramId)
      .single();

    if (progErr || !parentProg) {
      return NextResponse.json(
        { error: "The selected Programme does not exist in the database." },
        { status: 404 }
      );
    }

    const cleanTitle = title.trim();
    const cleanDomain = (domain || parentProg.domain || parentProg.category || "General").trim();
    const cleanDifficulty = normalizeDifficulty(difficultyLevel || difficulty_level);
    const cleanDuration = (duration || "4 Weeks").trim();
    const cleanStatus = ["active", "inactive", "draft"].includes(status?.toLowerCase())
      ? status.toLowerCase()
      : "active";
    const cleanOrder = Number(displayOrder || display_order || 0);

    // 2. Insert into public.learning_paths
    const newPath = {
      program_id: assignedProgramId,
      title: cleanTitle,
      description: (description || "").trim(),
      domain: cleanDomain,
      difficulty_level: cleanDifficulty,
      duration: cleanDuration,
      status: cleanStatus,
      display_order: cleanOrder,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: createdPath, error: insertErr } = await supabase
      .from("learning_paths")
      .insert(newPath)
      .select()
      .single();

    if (insertErr) throw insertErr;

    // 3. Insert initial modules if supplied
    const insertedModules: any[] = [];
    if (Array.isArray(modules) && modules.length > 0) {
      const moduleInserts = modules.map((m: any, index: number) => ({
        learning_path_id: createdPath.id,
        title: (m.title || `Module ${index + 1}`).trim(),
        description: (m.description || "").trim(),
        learning_objectives: parseObjectives(m.learningObjectives || m.learning_objectives),
        content: (m.content || "").trim(),
        resource_url: (m.resourceUrl || m.resource_url || "").trim() || null,
        estimated_duration: (m.estimatedDuration || m.estimated_duration || "45 mins").trim(),
        display_order: m.displayOrder ?? m.display_order ?? index + 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      const { data: modData, error: modErr } = await supabase
        .from("learning_modules")
        .insert(moduleInserts)
        .select();

      if (!modErr && modData) {
        insertedModules.push(...modData);
      }
    }

    await logAdminAuditAction({
      adminUserId: auth.user!.id,
      action: "CREATE_LEARNING_PATH",
      targetType: "learning_path",
      targetId: createdPath.id,
      metadata: {
        title: cleanTitle,
        programId: assignedProgramId,
        programTitle: parentProg.title,
        modulesCount: insertedModules.length,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Learning path created successfully.",
      learningPath: {
        id: createdPath.id,
        programId: createdPath.program_id,
        programTitle: parentProg.title,
        title: createdPath.title,
        description: createdPath.description,
        domain: createdPath.domain,
        difficultyLevel: normalizeDifficulty(createdPath.difficulty_level),
        duration: createdPath.duration,
        status: createdPath.status,
        displayOrder: createdPath.display_order,
        modulesCount: insertedModules.length,
        modules: insertedModules,
        assignedUsers: 0,
        avgProgress: 0,
        createdAt: createdPath.created_at,
        updatedAt: createdPath.updated_at,
      },
    });
  } catch (err: any) {
    console.error("Admin learning path POST error:", err);
    return NextResponse.json(
      { error: "Failed to create learning path", details: err.message },
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
      action,
      // Metadata updates
      programId,
      program_id,
      title,
      description,
      domain,
      difficultyLevel,
      difficulty_level,
      duration,
      status,
      displayOrder,
      display_order,
      // Module specific actions
      moduleId,
      module,
      moduleOrders,
    } = body;

    const adminDb = getSupabaseAdminClient();
    const supabase = adminDb || (await createSupabaseServerClient());

    // -------------------------------------------------------------
    // ACTION 1: ADD SINGLE MODULE TO LEARNING PATH
    // -------------------------------------------------------------
    if (action === "add_module") {
      const pathId = id || body.learningPathId;
      if (!pathId || !module || !module.title?.trim()) {
        return NextResponse.json(
          { error: "Learning Path ID and Module title are required." },
          { status: 400 }
        );
      }

      // Determine next display order if not provided
      let orderIndex = module.displayOrder ?? module.display_order;
      if (orderIndex === undefined) {
        const { count } = await supabase
          .from("learning_modules")
          .select("*", { count: "exact", head: true })
          .eq("learning_path_id", pathId);
        orderIndex = (count || 0) + 1;
      }

      const newModule = {
        learning_path_id: pathId,
        title: module.title.trim(),
        description: (module.description || "").trim(),
        learning_objectives: parseObjectives(module.learningObjectives || module.learning_objectives),
        content: (module.content || "").trim(),
        resource_url: (module.resourceUrl || module.resource_url || "").trim() || null,
        estimated_duration: (module.estimatedDuration || module.estimated_duration || "45 mins").trim(),
        display_order: orderIndex,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: createdMod, error: modErr } = await supabase
        .from("learning_modules")
        .insert(newModule)
        .select()
        .single();

      if (modErr) throw modErr;

      return NextResponse.json({
        success: true,
        message: "Module added successfully.",
        module: createdMod,
      });
    }

    // -------------------------------------------------------------
    // ACTION 2: EDIT SINGLE MODULE
    // -------------------------------------------------------------
    if (action === "edit_module") {
      const targetModId = moduleId || module?.id;
      if (!targetModId || !module) {
        return NextResponse.json({ error: "Module ID is required for editing." }, { status: 400 });
      }

      const modUpdates: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (module.title !== undefined) modUpdates.title = module.title.trim();
      if (module.description !== undefined) modUpdates.description = module.description.trim();
      if (module.learningObjectives !== undefined || module.learning_objectives !== undefined) {
        modUpdates.learning_objectives = parseObjectives(
          module.learningObjectives || module.learning_objectives
        );
      }
      if (module.content !== undefined) modUpdates.content = module.content.trim();
      if (module.resourceUrl !== undefined || module.resource_url !== undefined) {
        modUpdates.resource_url = (module.resourceUrl || module.resource_url || "").trim() || null;
      }
      if (module.estimatedDuration !== undefined || module.estimated_duration !== undefined) {
        modUpdates.estimated_duration = (
          module.estimatedDuration || module.estimated_duration || "45 mins"
        ).trim();
      }
      if (module.displayOrder !== undefined || module.display_order !== undefined) {
        modUpdates.display_order = Number(module.displayOrder ?? module.display_order);
      }

      const { data: updatedMod, error: modErr } = await supabase
        .from("learning_modules")
        .update(modUpdates)
        .eq("id", targetModId)
        .select()
        .single();

      if (modErr) throw modErr;

      return NextResponse.json({
        success: true,
        message: "Module updated successfully.",
        module: updatedMod,
      });
    }

    // -------------------------------------------------------------
    // ACTION 3: DELETE SINGLE MODULE
    // -------------------------------------------------------------
    if (action === "delete_module") {
      const targetModId = moduleId || body.id;
      if (!targetModId) {
        return NextResponse.json({ error: "Module ID is required for deletion." }, { status: 400 });
      }

      // Clean up progress entries first
      await supabase.from("module_progress").delete().eq("module_id", targetModId);
      const { error: delErr } = await supabase.from("learning_modules").delete().eq("id", targetModId);
      if (delErr) throw delErr;

      return NextResponse.json({
        success: true,
        message: "Module deleted successfully.",
      });
    }

    // -------------------------------------------------------------
    // ACTION 4: REORDER MODULES
    // -------------------------------------------------------------
    if (action === "reorder_modules") {
      if (!Array.isArray(moduleOrders) || moduleOrders.length === 0) {
        return NextResponse.json(
          { error: "Invalid module order list provided." },
          { status: 400 }
        );
      }

      for (const item of moduleOrders) {
        if (item.id && item.displayOrder !== undefined) {
          await supabase
            .from("learning_modules")
            .update({ display_order: item.displayOrder, updated_at: new Date().toISOString() })
            .eq("id", item.id);
        }
      }

      return NextResponse.json({
        success: true,
        message: "Module display orders updated successfully.",
      });
    }

    // -------------------------------------------------------------
    // DEFAULT ACTION: UPDATE LEARNING PATH METADATA
    // -------------------------------------------------------------
    if (!id) {
      return NextResponse.json({ error: "Learning Path ID is required." }, { status: 400 });
    }

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (title !== undefined) {
      if (!title.trim()) {
        return NextResponse.json(
          { error: "Learning Path title cannot be empty." },
          { status: 400 }
        );
      }
      updates.title = title.trim();
    }

    if (description !== undefined) updates.description = description.trim();
    if (domain !== undefined) updates.domain = domain.trim();
    if (difficultyLevel !== undefined || difficulty_level !== undefined) {
      updates.difficulty_level = normalizeDifficulty(difficultyLevel || difficulty_level);
    }
    if (duration !== undefined) updates.duration = duration.trim();
    if (displayOrder !== undefined || display_order !== undefined) {
      updates.display_order = Number(displayOrder ?? display_order);
    }

    const assignedProg = programId || program_id;
    if (assignedProg !== undefined) {
      if (!assignedProg) {
        return NextResponse.json(
          { error: "Learning path must belong to a valid Programme." },
          { status: 400 }
        );
      }
      updates.program_id = assignedProg;
    }

    if (status !== undefined) {
      const lower = status.toLowerCase();
      if (!["active", "inactive", "draft"].includes(lower)) {
        return NextResponse.json(
          { error: "Status must be 'active', 'inactive', or 'draft'." },
          { status: 400 }
        );
      }
      updates.status = lower;
    }

    const { data: updatedPath, error: updateErr } = await supabase
      .from("learning_paths")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    await logAdminAuditAction({
      adminUserId: auth.user!.id,
      action: "UPDATE_LEARNING_PATH",
      targetType: "learning_path",
      targetId: id,
      metadata: updates,
    });

    return NextResponse.json({
      success: true,
      message: "Learning path updated successfully.",
      learningPath: updatedPath,
    });
  } catch (err: any) {
    console.error("Admin learning path PATCH error:", err);
    return NextResponse.json(
      { error: "Failed to update learning path", details: err.message },
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
      return NextResponse.json({ error: "Learning Path ID is required." }, { status: 400 });
    }

    const adminDb = getSupabaseAdminClient();
    const supabase = adminDb || (await createSupabaseServerClient());

    // 1. Fetch child module IDs to clean up progress records
    const { data: childModules } = await supabase
      .from("learning_modules")
      .select("id")
      .eq("learning_path_id", id);

    if (childModules && childModules.length > 0) {
      const modIds = childModules.map((m) => m.id);
      await supabase.from("module_progress").delete().in("module_id", modIds);
      await supabase.from("learning_modules").delete().eq("learning_path_id", id);
    }

    // 2. Delete learning path
    const { error: delErr } = await supabase.from("learning_paths").delete().eq("id", id);
    if (delErr) throw delErr;

    await logAdminAuditAction({
      adminUserId: auth.user!.id,
      action: "DELETE_LEARNING_PATH",
      targetType: "learning_path",
      targetId: id,
    });

    return NextResponse.json({
      success: true,
      message: "Learning path and all associated modules were deleted successfully.",
    });
  } catch (err: any) {
    console.error("Admin learning path DELETE error:", err);
    return NextResponse.json(
      { error: "Failed to delete learning path", details: err.message },
      { status: 500 }
    );
  }
}
