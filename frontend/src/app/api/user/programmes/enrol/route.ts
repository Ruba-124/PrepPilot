import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-session";
import { getSupabaseAdminClient } from "@/lib/admin-auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthenticated. Please log in to enrol in a programme." },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { programId } = body;

    if (!programId) {
      return NextResponse.json(
        { success: false, error: "Programme ID is required for enrolment." },
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

    // 1. Verify that the programme exists and is ACTIVE
    // Requirement: Only active programmes should accept new enrolments. Do not expose draft or inactive.
    const { data: program, error: progErr } = await supabase
      .from("programs")
      .select("id, title, status, domain")
      .eq("id", programId)
      .single();

    if (progErr || !program) {
      return NextResponse.json(
        { success: false, error: "The selected programme does not exist." },
        { status: 404 }
      );
    }

    if (program.status !== "active") {
      return NextResponse.json(
        {
          success: false,
          error: "This programme is currently not accepting enrolments (status is inactive or draft).",
        },
        { status: 400 }
      );
    }

    // 2. Check for duplicate enrolment
    const { data: existingEnr } = await supabase
      .from("program_enrollments")
      .select("id, progress, status, created_at")
      .eq("user_id", user.id)
      .eq("program_id", programId)
      .maybeSingle();

    if (existingEnr) {
      return NextResponse.json({
        success: true,
        alreadyEnrolled: true,
        message: `You are already enrolled in "${program.title}".`,
        enrollment: existingEnr,
      });
    }

    // 3. Insert into public.program_enrollments
    const newEnrollment = {
      user_id: user.id,
      program_id: programId,
      progress: 0.0,
      status: "enrolled",
      created_at: new Date().toISOString(),
    };

    const { data: createdEnr, error: insertErr } = await supabase
      .from("program_enrollments")
      .insert(newEnrollment)
      .select()
      .single();

    if (insertErr) {
      // Catch potential race condition / unique constraint violation
      if (insertErr.code === "23505") {
        return NextResponse.json({
          success: true,
          alreadyEnrolled: true,
          message: `You are already enrolled in "${program.title}".`,
          enrollment: newEnrollment,
        });
      }
      throw insertErr;
    }

    return NextResponse.json({
      success: true,
      alreadyEnrolled: false,
      message: `Successfully enrolled in "${program.title}".`,
      enrollment: createdEnr,
    });
  } catch (err: any) {
    console.error("Student programme enrolment error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to enrol in programme", details: err.message },
      { status: 500 }
    );
  }
}
