"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  GraduationCap,
  Users,
  TrendingUp,
  Layers,
  Search,
  Plus,
  RotateCcw,
  Clock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Trash2,
  Sparkles,
  BookOpen,
  X,
  Filter,
  Edit3,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  FileText,
} from "lucide-react";

export interface LearningModule {
  id: string;
  learningPathId: string;
  title: string;
  description: string;
  learningObjectives: string[];
  content?: string;
  resourceUrl?: string | null;
  estimatedDuration: string;
  displayOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface LearningPath {
  id: string;
  programId: string;
  programTitle: string;
  title: string;
  description: string;
  domain: string;
  difficultyLevel: "Foundational" | "Intermediate" | "Advanced" | "All Levels";
  duration: string;
  status: "active" | "inactive" | "draft";
  displayOrder: number;
  modulesCount: number;
  modules: LearningModule[];
  assignedUsers: number;
  avgProgress: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProgrammeOption {
  id: string;
  title: string;
  domain: string;
  status: string;
}

interface NewModuleDraft {
  title: string;
  description: string;
  learningObjectives: string;
  resourceUrl: string;
  estimatedDuration: string;
}

const DOMAINS = [
  "All",
  "System Architecture",
  "Backend Engineering",
  "AI / ML Engineering",
  "Frontend Engineering",
  "Cloud & Security",
  "Core CS & Algorithms",
];

const DOMAIN_THEMES: Record<string, { bg: string; text: string; border: string }> = {
  "System Architecture": { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" },
  "Backend Engineering": { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  "AI / ML Engineering": { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  "Frontend Engineering": { bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-200" },
  "Cloud & Security": { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  "Core CS & Algorithms": { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
};

export default function AdminLearningPathsPage() {
  const searchParams = useSearchParams();
  const initialProgramFilter = searchParams.get("programId") || "all";

  const [paths, setPaths] = useState<LearningPath[]>([]);
  const [programs, setPrograms] = useState<ProgrammeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search & Filters
  const [search, setSearch] = useState("");
  const [selectedProgram, setSelectedProgram] = useState(initialProgramFilter);
  const [selectedDomain, setSelectedDomain] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("all");

  // Expanded syllabus card IDs
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Detail Modal
  const [selectedPathDetail, setSelectedPathDetail] = useState<LearningPath | null>(null);

  // Create / Edit Learning Path Modal State
  const [showPathModal, setShowPathModal] = useState(false);
  const [editingPath, setEditingPath] = useState<LearningPath | null>(null);
  const [pathFormData, setPathFormData] = useState({
    programId: "",
    title: "",
    description: "",
    domain: "System Architecture",
    difficultyLevel: "Intermediate",
    duration: "4 Weeks",
    status: "active" as "active" | "inactive" | "draft",
  });
  // Dynamic modules builder for create modal
  const [builderModules, setBuilderModules] = useState<NewModuleDraft[]>([]);
  const [pathModalSaving, setPathModalSaving] = useState(false);
  const [pathModalError, setPathModalError] = useState<string | null>(null);

  // Add / Edit Single Module Modal (for existing path)
  const [showModuleModal, setShowModuleModal] = useState(false);
  const [activePathForModule, setActivePathForModule] = useState<LearningPath | null>(null);
  const [editingModule, setEditingModule] = useState<LearningModule | null>(null);
  const [moduleFormData, setModuleFormData] = useState({
    title: "",
    description: "",
    learningObjectives: "",
    resourceUrl: "",
    estimatedDuration: "45 mins",
  });
  const [moduleModalSaving, setModuleModalSaving] = useState(false);
  const [moduleModalError, setModuleModalError] = useState<string | null>(null);

  // Delete Confirmation Modal
  const [pathToDelete, setPathToDelete] = useState<LearningPath | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch all learning paths and available programmes
  const fetchLearningPaths = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/admin/learning-paths");
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error || "Failed to load learning paths.");
        setPaths([]);
        return;
      }
      setPaths(json.learningPaths || []);
      setPrograms(json.programs || []);
    } catch {
      setError("Network error fetching learning paths from server.");
      setPaths([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLearningPaths();
  }, [fetchLearningPaths]);

  async function handleRefresh() {
    setRefreshing(true);
    await fetchLearningPaths();
  }

  // Open Create Learning Path Modal
  function handleOpenCreatePath() {
    setEditingPath(null);
    setPathFormData({
      programId: programs[0]?.id || "",
      title: "",
      description: "",
      domain: programs[0]?.domain || "System Architecture",
      difficultyLevel: "Intermediate",
      duration: "4 Weeks",
      status: "active",
    });
    setBuilderModules([
      {
        title: "",
        description: "",
        learningObjectives: "",
        resourceUrl: "",
        estimatedDuration: "45 mins",
      },
    ]);
    setPathModalError(null);
    setShowPathModal(true);
  }

  // Open Edit Learning Path Modal
  function handleOpenEditPath(lp: LearningPath) {
    setEditingPath(lp);
    setPathFormData({
      programId: lp.programId,
      title: lp.title,
      description: lp.description,
      domain: lp.domain,
      difficultyLevel: lp.difficultyLevel,
      duration: lp.duration,
      status: lp.status,
    });
    setBuilderModules([]);
    setPathModalError(null);
    setShowPathModal(true);
  }

  // Submit Create or Edit Learning Path Form
  async function handleSubmitPathForm(e: React.FormEvent) {
    e.preventDefault();
    if (!pathFormData.title.trim()) {
      setPathModalError("Learning Path title is required.");
      return;
    }
    if (!pathFormData.programId) {
      setPathModalError("Please select a parent Programme for this Learning Path.");
      return;
    }

    setPathModalSaving(true);
    setPathModalError(null);

    try {
      if (editingPath) {
        // PATCH existing path
        const res = await fetch("/api/admin/learning-paths", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingPath.id,
            programId: pathFormData.programId,
            title: pathFormData.title,
            description: pathFormData.description,
            domain: pathFormData.domain,
            difficultyLevel: pathFormData.difficultyLevel,
            duration: pathFormData.duration,
            status: pathFormData.status,
          }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setShowPathModal(false);
          fetchLearningPaths();
        } else {
          setPathModalError(data.error || "Failed to update learning path.");
        }
      } else {
        // Validation: Warn if publishing as Active without any modules
        const validModules = builderModules.filter((m) => m.title.trim().length > 0);
        if (pathFormData.status === "active" && validModules.length === 0) {
          setPathModalError("A learning path should contain at least one module before being published as Active.");
          setPathModalSaving(false);
          return;
        }

        // POST new path with initial modules
        const formattedModules = validModules.map((m, idx) => ({
          title: m.title.trim(),
          description: m.description.trim(),
          learningObjectives: m.learningObjectives
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
          resourceUrl: m.resourceUrl.trim(),
          estimatedDuration: m.estimatedDuration.trim() || "45 mins",
          displayOrder: idx + 1,
        }));

        const res = await fetch("/api/admin/learning-paths", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            programId: pathFormData.programId,
            title: pathFormData.title,
            description: pathFormData.description,
            domain: pathFormData.domain,
            difficultyLevel: pathFormData.difficultyLevel,
            duration: pathFormData.duration,
            status: pathFormData.status,
            modules: formattedModules,
          }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setShowPathModal(false);
          fetchLearningPaths();
        } else {
          setPathModalError(data.error || "Failed to create learning path.");
        }
      }
    } catch {
      setPathModalError("Network error while saving learning path.");
    } finally {
      setPathModalSaving(false);
    }
  }

  // Open Add Module Modal for an existing path
  function handleOpenAddModule(lp: LearningPath) {
    setActivePathForModule(lp);
    setEditingModule(null);
    setModuleFormData({
      title: "",
      description: "",
      learningObjectives: "",
      resourceUrl: "",
      estimatedDuration: "45 mins",
    });
    setModuleModalError(null);
    setShowModuleModal(true);
  }

  // Open Edit Module Modal
  function handleOpenEditModule(lp: LearningPath, mod: LearningModule) {
    setActivePathForModule(lp);
    setEditingModule(mod);
    setModuleFormData({
      title: mod.title,
      description: mod.description,
      learningObjectives: (mod.learningObjectives || []).join("\n"),
      resourceUrl: mod.resourceUrl || "",
      estimatedDuration: mod.estimatedDuration || "45 mins",
    });
    setModuleModalError(null);
    setShowModuleModal(true);
  }

  // Save Add/Edit Single Module
  async function handleSubmitModuleForm(e: React.FormEvent) {
    e.preventDefault();
    if (!activePathForModule) return;
    if (!moduleFormData.title.trim()) {
      setModuleModalError("Module title is required.");
      return;
    }

    setModuleModalSaving(true);
    setModuleModalError(null);

    try {
      const objectives = moduleFormData.learningObjectives
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);

      if (editingModule) {
        // Edit module
        const res = await fetch("/api/admin/learning-paths", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: activePathForModule.id,
            action: "edit_module",
            moduleId: editingModule.id,
            module: {
              title: moduleFormData.title,
              description: moduleFormData.description,
              learningObjectives: objectives,
              resourceUrl: moduleFormData.resourceUrl,
              estimatedDuration: moduleFormData.estimatedDuration,
            },
          }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setShowModuleModal(false);
          await fetchLearningPaths();
        } else {
          setModuleModalError(data.error || "Failed to update module.");
        }
      } else {
        // Add module
        const res = await fetch("/api/admin/learning-paths", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: activePathForModule.id,
            action: "add_module",
            module: {
              title: moduleFormData.title,
              description: moduleFormData.description,
              learningObjectives: objectives,
              resourceUrl: moduleFormData.resourceUrl,
              estimatedDuration: moduleFormData.estimatedDuration,
            },
          }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setShowModuleModal(false);
          await fetchLearningPaths();
        } else {
          setModuleModalError(data.error || "Failed to add module.");
        }
      }
    } catch {
      setModuleModalError("Network error while saving module.");
    } finally {
      setModuleModalSaving(false);
    }
  }

  // Delete a Module
  async function handleDeleteModule(pathId: string, modId: string, modTitle: string) {
    if (!confirm(`Are you sure you want to delete module "${modTitle}"?`)) return;

    try {
      const res = await fetch("/api/admin/learning-paths", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: pathId,
          action: "delete_module",
          moduleId: modId,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        fetchLearningPaths();
      } else {
        alert(data.error || "Failed to delete module.");
      }
    } catch {
      alert("Error deleting module.");
    }
  }

  // Reorder Modules (Move Up / Down)
  async function handleMoveModule(pathId: string, modIndex: number, direction: "up" | "down") {
    const targetPath = paths.find((p) => p.id === pathId);
    if (!targetPath || !targetPath.modules) return;

    const list = [...targetPath.modules];
    const targetIdx = direction === "up" ? modIndex - 1 : modIndex + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;

    // Swap items
    const temp = list[modIndex];
    list[modIndex] = list[targetIdx];
    list[targetIdx] = temp;

    // Build order mapping
    const moduleOrders = list.map((m, idx) => ({
      id: m.id,
      displayOrder: idx + 1,
    }));

    // Optimistic UI update
    setPaths((prev) =>
      prev.map((p) => (p.id === pathId ? { ...p, modules: list } : p))
    );

    try {
      await fetch("/api/admin/learning-paths", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: pathId,
          action: "reorder_modules",
          moduleOrders,
        }),
      });
    } catch {
      fetchLearningPaths();
    }
  }

  // Delete Learning Path
  async function handleExecuteDeletePath() {
    if (!pathToDelete) return;
    setDeleting(true);

    try {
      const res = await fetch(`/api/admin/learning-paths?id=${pathToDelete.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPathToDelete(null);
        fetchLearningPaths();
      } else {
        alert(data.error || "Failed to delete learning path.");
      }
    } catch {
      alert("Error contacting server to delete learning path.");
    } finally {
      setDeleting(false);
    }
  }

  // Filtered List
  const filteredPaths = useMemo(() => {
    return paths.filter((p) => {
      const matchesSearch =
        search === "" ||
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.description.toLowerCase().includes(search.toLowerCase()) ||
        p.domain.toLowerCase().includes(search.toLowerCase()) ||
        p.programTitle.toLowerCase().includes(search.toLowerCase());

      const matchesProgram =
        selectedProgram === "all" || p.programId === selectedProgram;

      const matchesDomain =
        selectedDomain === "All" || p.domain.toLowerCase() === selectedDomain.toLowerCase();

      const matchesStatus =
        selectedStatus === "all" || p.status.toLowerCase() === selectedStatus.toLowerCase();

      return matchesSearch && matchesProgram && matchesDomain && matchesStatus;
    });
  }, [paths, search, selectedProgram, selectedDomain, selectedStatus]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    const totalRoadmaps = paths.length;
    const totalModules = paths.reduce((sum, p) => sum + (p.modulesCount || 0), 0);
    const totalEnrolled = paths.reduce((sum, p) => sum + (p.assignedUsers || 0), 0);
    const avgProgress =
      totalRoadmaps > 0
        ? Math.round(paths.reduce((sum, p) => sum + (p.avgProgress || 0), 0) / totalRoadmaps)
        : 0;

    return { totalRoadmaps, totalModules, totalEnrolled, avgProgress };
  }, [paths]);

  return (
    <div className="min-h-full p-4 sm:p-6 lg:p-8 flex flex-col gap-6 font-sans max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Learning Path Management
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#F97316]/10 text-[#F97316] border border-[#F97316]/20">
              <Sparkles className="w-3 h-3" />
              Syllabus Roadmaps & Modules
            </span>
          </div>
          <p className="text-xs sm:text-sm font-semibold text-slate-500 mt-1">
            Build step-by-step learning roadmaps, curate ordered curriculum modules, and link them to parent training programmes.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition shadow-2xs"
            title="Refresh Data"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-[#F97316]" : ""}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleOpenCreatePath}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold text-white bg-gradient-to-r from-[#F97316] to-[#EA580C] hover:opacity-95 shadow-xs transition"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Create Learning Path</span>
          </button>
        </div>
      </div>

      {/* KPI Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-orange-50 text-[#F97316] border border-orange-100 flex items-center justify-center shrink-0">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Roadmaps</p>
            <h3 className="text-xl font-black text-slate-900 leading-tight">
              {metrics.totalRoadmaps} <span className="text-xs font-bold text-slate-400">Roadmaps</span>
            </h3>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Database Modules</p>
            <h3 className="text-xl font-black text-slate-900 leading-tight">
              {metrics.totalModules} <span className="text-xs font-bold text-slate-400">Curated</span>
            </h3>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Enrolled Candidates</p>
            <h3 className="text-xl font-black text-slate-900 leading-tight">
              {metrics.totalEnrolled} <span className="text-xs font-bold text-slate-400">Assigned</span>
            </h3>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Avg Cohort Progress</p>
            <h3 className="text-xl font-black text-slate-900 leading-tight">
              {metrics.avgProgress}% <span className="text-xs font-bold text-emerald-600">Active</span>
            </h3>
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-3 sm:p-4 shadow-2xs flex flex-col gap-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-2.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search roadmaps, module topics, programmes..."
              className="w-full rounded-xl bg-slate-50 border border-slate-200 pl-10 pr-9 py-2 text-xs font-medium text-slate-900 placeholder-slate-400 focus:bg-white focus:border-[#F97316] focus:outline-none transition"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Dropdown Filters */}
          <div className="flex flex-wrap items-center gap-2 self-start md:self-auto w-full md:w-auto">
            {/* Filter by Programme */}
            <select
              value={selectedProgram}
              onChange={(e) => setSelectedProgram(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 focus:bg-white focus:border-[#F97316] focus:outline-none transition max-w-[210px] truncate"
            >
              <option value="all">All Programmes</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>

            {/* Filter by Status */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 focus:bg-white focus:border-[#F97316] focus:outline-none transition"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="draft">Draft</option>
            </select>

            <span className="text-xs font-bold text-slate-500 ml-1">
              Showing <strong className="text-slate-900">{filteredPaths.length}</strong> of {paths.length}
            </span>
          </div>
        </div>

        {/* Domain Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none pt-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Domain:
          </span>
          {DOMAINS.map((domain) => {
            const count =
              domain === "All"
                ? paths.length
                : paths.filter((p) => p.domain.toLowerCase() === domain.toLowerCase()).length;

            const isSelected = selectedDomain === domain;

            return (
              <button
                key={domain}
                onClick={() => setSelectedDomain(domain)}
                className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-[#1E2544] text-white shadow-xs"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/60"
                }`}
              >
                <span>{domain}</span>
                <span
                  className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ${
                    isSelected ? "bg-white/20 text-white" : "bg-slate-200/80 text-slate-700"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Learning Paths List */}
      {loading ? (
        <div className="space-y-4 animate-pulse">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-44 rounded-2xl bg-white border border-slate-200 p-5" />
          ))}
        </div>
      ) : filteredPaths.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center flex flex-col items-center justify-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400">
            <BookOpen className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900">No Learning Paths Found</h3>
            <p className="text-xs font-semibold text-slate-500 max-w-sm mt-1">
              {search || selectedDomain !== "All" || selectedProgram !== "all" || selectedStatus !== "all"
                ? "No learning paths match your current filters. Try resetting filters."
                : "No learning paths have been created yet. Create your first roadmap linked to a programme."}
            </p>
          </div>
          <div className="flex items-center gap-2 mt-2">
            {search || selectedDomain !== "All" || selectedProgram !== "all" || selectedStatus !== "all" ? (
              <button
                onClick={() => {
                  setSearch("");
                  setSelectedDomain("All");
                  setSelectedProgram("all");
                  setSelectedStatus("all");
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
              >
                Reset Filters
              </button>
            ) : null}
            <button
              onClick={handleOpenCreatePath}
              className="px-4 py-2 rounded-xl text-xs font-extrabold text-white bg-[#F97316] hover:bg-orange-600 transition shadow-xs"
            >
              + Create Learning Path
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPaths.map((lp) => {
            const theme = DOMAIN_THEMES[lp.domain] || {
              bg: "bg-slate-100",
              text: "text-slate-700",
              border: "border-slate-200",
            };
            const isExpanded = expandedId === lp.id;

            return (
              <div
                key={lp.id}
                className="rounded-2xl border border-slate-200/90 bg-white shadow-2xs transition-all hover:border-slate-300 overflow-hidden"
              >
                <div className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                  {/* Left Column: Path Info & Programme Parent */}
                  <div className="space-y-2 flex-1">
                    {/* Programme Parent Banner */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#1E2544] bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200">
                        <BookOpen className="w-3 h-3 text-[#F97316]" />
                        Programme: {lp.programTitle}
                      </span>
                      <span
                        className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-lg border ${theme.bg} ${theme.text} ${theme.border}`}
                      >
                        {lp.domain}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 border border-slate-200">
                        {lp.difficultyLevel}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg bg-slate-50 text-slate-500 border border-slate-200">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {lp.duration}
                      </span>
                      <span
                        className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border ${
                          lp.status === "active"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : lp.status === "draft"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        }`}
                      >
                        {lp.status}
                      </span>
                    </div>

                    {/* Title & Description */}
                    <div>
                      <h3
                        onClick={() => setSelectedPathDetail(lp)}
                        className="text-base font-black text-slate-900 hover:text-indigo-600 cursor-pointer transition flex items-center gap-1.5"
                      >
                        <span>{lp.title}</span>
                      </h3>
                      <p className="text-xs font-semibold text-slate-500 mt-1 leading-relaxed line-clamp-2">
                        {lp.description || "Structured step-by-step roadmap with real-world practice modules."}
                      </p>
                    </div>

                    {/* Stats indicators */}
                    <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-600 pt-1">
                      <span className="flex items-center gap-1.5 text-slate-700">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <strong className="text-slate-900">{lp.assignedUsers}</strong> enrolled students
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="flex items-center gap-1.5 text-slate-700">
                        <Layers className="w-3.5 h-3.5 text-[#F97316]" />
                        <strong className="text-slate-900">{lp.modulesCount}</strong> ordered module(s)
                      </span>
                    </div>
                  </div>

                  {/* Right Column: Progress & Actions */}
                  <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end justify-between gap-4 shrink-0 lg:w-64 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                    {/* Progress Bar */}
                    <div className="w-full">
                      <div className="flex justify-between items-center text-xs font-bold text-slate-600 mb-1.5">
                        <span className="text-slate-500">Cohort Progress</span>
                        <span className="font-extrabold text-[#F97316]">{lp.avgProgress}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden border border-slate-200/60">
                        <div
                          className="h-full bg-gradient-to-r from-orange-400 to-[#F97316] rounded-full transition-all duration-700"
                          style={{ width: `${Math.max(lp.avgProgress, 5)}%` }}
                        />
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 w-full justify-between sm:justify-end">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : lp.id)}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                          isExpanded
                            ? "bg-slate-100 text-slate-900 border-slate-300"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <span>{isExpanded ? "Hide Modules" : `Modules (${lp.modulesCount})`}</span>
                        {isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <button
                        onClick={() => handleOpenAddModule(lp)}
                        className="px-2.5 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 text-xs font-bold flex items-center gap-1 transition"
                        title="Add New Module"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Module</span>
                      </button>

                      <button
                        onClick={() => handleOpenEditPath(lp)}
                        className="p-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition"
                        title="Edit Learning Path Details"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => setPathToDelete(lp)}
                        className="p-1.5 rounded-xl border border-slate-200 text-slate-400 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition"
                        title="Delete Learning Path"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* EXPANDABLE MODULES ACCORDION */}
                {isExpanded && (
                  <div className="bg-slate-50/80 border-t border-slate-200 px-5 py-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-[#F97316]" />
                        Modules Syllabus ({lp.modules.length} Saved in Database)
                      </h4>
                      <button
                        onClick={() => handleOpenAddModule(lp)}
                        className="text-xs font-extrabold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Add Module to this Path</span>
                      </button>
                    </div>

                    {lp.modules.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center bg-white">
                        <p className="text-xs font-semibold text-slate-500">
                          No modules have been added to this learning path yet.
                        </p>
                        <button
                          onClick={() => handleOpenAddModule(lp)}
                          className="mt-2 px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition"
                        >
                          + Add First Module
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {lp.modules.map((mod, modIdx) => (
                          <div
                            key={mod.id}
                            className="bg-white rounded-xl border border-slate-200 p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs hover:border-slate-300 transition"
                          >
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <div className="w-6 h-6 rounded-lg bg-orange-50 text-[#F97316] font-black text-xs flex items-center justify-center shrink-0 mt-0.5 border border-orange-100">
                                {mod.displayOrder || modIdx + 1}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h5 className="text-xs font-black text-slate-900">{mod.title}</h5>
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.2 rounded-md bg-slate-100 text-slate-500">
                                    <Clock className="w-2.5 h-2.5" />
                                    {mod.estimatedDuration}
                                  </span>
                                  {mod.resourceUrl ? (
                                    <a
                                      href={mod.resourceUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-[10px] font-bold text-indigo-600 hover:underline flex items-center gap-0.5"
                                    >
                                      <span>Resource Link</span>
                                      <ExternalLink className="w-2.5 h-2.5" />
                                    </a>
                                  ) : null}
                                </div>
                                <p className="text-xs font-medium text-slate-500 mt-0.5 leading-relaxed">
                                  {mod.description || "Practical interview evaluation topic."}
                                </p>
                                {mod.learningObjectives && mod.learningObjectives.length > 0 ? (
                                  <div className="flex flex-wrap gap-1 mt-1.5">
                                    {mod.learningObjectives.map((obj, oIdx) => (
                                      <span
                                        key={oIdx}
                                        className="text-[10px] font-semibold text-slate-600 bg-slate-50 border border-slate-200/80 px-1.5 py-0.2 rounded-md"
                                      >
                                        ✓ {obj}
                                      </span>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            </div>

                            {/* Reorder & Edit / Delete Controls */}
                            <div className="flex items-center gap-1 shrink-0 self-end md:self-center border-t md:border-t-0 pt-2 md:pt-0 border-slate-100 w-full md:w-auto justify-end">
                              <button
                                onClick={() => handleMoveModule(lp.id, modIdx, "up")}
                                disabled={modIdx === 0}
                                className="p-1 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 transition"
                                title="Move Module Up"
                              >
                                <ArrowUp className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleMoveModule(lp.id, modIdx, "down")}
                                disabled={modIdx === lp.modules.length - 1}
                                className="p-1 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 transition"
                                title="Move Module Down"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleOpenEditModule(lp, mod)}
                                className="p-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-indigo-600 transition"
                                title="Edit Module"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleDeleteModule(lp.id, mod.id, mod.title)}
                                className="p-1 rounded-lg border border-slate-200 text-slate-400 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition"
                                title="Delete Module"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE & EDIT LEARNING PATH MODAL */}
      {showPathModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  {editingPath ? "Edit Learning Path" : "Create Learning Path Roadmap"}
                </h3>
                <p className="text-xs font-semibold text-slate-500">
                  {editingPath
                    ? "Modify roadmap metadata and linked programme."
                    : "Establish a step-by-step roadmap and define its modules."}
                </p>
              </div>
              <button
                onClick={() => setShowPathModal(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {pathModalError && (
              <div className="mx-6 mt-4 p-3 rounded-xl border border-red-200 bg-red-50 text-xs font-bold text-red-700 flex items-center gap-2 shrink-0">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{pathModalError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitPathForm} className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Parent Programme Dropdown */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Parent Programme <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={pathFormData.programId}
                  onChange={(e) => {
                    const selected = programs.find((p) => p.id === e.target.value);
                    setPathFormData({
                      ...pathFormData,
                      programId: e.target.value,
                      domain: selected?.domain || pathFormData.domain,
                    });
                  }}
                  className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-700 focus:bg-white focus:border-[#F97316] focus:outline-none transition"
                >
                  <option value="" disabled>
                    -- Select a Training Programme --
                  </option>
                  {programs.map((prog) => (
                    <option key={prog.id} value={prog.id}>
                      {prog.title} ({prog.domain})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] font-semibold text-slate-400 mt-0.5">
                  Every learning path roadmap belongs to a structured career training programme.
                </p>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Learning Path Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={pathFormData.title}
                  onChange={(e) => setPathFormData({ ...pathFormData, title: e.target.value })}
                  placeholder="e.g. Distributed Systems & Event-Driven Patterns"
                  className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:border-[#F97316] focus:outline-none transition"
                />
              </div>

              {/* Domain & Difficulty */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Domain / Track</label>
                  <select
                    value={pathFormData.domain}
                    onChange={(e) => setPathFormData({ ...pathFormData, domain: e.target.value })}
                    className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 focus:bg-white focus:border-[#F97316] focus:outline-none transition"
                  >
                    <option value="System Architecture">System Architecture</option>
                    <option value="Backend Engineering">Backend Engineering</option>
                    <option value="AI / ML Engineering">AI / ML Engineering</option>
                    <option value="Frontend Engineering">Frontend Engineering</option>
                    <option value="Cloud & Security">Cloud & Security</option>
                    <option value="Core CS & Algorithms">Core CS & Algorithms</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Difficulty Level</label>
                  <select
                    value={pathFormData.difficultyLevel}
                    onChange={(e) =>
                      setPathFormData({ ...pathFormData, difficultyLevel: e.target.value })
                    }
                    className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 focus:bg-white focus:border-[#F97316] focus:outline-none transition"
                  >
                    <option value="Foundational">Foundational / Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                    <option value="All Levels">All Levels</option>
                  </select>
                </div>
              </div>

              {/* Duration & Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Estimated Duration</label>
                  <select
                    value={pathFormData.duration}
                    onChange={(e) => setPathFormData({ ...pathFormData, duration: e.target.value })}
                    className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 focus:bg-white focus:border-[#F97316] focus:outline-none transition"
                  >
                    <option value="3 Weeks">3 Weeks (Sprint)</option>
                    <option value="4 Weeks">4 Weeks (Standard)</option>
                    <option value="6 Weeks">6 Weeks (In-Depth)</option>
                    <option value="8 Weeks">8 Weeks (Comprehensive)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                  <select
                    value={pathFormData.status}
                    onChange={(e) =>
                      setPathFormData({
                        ...pathFormData,
                        status: e.target.value as "active" | "inactive" | "draft",
                      })
                    }
                    className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 focus:bg-white focus:border-[#F97316] focus:outline-none transition"
                  >
                    <option value="active">Active (Visible)</option>
                    <option value="draft">Draft (Work in Progress)</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Roadmap Description</label>
                <textarea
                  rows={2}
                  value={pathFormData.description}
                  onChange={(e) =>
                    setPathFormData({ ...pathFormData, description: e.target.value })
                  }
                  placeholder="Outline the core milestones, hands-on tasks, and skills gained…"
                  className="w-full rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs font-medium text-slate-900 focus:bg-white focus:border-[#F97316] focus:outline-none transition"
                />
              </div>

              {/* DYNAMIC MODULES BUILDER (When creating new learning path) */}
              {!editingPath && (
                <div className="border-t border-slate-200 pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-[#F97316]" />
                        Initial Modules Syllabus
                      </h4>
                      <p className="text-[10px] font-semibold text-slate-400">
                        Define the ordered modules to be created in the database.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setBuilderModules([
                          ...builderModules,
                          {
                            title: "",
                            description: "",
                            learningObjectives: "",
                            resourceUrl: "",
                            estimatedDuration: "45 mins",
                          },
                        ])
                      }
                      className="px-2.5 py-1 rounded-xl bg-orange-50 border border-orange-200 text-[#F97316] text-xs font-bold hover:bg-orange-100 transition flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Module</span>
                    </button>
                  </div>

                  <div className="space-y-3">
                    {builderModules.map((mod, bIdx) => (
                      <div
                        key={bIdx}
                        className="bg-slate-50 rounded-2xl border border-slate-200/80 p-3.5 space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-[#F97316] bg-orange-100 px-2 py-0.5 rounded-md">
                            Module {bIdx + 1}
                          </span>
                          {builderModules.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                setBuilderModules(builderModules.filter((_, i) => i !== bIdx))
                              }
                              className="text-slate-400 hover:text-red-600 transition"
                              title="Remove Module"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div className="sm:col-span-2">
                            <input
                              type="text"
                              value={mod.title}
                              onChange={(e) => {
                                const next = [...builderModules];
                                next[bIdx].title = e.target.value;
                                setBuilderModules(next);
                              }}
                              placeholder={`Module ${bIdx + 1} Title (e.g. Kafka Partitioning)`}
                              className="w-full rounded-xl bg-white border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-900 focus:border-[#F97316] focus:outline-none"
                            />
                          </div>
                          <div>
                            <input
                              type="text"
                              value={mod.estimatedDuration}
                              onChange={(e) => {
                                const next = [...builderModules];
                                next[bIdx].estimatedDuration = e.target.value;
                                setBuilderModules(next);
                              }}
                              placeholder="Duration (e.g. 45 mins)"
                              className="w-full rounded-xl bg-white border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 focus:border-[#F97316] focus:outline-none"
                            />
                          </div>
                        </div>

                        <textarea
                          rows={2}
                          value={mod.description}
                          onChange={(e) => {
                            const next = [...builderModules];
                            next[bIdx].description = e.target.value;
                            setBuilderModules(next);
                          }}
                          placeholder="Module objectives and key technical concepts…"
                          className="w-full rounded-xl bg-white border border-slate-200 p-2.5 text-xs font-medium text-slate-700 focus:border-[#F97316] focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPathModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pathModalSaving}
                  className="px-4 py-2 rounded-xl text-xs font-extrabold text-white bg-gradient-to-r from-[#F97316] to-[#EA580C] hover:opacity-95 shadow-xs transition disabled:opacity-50"
                >
                  {pathModalSaving
                    ? "Saving…"
                    : editingPath
                    ? "Update Learning Path"
                    : "Create Learning Path"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD / EDIT SINGLE MODULE MODAL */}
      {showModuleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 space-y-4 font-sans animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  {editingModule ? "Edit Curriculum Module" : "Add Module to Path"}
                </h3>
                <p className="text-xs font-semibold text-slate-500">
                  Path: <strong className="text-slate-800">{activePathForModule?.title}</strong>
                </p>
              </div>
              <button
                onClick={() => setShowModuleModal(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {moduleModalError && (
              <div className="p-3 rounded-xl border border-red-200 bg-red-50 text-xs font-bold text-red-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{moduleModalError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitModuleForm} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Module Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={moduleFormData.title}
                  onChange={(e) =>
                    setModuleFormData({ ...moduleFormData, title: e.target.value })
                  }
                  placeholder="e.g. Distributed Consensus & Raft Protocol"
                  className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-900 focus:bg-white focus:border-[#F97316] focus:outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Estimated Duration</label>
                <input
                  type="text"
                  value={moduleFormData.estimatedDuration}
                  onChange={(e) =>
                    setModuleFormData({ ...moduleFormData, estimatedDuration: e.target.value })
                  }
                  placeholder="e.g. 60 mins"
                  className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-700 focus:bg-white focus:border-[#F97316] focus:outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Module Description</label>
                <textarea
                  rows={2}
                  value={moduleFormData.description}
                  onChange={(e) =>
                    setModuleFormData({ ...moduleFormData, description: e.target.value })
                  }
                  placeholder="Core theoretical foundations, practical engineering tradeoffs…"
                  className="w-full rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-xs font-medium text-slate-800 focus:bg-white focus:border-[#F97316] focus:outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Learning Objectives <span className="text-slate-400 font-normal">(One per line)</span>
                </label>
                <textarea
                  rows={3}
                  value={moduleFormData.learningObjectives}
                  onChange={(e) =>
                    setModuleFormData({ ...moduleFormData, learningObjectives: e.target.value })
                  }
                  placeholder="Understand quorum leader election&#10;Implement heartbeat timers&#10;Handle network partition split-brain"
                  className="w-full rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-xs font-mono text-slate-800 focus:bg-white focus:border-[#F97316] focus:outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  External Resource / Documentation URL <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="url"
                  value={moduleFormData.resourceUrl}
                  onChange={(e) =>
                    setModuleFormData({ ...moduleFormData, resourceUrl: e.target.value })
                  }
                  placeholder="https://..."
                  className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-800 focus:bg-white focus:border-[#F97316] focus:outline-none transition"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModuleModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={moduleModalSaving}
                  className="px-4 py-2 rounded-xl text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs transition disabled:opacity-50"
                >
                  {moduleModalSaving
                    ? "Saving…"
                    : editingModule
                    ? "Save Module Changes"
                    : "Add Module to Database"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL MODAL (When clicking a Learning Path title) */}
      {selectedPathDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                  {selectedPathDetail.domain}
                </span>
                <h3 className="text-lg font-black text-slate-900 mt-1">
                  {selectedPathDetail.title}
                </h3>
                <p className="text-xs font-semibold text-slate-500">
                  Parent Programme: <strong className="text-slate-800">{selectedPathDetail.programTitle}</strong>
                </p>
              </div>
              <button
                onClick={() => setSelectedPathDetail(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs font-semibold text-slate-600 leading-relaxed">
              {selectedPathDetail.description || "Comprehensive technical syllabus roadmaps."}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 py-1">
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Difficulty</span>
                <p className="text-xs font-black text-slate-900 mt-0.5">{selectedPathDetail.difficultyLevel}</p>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Duration</span>
                <p className="text-xs font-black text-slate-900 mt-0.5">{selectedPathDetail.duration}</p>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Enrolled Students</span>
                <p className="text-xs font-black text-slate-900 mt-0.5">{selectedPathDetail.assignedUsers}</p>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Avg Progress</span>
                <p className="text-xs font-black text-[#F97316] mt-0.5">{selectedPathDetail.avgProgress}%</p>
              </div>
            </div>

            {/* List of Modules */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-extrabold uppercase text-slate-800">
                  Ordered Modules ({selectedPathDetail.modules.length})
                </h4>
                <button
                  onClick={() => {
                    handleOpenAddModule(selectedPathDetail);
                    setSelectedPathDetail(null);
                  }}
                  className="text-xs font-extrabold text-indigo-600 hover:underline"
                >
                  + Add Module
                </button>
              </div>

              {selectedPathDetail.modules.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center">No modules found in database.</p>
              ) : (
                <div className="space-y-2">
                  {selectedPathDetail.modules.map((m, idx) => (
                    <div
                      key={m.id}
                      className="rounded-xl border border-slate-200 p-3 bg-slate-50 flex items-start gap-3"
                    >
                      <span className="w-5 h-5 rounded-md bg-orange-100 text-[#F97316] font-black text-xs flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-black text-slate-900">{m.title}</p>
                        <p className="text-[11px] font-medium text-slate-500 mt-0.5">{m.description}</p>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 shrink-0">{m.estimatedDuration}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedPathDetail(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION DIALOG */}
      {pathToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 border border-red-200 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Delete Learning Path?</h3>
                <p className="text-xs font-semibold text-slate-500 mt-0.5">
                  Action for: <strong className="text-slate-900">{pathToDelete.title}</strong>
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete this learning path? This will permanently delete the roadmap and all its{" "}
              <strong>{pathToDelete.modulesCount} database modules</strong>. This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setPathToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleExecuteDeletePath}
                className="px-4 py-2 rounded-xl text-xs font-extrabold text-white bg-red-600 hover:bg-red-700 shadow-xs transition disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete Learning Path"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
