"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  Filter,
  X,
  Edit3,
  Trash2,
  Clock,
  Users,
  BookOpen,
  GraduationCap,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Layers,
  RotateCcw,
  TrendingUp,
  ExternalLink,
} from "lucide-react";

export interface Program {
  id: string;
  title: string;
  description: string;
  category: string;
  domain: string;
  difficultyLevel: "Foundational" | "Intermediate" | "Advanced" | "All Levels";
  duration: string;
  thumbnailUrl?: string | null;
  status: "active" | "inactive" | "draft";
  enrolledCount: number;
  completionRate: number;
  learningPathsCount: number;
  createdAt: string;
  updatedAt: string;
}

const CATEGORIES = [
  "All",
  "System Architecture",
  "Backend Engineering",
  "AI / ML Engineering",
  "Frontend Engineering",
  "Cloud & Security",
  "Core CS & Algorithms",
];

const CATEGORY_THEMES: Record<string, { bg: string; text: string; border: string }> = {
  "System Architecture": { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" },
  "Backend Engineering": { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  "AI / ML Engineering": { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  "Frontend Engineering": { bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-200" },
  "Cloud & Security": { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  "Core CS & Algorithms": { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
};

export default function AdminProgramsPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedDifficulty, setSelectedDifficulty] = useState("all");

  // Create / Edit Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "System Architecture",
    difficultyLevel: "Intermediate",
    duration: "8 Weeks",
    thumbnailUrl: "",
    status: "active" as "active" | "inactive" | "draft",
  });
  const [modalSaving, setModalSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Delete & Safety Guard Modal State
  const [programToDelete, setProgramToDelete] = useState<Program | null>(null);
  const [deleteWarning, setDeleteWarning] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Quick status toggle loading map
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);

  const fetchPrograms = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/admin/programs");
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error || "Failed to load programmes.");
        setPrograms([]);
        return;
      }
      setPrograms(json.programs || []);
    } catch (err: any) {
      setError("Network error fetching programmes from server.");
      setPrograms([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPrograms();
  }, [fetchPrograms]);

  async function handleRefresh() {
    setRefreshing(true);
    await fetchPrograms();
  }

  // Open Create Modal
  function handleOpenCreate() {
    setEditingProgram(null);
    setFormData({
      title: "",
      description: "",
      category: "System Architecture",
      difficultyLevel: "Intermediate",
      duration: "8 Weeks",
      thumbnailUrl: "",
      status: "active",
    });
    setModalError(null);
    setShowModal(true);
  }

  // Open Edit Modal
  function handleOpenEdit(prog: Program) {
    setEditingProgram(prog);
    setFormData({
      title: prog.title,
      description: prog.description,
      category: prog.category || prog.domain || "System Architecture",
      difficultyLevel: prog.difficultyLevel || "Intermediate",
      duration: prog.duration || "8 Weeks",
      thumbnailUrl: prog.thumbnailUrl || "",
      status: prog.status,
    });
    setModalError(null);
    setShowModal(true);
  }

  // Submit Create or Edit Form
  async function handleSubmitForm(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.title.trim()) {
      setModalError("Programme title is required.");
      return;
    }

    setModalSaving(true);
    setModalError(null);

    try {
      if (editingProgram) {
        // PATCH existing programme
        const res = await fetch("/api/admin/programs", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingProgram.id,
            title: formData.title,
            description: formData.description,
            category: formData.category,
            domain: formData.category,
            difficultyLevel: formData.difficultyLevel,
            duration: formData.duration,
            thumbnailUrl: formData.thumbnailUrl,
            status: formData.status,
          }),
        });
        const data = await res.json();

        if (res.ok && data.success) {
          setShowModal(false);
          fetchPrograms();
        } else {
          setModalError(data.error || "Failed to update programme.");
        }
      } else {
        // POST new programme
        const res = await fetch("/api/admin/programs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: formData.title,
            description: formData.description,
            category: formData.category,
            domain: formData.category,
            difficultyLevel: formData.difficultyLevel,
            duration: formData.duration,
            thumbnailUrl: formData.thumbnailUrl,
            status: formData.status,
          }),
        });
        const data = await res.json();

        if (res.ok && data.success) {
          setShowModal(false);
          fetchPrograms();
        } else {
          setModalError(data.error || "Failed to create programme.");
        }
      }
    } catch {
      setModalError("Network error while saving programme.");
    } finally {
      setModalSaving(false);
    }
  }

  // Quick Status Toggle directly from card
  async function handleQuickStatusChange(progId: string, newStatus: "active" | "inactive" | "draft") {
    setStatusUpdatingId(progId);
    try {
      const res = await fetch("/api/admin/programs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: progId, status: newStatus }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPrograms((prev) =>
          prev.map((p) => (p.id === progId ? { ...p, status: newStatus } : p))
        );
      } else {
        alert(data.error || "Failed to change programme status.");
      }
    } catch {
      alert("Network error updating status.");
    } finally {
      setStatusUpdatingId(null);
    }
  }

  // Open Delete Confirmation Dialog
  function handleInitiateDelete(prog: Program) {
    setProgramToDelete(prog);
    if (prog.enrolledCount > 0) {
      setDeleteWarning(
        `Safety Notice: ${prog.enrolledCount} student(s) are actively enrolled in this programme. Permanently deleting it will remove student enrolment records. Deactivating it is recommended.`
      );
    } else {
      setDeleteWarning(null);
    }
  }

  // Perform Delete or Safe Deactivate
  async function handleExecuteDelete(actionType: "deactivate" | "permanent") {
    if (!programToDelete) return;
    setDeleting(true);

    try {
      const url =
        actionType === "deactivate"
          ? `/api/admin/programs?id=${programToDelete.id}&action=deactivate`
          : `/api/admin/programs?id=${programToDelete.id}&force=true`;

      const res = await fetch(url, { method: "DELETE" });
      const data = await res.json();

      if (res.ok && data.success) {
        setProgramToDelete(null);
        setDeleteWarning(null);
        fetchPrograms();
      } else {
        alert(data.error || "Failed to complete programme deletion.");
      }
    } catch {
      alert("Error contacting server to delete programme.");
    } finally {
      setDeleting(false);
    }
  }

  // Filtered List
  const filteredPrograms = useMemo(() => {
    return programs.filter((p) => {
      const matchesSearch =
        search === "" ||
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.description.toLowerCase().includes(search.toLowerCase()) ||
        p.category.toLowerCase().includes(search.toLowerCase());

      const matchesCategory =
        selectedCategory === "All" ||
        p.category.toLowerCase() === selectedCategory.toLowerCase() ||
        p.domain.toLowerCase() === selectedCategory.toLowerCase();

      const matchesStatus =
        selectedStatus === "all" || p.status.toLowerCase() === selectedStatus.toLowerCase();

      const matchesDifficulty =
        selectedDifficulty === "all" ||
        p.difficultyLevel.toLowerCase() === selectedDifficulty.toLowerCase() ||
        (selectedDifficulty === "Foundational" && p.difficultyLevel === "Foundational");

      return matchesSearch && matchesCategory && matchesStatus && matchesDifficulty;
    });
  }, [programs, search, selectedCategory, selectedStatus, selectedDifficulty]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    const total = programs.length;
    const activeCount = programs.filter((p) => p.status === "active").length;
    const draftCount = programs.filter((p) => p.status === "draft").length;
    const totalEnrolled = programs.reduce((sum, p) => sum + (p.enrolledCount || 0), 0);
    const avgCompletion =
      total > 0
        ? Math.round(programs.reduce((sum, p) => sum + (p.completionRate || 0), 0) / total)
        : 0;

    return { total, activeCount, draftCount, totalEnrolled, avgCompletion };
  }, [programs]);

  return (
    <div className="min-h-full p-4 sm:p-6 lg:p-8 flex flex-col gap-6 font-sans max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Programme Management
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              <Sparkles className="w-3 h-3 text-indigo-600" />
              Training & Placement Prep
            </span>
          </div>
          <p className="text-xs sm:text-sm font-semibold text-slate-500 mt-1">
            Curate structured career training programmes, track student cohort enrolments, and link learning path roadmaps.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition shadow-2xs"
            title="Refresh Data"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-indigo-600" : ""}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs transition"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Create Programme</span>
          </button>
        </div>
      </div>

      {/* KPI Metrics Summary Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Programmes</p>
            <h3 className="text-xl font-black text-slate-900 leading-tight">
              {metrics.total} <span className="text-xs font-bold text-slate-400">Total</span>
            </h3>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active Cohorts</p>
            <h3 className="text-xl font-black text-slate-900 leading-tight">
              {metrics.activeCount} <span className="text-xs font-bold text-emerald-600">Active</span>
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
              {metrics.totalEnrolled} <span className="text-xs font-bold text-slate-400">Students</span>
            </h3>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-orange-50 text-[#F97316] border border-orange-100 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Avg Completion</p>
            <h3 className="text-xl font-black text-slate-900 leading-tight">
              {metrics.avgCompletion}% <span className="text-xs font-bold text-[#F97316]">Avg</span>
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
              placeholder="Search by programme title, domain, or skills..."
              className="w-full rounded-xl bg-slate-50 border border-slate-200 pl-10 pr-9 py-2 text-xs font-medium text-slate-900 placeholder-slate-400 focus:bg-white focus:border-indigo-600 focus:outline-none transition"
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
            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 focus:bg-white focus:border-indigo-600 focus:outline-none transition"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="draft">Draft</option>
            </select>

            {/* Difficulty Filter */}
            <select
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 focus:bg-white focus:border-indigo-600 focus:outline-none transition"
            >
              <option value="all">All Difficulties</option>
              <option value="Foundational">Foundational / Beginner</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Advanced">Advanced</option>
              <option value="All Levels">All Levels</option>
            </select>

            <span className="text-xs font-bold text-slate-500 ml-1">
              Showing <strong className="text-slate-900">{filteredPrograms.length}</strong> of {programs.length}
            </span>
          </div>
        </div>

        {/* Category Pill Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none pt-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Category:
          </span>
          {CATEGORIES.map((cat) => {
            const count =
              cat === "All"
                ? programs.length
                : programs.filter(
                    (p) =>
                      p.category.toLowerCase() === cat.toLowerCase() ||
                      p.domain.toLowerCase() === cat.toLowerCase()
                  ).length;

            const isSelected = selectedCategory === cat;

            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-[#1E2544] text-white shadow-xs"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/60"
                }`}
              >
                <span>{cat}</span>
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

      {/* Programmes Card Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-56 rounded-2xl bg-white border border-slate-200 p-5" />
          ))}
        </div>
      ) : filteredPrograms.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center flex flex-col items-center justify-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400">
            <BookOpen className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900">No Programmes Found</h3>
            <p className="text-xs font-semibold text-slate-500 max-w-sm mt-1">
              {search || selectedCategory !== "All" || selectedStatus !== "all" || selectedDifficulty !== "all"
                ? "No programmes match your current filter and search criteria. Try clearing filters."
                : "No career training programmes currently exist in your platform database."}
            </p>
          </div>
          <div className="flex items-center gap-2 mt-2">
            {search || selectedCategory !== "All" || selectedStatus !== "all" || selectedDifficulty !== "all" ? (
              <button
                onClick={() => {
                  setSearch("");
                  setSelectedCategory("All");
                  setSelectedStatus("all");
                  setSelectedDifficulty("all");
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
              >
                Reset Filters
              </button>
            ) : null}
            <button
              onClick={handleOpenCreate}
              className="px-4 py-2 rounded-xl text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 transition shadow-xs"
            >
              + Create First Programme
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPrograms.map((p) => {
            const theme = CATEGORY_THEMES[p.category] ||
              CATEGORY_THEMES[p.domain] || {
                bg: "bg-slate-100",
                text: "text-slate-700",
                border: "border-slate-200",
              };

            return (
              <div
                key={p.id}
                className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs hover:border-indigo-300 hover:shadow-xs transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Card Header: Badges & Status */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span
                      className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-lg border ${theme.bg} ${theme.text} ${theme.border} truncate max-w-[170px]`}
                    >
                      {p.category}
                    </span>

                    {/* Quick Status Pill / Dropdown */}
                    <select
                      value={p.status}
                      disabled={statusUpdatingId === p.id}
                      onChange={(e) =>
                        handleQuickStatusChange(
                          p.id,
                          e.target.value as "active" | "inactive" | "draft"
                        )
                      }
                      className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border cursor-pointer focus:outline-none transition ${
                        p.status === "active"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : p.status === "draft"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-slate-100 text-slate-600 border-slate-200"
                      }`}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="draft">Draft</option>
                    </select>
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-base font-black text-slate-900 leading-snug hover:text-indigo-600 transition">
                    {p.title}
                  </h3>

                  <p className="text-xs font-semibold text-slate-500 mt-1.5 line-clamp-3 leading-relaxed">
                    {p.description || "Structured training curriculum designed for comprehensive candidate preparation."}
                  </p>

                  {/* Meta Tags: Difficulty & Duration */}
                  <div className="flex flex-wrap items-center gap-2 mt-3.5">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                      {p.difficultyLevel}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-50 text-slate-500 border border-slate-200">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {p.duration}
                    </span>
                    {p.learningPathsCount > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                        <Layers className="w-3 h-3 text-indigo-500" />
                        {p.learningPathsCount} Roadmaps
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* Card Footer: Metrics & Actions */}
                <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-col gap-3">
                  {/* Progress & Students */}
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                    <span className="flex items-center gap-1.5 text-slate-700">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <strong className="text-slate-900 font-extrabold">{p.enrolledCount}</strong> candidates
                    </span>
                    <span className="flex items-center gap-1 font-bold text-slate-500">
                      Avg Rate: <strong className="text-indigo-600 font-extrabold">{p.completionRate}%</strong>
                    </span>
                  </div>

                  {/* Completion Rate Bar */}
                  <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(p.completionRate, 4)}%` }}
                    />
                  </div>

                  {/* Actions Row */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <Link
                      href={`/admin/learning-paths?programId=${p.id}`}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition flex items-center gap-1"
                    >
                      <span>Manage Roadmaps</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenEdit(p)}
                        className="p-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-indigo-600 transition"
                        title="Edit Programme Details"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleInitiateDelete(p)}
                        className="p-1.5 rounded-xl border border-slate-200 text-slate-400 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition"
                        title="Delete Programme"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE & EDIT PROGRAMME MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  {editingProgram ? "Edit Programme Details" : "Create New Programme"}
                </h3>
                <p className="text-xs font-semibold text-slate-500">
                  {editingProgram
                    ? "Modify training track curriculum, difficulty and cohort availability."
                    : "Establish a structured training or placement preparation opportunity."}
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="mx-6 mt-4 p-3 rounded-xl border border-red-200 bg-red-50 text-xs font-bold text-red-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitForm} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Programme Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Distributed Systems & High-Scale Architecture"
                  className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-none transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Category / Domain</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 focus:bg-white focus:border-indigo-600 focus:outline-none transition"
                  >
                    <option value="System Architecture">System Architecture</option>
                    <option value="Backend Engineering">Backend Engineering</option>
                    <option value="AI / ML Engineering">AI / ML Engineering</option>
                    <option value="Frontend Engineering">Frontend Engineering</option>
                    <option value="Cloud & Security">Cloud & Security</option>
                    <option value="Core CS & Algorithms">Core CS & Algorithms</option>
                    <option value="Software Engineering">Software Engineering</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Difficulty Level</label>
                  <select
                    value={formData.difficultyLevel}
                    onChange={(e) => setFormData({ ...formData, difficultyLevel: e.target.value })}
                    className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 focus:bg-white focus:border-indigo-600 focus:outline-none transition"
                  >
                    <option value="Foundational">Foundational / Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                    <option value="All Levels">All Levels</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Estimated Duration</label>
                  <select
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                    className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 focus:bg-white focus:border-indigo-600 focus:outline-none transition"
                  >
                    <option value="4 Weeks">4 Weeks (Intensive)</option>
                    <option value="6 Weeks">6 Weeks (Accelerated)</option>
                    <option value="8 Weeks">8 Weeks (Standard)</option>
                    <option value="12 Weeks">12 Weeks (Comprehensive)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        status: e.target.value as "active" | "inactive" | "draft",
                      })
                    }
                    className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 focus:bg-white focus:border-indigo-600 focus:outline-none transition"
                  >
                    <option value="active">Active (Visible to Students)</option>
                    <option value="draft">Draft (Work in Progress)</option>
                    <option value="inactive">Inactive (Archived)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Programme Description</label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Outline the core placement objectives, technical competencies, and target roles…"
                  className="w-full rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs font-medium text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-none transition"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSaving}
                  className="px-4 py-2 rounded-xl text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs transition disabled:opacity-50"
                >
                  {modalSaving
                    ? "Saving…"
                    : editingProgram
                    ? "Update Programme"
                    : "Create Programme"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE & SAFETY GUARD CONFIRMATION DIALOG */}
      {programToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  {deleteWarning ? "Student Enrolment Guard" : "Delete Programme?"}
                </h3>
                <p className="text-xs font-semibold text-slate-500 mt-0.5">
                  Action for: <strong className="text-slate-900">{programToDelete.title}</strong>
                </p>
              </div>
            </div>

            {deleteWarning ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-900 space-y-2">
                <p className="font-bold">{deleteWarning}</p>
                <p className="text-[11px] text-amber-700">
                  Deactivating this programme will archive it from student catalogs while keeping student progress and completion stats intact.
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-600">
                Are you sure you want to permanently delete this programme? This will remove any associated roadmaps and cannot be undone.
              </p>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setProgramToDelete(null);
                  setDeleteWarning(null);
                }}
                className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
              >
                Cancel
              </button>

              {deleteWarning ? (
                <>
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => handleExecuteDelete("deactivate")}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs transition disabled:opacity-50"
                  >
                    {deleting ? "Deactivating…" : "Deactivate Programme (Safe)"}
                  </button>
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => handleExecuteDelete("permanent")}
                    className="w-full sm:w-auto px-3 py-2 rounded-xl text-[11px] font-bold text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition disabled:opacity-50"
                  >
                    Delete Anyway
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => handleExecuteDelete("permanent")}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-extrabold text-white bg-red-600 hover:bg-red-700 shadow-xs transition disabled:opacity-50"
                >
                  {deleting ? "Deleting…" : "Delete Permanently"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
