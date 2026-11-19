-- ==============================================================================
-- PrepPilot: Programme & Learning Path Management Migration
-- Description: Establishes a true hierarchical curriculum system:
--   1. Programmes (Structured training & placement preparation opportunities)
--   2. Learning Paths (Ordered step-by-step roadmaps belonging to a programme)
--   3. Learning Modules (Granular syllabus units belonging to a learning path)
--   4. Module Progress (Per-student granular completion tracking)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. UPDATE PROGRAMMES TABLE (public.programs)
-- ------------------------------------------------------------------------------
-- Add new fields to existing programs table while strictly preserving existing rows
ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS difficulty_level text DEFAULT 'Intermediate';
ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS duration text DEFAULT '8 Weeks';
ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS thumbnail_url text;

-- Populate category from domain if category is not yet populated
UPDATE public.programs 
SET category = domain 
WHERE category IS NULL AND domain IS NOT NULL;

-- Ensure check constraint on difficulty_level if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'programs_difficulty_level_check'
    ) THEN
        ALTER TABLE public.programs
        ADD CONSTRAINT programs_difficulty_level_check 
        CHECK (difficulty_level IN ('Foundational', 'Intermediate', 'Advanced', 'All Levels'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS programs_category_idx ON public.programs (category);
CREATE INDEX IF NOT EXISTS programs_difficulty_idx ON public.programs (difficulty_level);

-- ------------------------------------------------------------------------------
-- 2. CREATE LEARNING PATHS TABLE (public.learning_paths)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.learning_paths (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id uuid NOT NULL REFERENCES public.programs (id) ON DELETE CASCADE,
    title text NOT NULL,
    description text,
    domain text,
    difficulty_level text NOT NULL DEFAULT 'Intermediate' 
        CHECK (difficulty_level IN ('Foundational', 'Intermediate', 'Advanced', 'All Levels')),
    duration text DEFAULT '4 Weeks',
    status text NOT NULL DEFAULT 'active' 
        CHECK (status IN ('active', 'inactive', 'draft')),
    display_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS learning_paths_program_id_idx ON public.learning_paths (program_id);
CREATE INDEX IF NOT EXISTS learning_paths_status_idx ON public.learning_paths (status);
CREATE INDEX IF NOT EXISTS learning_paths_display_order_idx ON public.learning_paths (display_order);

-- ------------------------------------------------------------------------------
-- 3. CREATE LEARNING MODULES TABLE (public.learning_modules)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.learning_modules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    learning_path_id uuid NOT NULL REFERENCES public.learning_paths (id) ON DELETE CASCADE,
    title text NOT NULL,
    description text,
    learning_objectives text[] DEFAULT '{}',
    content text,
    resource_url text,
    estimated_duration text DEFAULT '45 mins',
    display_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS learning_modules_learning_path_id_idx ON public.learning_modules (learning_path_id);
CREATE INDEX IF NOT EXISTS learning_modules_display_order_idx ON public.learning_modules (display_order);

-- ------------------------------------------------------------------------------
-- 4. CREATE MODULE PROGRESS TABLE (public.module_progress)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.module_progress (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
    module_id uuid NOT NULL REFERENCES public.learning_modules (id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'not_started' 
        CHECK (status IN ('not_started', 'in_progress', 'completed')),
    completion_date timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, module_id)
);

CREATE INDEX IF NOT EXISTS module_progress_user_id_idx ON public.module_progress (user_id);
CREATE INDEX IF NOT EXISTS module_progress_module_id_idx ON public.module_progress (module_id);
CREATE INDEX IF NOT EXISTS module_progress_status_idx ON public.module_progress (status);

-- ------------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_paths ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_progress ENABLE ROW LEVEL SECURITY;

-- Drop existing overlapping policies if re-running
DROP POLICY IF EXISTS "learning_paths: read active" ON public.learning_paths;
DROP POLICY IF EXISTS "learning_paths: admin write" ON public.learning_paths;
DROP POLICY IF EXISTS "learning_modules: read active" ON public.learning_modules;
DROP POLICY IF EXISTS "learning_modules: admin write" ON public.learning_modules;
DROP POLICY IF EXISTS "module_progress: student and admin access" ON public.module_progress;

-- Learning Paths Policies
CREATE POLICY "learning_paths: read active" ON public.learning_paths
    FOR SELECT USING (
        status = 'active' OR EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "learning_paths: admin write" ON public.learning_paths
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Learning Modules Policies
CREATE POLICY "learning_modules: read active" ON public.learning_modules
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.learning_paths lp 
            WHERE lp.id = learning_path_id 
              AND (lp.status = 'active' OR EXISTS (
                  SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
              ))
        )
    );

CREATE POLICY "learning_modules: admin write" ON public.learning_modules
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Module Progress Policies (Owner read/write + Admin oversight)
CREATE POLICY "module_progress: student and admin access" ON public.module_progress
    FOR ALL USING (
        user_id = auth.uid() OR EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
        )
    ) WITH CHECK (
        user_id = auth.uid() OR EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ------------------------------------------------------------------------------
-- 6. SEED CURATED LEARNING PATHS & MODULES (Linked to Existing 6 Programs)
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    prog_id uuid;
    path_id uuid;
BEGIN
    -- 1. Full-Stack & Distributed Systems Architecture
    SELECT id INTO prog_id FROM public.programs 
    WHERE title ILIKE '%Full-Stack & Distributed Systems%' LIMIT 1;
    
    IF prog_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.learning_paths WHERE program_id = prog_id) THEN
        -- Path 1
        INSERT INTO public.learning_paths (program_id, title, description, domain, difficulty_level, duration, display_order)
        VALUES (
            prog_id, 
            'Distributed Systems & Event-Driven Patterns',
            'Master asynchronous message brokers, microservice consensus, and resilient system design.',
            'System Architecture',
            'Advanced',
            '4 Weeks',
            1
        ) RETURNING id INTO path_id;

        INSERT INTO public.learning_modules (learning_path_id, title, description, estimated_duration, display_order, learning_objectives) VALUES
        (path_id, 'Event Broker Fundamentals (Kafka vs RabbitMQ)', 'Understand partition keys, consumer groups, offset management, and delivery semantics.', '60 mins', 1, ARRAY['Configure Kafka brokers and topics', 'Analyze at-least-once vs exactly-once semantics']),
        (path_id, 'Microservices Sagas & Distributed Transactions', 'Implement orchestration vs choreography sagas for multi-service business workflows.', '75 mins', 2, ARRAY['Design 2PC vs compensating sagas', 'Handle partial failures in distributed systems']),
        (path_id, 'Resiliency, Circuit Breakers & Distributed Tracing', 'Implement Envoy/Hystrix style circuit breakers and OpenTelemetry tracing.', '60 mins', 3, ARRAY['Prevent cascading service outages', 'Correlate distributed trace spans']);

        -- Path 2
        INSERT INTO public.learning_paths (program_id, title, description, domain, difficulty_level, duration, display_order)
        VALUES (
            prog_id, 
            'High-Throughput Node.js & API Gateway Architecture',
            'Scale Node.js microservices with Redis clusters, PgBouncer pooling, and reverse proxies.',
            'System Architecture',
            'Intermediate',
            '4 Weeks',
            2
        ) RETURNING id INTO path_id;

        INSERT INTO public.learning_modules (learning_path_id, title, description, estimated_duration, display_order, learning_objectives) VALUES
        (path_id, 'Node.js Event Loop & Memory Profiling', 'V8 garbage collection, heap dumps, libuv threadpool optimization.', '60 mins', 1, ARRAY['Profile memory leaks with Clinic.js', 'Tune libuv threadpool size']),
        (path_id, 'Distributed Caching Strategies with Redis', 'Cache-aside, write-through, cache stampede prevention, and Redis clustering.', '45 mins', 2, ARRAY['Implement Redis mutex locks', 'Design TTL expiration policies']);
    END IF;

    -- 2. Backend Infrastructure, PostgreSQL & Data Modeling
    SELECT id INTO prog_id FROM public.programs 
    WHERE title ILIKE '%Backend Infrastructure%' LIMIT 1;

    IF prog_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.learning_paths WHERE program_id = prog_id) THEN
        INSERT INTO public.learning_paths (program_id, title, description, domain, difficulty_level, duration, display_order)
        VALUES (
            prog_id, 
            'PostgreSQL Internals, Index Tuning & Concurrency',
            'Deep dive into PostgreSQL page architecture, query execution plans, and row-level locks.',
            'Backend Engineering',
            'Advanced',
            '4 Weeks',
            1
        ) RETURNING id INTO path_id;

        INSERT INTO public.learning_modules (learning_path_id, title, description, estimated_duration, display_order, learning_objectives) VALUES
        (path_id, 'B-Tree, GIN & BRIN Index Tuning', 'Analyze EXPLAIN ANALYZE execution trees, index scans, and bitmap heap scans.', '60 mins', 1, ARRAY['Optimize complex queries using composite indexes', 'Prevent full table sequential scans']),
        (path_id, 'ACID Concurrency & Row-Level Locking', 'Master transaction isolation levels (Read Committed, Repeatable Read, Serializable).', '75 mins', 2, ARRAY['Detect and resolve database deadlocks', 'Implement optimistic vs pessimistic concurrency']);

        INSERT INTO public.learning_paths (program_id, title, description, domain, difficulty_level, duration, display_order)
        VALUES (
            prog_id, 
            'High-Scale Data Modeling & Zero-Downtime Migrations',
            'Schema normalization, partition pruning, and backward-compatible zero-downtime DDL.',
            'Backend Engineering',
            'Intermediate',
            '3 Weeks',
            2
        ) RETURNING id INTO path_id;

        INSERT INTO public.learning_modules (learning_path_id, title, description, estimated_duration, display_order, learning_objectives) VALUES
        (path_id, 'Declarative Table Partitioning by Range and Hash', 'Partition large multi-million row datasets for sub-millisecond query pruning.', '60 mins', 1, ARRAY['Design range and list partitioned tables', 'Verify partition elimination in planner']);
    END IF;

    -- 3. Generative AI, LLM Reasoning & Vector RAG
    SELECT id INTO prog_id FROM public.programs 
    WHERE title ILIKE '%Generative AI%' LIMIT 1;

    IF prog_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.learning_paths WHERE program_id = prog_id) THEN
        INSERT INTO public.learning_paths (program_id, title, description, domain, difficulty_level, duration, display_order)
        VALUES (
            prog_id, 
            'Vector Search & Hybrid RAG Pipelines',
            'Build state-of-the-art vector embedding retrievers using Pinecone and dense rerankers.',
            'AI / ML Engineering',
            'Advanced',
            '4 Weeks',
            1
        ) RETURNING id INTO path_id;

        INSERT INTO public.learning_modules (learning_path_id, title, description, estimated_duration, display_order, learning_objectives) VALUES
        (path_id, 'Embeddings, Cosine Distance & Index Quantization', 'Transform text into semantic vector embeddings and evaluate HNSW graph indexes.', '60 mins', 1, ARRAY['Generate multi-modal embeddings', 'Tune index similarity metrics']),
        (path_id, 'Hybrid Search, Chunking & Cross-Encoder Reranking', 'Combine sparse BM25 keyword matching with dense semantic search.', '75 mins', 2, ARRAY['Implement recursive chunking strategies', 'Evaluate precision with Reciprocal Rank Fusion (RRF)']);

        INSERT INTO public.learning_paths (program_id, title, description, domain, difficulty_level, duration, display_order)
        VALUES (
            prog_id, 
            'Autonomous AI Agents & Tool Execution',
            'Design agentic loops with function calling, plan-and-solve reasoning, and guardrails.',
            'AI / ML Engineering',
            'Advanced',
            '4 Weeks',
            2
        ) RETURNING id INTO path_id;

        INSERT INTO public.learning_modules (learning_path_id, title, description, estimated_duration, display_order, learning_objectives) VALUES
        (path_id, 'LLM Structured Output & Function Calling', 'Enforce JSON schema outputs and integrate dynamic external tools.', '45 mins', 1, ARRAY['Implement reliable tool-use dispatching', 'Handle LLM schema parsing fallbacks']);
    END IF;

    -- 4. Modern Frontend Architecture & Web Performance
    SELECT id INTO prog_id FROM public.programs 
    WHERE title ILIKE '%Frontend Architecture%' LIMIT 1;

    IF prog_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.learning_paths WHERE program_id = prog_id) THEN
        INSERT INTO public.learning_paths (program_id, title, description, domain, difficulty_level, duration, display_order)
        VALUES (
            prog_id, 
            'React 19 & Next.js App Router Architecture',
            'Deep dive into React Server Components, Suspense streaming, and optimistic updates.',
            'Frontend Engineering',
            'Intermediate',
            '3 Weeks',
            1
        ) RETURNING id INTO path_id;

        INSERT INTO public.learning_modules (learning_path_id, title, description, estimated_duration, display_order, learning_objectives) VALUES
        (path_id, 'React Server Components vs Client Boundaries', 'Optimize bundle sizes by moving data fetching and rendering to the server.', '45 mins', 1, ARRAY['Structure server vs client component trees', 'Avoid hydration mismatch errors']),
        (path_id, 'Core Web Vitals & Web Performance Optimization', 'Master Largest Contentful Paint (LCP), Interaction to Next Paint (INP), and Cumulative Layout Shift (CLS).', '60 mins', 2, ARRAY['Eliminate render-blocking resources', 'Audit performance with Chrome DevTools']);
    END IF;

    -- 5. Cloud Security, IAM & Zero-Trust Infrastructure
    SELECT id INTO prog_id FROM public.programs 
    WHERE title ILIKE '%Cloud Security%' LIMIT 1;

    IF prog_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.learning_paths WHERE program_id = prog_id) THEN
        INSERT INTO public.learning_paths (program_id, title, description, domain, difficulty_level, duration, display_order)
        VALUES (
            prog_id, 
            'Enterprise IAM & Zero-Trust Architecture',
            'Design cryptographic authentication flows, OAuth 2.1 specifications, and cloud IAM boundaries.',
            'Cloud & Security',
            'Advanced',
            '4 Weeks',
            1
        ) RETURNING id INTO path_id;

        INSERT INTO public.learning_modules (learning_path_id, title, description, estimated_duration, display_order, learning_objectives) VALUES
        (path_id, 'OAuth 2.1, PKCE & Cryptographic JWT Verifications', 'Implement authorization code flow with PKCE and public key signature rotation.', '60 mins', 1, ARRAY['Verify asymmetric JWT signatures (RS256)', 'Secure mobile and SPA token exchanges']);
    END IF;

    -- 6. Data Structures & Algorithmic Interview Prep
    SELECT id INTO prog_id FROM public.programs 
    WHERE title ILIKE '%Data Structures%' LIMIT 1;

    IF prog_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.learning_paths WHERE program_id = prog_id) THEN
        INSERT INTO public.learning_paths (program_id, title, description, domain, difficulty_level, duration, display_order)
        VALUES (
            prog_id, 
            'Graph Algorithms & Dynamic Programming Mastery',
            'Master shortest paths, topological ordering, bipartite graphs, and memoized transitions.',
            'Core CS & Algorithms',
            'All Levels',
            '4 Weeks',
            1
        ) RETURNING id INTO path_id;

        INSERT INTO public.learning_modules (learning_path_id, title, description, estimated_duration, display_order, learning_objectives) VALUES
        (path_id, 'Graph Traversals, Dijkstra & Topological Sort', 'Solve advanced connectivity, cycle detection, and dependency graph problems.', '60 mins', 1, ARRAY['Implement BFS/DFS on directed graphs', 'Solve topological scheduling problems']),
        (path_id, 'Dynamic Programming: 1D & 2D Memoization Patterns', 'Deconstruct optimal substructure and overlapping subproblems.', '75 mins', 2, ARRAY['Derive state transition relations', 'Optimize auxiliary space complexity']);
    END IF;

END $$;
