import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser, getSupabaseAdminClient, logAdminAuditAction } from "@/lib/admin-auth";
import { createSupabaseServerClient } from "@/lib/supabase-server";

// Curated curriculum templates based on domain
const DOMAIN_CURRICULA: Record<string, { level: string; duration: string; modules: string[] }> = {
  "System Architecture": {
    level: "Advanced",
    duration: "8 Weeks",
    modules: [
      "Microservices Architecture & Event-Driven Patterns (Kafka / RabbitMQ)",
      "Distributed Caching & In-Memory Storage (Redis clustering)",
      "Scalable Database Partitioning & Sharding Strategies",
      "High-Throughput Load Balancing & Reverse Proxies (NGINX / Envoy)",
      "Resiliency, Circuit Breakers & Distributed Tracing (OpenTelemetry)",
      "System Design Mock Interviews & Real-World High-Scale Case Studies",
    ],
  },
  "Backend Engineering": {
    level: "Intermediate - Advanced",
    duration: "6 Weeks",
    modules: [
      "Relational Database Internals & B-Tree Indexing",
      "Advanced SQL: Window Functions, CTEs, & Query Optimizers",
      "ACID Transactions, Isolation Levels & Concurrency Locking",
      "Connection Pooling, PgBouncer & High Availability Replicas",
      "RESTful & gRPC Microservice APIs with Schema Validation",
      "Production Node.js / Go Backend Profiling and Memory Optimization",
    ],
  },
  "AI / ML Engineering": {
    level: "Advanced",
    duration: "6 Weeks",
    modules: [
      "Transformer Architectures & Multi-Head Self-Attention",
      "Vector Embeddings, Cosine Distance & Vector DB Indexing (Pinecone/pgvector)",
      "Retrieval-Augmented Generation (RAG) Pipelines & Chunking",
      "Prompt Engineering, Chain-of-Thought & Few-Shot Calibration",
      "Autonomous Multi-Agent Orchestration & Tool Use (LangChain / Semantic Kernel)",
      "LLM Evaluation Benchmarks, Hallucination Guardrails & Fine-Tuning",
    ],
  },
  "Frontend Engineering": {
    level: "Intermediate",
    duration: "5 Weeks",
    modules: [
      "React 19 Internals: Server Components & Concurrent Mode",
      "Next.js App Router Architecture, Streaming SSR & ISR Caching",
      "Core Web Vitals (LCP, INP, CLS) Deep Dive & Performance Profiling",
      "Modern State Architecture (Zustand, TanStack Query)",
      "Accessible Design Systems & Component Architecture (Radix / Tailwind)",
      "End-to-End Testing & Frontend Security (CSP, XSS Prevention)",
    ],
  },
  "Cloud & Security": {
    level: "Advanced",
    duration: "6 Weeks",
    modules: [
      "Zero-Trust Security Framework & Identity Providers (IdP)",
      "OAuth 2.1, OpenID Connect & Cryptographic JWT Verifications",
      "AWS / GCP IAM Hierarchy & Principle of Least Privilege",
      "Container Hardening, Docker Security & Kubernetes RBAC",
      "DevSecOps: Automated SAST/DAST Vulnerability Scanning",
      "Incident Response Simulation & Cloud Audit Compliance (SOC2 / ISO 27001)",
    ],
  },
  "Core CS & Algorithms": {
    level: "All Levels",
    duration: "8 Weeks",
    modules: [
      "Time & Space Complexity (Asymptotic Big-O Deep Dive)",
      "Trees, Graphs, Dijkstra & Topological Sort",
      "Dynamic Programming, Memoization & Tabulation",
      "Sliding Window, Two-Pointer & Monotonic Stack Patterns",
      "Trie, Disjoint Set Union (DSU) & Segment Trees",
      "Live FAANG/MNC Mock Technical Coding Interviews",
    ],
  },
};

const DEFAULT_SEED_PROGRAMS = [
  {
    title: "Full-Stack & Distributed Systems Architecture",
    domain: "System Architecture",
    description: "Architect scalable distributed systems, microservices, Kafka event streams, and fault-tolerant cloud backends.",
    status: "active",
  },
  {
    title: "Backend Infrastructure, PostgreSQL & Data Modeling",
    domain: "Backend Engineering",
    description: "Master PostgreSQL internals, query indexing, ACID concurrency, connection pools, and robust API design.",
    status: "active",
  },
  {
    title: "Generative AI, LLM Reasoning & Vector RAG",
    domain: "AI / ML Engineering",
    description: "Build cutting-edge AI systems with vector embeddings, RAG pipelines, fine-tuning, and multi-agent coordination.",
    status: "active",
  },
  {
    title: "Modern Frontend Architecture & Web Performance",
    domain: "Frontend Engineering",
    description: "High-performance React 19, Next.js streaming, Core Web Vitals optimization, and state design.",
    status: "active",
  },
  {
    title: "Cloud Security, IAM & Zero-Trust Infrastructure",
    domain: "Cloud & Security",
    description: "Enterprise identity, zero-trust architectures, OAuth 2.1, Kubernetes RBAC, and DevSecOps pipelines.",
    status: "active",
  },
  {
    title: "Data Structures & Algorithmic Interview Prep",
    domain: "Core CS & Algorithms",
    description: "Exhaustive algorithmic problem solving, graph theory, dynamic programming, and FAANG technical interview questions.",
    status: "active",
  },
];

export async function GET() {
  const auth = await requireAdminUser();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode });
  }

  try {
    const adminDb = getSupabaseAdminClient();
    const supabase = adminDb || (await createSupabaseServerClient());

    let { data: dbPrograms, error } = await supabase
      .from("programs")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Fallback auto-seed if database programs table is ever empty
    if (!dbPrograms || dbPrograms.length === 0) {
      console.log("No programs found, seeding default learning pathways...");
      const inserted: any[] = [];
      for (const item of DEFAULT_SEED_PROGRAMS) {
        const { data: created } = await supabase.from("programs").insert(item).select().single();
        if (created) inserted.push(created);
      }
      dbPrograms = inserted;
    }

    const { data: enrollments } = await supabase
      .from("program_enrollments")
      .select("program_id, progress, status");

    const enrollmentMap: Record<string, { count: number; totalProgress: number; completedCount: number }> = {};
    (enrollments || []).forEach((e) => {
      if (!enrollmentMap[e.program_id]) {
        enrollmentMap[e.program_id] = { count: 0, totalProgress: 0, completedCount: 0 };
      }
      enrollmentMap[e.program_id].count += 1;
      enrollmentMap[e.program_id].totalProgress += Number(e.progress || 0);
      if (e.status === "completed" || Number(e.progress) >= 100) {
        enrollmentMap[e.program_id].completedCount += 1;
      }
    });

    const learningPaths = (dbPrograms || []).map((p) => {
      const stats = enrollmentMap[p.id] || { count: 0, totalProgress: 0, completedCount: 0 };
      const avgProgress = stats.count > 0 ? Math.round(stats.totalProgress / stats.count) : 0;
      const domainInfo = DOMAIN_CURRICULA[p.domain] || {
        level: "Intermediate",
        duration: "6 Weeks",
        modules: [
          "Core Foundations & Best Practices",
          "Deep Dive Architecture & Tooling",
          "Advanced Design Patterns & Performance",
          "Real-World Capstone Project & Evaluation",
        ],
      };

      const totalModules = domainInfo.modules.length;
      const completedModules = stats.count > 0 ? Math.min(totalModules, Math.round((avgProgress / 100) * totalModules)) : 0;

      return {
        id: p.id,
        title: p.title,
        description: p.description || "Structured comprehensive training syllabus with real-world practice modules.",
        domain: p.domain || "General",
        level: domainInfo.level,
        duration: domainInfo.duration,
        assignedUsers: stats.count,
        modulesCount: totalModules,
        completedModules,
        avgProgress,
        status: p.status === "active" ? "Active" : "Inactive",
        modules: domainInfo.modules,
        createdAt: p.created_at,
      };
    });

    return NextResponse.json({
      success: true,
      learningPaths,
    });
  } catch (err: any) {
    console.error("Learning paths API error:", err);
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
    const { title, domain, description, status, level, duration } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: "Learning path title is required." }, { status: 400 });
    }

    const adminDb = getSupabaseAdminClient();
    const supabase = adminDb || (await createSupabaseServerClient());

    const newPath = {
      title: title.trim(),
      domain: domain?.trim() || "General",
      description: description?.trim() || "Tailored AI curriculum track with hands-on technical assessments.",
      status: status || "active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from("programs").insert(newPath).select().single();
    if (error) throw error;

    await logAdminAuditAction({
      adminUserId: auth.user!.id,
      action: "CREATE_LEARNING_PATH",
      targetType: "program",
      targetId: data?.id,
      metadata: { title: newPath.title, domain: newPath.domain, level, duration },
    });

    const domainInfo = DOMAIN_CURRICULA[newPath.domain] || {
      level: level || "Intermediate",
      duration: duration || "6 Weeks",
      modules: [
        "Core Foundations & Best Practices",
        "Deep Dive Architecture & Tooling",
        "Advanced Design Patterns & Performance",
        "Real-World Capstone Project & Evaluation",
      ],
    };

    return NextResponse.json({
      success: true,
      learningPath: {
        id: data.id,
        title: data.title,
        description: data.description,
        domain: data.domain,
        level: level || domainInfo.level,
        duration: duration || domainInfo.duration,
        assignedUsers: 0,
        modulesCount: domainInfo.modules.length,
        completedModules: 0,
        avgProgress: 0,
        status: data.status === "active" ? "Active" : "Inactive",
        modules: domainInfo.modules,
        createdAt: data.created_at,
      },
    });
  } catch (err: any) {
    console.error("Create learning path error:", err);
    return NextResponse.json(
      { error: "Failed to create learning path", details: err.message },
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
      return NextResponse.json({ error: "Learning path ID is required." }, { status: 400 });
    }

    const adminDb = getSupabaseAdminClient();
    const supabase = adminDb || (await createSupabaseServerClient());

    // Clean up enrollments first
    await supabase.from("program_enrollments").delete().eq("program_id", id);

    // Delete program
    const { error } = await supabase.from("programs").delete().eq("id", id);
    if (error) throw error;

    await logAdminAuditAction({
      adminUserId: auth.user!.id,
      action: "DELETE_LEARNING_PATH",
      targetType: "program",
      targetId: id,
    });

    return NextResponse.json({ success: true, message: "Learning path deleted successfully." });
  } catch (err: any) {
    console.error("Delete learning path error:", err);
    return NextResponse.json(
      { error: "Failed to delete learning path", details: err.message },
      { status: 500 }
    );
  }
}
