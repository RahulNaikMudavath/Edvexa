import React from "react";

export default function MetricCard({ title, value, subtitle, icon: Icon, color = "indigo", badge }) {
  const colorMap = {
    indigo: {
      bg: "from-indigo-500/10 to-indigo-500/5",
      border: "border-indigo-500/20",
      text: "text-indigo-400",
      iconBg: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
    },
    emerald: {
      bg: "from-emerald-500/10 to-emerald-500/5",
      border: "border-emerald-500/20",
      text: "text-emerald-400",
      iconBg: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    },
    amber: {
      bg: "from-amber-500/10 to-amber-500/5",
      border: "border-amber-500/20",
      text: "text-amber-400",
      iconBg: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    },
    rose: {
      bg: "from-rose-500/10 to-rose-500/5",
      border: "border-rose-500/20",
      text: "text-rose-400",
      iconBg: "bg-rose-500/15 text-rose-400 border-rose-500/30",
    },
    cyan: {
      bg: "from-cyan-500/10 to-cyan-500/5",
      border: "border-cyan-500/20",
      text: "text-cyan-400",
      iconBg: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
    },
  };

  const scheme = colorMap[color] || colorMap.indigo;

  return (
    <div className={`p-5 rounded-2xl bg-gradient-to-br ${scheme.bg} border ${scheme.border} glass-panel relative overflow-hidden group`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</p>
          <h3 className="text-2xl font-bold text-white mt-1 tracking-tight">{value}</h3>
          {subtitle && (
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">{subtitle}</p>
          )}
        </div>
        <div className={`p-2.5 rounded-xl border ${scheme.iconBg}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      {badge && (
        <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">{badge.label}</span>
          <span className={`text-[11px] font-semibold ${badge.color || "text-slate-300"}`}>{badge.value}</span>
        </div>
      )}
    </div>
  );
}
