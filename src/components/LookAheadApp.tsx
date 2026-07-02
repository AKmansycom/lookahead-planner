"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { css } from "@/lib/style";
import { HoverCard } from "@/components/HoverCard";
import * as api from "@/lib/api";
import {
  Activity,
  Constraint,
  ConstraintType,
  TYPE_LABELS,
  TYPE_HUE,
  REASONS,
  statusMeta,
  derivedStatus,
} from "@/lib/types";
import { fmtDay, toDateInput, daysBetween, todayISO, weekOfLabel } from "@/lib/format";
import { isUpcoming, isDelayed, openConstraintsByActivity } from "@/lib/derive";

type Screen = "dashboard" | "activities" | "constraints" | "import";
type ActivityFilter = "all" | "upcoming" | "delayed" | "blocked" | "delivered" | "inprogress";
type ConstraintFilter = "open" | "closed" | "all";

const TRANS = " transition:transform .18s ease, box-shadow .18s ease, border-color .18s ease;";
const GLASS =
  "padding:18px 22px; background:linear-gradient(158deg, rgba(124,140,255,0.13), rgba(255,255,255,0.03)); backdrop-filter:blur(24px) saturate(140%); -webkit-backdrop-filter:blur(24px) saturate(140%); border:1px solid rgba(255,255,255,0.14); box-shadow:0 24px 60px -34px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.14); border-radius:20px;" +
  TRANS;
const DELAYED_GLASS =
  "padding:18px 22px; background:linear-gradient(rgba(255,90,80,0.11),rgba(255,90,80,0.04)); backdrop-filter:blur(24px) saturate(140%); -webkit-backdrop-filter:blur(24px) saturate(140%); border:1px solid rgba(255,107,99,0.3); border-left:5px solid #ff6b63; box-shadow:0 24px 60px -34px rgba(0,0,0,0.85), 0 0 30px -18px rgba(255,107,99,0.6), inset 0 1px 0 rgba(255,255,255,0.05); border-radius:20px;" +
  TRANS;
const CARD_HOVER =
  "transform:translateY(-3px); border-color:rgba(255,255,255,0.24); box-shadow:0 32px 68px -30px rgba(0,0,0,0.95), 0 0 34px -16px rgba(124,140,255,0.4), inset 0 1px 0 rgba(255,255,255,0.16);";
const HERO_HOVER =
  "transform:translateY(-4px); border-color:rgba(124,140,255,0.42); box-shadow:0 40px 84px -30px rgba(0,0,0,0.95), 0 0 48px -14px rgba(124,140,255,0.5), inset 0 1px 0 rgba(255,255,255,0.18);";
const PANEL =
  "padding:22px; background:linear-gradient(158deg, rgba(124,140,255,0.13), rgba(255,255,255,0.03)); backdrop-filter:blur(24px) saturate(140%); -webkit-backdrop-filter:blur(24px) saturate(140%); border:1px solid rgba(255,255,255,0.14); box-shadow:0 24px 60px -34px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.14); border-radius:22px;" +
  TRANS;

const pill = (type: ConstraintType) => {
  const h = TYPE_HUE[type];
  return `background:${h}26; color:${h};`;
};
const tabStyle = (active: boolean) =>
  "display:flex; align-items:center; gap:7px; padding:9px 15px; border:none; border-radius:12px; font-size:13.5px; font-weight:700; cursor:pointer; transition:all .15s ease;" +
  (active
    ? "background:rgba(124,140,255,0.9); color:#0b0f1c; box-shadow:0 4px 14px -4px rgba(124,140,255,0.7);"
    : "background:transparent; color:#eef1fa;");
const countStyle = (active: boolean) =>
  "padding:1px 7px; border-radius:7px; font-size:11px; font-weight:700; " +
  (active ? "background:rgba(11,15,28,0.22); color:#1a2340;" : "background:rgba(255,255,255,0.08); color:#a6afc7;");

export default function LookAheadApp() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [constraints, setConstraints] = useState<Constraint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [screen, setScreen] = useState<Screen>("dashboard");
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
  const [constraintFilter, setConstraintFilter] = useState<ConstraintFilter>("open");
  const [search, setSearch] = useState("");
  const [engineerFilter, setEngineerFilter] = useState("all");

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<{
    activityId: string;
    constraintType: ConstraintType;
    description: string;
    targetRemovalDate: string;
  }>({ activityId: "", constraintType: "DRAWING", description: "", targetRemovalDate: "" });

  const [activeToast, setToastState] = useState<{ msg: string; id: number } | null>(null);
  const toastRef = useRef(0);
  const [imports, setImports] = useState<{
    baseline?: { name: string; count: number };
    progress?: { name: string; count: number };
  }>({});
  const [importing, setImporting] = useState<{ baseline?: boolean; progress?: boolean }>({});

  const toast = useCallback((msg: string) => {
    const id = toastRef.current + 1;
    toastRef.current = id;
    setToastState({ msg, id });
    setTimeout(() => {
      if (toastRef.current === id) setToastState(null);
    }, 2800);
  }, []);

  const loadActivities = useCallback(async () => {
    setActivities(await api.fetchActivities());
  }, []);
  const loadConstraints = useCallback(async () => {
    setConstraints(await api.fetchConstraints());
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await Promise.all([loadActivities(), loadConstraints()]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    })();
  }, [loadActivities, loadConstraints]);

  // --- local optimistic patch ---
  const patchLocal = useCallback((id: string, patch: Partial<Activity>) => {
    setActivities((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }, []);

  // Debounced network commits for the progress slider and engineer text field.
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const debounce = useCallback((key: string, fn: () => void, ms = 450) => {
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(fn, ms);
  }, []);

  const setProgress = useCallback(
    (id: string, v: number) => {
      patchLocal(id, { progressPercent: v, status: derivedStatus(v) });
      debounce(`prog:${id}`, async () => {
        try {
          await api.patchActivity(id, { progressPercent: v });
          toast(`${id} progress set to ${v}%`);
        } catch (e) {
          toast(e instanceof Error ? e.message : "Update failed");
        }
      });
    },
    [patchLocal, debounce, toast]
  );

  const commitEngineer = useCallback(
    async (id: string, v: string) => {
      try {
        await api.patchActivity(id, { responsibleEngineer: v });
        toast(v ? `${id} assigned to ${v}` : `${id} engineer cleared`);
      } catch (e) {
        toast(e instanceof Error ? e.message : "Update failed");
      }
    },
    [toast]
  );

  const setActual = useCallback(
    async (id: string, field: "actualStart" | "actualFinish", v: string) => {
      patchLocal(id, { [field]: v || null } as Partial<Activity>);
      try {
        await api.patchActivity(id, { [field]: v || null });
        const label = field === "actualStart" ? "actual start" : "actual finish";
        toast(`${id} ${label} ${v ? fmtDay(v) : "cleared"}`);
      } catch (e) {
        toast(e instanceof Error ? e.message : "Update failed");
      }
    },
    [patchLocal, toast]
  );

  const setReason = useCallback(
    async (id: string, v: string) => {
      patchLocal(id, { varianceReason: v || null });
      try {
        await api.patchActivity(id, { varianceReason: v || null });
        if (v) toast(`${id} reason logged: ${v}`);
      } catch (e) {
        toast(e instanceof Error ? e.message : "Update failed");
      }
    },
    [patchLocal, toast]
  );

  const closeConstraint = useCallback(
    async (id: number) => {
      try {
        await api.updateConstraintStatus(id, "CLOSED");
        await loadConstraints();
        toast(`C-${String(id).padStart(3, "0")} closed — cleared today`);
      } catch (e) {
        toast(e instanceof Error ? e.message : "Update failed");
      }
    },
    [loadConstraints, toast]
  );

  const submitConstraint = useCallback(async () => {
    if (!form.activityId || !form.description.trim() || !form.targetRemovalDate) return;
    try {
      const created = await api.createConstraint({
        activityId: form.activityId,
        constraintType: form.constraintType,
        description: form.description.trim(),
        targetRemovalDate: form.targetRemovalDate,
      });
      await loadConstraints();
      setShowAdd(false);
      setConstraintFilter("open");
      setScreen("constraints");
      toast(`C-${String(created.id).padStart(3, "0")} constraint logged`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not add constraint");
    }
  }, [form, loadConstraints, toast]);

  const onImport = useCallback(
    async (kind: "baseline" | "progress", file: File | undefined) => {
      if (!file) return;
      setImporting((prev) => ({ ...prev, [kind]: true }));
      try {
        toast(`Importing ${file.name}…`);
        const res = await api.importFile(kind, file);
        await Promise.all([loadActivities(), loadConstraints()]);
        setImports((prev) => ({ ...prev, [kind]: { name: file.name, count: res.count } }));
        toast(`${file.name} imported — ${res.count} activities`);
      } catch (e) {
        toast(e instanceof Error ? e.message : "Import failed");
      } finally {
        setImporting((prev) => ({ ...prev, [kind]: false }));
      }
    },
    [loadActivities, loadConstraints, toast]
  );

  // --------- derived view model ---------
  const vm = useMemo(() => {
    const now = new Date();
    const A = activities;
    const C = constraints;

    const upcoming = A.filter((a) => isUpcoming(a, now));
    const delayed = A.filter((a) => isDelayed(a, now));
    const openC = C.filter((c) => c.status === "OPEN");
    const openByAct = openConstraintsByActivity(C);
    const isBlocked = (a: Activity) => (openByAct[a.id] || []).length > 0;
    const blockedTotal = A.filter(isBlocked).length;
    const upcomingActive = upcoming.filter((a) => a.progressPercent < 100);
    const blockedCount = upcomingActive.filter(isBlocked).length;
    const readyCount = upcomingActive.filter((a) => !isBlocked(a)).length;

    const ppcDen = upcoming.length;
    const ppcNum = upcoming.filter((a) => a.progressPercent >= 100).length;
    const ppc = ppcDen ? Math.round((100 * ppcNum) / ppcDen) : 0;
    const ppcColor = ppc >= 80 ? "#34d399" : ppc >= 50 ? "#8b9dff" : "#f4b04a";

    const nameOf = (id: string) => A.find((x) => x.id === id)?.activityName ?? id;

    return {
      now,
      A,
      C,
      upcoming,
      delayed,
      openC,
      openByAct,
      isBlocked,
      blockedTotal,
      blockedCount,
      readyCount,
      ppcDen,
      ppcNum,
      ppc,
      ppcColor,
      nameOf,
    };
  }, [activities, constraints]);

  const engineers = useMemo(
    () => Array.from(new Set(activities.map((a) => a.responsibleEngineer).filter(Boolean))).sort() as string[],
    [activities]
  );

  if (loading) {
    return (
      <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", color: "#9aa4bf", fontWeight: 600 }}>
        Loading schedule…
      </div>
    );
  }

  const now = vm.now;
  const windowEnd = new Date(now.getTime() + 14 * 86400000).toISOString();

  const navDef: [Screen, string, number][] = [
    ["dashboard", "Dashboard", 0],
    ["activities", "Activities", vm.delayed.length],
    ["constraints", "Constraints", vm.openC.length],
    ["import", "Import", 0],
  ];

  const kpiDef = [
    { label: "TOTAL ACTIVITIES", caption: "in imported schedule", value: vm.A.length, color: "#f2f4fb", onClick: () => go("all") },
    { label: "UPCOMING · 14 DAYS", caption: "due to finish soon", value: vm.upcoming.length, color: "#a3b0ff", onClick: () => go("upcoming") },
    { label: "DELAYED", caption: "behind plan — act now", value: vm.delayed.length, color: "#ff8079", onClick: () => go("delayed") },
    { label: "OPEN CONSTRAINTS", caption: "blocking the team", value: vm.openC.length, color: "#f4b04a", onClick: () => { setScreen("constraints"); setConstraintFilter("open"); } },
  ];

  function go(filter: ActivityFilter) {
    setActivityFilter(filter);
    setScreen("activities");
  }

  // activities list (filtered + sorted)
  const q = search.trim().toLowerCase();
  let list = activities.slice();
  if (activityFilter === "upcoming") list = list.filter((a) => isUpcoming(a, now));
  else if (activityFilter === "delayed") list = list.filter((a) => isDelayed(a, now));
  else if (activityFilter === "blocked") list = list.filter((a) => vm.isBlocked(a));
  else if (activityFilter === "delivered") list = list.filter((a) => isUpcoming(a, now) && a.progressPercent >= 100);
  else if (activityFilter === "inprogress") list = list.filter((a) => isUpcoming(a, now) && a.progressPercent < 100);
  if (engineerFilter === "unassigned") list = list.filter((a) => !a.responsibleEngineer);
  else if (engineerFilter !== "all") list = list.filter((a) => a.responsibleEngineer === engineerFilter);
  if (q)
    list = list.filter((a) =>
      `${a.id} ${a.activityName} ${a.wbsCode ?? ""} ${a.responsibleEngineer ?? ""}`.toLowerCase().includes(q)
    );
  list.sort((a, b) => (a.plannedFinish < b.plannedFinish ? -1 : 1));

  const filterTabDef: [ActivityFilter, string, number][] = [
    ["all", "All", vm.A.length],
    ["upcoming", "Next 14 days", vm.upcoming.length],
    ["delayed", "Delayed", vm.delayed.length],
    ["blocked", "Blocked", vm.blockedTotal],
  ];

  const constraintTabDef: [ConstraintFilter, string, number][] = [
    ["open", "Open", vm.openC.length],
    ["closed", "Closed", vm.C.length - vm.openC.length],
    ["all", "All", vm.C.length],
  ];
  let clist = constraints.slice();
  if (constraintFilter === "open") clist = clist.filter((c) => c.status === "OPEN");
  else if (constraintFilter === "closed") clist = clist.filter((c) => c.status === "CLOSED");

  const cannotSubmit = !(form.activityId && form.description.trim() && form.targetRemovalDate);

  return (
    <div style={css("position:relative; min-height:100vh; background:radial-gradient(1300px 900px at 18% -5%, #141a34, #070a14 58%); overflow:hidden;")}>
      {/* AURORA */}
      <div style={css("position:fixed; inset:0; z-index:0; overflow:hidden; pointer-events:none;")}>
        <div style={css("position:absolute; top:-180px; left:-140px; width:680px; height:680px; border-radius:50%; filter:blur(94px); opacity:0.68; background:radial-gradient(circle, #4a5bff, transparent 70%); animation:drift1 26s ease-in-out infinite alternate;")} />
        <div style={css("position:absolute; top:4%; right:-160px; width:620px; height:620px; border-radius:50%; filter:blur(100px); opacity:0.6; background:radial-gradient(circle, #a63ff0, transparent 70%); animation:drift2 30s ease-in-out infinite alternate;")} />
        <div style={css("position:absolute; bottom:-200px; left:14%; width:600px; height:600px; border-radius:50%; filter:blur(108px); opacity:0.5; background:radial-gradient(circle, #1f9caf, transparent 70%); animation:drift3 34s ease-in-out infinite alternate;")} />
        <div style={css("position:absolute; bottom:6%; right:12%; width:480px; height:480px; border-radius:50%; filter:blur(96px); opacity:0.5; background:radial-gradient(circle, #7c3aed, transparent 70%); animation:drift4 38s ease-in-out infinite alternate;")} />
      </div>
      <div style={css("position:fixed; inset:0; z-index:0; pointer-events:none; background:radial-gradient(1400px 900px at 50% -10%, transparent, rgba(7,10,20,0.55) 70%), linear-gradient(180deg, rgba(7,10,20,0.35), rgba(7,10,20,0.72));")} />

      <div style={css("position:relative; z-index:1; padding:22px clamp(16px,4vw,44px) 70px;")}>
        {/* NAV */}
        <nav style={css("position:sticky; top:14px; z-index:40; display:flex; align-items:center; gap:18px; flex-wrap:wrap; padding:11px 15px; margin-bottom:30px; background:rgba(255,255,255,0.055); backdrop-filter:blur(26px) saturate(150%); -webkit-backdrop-filter:blur(26px) saturate(150%); border:1px solid rgba(255,255,255,0.10); box-shadow:0 20px 50px -26px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.09); border-radius:20px;")}>
          <div style={css("display:flex; align-items:center; gap:12px; padding-right:8px;")}>
            <div style={css("width:46px; height:46px; border-radius:14px; background:linear-gradient(135deg,#6d7cff,#a855f7); box-shadow:0 8px 24px -3px rgba(124,140,255,0.8); display:flex; align-items:center; justify-content:center;")}>
              <div style={css("width:17px; height:17px; border-radius:5px; border:3px solid #fff; transform:rotate(45deg);")} />
            </div>
            <div style={css("line-height:1.05;")}>
              <div style={css("font-family:'Space Grotesk',sans-serif; font-weight:700; font-size:25px; letter-spacing:-0.025em; background:linear-gradient(118deg,#ffffff 20%,#b7c0ff 75%,#d9b3ff); -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; color:transparent;")}>
                LookAhead
              </div>
              <div style={css("font-size:11.5px; color:#8590ad; font-weight:600; letter-spacing:0.02em; margin-top:2px;")}>
                Northgate WTP · Phase 2
              </div>
            </div>
          </div>
          <div style={css("display:flex; gap:5px; flex-wrap:wrap;")}>
            {navDef.map(([key, label, badge]) => {
              const active = screen === key;
              return (
                <button
                  key={key}
                  onClick={() => setScreen(key)}
                  style={css(
                    "display:flex; align-items:center; gap:8px; padding:9px 15px; border:none; border-radius:13px; font-size:14px; font-weight:700; cursor:pointer;" +
                      (active
                        ? "background:rgba(124,140,255,0.18); color:#aeb9ff; box-shadow:inset 0 0 0 1px rgba(124,140,255,0.3);"
                        : "background:transparent; color:#eef1fa;")
                  )}
                >
                  <span>{label}</span>
                  {badge > 0 && (
                    <span
                      style={css(
                        "padding:1px 7px; border-radius:8px; font-size:11px; font-weight:700; " +
                          (key === "constraints"
                            ? "background:rgba(244,176,74,0.2); color:#f4b04a;"
                            : "background:rgba(255,107,99,0.2); color:#ff9089;")
                      )}
                    >
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div style={css("margin-left:auto; display:flex; align-items:center; gap:10px; padding:8px 14px; border-radius:13px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1);")}>
            <div style={css("width:8px; height:8px; border-radius:50%; background:#34d399; box-shadow:0 0 0 4px rgba(52,211,153,0.18), 0 0 10px rgba(52,211,153,0.6);")} />
            <span style={css("font-size:13px; font-weight:600; color:#c3cbe0;")}>{weekOfLabel()}</span>
          </div>
        </nav>

        <main style={css("max-width:1240px; margin:0 auto;")}>
          {error && (
            <div style={css("padding:16px 20px; margin-bottom:18px; border-radius:16px; background:rgba(255,107,99,0.12); border:1px solid rgba(255,107,99,0.35); color:#ff9089; font-weight:600;")}>
              {error}
            </div>
          )}

          {screen === "dashboard" && renderDashboard()}
          {screen === "activities" && renderActivities()}
          {screen === "constraints" && renderConstraints()}
          {screen === "import" && renderImport()}
        </main>
      </div>

      {showAdd && renderModal()}
      {activeToast && (
        <div style={css("position:fixed; left:50%; bottom:28px; transform:translateX(-50%); z-index:90; display:flex; align-items:center; gap:11px; padding:13px 20px; background:rgba(20,24,38,0.92); backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px); border:1px solid rgba(124,140,255,0.4); box-shadow:0 20px 50px -18px rgba(0,0,0,0.9); border-radius:14px; animation:popin .22s ease;")}>
          <span style={css("width:9px; height:9px; border-radius:50%; background:#34d399; box-shadow:0 0 10px rgba(52,211,153,0.8);")} />
          <span style={css("font-size:14px; font-weight:600; color:#eef1fa;")}>{activeToast.msg}</span>
        </div>
      )}
    </div>
  );

  // ============ DASHBOARD ============
  function renderDashboard() {
    const ppcRing = `conic-gradient(${vm.ppcColor} ${vm.ppc * 3.6}deg, rgba(255,255,255,0.09) ${vm.ppc * 3.6}deg)`;
    return (
      <div style={css("animation:fadein .4s ease;")}>
        <div style={css("margin-bottom:26px;")}>
          <div style={css("font-size:12px; font-weight:700; letter-spacing:0.22em; color:#8b93ff; margin-bottom:9px;")}>
            LOOK-AHEAD · 14-DAY WINDOW
          </div>
          <h1 style={css("font-family:'Space Grotesk',sans-serif; font-size:clamp(30px,4.5vw,42px); font-weight:700; margin:0; letter-spacing:-0.025em; color:#f2f4fb; line-height:1;")}>
            This week&apos;s plan
          </h1>
          <p style={css("margin: 12px 0 0; color: #DCDCDC; font-size: 15.5px; font-weight: 500; max-width: 620px;")}>
            What&apos;s due, what&apos;s slipping, and what&apos;s blocking the team — from {fmtDay(todayISO())} through {fmtDay(windowEnd)}.
          </p>
        </div>

        <div style={css("display:grid; grid-template-columns:1.42fr 1fr; gap:20px; align-items:stretch; margin-bottom:20px;")}>
          {/* PPC HERO */}
          <HoverCard
            base={"position:relative; overflow:hidden; padding:34px 38px; background:linear-gradient(158deg, rgba(124,140,255,0.16), rgba(255,255,255,0.035)); backdrop-filter:blur(28px) saturate(150%); -webkit-backdrop-filter:blur(28px) saturate(150%); border:1px solid rgba(255,255,255,0.15); box-shadow:0 30px 70px -32px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.16); border-radius:28px;" + TRANS}
            hover={HERO_HOVER}
          >
            <div style={css(`position:absolute; top:-120px; right:-80px; width:340px; height:340px; border-radius:50%; background:radial-gradient(circle, ${vm.ppcColor}, transparent 70%); opacity:0.16; filter:blur(30px);`)} />
            <div style={css("position:relative; display:flex; align-items:center; gap:38px; flex-wrap:wrap;")}>
              <div style={css(`position:relative; width:210px; height:210px; border-radius:50%; background:${ppcRing}; display:flex; align-items:center; justify-content:center; flex-shrink:0;`)}>
                <div style={css("position:absolute; inset:15px; border-radius:50%; background:radial-gradient(circle at 50% 35%, rgba(255,255,255,0.06), rgba(9,13,24,0.96)); box-shadow:inset 0 2px 14px rgba(0,0,0,0.6);")} />
                <div style={css("position:relative; text-align:center; line-height:1;")}>
                  <div style={css("font-family:'Space Grotesk',sans-serif; font-size:60px; font-weight:700; letter-spacing:-0.03em; color:#ffffff;")}>
                    {vm.ppc}
                    <span style={css("font-size:26px;")}>%</span>
                  </div>
                  <div style={css("font-size:11px; font-weight:700; letter-spacing:0.18em; color:#9aa4bf; margin-top:6px;")}>PPC</div>
                </div>
              </div>
              <div style={css("flex:1; min-width:220px;")}>
                <div style={css(`font-size:12px; font-weight:700; letter-spacing:0.14em; color:${vm.ppcColor}; margin-bottom:8px;`)}>
                  PLAN PERCENT COMPLETE
                </div>
                <h2 style={css("font-family:'Space Grotesk',sans-serif; font-size:24px; font-weight:600; margin:0 0 10px; letter-spacing:-0.01em; color:#f2f4fb;")}>
                  Is the plan being delivered?
                </h2>
                <p style={css("margin:0 0 18px; font-size:14.5px; line-height:1.55; color:#c3cbe0;")}>
                  Of the <b style={css("color:#f2f4fb;")}>{vm.ppcDen}</b> activities due to finish in this window,{" "}
                  <b style={css("color:#f2f4fb;")}>{vm.ppcNum}</b> are complete and <b style={css("color:#f2f4fb;")}>{vm.readyCount}</b> more are constraint-free and ready to run. PPC tracks plan delivery — not overall project progress.
                </p>
                <div style={css("display:flex; gap:9px; flex-wrap:wrap;")}>
                  <button onClick={() => go("delivered")} style={css("display:flex; align-items:center; gap:8px; padding:9px 14px; border-radius:12px; cursor:pointer; background:rgba(52,211,153,0.13); border:1px solid rgba(52,211,153,0.32);")}>
                    <span style={css("width:8px;height:8px;border-radius:50%;background:#34d399; box-shadow:0 0 8px rgba(52,211,153,0.8);")} />
                    <span style={css("font-size:13px;font-weight:700;color:#4ade9f;")}>{vm.ppcNum} delivered</span>
                    <span style={css("font-size:13px;color:#3a7d64;")}>›</span>
                  </button>
                  <button onClick={() => go("inprogress")} style={css("display:flex; align-items:center; gap:8px; padding:9px 14px; border-radius:12px; cursor:pointer; background:rgba(124,140,255,0.13); border:1px solid rgba(124,140,255,0.32);")}>
                    <span style={css("width:8px;height:8px;border-radius:50%;background:#8b9dff; box-shadow:0 0 8px rgba(124,140,255,0.8);")} />
                    <span style={css("font-size:13px;font-weight:700;color:#a3b0ff;")}>{vm.ppcDen - vm.ppcNum} still in progress</span>
                    <span style={css("font-size:13px;color:#5b64a8;")}>›</span>
                  </button>
                  <button onClick={() => go("blocked")} style={css("display:flex; align-items:center; gap:8px; padding:9px 14px; border-radius:12px; cursor:pointer; background:rgba(244,176,74,0.13); border:1px solid rgba(244,176,74,0.32);")}>
                    <span style={css("width:8px;height:8px;border-radius:50%;background:#f4b04a; box-shadow:0 0 8px rgba(244,176,74,0.8);")} />
                    <span style={css("font-size:13px;font-weight:700;color:#f4b04a;")}>{vm.blockedCount} blocked</span>
                    <span style={css("font-size:13px;color:#96702a;")}>›</span>
                  </button>
                </div>
              </div>
            </div>
          </HoverCard>

          {/* KPI RAIL */}
          <HoverCard
            base={"padding:8px 24px; background:linear-gradient(158deg, rgba(124,140,255,0.16), rgba(255,255,255,0.035)); backdrop-filter:blur(26px) saturate(150%); -webkit-backdrop-filter:blur(26px) saturate(150%); border:1px solid rgba(255,255,255,0.15); box-shadow:0 30px 70px -34px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.16); border-radius:28px; display:flex; flex-direction:column;" + TRANS}
            hover={HERO_HOVER}
          >
            {kpiDef.map((k, i) => (
              <button
                key={k.label}
                onClick={k.onClick}
                style={css(
                  "display:flex; align-items:center; justify-content:space-between; gap:16px; padding:20px 4px; cursor:pointer; border:none; background:none; width:100%;" +
                    (i < kpiDef.length - 1 ? "border-bottom:1px solid rgba(255,255,255,0.08);" : "")
                )}
              >
                <div style={css("text-align:left;")}>
                  <div style={css(`font-size:11.5px; font-weight:700; letter-spacing:0.08em; color:${k.color};`)}>{k.label}</div>
                  <div style={css("font-size:12.5px; color:#e8ecf5; font-weight:500; margin-top:3px;")}>{k.caption}</div>
                </div>
                <div style={css(`font-family:'Space Grotesk',sans-serif; font-size:40px; font-weight:700; letter-spacing:-0.03em; color:${k.color}; line-height:1;`)}>
                  {k.value}
                </div>
              </button>
            ))}
          </HoverCard>
        </div>

        {/* NEEDS ATTENTION */}
        <div style={css("font-size:12px; font-weight:700; letter-spacing:0.2em; color:#9aa4bf; margin:6px 2px 14px;")}>NEEDS ATTENTION</div>
        <div style={css("display:grid; grid-template-columns:1.25fr 1fr; gap:20px;")}>
          <HoverCard
            base={"padding:24px 26px; background:linear-gradient(158deg, rgba(255,107,99,0.14), rgba(255,255,255,0.03)); backdrop-filter:blur(26px) saturate(150%); -webkit-backdrop-filter:blur(26px) saturate(150%); border:1px solid rgba(255,107,99,0.28); box-shadow:0 26px 60px -34px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.12); border-radius:26px;" + TRANS}
            hover={"transform:translateY(-4px); border-color:rgba(255,107,99,0.5); box-shadow:0 40px 84px -30px rgba(0,0,0,0.95), 0 0 48px -16px rgba(255,107,99,0.5), inset 0 1px 0 rgba(255,255,255,0.14);"}
          >
            <div style={css("display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;")}>
              <h3 style={css("margin:0; font-family:'Space Grotesk',sans-serif; font-size:18px; font-weight:600; color:#f2f4fb;")}>Falling behind</h3>
              <button onClick={() => go("delayed")} style={css("border:none; background:none; cursor:pointer; font-size:13px; font-weight:700; color:#a3b0ff;")}>View all →</button>
            </div>
            {vm.delayed.length === 0 && <div style={css("font-size:13.5px; color:#9aa4bf; padding:8px 0;")}>Nothing behind plan. 🎉</div>}
            {vm.delayed.map((a) => {
              const startPast0 = a.progressPercent === 0;
              const late = startPast0 ? daysBetween(a.plannedStart, todayISO()) : daysBetween(a.plannedFinish, todayISO());
              return (
                <div key={a.id} style={css("display:flex; align-items:center; gap:15px; padding:13px 0; border-bottom:1px solid rgba(255,255,255,0.07);")}>
                  <div style={css("width:4px; align-self:stretch; border-radius:999px; background:#ff6b63; box-shadow:0 0 10px rgba(255,107,99,0.6);")} />
                  <div style={css("flex:1; min-width:0;")}>
                    <div style={css("font-weight:600; font-size:14.5px; color:#e8ecf5; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;")}>{a.activityName}</div>
                    <div style={css("font-size:12px; color:#ff9089; font-weight:600; margin-top:3px;")}>
                      {startPast0 ? `Not started · ${late}d past planned start` : `Due ${fmtDay(a.plannedFinish)} · ${late}d overdue`}
                    </div>
                  </div>
                  <div style={css("text-align:right;")}>
                    <div style={css("font-family:'Space Grotesk',sans-serif; font-weight:700; font-size:18px; color:#f2f4fb;")}>{a.progressPercent}%</div>
                    <div style={css("width:68px; height:6px; border-radius:999px; background:rgba(255,255,255,0.12); margin-top:5px; overflow:hidden;")}>
                      <div style={css(`height:100%; border-radius:999px; background:#ff6b63; width:${a.progressPercent}%;`)} />
                    </div>
                  </div>
                </div>
              );
            })}
          </HoverCard>

          <HoverCard
            base={"padding:24px 26px; background:linear-gradient(158deg, rgba(244,176,74,0.13), rgba(255,255,255,0.03)); backdrop-filter:blur(26px) saturate(150%); -webkit-backdrop-filter:blur(26px) saturate(150%); border:1px solid rgba(244,176,74,0.28); box-shadow:0 26px 60px -34px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.12); border-radius:26px;" + TRANS}
            hover={"transform:translateY(-4px); border-color:rgba(244,176,74,0.5); box-shadow:0 40px 84px -30px rgba(0,0,0,0.95), 0 0 48px -16px rgba(244,176,74,0.45), inset 0 1px 0 rgba(255,255,255,0.14);"}
          >
            <div style={css("display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;")}>
              <h3 style={css("margin:0; font-family:'Space Grotesk',sans-serif; font-size:18px; font-weight:600; color:#f2f4fb;")}>Open constraints</h3>
              <button onClick={() => { setScreen("constraints"); setConstraintFilter("open"); }} style={css("border:none; background:none; cursor:pointer; font-size:13px; font-weight:700; color:#a3b0ff;")}>Manage →</button>
            </div>
            {vm.openC.length === 0 && <div style={css("font-size:13.5px; color:#9aa4bf; padding:8px 0;")}>No open constraints.</div>}
            {vm.openC.map((c) => (
              <div key={c.id} style={css("display:flex; align-items:flex-start; gap:12px; padding:13px 0; border-bottom:1px solid rgba(255,255,255,0.07);")}>
                <span style={css("flex-shrink:0; margin-top:1px; padding:3px 9px; border-radius:8px; font-size:10.5px; font-weight:700; letter-spacing:0.02em; " + pill(c.constraintType))}>{TYPE_LABELS[c.constraintType]}</span>
                <div style={css("flex:1; min-width:0;")}>
                  <div style={css("font-size:13.5px; font-weight:500; color:#cfd6e8; line-height:1.45;")}>{c.description}</div>
                  <div style={css("font-size:11.5px; color:#9aa4bf; font-weight:600; margin-top:4px;")}>{c.activityId} · target {fmtDay(c.targetRemovalDate)}</div>
                </div>
              </div>
            ))}
          </HoverCard>
        </div>
      </div>
    );
  }

  // ============ ACTIVITIES ============
  function renderActivities() {
    const extraTab =
      activityFilter === "delivered" || activityFilter === "inprogress"
        ? { label: activityFilter === "delivered" ? "Delivered ✕" : "In progress ✕", count: list.length }
        : null;
    const engineerOptions = [
      { value: "all", label: "All engineers" },
      { value: "unassigned", label: "Unassigned" },
      ...engineers.map((e) => ({ value: e, label: e })),
    ];
    return (
      <div style={css("animation:fadein .4s ease;")}>
        <div style={css("margin-bottom:20px;")}>
          <div style={css("font-size:12px; font-weight:700; letter-spacing:0.22em; color:#8b93ff; margin-bottom:9px;")}>SCHEDULE</div>
          <h1 style={css("font-family:'Space Grotesk',sans-serif; font-size:clamp(28px,4vw,38px); font-weight:700; margin:0; letter-spacing:-0.02em; color:#f2f4fb; line-height:1;")}>Activities</h1>
          <p style={css("margin: 11px 0 0; color: #DCDCDC; font-size: 15px; font-weight: 500;")}>Slide to update progress, tap to assign an engineer. Delayed activities glow red.</p>
        </div>

        <div style={css("display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:18px;")}>
          <div style={css("display:flex; gap:4px; padding:5px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:15px;")}>
            {filterTabDef.map(([key, label, count]) => {
              const active = activityFilter === key;
              return (
                <button key={key} onClick={() => setActivityFilter(key)} style={css(tabStyle(active))}>
                  {label}
                  <span style={css(countStyle(active))}>{count}</span>
                </button>
              );
            })}
            {extraTab && (
              <button onClick={() => setActivityFilter("all")} style={css(tabStyle(true))}>
                {extraTab.label}
                <span style={css(countStyle(true))}>{extraTab.count}</span>
              </button>
            )}
          </div>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search activity, ID, WBS or engineer…" style={css("flex:1; min-width:200px; padding:12px 16px; border-radius:14px; border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.05); font-size:14px; color:#e8ecf5; outline:none;")} />
          <select value={engineerFilter} onChange={(e) => setEngineerFilter(e.target.value)} style={css("padding:12px 14px; border-radius:14px; border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.05); font-size:14px; color:#e8ecf5; outline:none; cursor:pointer;")}>
            {engineerOptions.map((e) => (
              <option key={e.value} value={e.value}>{e.label}</option>
            ))}
          </select>
          <div style={css("font-size: 13px; font-weight: 600; color: #B4B4B4; white-space: nowrap;")}>{list.length} shown</div>
        </div>

        <div style={css("display:flex; flex-direction:column; gap:12px;")}>
          {list.map((a) => {
            const delayed = isDelayed(a, now);
            const meta = statusMeta(derivedStatus(a.progressPercent));
            const openCons = vm.openByAct[a.id] || [];
            const blocked = openCons.length > 0;
            const done = a.progressPercent >= 100;
            const startPast0 = a.progressPercent === 0;
            const late = startPast0 ? daysBetween(a.plannedStart, todayISO()) : daysBetween(a.plannedFinish, todayISO());
            return (
              <HoverCard key={a.id} base={delayed ? DELAYED_GLASS : GLASS} hover={CARD_HOVER}>
                <div style={css("display:grid; grid-template-columns:minmax(0,2.1fr) minmax(0,1.15fr) minmax(0,1.9fr) minmax(0,1.3fr); gap:22px; align-items:center;")}>
                  <div style={css("min-width:0;")}>
                    <div style={css("display:flex; align-items:center; gap:9px; margin-bottom:5px; flex-wrap:wrap;")}>
                      <span style={css("font-family:'Space Grotesk',sans-serif; font-size:12px; font-weight:700; color:#a3b0ff; background:rgba(124,140,255,0.14); padding:2px 8px; border-radius:7px;")}>{a.id}</span>
                      <span style={css("padding:2px 9px; border-radius:8px; font-size:11px; font-weight:700; " + meta.style)}>{meta.label}</span>
                      {delayed && <span style={css("padding:2px 9px; border-radius:8px; font-size:11px; font-weight:700; background:rgba(255,107,99,0.18); color:#ff9089;")}>DELAYED</span>}
                      {blocked && <span title={"Blocked by: " + openCons.map((c) => TYPE_LABELS[c.constraintType]).join(", ")} style={css("padding:2px 9px; border-radius:8px; font-size:11px; font-weight:700; background:rgba(244,176,74,0.2); color:#f4b04a;")}>⚠ Blocked · {openCons.length}</span>}
                      {!blocked && !done && <span style={css("padding:2px 9px; border-radius:8px; font-size:11px; font-weight:700; background:rgba(52,211,153,0.16); color:#4ade9f;")}>✓ Ready</span>}
                    </div>
                    <div style={css("font-weight:600; font-size:15px; color:#f2f4fb; line-height:1.3;")}>{a.activityName}</div>
                    <div style={css("font-size:12px; color:#9aa4bf; font-weight:600; margin-top:3px;")}>{a.wbsCode || "—"}</div>
                  </div>
                  <div style={css("min-width:0;")}>
                    <div style={css("font-size:11px; font-weight:700; letter-spacing:0.05em; color:#97a1bc;")}>PLANNED</div>
                    <div style={css("font-size:14px; font-weight:600; color:#dbe1f0; margin-top:3px;")}>{fmtDay(a.plannedStart)} – {fmtDay(a.plannedFinish)}</div>
                    <div style={css("font-size: 12px; color: #ABABAB; font-weight: 600; margin-top: 2px;")}>{a.originalDurationDays} day plan</div>
                    {delayed && <div style={css("font-size:12px; color:#ff9089; font-weight:700; margin-top:4px;")}>{startPast0 ? `${late}d past start` : `${late}d overdue`}</div>}
                  </div>
                  <div style={css("min-width:0;")}>
                    <div style={css("display:flex; align-items:baseline; justify-content:space-between; margin-bottom:9px;")}>
                      <span style={css("font-size: 11px; font-weight: 700; letter-spacing: 0.05em; color: #BDBDBD;")}>PROGRESS</span>
                      <span style={css(`font-family:'Space Grotesk',sans-serif; font-size:23px; font-weight:700; letter-spacing:-0.02em; color:${meta.color};`)}>{a.progressPercent}%</span>
                    </div>
                    <input type="range" min={0} max={100} step={5} value={a.progressPercent} onChange={(e) => setProgress(a.id, parseInt(e.target.value, 10))} style={{ width: "100%" }} />
                  </div>
                  <div style={css("min-width:0;")}>
                    <div style={css("font-size:11px; font-weight:700; letter-spacing:0.05em; color:#97a1bc; margin-bottom:7px;")}>RESPONSIBLE</div>
                    <input
                      defaultValue={a.responsibleEngineer || ""}
                      onBlur={(e) => commitEngineer(a.id, e.target.value)}
                      placeholder="+ Assign engineer"
                      style={css(
                        "width:100%; padding:10px 13px; border-radius:12px; font-size:13.5px; font-weight:600; outline:none; border:1px solid " +
                          (a.responsibleEngineer ? "rgba(124,140,255,0.4)" : "rgba(255,255,255,0.12)") +
                          "; background:" +
                          (a.responsibleEngineer ? "rgba(124,140,255,0.12)" : "rgba(255,255,255,0.05)") +
                          "; color:" +
                          (a.responsibleEngineer ? "#c7cfff" : "#e8ecf5") +
                          ";"
                      )}
                    />
                  </div>
                </div>
                <div style={css("display:flex; align-items:flex-end; gap:18px; flex-wrap:wrap; margin-top:16px; padding-top:16px; border-top:1px solid rgba(255,255,255,0.08);")}>
                  <div style={css("flex:1; min-width:240px;")}>
                    <div style={css("font-size:11px; font-weight:700; letter-spacing:0.05em; color:#9aa4bf; margin-bottom:7px;")}>QUICK SET PROGRESS</div>
                    <div style={css("display:flex; gap:6px;")}>
                      {[0, 25, 50, 75, 100].map((v) => (
                        <button
                          key={v}
                          onClick={() => setProgress(a.id, v)}
                          style={css(
                            "flex:1; min-width:40px; padding:9px 0; border-radius:9px; font-size:12.5px; font-weight:700; cursor:pointer; transition:all .12s ease; border:1px solid " +
                              (a.progressPercent === v ? "rgba(124,140,255,0.65)" : "rgba(255,255,255,0.12)") +
                              "; background:" +
                              (a.progressPercent === v ? "rgba(124,140,255,0.24)" : "rgba(255,255,255,0.04)") +
                              "; color:" +
                              (a.progressPercent === v ? "#c7cfff" : "#c3cbe0") +
                              ";"
                          )}
                        >
                          {v === 100 ? "✓ Done" : String(v)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={css("min-width:0;")}>
                    <div style={css("font-size:11px; font-weight:700; letter-spacing:0.05em; color:#9aa4bf; margin-bottom:7px;")}>ACTUAL START</div>
                    <input type="date" value={toDateInput(a.actualStart)} onChange={(e) => setActual(a.id, "actualStart", e.target.value)} style={css("padding:9px 12px; border-radius:11px; border:1px solid rgba(255,255,255,0.12); background:rgba(255,255,255,0.05); font-size:13px; color:#e8ecf5; outline:none;")} />
                  </div>
                  <div style={css("min-width:0;")}>
                    <div style={css("font-size:11px; font-weight:700; letter-spacing:0.05em; color:#9aa4bf; margin-bottom:7px;")}>ACTUAL FINISH</div>
                    <input type="date" value={toDateInput(a.actualFinish)} onChange={(e) => setActual(a.id, "actualFinish", e.target.value)} style={css("padding:9px 12px; border-radius:11px; border:1px solid rgba(255,255,255,0.12); background:rgba(255,255,255,0.05); font-size:13px; color:#e8ecf5; outline:none;")} />
                  </div>
                  {delayed && (
                    <div style={css("min-width:190px; flex:1;")}>
                      <div style={css("font-size:11px; font-weight:700; letter-spacing:0.05em; color:#ff9089; margin-bottom:7px;")}>WHY IS IT LATE?</div>
                      <select value={a.varianceReason || ""} onChange={(e) => setReason(a.id, e.target.value)} style={css("width:100%; padding:9px 12px; border-radius:11px; border:1px solid rgba(255,107,99,0.38); background:rgba(255,107,99,0.09); font-size:13px; color:#e8ecf5; outline:none; cursor:pointer;")}>
                        <option value="">Select reason…</option>
                        {REASONS.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </HoverCard>
            );
          })}
        </div>
      </div>
    );
  }

  // ============ CONSTRAINTS ============
  function renderConstraints() {
    return (
      <div style={css("animation:fadein .4s ease;")}>
        <div style={css("display:flex; align-items:flex-end; justify-content:space-between; gap:16px; flex-wrap:wrap; margin-bottom:20px;")}>
          <div>
            <div style={css("font-size:12px; font-weight:700; letter-spacing:0.22em; color:#8b93ff; margin-bottom:9px;")}>BLOCKERS</div>
            <h1 style={css("font-family:'Space Grotesk',sans-serif; font-size:clamp(28px,4vw,38px); font-weight:700; margin:0; letter-spacing:-0.02em; color:#f2f4fb; line-height:1;")}>Constraint register</h1>
            <p style={css("margin:11px 0 0; color:#a6afc7; font-size:15px; font-weight:500;")}>Log anything blocking the team, then close it out when cleared.</p>
          </div>
          <button onClick={() => { setForm({ activityId: "", constraintType: "DRAWING", description: "", targetRemovalDate: "" }); setShowAdd(true); }} style={css("display:flex; align-items:center; gap:8px; padding:13px 20px; border:none; border-radius:14px; background:linear-gradient(135deg,#6d7cff,#a855f7); color:#fff; font-size:14px; font-weight:700; cursor:pointer; box-shadow:0 14px 30px -10px rgba(124,140,255,0.7);")}>
            <span style={css("font-size:18px; line-height:0; margin-top:-1px;")}>+</span> Add constraint
          </button>
        </div>

        <div style={css("display:flex; gap:4px; padding:5px; margin-bottom:18px; width:fit-content; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:15px;")}>
          {constraintTabDef.map(([key, label, count]) => {
            const active = constraintFilter === key;
            return (
              <button key={key} onClick={() => setConstraintFilter(key)} style={css(tabStyle(active))}>
                {label}
                <span style={css(countStyle(active))}>{count}</span>
              </button>
            );
          })}
        </div>

        <div style={css("display:flex; flex-direction:column; gap:12px;")}>
          {clist.length === 0 && <div style={css("font-size:14px; color:#9aa4bf; padding:12px 2px;")}>No constraints in this view.</div>}
          {clist.map((c) => {
            const open = c.status === "OPEN";
            const overdue = open && !!c.targetRemovalDate && daysBetween(todayISO(), c.targetRemovalDate) < 0;
            const rowStyle =
              "padding:18px 22px; background:linear-gradient(158deg, rgba(124,140,255,0.13), rgba(255,255,255,0.03)); backdrop-filter:blur(24px) saturate(140%); -webkit-backdrop-filter:blur(24px) saturate(140%); border:1px solid rgba(255,255,255,0.14); box-shadow:0 22px 56px -34px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.14); border-radius:20px;" +
              TRANS +
              (open ? "" : "opacity:0.6;");
            return (
              <HoverCard key={c.id} base={rowStyle} hover={CARD_HOVER}>
                <div style={css("display:flex; align-items:center; gap:18px; flex-wrap:wrap;")}>
                  <span style={css("flex-shrink:0; padding:6px 12px; border-radius:10px; font-size:12px; font-weight:700; letter-spacing:0.02em; " + pill(c.constraintType))}>{TYPE_LABELS[c.constraintType]}</span>
                  <div style={css("flex:1; min-width:200px;")}>
                    <div style={css("font-size:15px; font-weight:600; color:#f2f4fb; line-height:1.4;")}>{c.description}</div>
                    <div style={css("font-size:12.5px; color:#9aa4bf; font-weight:600; margin-top:4px;")}>C-{String(c.id).padStart(3, "0")} · linked to {c.activityId} {vm.nameOf(c.activityId)}</div>
                  </div>
                  <div style={css("text-align:right; min-width:130px;")}>
                    <div style={css("font-size:11px; font-weight:700; letter-spacing:0.05em; color:#97a1bc;")}>{open ? "TARGET REMOVAL" : "CLEARED"}</div>
                    <div style={css(`font-size:14px; font-weight:700; color:${overdue ? "#ff8079" : open ? "#dbe1f0" : "#4ade9f"}; margin-top:3px;`)}>{fmtDay(open ? c.targetRemovalDate : c.actualRemovalDate)}</div>
                    {overdue && <span style={css("display:inline-block; margin-top:6px; padding:2px 8px; border-radius:7px; font-size:10.5px; font-weight:700; background:rgba(255,107,99,0.2); color:#ff9089;")}>{Math.abs(daysBetween(todayISO(), c.targetRemovalDate))}d overdue</span>}
                  </div>
                  {open ? (
                    <button onClick={() => closeConstraint(c.id)} style={css("flex-shrink:0; padding:11px 18px; border:1px solid rgba(52,211,153,0.4); border-radius:12px; background:rgba(52,211,153,0.12); color:#4ade9f; font-size:13.5px; font-weight:700; cursor:pointer; white-space:nowrap;")}>✓ Close out</button>
                  ) : (
                    <span style={css("flex-shrink:0; display:flex; align-items:center; gap:7px; padding:9px 15px; border-radius:12px; background:rgba(52,211,153,0.12); color:#4ade9f; font-size:13px; font-weight:700;")}>
                      <span style={css("width:7px;height:7px;border-radius:50%;background:#34d399;")} />Closed
                    </span>
                  )}
                </div>
              </HoverCard>
            );
          })}
        </div>
      </div>
    );
  }

  // ============ IMPORT ============
  function renderImport() {
    const bDone = !!imports.baseline;
    const pDone = !!imports.progress;
    return (
      <div style={css("animation:fadein .4s ease; max-width:960px;")}>
        <div style={css("margin-bottom:22px;")}>
          <div style={css("font-size:12px; font-weight:700; letter-spacing:0.22em; color:#8b93ff; margin-bottom:9px;")}>DATA SOURCE</div>
          <h1 style={css("font-family:'Space Grotesk',sans-serif; font-size:clamp(28px,4vw,38px); font-weight:700; margin:0; letter-spacing:-0.02em; color:#f2f4fb; line-height:1;")}>Import from Primavera</h1>
          <p style={css("margin:11px 0 0; color:#a6afc7; font-size:15px; font-weight:500;")}>Two-file workflow: load the baseline schedule, then overlay the latest progress update. Activities can only be added via import.</p>
        </div>

        <div style={css("display:grid; grid-template-columns:1fr 1fr; gap:18px; margin-bottom:18px;")}>
          <HoverCard base={PANEL} hover={"transform:translateY(-3px); border-color:rgba(124,140,255,0.4); box-shadow:0 32px 68px -30px rgba(0,0,0,0.95), 0 0 34px -16px rgba(124,140,255,0.4), inset 0 1px 0 rgba(255,255,255,0.16);"}>
            <div style={css("display:flex; align-items:center; gap:12px; margin-bottom:14px;")}>
              <div style={css("width:34px; height:34px; border-radius:11px; background:rgba(124,140,255,0.16); display:flex; align-items:center; justify-content:center; font-family:'Space Grotesk',sans-serif; font-weight:700; color:#a3b0ff;")}>1</div>
              <div>
                <div style={css("font-family:'Space Grotesk',sans-serif; font-weight:600; font-size:16px; color:#f2f4fb;")}>Baseline schedule</div>
                <div style={css("font-size:12.5px; color:#9aa4bf; font-weight:600;")}>Activities, WBS &amp; planned dates</div>
              </div>
            </div>
            {importing.baseline ? (
              <div style={css("display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; padding:32px 16px; border-radius:16px; border:2px dashed rgba(124,140,255,0.35); background:rgba(124,140,255,0.06); text-align:center;")}>
                <div style={css("width:26px; height:26px; border-radius:50%; border:3px solid rgba(124,140,255,0.25); border-top-color:#a3b0ff; animation:spin 0.8s linear infinite;")} />
                <div style={css("font-size:13.5px; font-weight:700; color:#a3b0ff;")}>Importing — this can take up to a minute for large files…</div>
              </div>
            ) : bDone ? (
              <div style={css("padding:16px; border-radius:16px; background:rgba(52,211,153,0.1); border:1px solid rgba(52,211,153,0.28);")}>
                <div style={css("display:flex; align-items:center; gap:8px; font-weight:700; color:#4ade9f; font-size:14px;")}>
                  <span style={css("width:9px;height:9px;border-radius:50%;background:#34d399; box-shadow:0 0 8px rgba(52,211,153,0.7);")} />{imports.baseline!.name}
                </div>
                <div style={css("font-size:13px; color:#83c9a8; font-weight:600; margin-top:6px;")}>{imports.baseline!.count} activities loaded</div>
              </div>
            ) : (
              <label style={css("display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; padding:32px 16px; border-radius:16px; border:2px dashed rgba(124,140,255,0.35); background:rgba(124,140,255,0.06); cursor:pointer; text-align:center;")}>
                <div style={css("font-size:14px; font-weight:700; color:#a3b0ff;")}>Drop .xlsx or browse</div>
                <div style={css("font-size:12px; color:#9aa4bf; font-weight:600;")}>Primavera baseline export</div>
                <input type="file" accept=".xlsx,.xls" onChange={(e) => onImport("baseline", e.target.files?.[0])} style={{ display: "none" }} />
              </label>
            )}
          </HoverCard>

          <HoverCard base={PANEL} hover={"transform:translateY(-3px); border-color:rgba(124,140,255,0.4); box-shadow:0 32px 68px -30px rgba(0,0,0,0.95), 0 0 34px -16px rgba(124,140,255,0.4), inset 0 1px 0 rgba(255,255,255,0.16);"}>
            <div style={css("display:flex; align-items:center; gap:12px; margin-bottom:14px;")}>
              <div style={css("width:34px; height:34px; border-radius:11px; background:rgba(244,176,74,0.16); display:flex; align-items:center; justify-content:center; font-family:'Space Grotesk',sans-serif; font-weight:700; color:#f4b04a;")}>2</div>
              <div>
                <div style={css("font-family:'Space Grotesk',sans-serif; font-weight:600; font-size:16px; color:#f2f4fb;")}>Progress update</div>
                <div style={css("font-size:12.5px; color:#9aa4bf; font-weight:600;")}>Actual dates &amp; % complete</div>
              </div>
            </div>
            {importing.progress ? (
              <div style={css("display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; padding:32px 16px; border-radius:16px; border:2px dashed rgba(244,176,74,0.4); background:rgba(244,176,74,0.07); text-align:center;")}>
                <div style={css("width:26px; height:26px; border-radius:50%; border:3px solid rgba(244,176,74,0.25); border-top-color:#f4b04a; animation:spin 0.8s linear infinite;")} />
                <div style={css("font-size:13.5px; font-weight:700; color:#f4b04a;")}>Importing — this can take up to a minute for large files…</div>
              </div>
            ) : pDone ? (
              <div style={css("padding:16px; border-radius:16px; background:rgba(52,211,153,0.1); border:1px solid rgba(52,211,153,0.28);")}>
                <div style={css("display:flex; align-items:center; gap:8px; font-weight:700; color:#4ade9f; font-size:14px;")}>
                  <span style={css("width:9px;height:9px;border-radius:50%;background:#34d399; box-shadow:0 0 8px rgba(52,211,153,0.7);")} />{imports.progress!.name}
                </div>
                <div style={css("font-size:13px; color:#83c9a8; font-weight:600; margin-top:6px;")}>Actuals &amp; % complete applied to {imports.progress!.count} activities</div>
              </div>
            ) : !bDone ? (
              <div style={css("padding:32px 16px; border-radius:16px; border:2px dashed rgba(255,255,255,0.12); background:rgba(255,255,255,0.03); text-align:center;")}>
                <div style={css("font-size:13.5px; font-weight:700; color:#97a1bc;")}>Load the baseline first</div>
              </div>
            ) : (
              <label style={css("display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; padding:32px 16px; border-radius:16px; border:2px dashed rgba(244,176,74,0.4); background:rgba(244,176,74,0.07); cursor:pointer; text-align:center;")}>
                <div style={css("font-size:14px; font-weight:700; color:#f4b04a;")}>Drop .xlsx or browse</div>
                <div style={css("font-size:12px; color:#9aa4bf; font-weight:600;")}>Latest progress export</div>
                <input type="file" accept=".xlsx,.xls" onChange={(e) => onImport("progress", e.target.files?.[0])} style={{ display: "none" }} />
              </label>
            )}
          </HoverCard>
        </div>

        {bDone && pDone && (
          <div style={css("display:flex; align-items:center; gap:18px; padding:22px 26px; background:rgba(255,255,255,0.05); backdrop-filter:blur(24px) saturate(150%); -webkit-backdrop-filter:blur(24px) saturate(150%); border:1px solid rgba(52,211,153,0.28); box-shadow:0 20px 46px -22px rgba(0,0,0,0.85); border-radius:22px;")}>
            <div style={css("width:46px; height:46px; border-radius:14px; background:rgba(52,211,153,0.16); display:flex; align-items:center; justify-content:center; color:#4ade9f; font-size:22px;")}>✓</div>
            <div style={css("flex:1;")}>
              <div style={css("font-family:'Space Grotesk',sans-serif; font-weight:600; font-size:17px; color:#f2f4fb;")}>Schedule is live</div>
              <div style={css("font-size:13.5px; color:#a6afc7; font-weight:600; margin-top:2px;")}>Dashboard, activities and PPC now reflect the imported data.</div>
            </div>
            <button onClick={() => setScreen("dashboard")} style={css("padding:12px 20px; border:none; border-radius:13px; background:linear-gradient(135deg,#6d7cff,#a855f7); color:#fff; font-weight:700; font-size:14px; cursor:pointer; box-shadow:0 12px 26px -10px rgba(124,140,255,0.7);")}>View dashboard →</button>
          </div>
        )}

        <div style={css("margin-top:18px; padding:16px 20px; border-radius:16px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.09); font-size:13px; color:#a6afc7; font-weight:500; line-height:1.55;")}>
          <b style={css("color:#c3cbe0;")}>Tip —</b> re-importing a progress file updates % complete and actual dates on existing activities; it never creates duplicates. The baseline defines the activity list and planned dates.
        </div>
      </div>
    );
  }

  // ============ ADD CONSTRAINT MODAL ============
  function renderModal() {
    const submitStyle =
      "flex:1; padding:13px; border:none; border-radius:13px; font-size:14px; font-weight:700; " +
      (cannotSubmit
        ? "background:rgba(255,255,255,0.08); color:#5b657e; cursor:not-allowed;"
        : "background:linear-gradient(135deg,#6d7cff,#a855f7); color:#fff; cursor:pointer; box-shadow:0 12px 26px -10px rgba(124,140,255,0.7);");
    return (
      <div onClick={() => setShowAdd(false)} style={css("position:fixed; inset:0; z-index:80; background:rgba(4,6,14,0.6); backdrop-filter:blur(8px); display:flex; align-items:center; justify-content:center; padding:20px; animation:fadein .2s ease;")}>
        <div onClick={(e) => e.stopPropagation()} style={css("width:520px; max-width:100%; max-height:90vh; overflow:auto; padding:28px; background:rgba(20,24,38,0.86); backdrop-filter:blur(32px) saturate(150%); -webkit-backdrop-filter:blur(32px) saturate(150%); border:1px solid rgba(255,255,255,0.12); box-shadow:0 40px 90px -30px rgba(0,0,0,0.95), inset 0 1px 0 rgba(255,255,255,0.1); border-radius:26px; animation:popin .25s cubic-bezier(.2,.8,.2,1);")}>
          <div style={css("display:flex; align-items:center; justify-content:space-between; margin-bottom:22px;")}>
            <h2 style={css("margin:0; font-family:'Space Grotesk',sans-serif; font-size:21px; font-weight:600; color:#f2f4fb;")}>Log a constraint</h2>
            <button onClick={() => setShowAdd(false)} style={css("width:34px; height:34px; border:none; border-radius:11px; background:rgba(255,255,255,0.08); color:#a6afc7; font-size:18px; cursor:pointer;")}>×</button>
          </div>
          <div style={css("display:flex; flex-direction:column; gap:16px;")}>
            <div>
              <label style={css("display:block; font-size:12px; font-weight:700; letter-spacing:0.04em; color:#a6afc7; margin-bottom:8px;")}>LINKED ACTIVITY</label>
              <select value={form.activityId} onChange={(e) => setForm((f) => ({ ...f, activityId: e.target.value }))} style={css("width:100%; padding:12px 14px; border-radius:13px; border:1px solid rgba(255,255,255,0.12); background:rgba(255,255,255,0.06); font-size:14px; color:#e8ecf5; outline:none;")}>
                <option value="">Select activity…</option>
                {activities.map((a) => (
                  <option key={a.id} value={a.id}>{a.id} — {a.activityName}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={css("display:block; font-size:12px; font-weight:700; letter-spacing:0.04em; color:#a6afc7; margin-bottom:8px;")}>CONSTRAINT TYPE</label>
              <div style={css("display:flex; gap:7px; flex-wrap:wrap;")}>
                {(Object.keys(TYPE_LABELS) as ConstraintType[]).map((k) => {
                  const active = form.constraintType === k;
                  const h = TYPE_HUE[k];
                  return (
                    <button key={k} onClick={() => setForm((f) => ({ ...f, constraintType: k }))} style={css("padding:8px 13px; border-radius:11px; font-size:12.5px; font-weight:700; cursor:pointer; border:1px solid " + (active ? h : "rgba(255,255,255,0.14)") + "; background:" + (active ? h + "26" : "rgba(255,255,255,0.04)") + "; color:" + (active ? h : "#a6afc7") + ";")}>
                      {TYPE_LABELS[k]}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label style={css("display:block; font-size:12px; font-weight:700; letter-spacing:0.04em; color:#a6afc7; margin-bottom:8px;")}>DESCRIPTION</label>
              <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="What's blocking the activity?" rows={3} style={css("width:100%; padding:12px 14px; border-radius:13px; border:1px solid rgba(255,255,255,0.12); background:rgba(255,255,255,0.06); font-size:14px; color:#e8ecf5; outline:none; resize:vertical;")} />
            </div>
            <div>
              <label style={css("display:block; font-size:12px; font-weight:700; letter-spacing:0.04em; color:#a6afc7; margin-bottom:8px;")}>TARGET REMOVAL DATE</label>
              <input type="date" value={form.targetRemovalDate} onChange={(e) => setForm((f) => ({ ...f, targetRemovalDate: e.target.value }))} style={css("width:100%; padding:12px 14px; border-radius:13px; border:1px solid rgba(255,255,255,0.12); background:rgba(255,255,255,0.06); font-size:14px; color:#e8ecf5; outline:none;")} />
            </div>
            <div style={css("display:flex; gap:10px; margin-top:4px;")}>
              <button onClick={() => setShowAdd(false)} style={css("flex:1; padding:13px; border:1px solid rgba(255,255,255,0.14); border-radius:13px; background:rgba(255,255,255,0.04); color:#a6afc7; font-size:14px; font-weight:700; cursor:pointer;")}>Cancel</button>
              <button onClick={submitConstraint} disabled={cannotSubmit} style={css(submitStyle)}>Add constraint</button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
