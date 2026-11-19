"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase";
import {
  LayoutDashboard,
  GraduationCap,
  FileCheck,
  User,
  LogOut,
  Search,
  Sparkles,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Layers,
  Filter,
  Check,
  RotateCcw,
  Compass,
  Award,
  AlertCircle,
  X,
  PlayCircle,
} from "lucide-react";

export interface StudentModule {
  id: string;
  learningPathId: string;
  title: string;
  description: string;
  learningObjectives: string[];
  resourceUrl: string | null;
  estimatedDuration: string;
  displayOrder: number;
  isCompleted: boolean;
  completionDate?: string | null;
}

export interface StudentLearningPath {
  id: string;
  programId: string;
  programTitle: string;
  title: string;
  description: string;
  domain: string;
  difficultyLevel: string;
  duration: string;
  modulesCount: number;
  completedCount: number;
  progress: number;
  modules: StudentModule[];
}

export interface StudentProgramme {
  id: string;
  title: string;
  description: string;
  domain: string;
  category: string;
  difficultyLevel: string;
  duration: string;
  thumbnailUrl: string | null;
  status: string;
  isEnrolled: boolean;
  enrollmentId?: string | null;
  enrollmentStatus?: string | null;
  progress: number;
  totalModulesCount: number;
  completedModulesCount: number;
  learningPathsCount: number;
  learningPaths: StudentLearningPath[];
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

export default function MyLearningPage() {
  const router = useRouter();

  // Navigation / Tabs
  const [activeTab, setActiveTab] = useState<"enrolled" | "browse">("enrolled");

  // Data state
  const [availablePrograms, setAvailablePrograms] = useState<StudentProgramme[]>([]);
  const [enrolledPrograms, setEnrolledPrograms] = useState<StudentProgramme[]>([]);
  const [myLearningPaths, setMyLearningPaths] = useState<StudentLearningPath[]>([]);
  const [completedModules, setCompletedModules] = useState<any[]>([]);
  const [nextPendingModule, setNextPendingModule] = useState<any | null>(null);
  const [stats, setStats] = useState({
    enrolledCount: 0,
    totalPaths: 0,
    totalModules: 0,
    completedModules: 0,
    overallProgress: 0,
  });

  const [loading, setLoading] = useState(true);
  const [enrollingId, setEnrollingId] = useState<string | null>(null);
  const [togglingModuleId, setTogglingModuleId] = useState<string | null>(null);

  // Search & Filters
  const [search, setSearch] = useState("");
  const [selectedDomain, setSelectedDomain] = useState("All");

  // Selected Programme for detailed syllabus view
  const [selectedProgramme, setSelectedProgramme] = useState<StudentProgramme | null>(null);
  // Active expanded path ID inside syllabus viewer
  const [expandedPathId, setExpandedPathId] = useState<string | null>(null);

  // User Profile
  const [profile, setProfile] = useState<{ fullName: string; targetRole: string } | null>(null);

  // Fetch Programmes & Enrollments
  const fetchProgrammesData = useCallback(async () => {
    try {
      const res = await fetch("/api/user/programmes");
      const json = await res.json();
      if (res.status === 401 || !json.success) {
        router.push("/login");
        return;
      }

      setAvailablePrograms(json.availablePrograms || []);
      setEnrolledPrograms(json.enrolledPrograms || []);
      setMyLearningPaths(json.myLearningPaths || []);
      setCompletedModules(json.completedModules || []);
      setNextPendingModule(json.nextPendingModule || null);
      setStats(
        json.stats || {
          enrolledCount: 0,
          totalPaths: 0,
          totalModules: 0,
          completedModules: 0,
          overallProgress: 0,
        }
      );

      // If user had selected a programme, update its reference
      if (selectedProgramme) {
        const updated = (json.availablePrograms || []).find(
          (p: StudentProgramme) => p.id === selectedProgramme.id
        );
        if (updated) setSelectedProgramme(updated);
      }
    } catch (err) {
      console.warn("Failed to fetch student programmes:", err);
    } finally {
      setLoading(false);
    }
  }, [router, selectedProgramme]);

  useEffect(() => {
    fetchProgrammesData();
  }, [fetchProgrammesData]);

  // Fetch Profile
  useEffect(() => {
    fetch("/api/user/me")
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.user) {
          setProfile({
            fullName: json.user.fullName || "Learner",
            targetRole: json.user.targetRole || "Software Engineer",
          });
        }
      })
      .catch((err) => console.warn("Failed to load profile:", err));
  }, []);

  // Handle Programme Enrolment
  async function handleEnrol(progId: string, progTitle: string) {
    setEnrollingId(progId);
    try {
      const res = await fetch("/api/user/programmes/enrol", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programId: progId }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        await fetchProgrammesData();
        // Switch to enrolled tab to show immediate availability
        setActiveTab("enrolled");
      } else {
        alert(data.error || "Failed to enrol in programme.");
      }
    } catch {
      alert("Network error enrolling in programme.");
    } finally {
      setEnrollingId(null);
    }
  }

  // Handle Toggle Module Completion
  async function handleToggleModule(moduleId: string, currentlyCompleted: boolean) {
    setTogglingModuleId(moduleId);
    const newCompleted = !currentlyCompleted;

    // Optimistically update local state for instant responsiveness
    setAvailablePrograms((prev) =>
      prev.map((prog) => ({
        ...prog,
        learningPaths: prog.learningPaths.map((lp) => ({
          ...lp,
          modules: lp.modules.map((m) =>
            m.id === moduleId ? { ...m, isCompleted: newCompleted } : m
          ),
        })),
      }))
    );

    if (selectedProgramme) {
      setSelectedProgramme((prev) =>
        prev
          ? {
              ...prev,
              learningPaths: prev.learningPaths.map((lp) => ({
                ...lp,
                modules: lp.modules.map((m) =>
                  m.id === moduleId ? { ...m, isCompleted: newCompleted } : m
                ),
              })),
            }
          : null
      );
    }

    try {
      const res = await fetch("/api/user/modules/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moduleId,
          completed: newCompleted,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        // Revert on error
        alert(data.error || "Failed to update module progress.");
        await fetchProgrammesData();
      } else {
        await fetchProgrammesData();
      }
    } catch {
      alert("Network error updating module progress.");
      await fetchProgrammesData();
    } finally {
      setTogglingModuleId(null);
    }
  }

  async function handleSignOut() {
    try {
      await fetch("/api/auth/signout", { method: "POST" });
    } catch (e) {
      console.warn("Signout fetch warning:", e);
    }
    const supabase = createSupabaseClient();
    await supabase.auth.signOut();
    router.push("/role-selection");
  }

  const fullName = profile?.fullName || "Learner";
  const initials =
    fullName
      .split(" ")
      .map((n: string) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "LN";

  // Filtered Programmes
  const filteredAvailable = useMemo(() => {
    return availablePrograms.filter((p) => {
      const matchesSearch =
        search === "" ||
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.description.toLowerCase().includes(search.toLowerCase()) ||
        p.domain.toLowerCase().includes(search.toLowerCase());

      const matchesDomain =
        selectedDomain === "All" || p.domain.toLowerCase() === selectedDomain.toLowerCase();

      return matchesSearch && matchesDomain;
    });
  }, [availablePrograms, search, selectedDomain]);

  const filteredEnrolled = useMemo(() => {
    return enrolledPrograms.filter((p) => {
      const matchesSearch =
        search === "" ||
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.description.toLowerCase().includes(search.toLowerCase()) ||
        p.domain.toLowerCase().includes(search.toLowerCase());

      const matchesDomain =
        selectedDomain === "All" || p.domain.toLowerCase() === selectedDomain.toLowerCase();

      return matchesSearch && matchesDomain;
    });
  }, [enrolledPrograms, search, selectedDomain]);

  // Open Programme syllabus modal / view
  function handleOpenProgrammeSyllabus(prog: StudentProgramme) {
    setSelectedProgramme(prog);
    if (prog.learningPaths.length > 0) {
      setExpandedPathId(prog.learningPaths[0].id);
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-900 flex flex-col md:flex-row">
      {/* Left Sidebar */}
      <aside className="w-full md:w-56 bg-white border-r border-slate-200/90 flex flex-col justify-between shrink-0 md:h-screen md:sticky md:top-0 z-20 shadow-xs">
        <div>
          {/* Logo Header */}
          <div className="h-14 px-5 border-b border-slate-100 flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-blue-500/25">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-extrabold text-lg tracking-tight text-slate-900">PrepPilot</span>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            <Link
              href="/dashboard"
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition"
            >
              <LayoutDashboard className="w-4 h-4 text-slate-400" />
              <span>Overview</span>
            </Link>
            <Link
              href="/my-learning"
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-extrabold bg-blue-50 text-blue-700 shadow-xs border border-blue-100"
            >
              <GraduationCap className="w-4 h-4 text-blue-600" />
              <span>My Learning</span>
            </Link>
            <Link
              href="/upload"
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition"
            >
              <FileCheck className="w-4 h-4 text-slate-400" />
              <span>Mock Interview</span>
            </Link>
            <Link
              href="/admin/login"
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition"
            >
              <User className="w-4 h-4 text-slate-400" />
              <span>Admin Console</span>
            </Link>
          </nav>
        </div>

        {/* Account Footer */}
        <div className="p-3 border-t border-slate-100 space-y-0.5">
          <p className="px-3 py-1 text-[9px] font-black tracking-widest uppercase text-slate-400">
            ACCOUNT
          </p>
          <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/60 mb-2">
            <p className="text-xs font-extrabold text-slate-900 truncate">{fullName}</p>
            <p className="text-[10px] font-semibold text-blue-600 truncate">{profile?.targetRole || "Candidate"}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-red-50 hover:text-red-600 transition"
          >
            <LogOut className="w-4 h-4 text-slate-400" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen bg-[#F8FAFC]">
        {/* Top Header */}
        <header className="h-14 bg-white border-b border-slate-200/90 px-6 flex items-center justify-between shrink-0 sticky top-0 z-10 shadow-xs">
          <div className="relative w-72 sm:w-80">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search programmes, learning paths, topics..."
              className="w-full rounded-xl bg-slate-50/80 border border-slate-200 pl-9 pr-3 py-1.5 text-xs text-slate-900 font-medium placeholder-slate-400 focus:bg-white focus:border-blue-600 focus:outline-none transition"
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

          <div className="flex items-center gap-3">
            <Link
              href="/upload"
              className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-3.5 py-1.5 text-xs font-extrabold shadow-sm transition flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-white" />
              <span>+ Start Mock Interview</span>
            </Link>

            <div className="flex items-center gap-2.5 border-l border-slate-200 pl-3">
              <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-extrabold text-[11px] flex items-center justify-center shadow-xs">
                {initials}
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-xs font-extrabold text-slate-900 leading-none">{fullName}</p>
                <p className="text-[10px] font-semibold text-slate-400 mt-0.5">Learner</p>
              </div>
            </div>
          </div>
        </header>

        {/* Viewport Content Area */}
        <main className="flex-1 p-4 sm:p-6 bg-[#F8FAFC] flex flex-col gap-6 min-h-[calc(100vh-56px)] max-w-7xl mx-auto w-full">
          {/* Page Title & Tab Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4 shrink-0">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                  CAREER TRAINING HUB
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live Supabase Sync
                </span>
              </div>
              <h1 className="text-2xl font-black text-slate-900 mt-1">
                Programme & Learning Path Management
              </h1>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                Enrol in structured preparation programmes, complete ordered technical modules, and track your progress.
              </p>
            </div>

            {/* Tab Buttons */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200/80 self-start sm:self-auto">
              <button
                onClick={() => setActiveTab("enrolled")}
                className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 ${
                  activeTab === "enrolled"
                    ? "bg-white text-blue-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <GraduationCap className="w-4 h-4" />
                <span>My Enrolled ({enrolledPrograms.length})</span>
              </button>
              <button
                onClick={() => setActiveTab("browse")}
                className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 ${
                  activeTab === "browse"
                    ? "bg-white text-blue-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Compass className="w-4 h-4" />
                <span>Browse Programmes ({availablePrograms.length})</span>
              </button>
            </div>
          </div>

          {/* KPI Metrics Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 shrink-0">
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
                  Enrolled Programmes
                </p>
                <p className="text-2xl font-black text-slate-900 mt-1">
                  {stats.enrolledCount} <span className="text-xs font-bold text-slate-400">Active</span>
                </p>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center font-bold">
                <BookOpen className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
                  My Learning Paths
                </p>
                <p className="text-2xl font-black text-indigo-600 mt-1">
                  {stats.totalPaths} <span className="text-xs font-bold text-slate-400">Roadmaps</span>
                </p>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center font-bold">
                <Layers className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
                  Completed Modules
                </p>
                <p className="text-2xl font-black text-emerald-600 mt-1">
                  {stats.completedModules} / {stats.totalModules}
                </p>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center font-bold">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
                  Overall Progress
                </p>
                <p className="text-2xl font-black text-[#F97316] mt-1">
                  {stats.overallProgress}%
                </p>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-orange-50 text-[#F97316] border border-orange-100 flex items-center justify-center font-bold">
                <Award className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Continue Learning Banner (if a pending module exists in enrolled paths) */}
          {nextPendingModule && (
            <div className="bg-gradient-to-r from-blue-900 to-indigo-900 rounded-2xl p-5 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 text-blue-200 px-2 py-0.5 rounded-md">
                  CONTINUE LEARNING
                </span>
                <h3 className="text-base font-black text-white mt-1">
                  {nextPendingModule.title}
                </h3>
                <p className="text-xs text-blue-200">
                  From: <strong>{nextPendingModule.programTitle}</strong> · Roadmap:{" "}
                  <strong>{nextPendingModule.pathTitle}</strong> · Duration:{" "}
                  {nextPendingModule.duration}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const targetProg = enrolledPrograms.find(
                      (p) => p.id === nextPendingModule.programId
                    );
                    if (targetProg) {
                      handleOpenProgrammeSyllabus(targetProg);
                      setExpandedPathId(nextPendingModule.pathId);
                    }
                  }}
                  className="bg-white hover:bg-blue-50 text-blue-900 rounded-xl px-4 py-2 text-xs font-black flex items-center gap-1.5 shadow-xs transition"
                >
                  <PlayCircle className="w-4 h-4 text-blue-700" />
                  <span>Open Module →</span>
                </button>
              </div>
            </div>
          )}

          {/* Domain Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Track:
            </span>
            {DOMAINS.map((domain) => {
              const isSelected = selectedDomain === domain;
              return (
                <button
                  key={domain}
                  onClick={() => setSelectedDomain(domain)}
                  className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                    isSelected
                      ? "bg-[#1E2544] text-white shadow-xs"
                      : "bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/80"
                  }`}
                >
                  <span>{domain}</span>
                </button>
              );
            })}
          </div>

          {/* TAB 1: MY ENROLLED PROGRAMMES */}
          {activeTab === "enrolled" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                  Enrolled Preparation Programmes ({filteredEnrolled.length})
                </h2>
                <button
                  onClick={() => setActiveTab("browse")}
                  className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                >
                  <span>+ Browse More Programmes</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
                  <div className="h-44 rounded-2xl bg-white border border-slate-200" />
                  <div className="h-44 rounded-2xl bg-white border border-slate-200" />
                </div>
              ) : filteredEnrolled.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center flex flex-col items-center justify-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      {search || selectedDomain !== "All"
                        ? "No enrolled programmes match your filter"
                        : "You haven't enrolled in any programmes yet"}
                    </h3>
                    <p className="text-xs font-medium text-slate-500 mt-1 max-w-md mx-auto">
                      Explore active preparation programmes published by the faculty. Choose a track
                      to unlock structured learning paths and practical interview modules.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSearch("");
                      setSelectedDomain("All");
                      setActiveTab("browse");
                    }}
                    className="mt-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black transition shadow-xs flex items-center gap-1.5"
                  >
                    <Compass className="w-4 h-4" />
                    <span>Explore Available Programmes</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredEnrolled.map((prog) => {
                    const theme = DOMAIN_THEMES[prog.domain] || {
                      bg: "bg-slate-100",
                      text: "text-slate-700",
                      border: "border-slate-200",
                    };

                    return (
                      <div
                        key={prog.id}
                        className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs hover:border-blue-300 transition flex flex-col justify-between"
                      >
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span
                              className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border ${theme.bg} ${theme.text} ${theme.border}`}
                            >
                              {prog.domain}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Enrolled
                            </span>
                          </div>

                          <div>
                            <h3 className="text-base font-black text-slate-900 hover:text-blue-600 cursor-pointer transition"
                              onClick={() => handleOpenProgrammeSyllabus(prog)}
                            >
                              {prog.title}
                            </h3>
                            <p className="text-xs font-medium text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                              {prog.description || "Comprehensive career preparation programme."}
                            </p>
                          </div>

                          {/* Progress bar */}
                          <div className="space-y-1.5 pt-1">
                            <div className="flex items-center justify-between text-xs font-bold">
                              <span className="text-slate-500">Programme Progress</span>
                              <span className="text-blue-700 font-extrabold">{prog.progress}%</span>
                            </div>
                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200/60">
                              <div
                                style={{ width: `${Math.max(prog.progress, 5)}%` }}
                                className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full transition-all duration-500"
                              />
                            </div>
                            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
                              <span>
                                {prog.completedModulesCount} of {prog.totalModulesCount} module(s) completed
                              </span>
                              <span>{prog.learningPathsCount} learning path(s)</span>
                            </div>
                          </div>
                        </div>

                        {/* Card Footer */}
                        <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-100">
                          <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {prog.duration} · {prog.difficultyLevel}
                          </span>

                          <button
                            onClick={() => handleOpenProgrammeSyllabus(prog)}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-black px-4 py-2 rounded-xl flex items-center gap-1.5 transition shadow-xs"
                          >
                            <span>Open Syllabus</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: BROWSE ALL PROGRAMMES */}
          {activeTab === "browse" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                  Published Programmes ({filteredAvailable.length})
                </h2>
                <span className="text-xs font-semibold text-slate-400">
                  Only active published programmes accept new enrolments
                </span>
              </div>

              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
                  <div className="h-56 rounded-2xl bg-white border border-slate-200" />
                  <div className="h-56 rounded-2xl bg-white border border-slate-200" />
                </div>
              ) : filteredAvailable.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center">
                  <p className="text-xs font-semibold text-slate-400">
                    No active programmes match your search criteria.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {filteredAvailable.map((prog) => {
                    const theme = DOMAIN_THEMES[prog.domain] || {
                      bg: "bg-slate-100",
                      text: "text-slate-700",
                      border: "border-slate-200",
                    };
                    const isEnrolling = enrollingId === prog.id;

                    return (
                      <div
                        key={prog.id}
                        className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs hover:border-slate-300 transition flex flex-col justify-between"
                      >
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span
                              className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border ${theme.bg} ${theme.text} ${theme.border}`}
                            >
                              {prog.domain}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 border border-slate-200">
                                {prog.difficultyLevel}
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-slate-50 text-slate-500 border border-slate-200 flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-400" />
                                {prog.duration}
                              </span>
                            </div>
                          </div>

                          <div>
                            <h3 className="text-base font-black text-slate-900 leading-snug">
                              {prog.title}
                            </h3>
                            <p className="text-xs font-medium text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                              {prog.description || "Structured interview and career roadmap."}
                            </p>
                          </div>

                          {/* Available Learning Paths List */}
                          <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/70 space-y-2">
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                              <Layers className="w-3 h-3 text-blue-600" />
                              Available Learning Paths ({prog.learningPaths.length})
                            </p>
                            {prog.learningPaths.length === 0 ? (
                              <p className="text-[11px] font-semibold text-slate-400">
                                Curriculum roadmap is being curated.
                              </p>
                            ) : (
                              <div className="space-y-1.5">
                                {prog.learningPaths.map((lp) => (
                                  <div
                                    key={lp.id}
                                    className="flex items-center justify-between text-xs font-semibold text-slate-700 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200/50"
                                  >
                                    <span className="truncate pr-2 font-bold">{lp.title}</span>
                                    <span className="text-[10px] font-bold text-slate-400 shrink-0">
                                      {lp.modulesCount} module(s)
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Footer & Enrolment Action */}
                        <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-100">
                          <span className="text-[11px] font-bold text-slate-500">
                            {prog.totalModulesCount} Total Module(s)
                          </span>

                          {prog.isEnrolled ? (
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 rounded-xl">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                Enrolled
                              </span>
                              <button
                                onClick={() => handleOpenProgrammeSyllabus(prog)}
                                className="bg-slate-900 hover:bg-blue-600 text-white text-xs font-black px-3.5 py-1.5 rounded-xl transition flex items-center gap-1 shadow-xs"
                              >
                                <span>Open</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              disabled={isEnrolling}
                              onClick={() => handleEnrol(prog.id, prog.title)}
                              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-black px-4 py-2 rounded-xl transition shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                            >
                              {isEnrolling ? (
                                <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Sparkles className="w-3.5 h-3.5 text-white" />
                              )}
                              <span>{isEnrolling ? "Enrolling…" : "Enrol Now"}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* SYLLABUS & MODULES VIEWER MODAL */}
          {selectedProgramme && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
              <div className="w-full max-w-3xl bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 space-y-4 max-h-[92vh] overflow-y-auto font-sans flex flex-col">
                {/* Header */}
                <div className="flex items-start justify-between border-b border-slate-100 pb-4 shrink-0">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
                        {selectedProgramme.domain}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600">
                        {selectedProgramme.difficultyLevel}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-slate-50 text-slate-500">
                        {selectedProgramme.duration}
                      </span>
                      {selectedProgramme.isEnrolled ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Enrolled · {selectedProgramme.progress}% Completed
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-400">
                          Previewing Curriculum
                        </span>
                      )}
                    </div>

                    <h2 className="text-xl font-black text-slate-900 mt-1">
                      {selectedProgramme.title}
                    </h2>
                    <p className="text-xs font-semibold text-slate-500 leading-relaxed">
                      {selectedProgramme.description || "Curated technical curriculum and mock assessments."}
                    </p>
                  </div>

                  <button
                    onClick={() => setSelectedProgramme(null)}
                    className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Enrolment prompt if not enrolled */}
                {!selectedProgramme.isEnrolled && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                    <div>
                      <p className="text-xs font-black text-amber-900">
                        Enrol to track your learning progress
                      </p>
                      <p className="text-[11px] font-semibold text-amber-700 mt-0.5">
                        Enrolling gives you full access to module tracking, progress stats, and direct resume-learning.
                      </p>
                    </div>
                    <button
                      onClick={() => handleEnrol(selectedProgramme.id, selectedProgramme.title)}
                      disabled={enrollingId === selectedProgramme.id}
                      className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl px-4 py-2 text-xs font-black transition shadow-xs self-start sm:self-auto shrink-0"
                    >
                      {enrollingId === selectedProgramme.id ? "Enrolling…" : "Enrol in Programme"}
                    </button>
                  </div>
                )}

                {/* Learning Paths List */}
                <div className="space-y-4 flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                      Curriculum Learning Paths ({selectedProgramme.learningPaths.length})
                    </h3>
                    <span className="text-[11px] font-semibold text-slate-400">
                      Sequential module progression
                    </span>
                  </div>

                  {selectedProgramme.learningPaths.length === 0 ? (
                    <div className="text-center py-8 text-xs font-semibold text-slate-400">
                      No learning paths added for this programme yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedProgramme.learningPaths.map((lp, lpIdx) => {
                        const isExpanded = expandedPathId === lp.id;
                        return (
                          <div
                            key={lp.id}
                            className="bg-slate-50/70 border border-slate-200/90 rounded-2xl overflow-hidden transition"
                          >
                            {/* Path Header */}
                            <div
                              onClick={() => setExpandedPathId(isExpanded ? null : lp.id)}
                              className="p-4 cursor-pointer hover:bg-slate-100/70 transition flex items-center justify-between gap-3"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 font-black text-xs flex items-center justify-center shrink-0">
                                  {lpIdx + 1}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h4 className="text-sm font-black text-slate-900 truncate">
                                      {lp.title}
                                    </h4>
                                    <span className="text-[10px] font-bold px-2 py-0.2 rounded bg-white text-slate-600 border border-slate-200">
                                      {lp.difficultyLevel}
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-400">
                                      {lp.duration}
                                    </span>
                                  </div>
                                  <p className="text-xs font-medium text-slate-500 truncate mt-0.5">
                                    {lp.description || "Ordered technical milestones and evaluation."}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-3 shrink-0">
                                {selectedProgramme.isEnrolled && (
                                  <div className="text-right hidden sm:block">
                                    <span className="text-xs font-black text-blue-700">{lp.progress}%</span>
                                    <p className="text-[10px] font-bold text-slate-400">
                                      {lp.completedCount} / {lp.modulesCount} done
                                    </p>
                                  </div>
                                )}
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-slate-500" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-slate-500" />
                                )}
                              </div>
                            </div>

                            {/* Modules Checklist */}
                            {isExpanded && (
                              <div className="border-t border-slate-200/80 bg-white p-4 space-y-3">
                                <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                                  <span>Step-by-Step Curriculum Modules</span>
                                  <span>{lp.modules.length} Modules Total</span>
                                </div>

                                {lp.modules.length === 0 ? (
                                  <p className="text-xs text-slate-400 py-3 text-center">
                                    No modules published in this roadmap yet.
                                  </p>
                                ) : (
                                  <div className="space-y-2.5">
                                    {lp.modules.map((mod, modIdx) => {
                                      const isToggling = togglingModuleId === mod.id;
                                      return (
                                        <div
                                          key={mod.id}
                                          className={`rounded-2xl p-4 border transition flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                                            mod.isCompleted
                                              ? "bg-emerald-50/50 border-emerald-200/80"
                                              : "bg-slate-50/60 border-slate-200/80 hover:border-slate-300"
                                          }`}
                                        >
                                          <div className="flex items-start gap-3 flex-1 min-w-0">
                                            <div
                                              className={`w-6 h-6 rounded-lg font-black text-xs flex items-center justify-center shrink-0 mt-0.5 ${
                                                mod.isCompleted
                                                  ? "bg-emerald-600 text-white"
                                                  : "bg-slate-200 text-slate-700"
                                              }`}
                                            >
                                              {mod.isCompleted ? (
                                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                                              ) : (
                                                mod.displayOrder || modIdx + 1
                                              )}
                                            </div>

                                            <div className="min-w-0 flex-1">
                                              <div className="flex flex-wrap items-center gap-2">
                                                <h5
                                                  className={`text-xs font-black ${
                                                    mod.isCompleted
                                                      ? "text-emerald-900 line-through decoration-emerald-500/60"
                                                      : "text-slate-900"
                                                  }`}
                                                >
                                                  {mod.title}
                                                </h5>
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.2 rounded-md bg-white border border-slate-200/80 text-slate-500">
                                                  <Clock className="w-2.5 h-2.5" />
                                                  {mod.estimatedDuration}
                                                </span>
                                                {mod.resourceUrl ? (
                                                  <a
                                                    href={mod.resourceUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:underline bg-blue-50 border border-blue-200 px-2 py-0.2 rounded-md"
                                                  >
                                                    <span>Documentation / Guide</span>
                                                    <ExternalLink className="w-2.5 h-2.5" />
                                                  </a>
                                                ) : null}
                                              </div>

                                              <p className="text-xs font-medium text-slate-600 mt-1 leading-relaxed">
                                                {mod.description || "Practical technical preparation milestone."}
                                              </p>

                                              {mod.learningObjectives &&
                                              mod.learningObjectives.length > 0 ? (
                                                <div className="flex flex-wrap gap-1 mt-2">
                                                  {mod.learningObjectives.map((obj, oIdx) => (
                                                    <span
                                                      key={oIdx}
                                                      className="text-[10px] font-semibold text-slate-600 bg-white border border-slate-200/80 px-2 py-0.5 rounded-md"
                                                    >
                                                      ✓ {obj}
                                                    </span>
                                                  ))}
                                                </div>
                                              ) : null}
                                            </div>
                                          </div>

                                          {/* Mark as Complete Action */}
                                          {selectedProgramme.isEnrolled && (
                                            <div className="shrink-0 self-end md:self-center">
                                              <button
                                                disabled={isToggling}
                                                onClick={() =>
                                                  handleToggleModule(mod.id, mod.isCompleted)
                                                }
                                                className={`px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-2xs ${
                                                  mod.isCompleted
                                                    ? "bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300"
                                                    : "bg-white hover:bg-slate-100 text-slate-700 border border-slate-200"
                                                }`}
                                              >
                                                {isToggling ? (
                                                  <RotateCcw className="w-3 h-3 animate-spin" />
                                                ) : mod.isCompleted ? (
                                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                                                ) : (
                                                  <span className="w-3 h-3 rounded-full border border-slate-400" />
                                                )}
                                                <span>
                                                  {mod.isCompleted ? "Completed" : "Mark Complete"}
                                                </span>
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end pt-3 border-t border-slate-100">
                  <button
                    onClick={() => setSelectedProgramme(null)}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
                  >
                    Close Curriculum
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
