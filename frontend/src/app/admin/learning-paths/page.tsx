"use client";

import { useState, useEffect, useMemo } from "react";
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
  BarChart3,
  Award,
} from "lucide-react";

interface LearningPath {
  id: string;
  title: string;
  description: string;
  domain: string;
  level: string;
  duration: string;
  assignedUsers: number;
  modulesCount: number;
  completedModules: number;
  avgProgress: number;
  status: string;
  modules?: string[];
  createdAt?: string;
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
  const [paths, setPaths] = useState<LearningPath[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedDomain, setSelectedDomain] = useState("All");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Create Modal State
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    domain: "System Architecture",
    level: "Intermediate",
    duration: "6 Weeks",
    description: "",
  });

  async function fetchPaths() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/learning-paths");
      const json = await res.json();
      if (json.success && Array.isArray(json.learningPaths)) {
        setPaths(json.learningPaths);
      }
    } catch (err) {
      console.error("Failed to fetch learning paths:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchPaths();
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    await fetchPaths();
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.title.trim()) return;

    setCreating(true);
    try {
      const res = await fetch("/api/admin/learning-paths", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (res.ok && data.success && data.learningPath) {
        setPaths((prev) => [data.learningPath, ...prev]);
        setShowModal(false);
        setFormData({
          title: "",
          domain: "System Architecture",
          level: "Intermediate",
          duration: "6 Weeks",
          description: "",
        });
      } else {
        alert(data.error || "Failed to create learning path.");
      }
    } catch (err) {
      alert("An error occurred while creating the learning path.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Are you sure you want to delete the pathway "${title}"? This will also remove associated candidate enrollments.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/learning-paths?id=${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPaths((prev) => prev.filter((p) => p.id !== id));
      } else {
        alert(data.error || "Failed to delete pathway.");
      }
    } catch {
      alert("Error deleting pathway.");
    }
  }

  // Filtered list
  const filteredPaths = useMemo(() => {
    return paths.filter((p) => {
      const matchesSearch =
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(search.toLowerCase())) ||
        p.domain.toLowerCase().includes(search.toLowerCase());

      const matchesDomain = selectedDomain === "All" || p.domain === selectedDomain;

      return matchesSearch && matchesDomain;
    });
  }, [paths, search, selectedDomain]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    const totalTracks = paths.length;
    const totalCandidates = paths.reduce((sum, p) => sum + (p.assignedUsers || 0), 0);
    const avgProgress =
      totalTracks > 0
        ? Math.round(paths.reduce((sum, p) => sum + (p.avgProgress || 0), 0) / totalTracks)
        : 0;
    const totalModules = paths.reduce((sum, p) => sum + (p.modulesCount || 0), 0);

    return { totalTracks, totalCandidates, avgProgress, totalModules };
  }, [paths]);

  return (
    <div className="min-h-full p-4 sm:p-6 lg:p-8 flex flex-col gap-6 font-sans max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Learning Paths Management
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#F97316]/10 text-[#F97316] border border-[#F97316]/20">
              <Sparkles className="w-3 h-3" />
              AI Curriculum
            </span>
          </div>
          <p className="text-xs sm:text-sm font-semibold text-slate-500 mt-1">
            Curate, monitor, and tailor technical learning tracks, candidate progression, and syllabus modules.
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
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold text-white bg-gradient-to-r from-[#F97316] to-[#EA580C] hover:opacity-95 shadow-xs transition"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Create Learning Path</span>
          </button>
        </div>
      </div>

      {/* Metrics Summary Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-orange-50 text-[#F97316] border border-orange-100 flex items-center justify-center shrink-0">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active Tracks</p>
            <h3 className="text-xl font-black text-slate-900 leading-tight">
              {metrics.totalTracks} <span className="text-xs font-bold text-slate-400">Programs</span>
            </h3>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Enrolled Candidates</p>
            <h3 className="text-xl font-black text-slate-900 leading-tight">
              {metrics.totalCandidates} <span className="text-xs font-bold text-slate-400">Assigned</span>
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
              {metrics.avgProgress}% <span className="text-xs font-bold text-emerald-600 font-black">↑ Active</span>
            </h3>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Curriculum Modules</p>
            <h3 className="text-xl font-black text-slate-900 leading-tight">
              {metrics.totalModules} <span className="text-xs font-bold text-slate-400">Delivered</span>
            </h3>
          </div>
        </div>
      </div>

      {/* Search & Domain Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-3 sm:p-4 shadow-2xs flex flex-col gap-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-2.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by track title, domain, or skills..."
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

          <div className="text-xs font-bold text-slate-500 self-end md:self-center">
            Showing <span className="text-slate-900 font-extrabold">{filteredPaths.length}</span> of {paths.length} tracks
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
                : paths.filter((p) => p.domain === domain).length;

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

      {/* Pathways List Container */}
      {loading ? (
        <div className="space-y-4 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-36 rounded-2xl bg-white border border-slate-200 p-5" />
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
              {search || selectedDomain !== "All"
                ? "No technical pathways matched your search or filter criteria. Try resetting filters."
                : "No learning pathways currently exist in the database."}
            </p>
          </div>
          <div className="flex items-center gap-2 mt-2">
            {search || selectedDomain !== "All" ? (
              <button
                onClick={() => {
                  setSearch("");
                  setSelectedDomain("All");
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
              >
                Reset Filters
              </button>
            ) : null}
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 rounded-xl text-xs font-extrabold text-white bg-[#F97316] hover:bg-orange-600 transition shadow-xs"
            >
              + Create First Track
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPaths.map((p) => {
            const theme = DOMAIN_THEMES[p.domain] || {
              bg: "bg-slate-100",
              text: "text-slate-700",
              border: "border-slate-200",
            };
            const isExpanded = expandedId === p.id;

            return (
              <div
                key={p.id}
                className="rounded-2xl border border-slate-200 bg-white shadow-2xs transition-all hover:border-slate-300 overflow-hidden"
              >
                <div className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                  {/* Left Column: Track Info */}
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-lg border ${theme.bg} ${theme.text} ${theme.border}`}
                      >
                        {p.domain}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 border border-slate-200">
                        {p.level}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg bg-slate-50 text-slate-500 border border-slate-200">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {p.duration}
                      </span>
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded-lg border ${
                          p.status === "Active"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        }`}
                      >
                        {p.status}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-base font-black text-slate-900 hover:text-indigo-600 transition">
                        {p.title}
                      </h3>
                      <p className="text-xs font-semibold text-slate-500 mt-1 leading-relaxed">
                        {p.description}
                      </p>
                    </div>

                    {/* Stats indicators */}
                    <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-600 pt-1">
                      <span className="flex items-center gap-1.5 text-slate-700">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <strong className="text-slate-900">{p.assignedUsers}</strong> candidates assigned
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="flex items-center gap-1.5 text-slate-700">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        <strong className="text-slate-900">{p.completedModules}</strong> of {p.modulesCount} modules completed
                      </span>
                    </div>
                  </div>

                  {/* Right Column: Progress & Actions */}
                  <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end justify-between gap-4 shrink-0 lg:w-64 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                    {/* Progress Bar */}
                    <div className="w-full">
                      <div className="flex justify-between items-center text-xs font-bold text-slate-600 mb-1.5">
                        <span className="text-slate-500">Cohort Progress</span>
                        <span className="font-extrabold text-[#F97316]">{p.avgProgress}%</span>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden border border-slate-200/60">
                        <div
                          className="h-full bg-gradient-to-r from-orange-400 to-[#F97316] rounded-full transition-all duration-700"
                          style={{ width: `${p.avgProgress}%` }}
                        />
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 w-full justify-between sm:justify-end">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : p.id)}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                          isExpanded
                            ? "bg-slate-100 text-slate-900 border-slate-300"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <span>{isExpanded ? "Hide Syllabus" : "View Curriculum"}</span>
                        {isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <button
                        onClick={() => handleDelete(p.id, p.title)}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition"
                        title="Delete Pathway"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Curriculum Syllabus */}
                {isExpanded && p.modules && p.modules.length > 0 && (
                  <div className="bg-slate-50/80 border-t border-slate-200 px-5 py-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-[#F97316]" />
                        Curriculum Syllabus ({p.modules.length} Tailored Modules)
                      </h4>
                      <span className="text-[11px] font-bold text-slate-400">
                        Adaptive AI-assisted track
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {p.modules.map((mod, idx) => (
                        <div
                          key={idx}
                          className="bg-white rounded-xl border border-slate-200/80 p-2.5 flex items-start gap-2.5 shadow-2xs hover:border-slate-300 transition"
                        >
                          <div className="w-5 h-5 rounded-lg bg-orange-50 text-[#F97316] font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5 border border-orange-100">
                            {idx + 1}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-800 leading-snug">{mod}</p>
                            <p className="text-[10px] font-semibold text-slate-400 mt-0.5">
                              Hands-on practical coding & AI evaluation
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Learning Path Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900">Create New Learning Path</h3>
                <p className="text-xs font-semibold text-slate-500">
                  Define a tailored curriculum track for your candidates.
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Track Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Distributed Systems & High-Scale Architecture"
                  className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:border-[#F97316] focus:outline-none transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Domain</label>
                  <select
                    value={formData.domain}
                    onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
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
                    value={formData.level}
                    onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                    className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 focus:bg-white focus:border-[#F97316] focus:outline-none transition"
                  >
                    <option value="Foundational">Foundational</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                    <option value="All Levels">All Levels</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Estimated Duration</label>
                <select
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                  className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 focus:bg-white focus:border-[#F97316] focus:outline-none transition"
                >
                  <option value="4 Weeks">4 Weeks (Intensive)</option>
                  <option value="6 Weeks">6 Weeks (Standard)</option>
                  <option value="8 Weeks">8 Weeks (Comprehensive)</option>
                  <option value="12 Weeks">12 Weeks (Full Masterclass)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Outline the core competencies, practical interview topics, and learning objectives..."
                  className="w-full rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs font-medium text-slate-900 focus:bg-white focus:border-[#F97316] focus:outline-none transition"
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
                  disabled={creating}
                  className="px-4 py-2 rounded-xl text-xs font-extrabold text-white bg-gradient-to-r from-[#F97316] to-[#EA580C] hover:opacity-95 shadow-xs transition disabled:opacity-50"
                >
                  {creating ? "Creating..." : "Create Pathway"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
