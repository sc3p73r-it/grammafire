import React from "react";
import { History, ArrowLeftRight, CheckSquare, Calendar, Trash2 } from "lucide-react";
import { Revision } from "../types";

interface RevisionHistoryProps {
  revisions: Revision[];
  onSelectRevision: (revision: Revision) => void;
  activeRevisionId: string | null;
}

export default function RevisionHistory({
  revisions,
  onSelectRevision,
  activeRevisionId,
}: RevisionHistoryProps) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-xs space-y-4">
      <div className="flex items-center justify-between border-b border-gray-50 pb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
          <History size={14} className="text-slate-500" />
          Correction History
        </h3>
        <span className="text-[10px] font-semibold text-slate-500 px-1.5 bg-slate-100 rounded-full">
          {revisions.length} saved
        </span>
      </div>

      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
        {revisions.length === 0 ? (
          <div className="text-center py-6 text-gray-400 space-y-1">
            <CheckSquare size={18} className="mx-auto text-gray-300" />
            <p className="text-xs font-medium">No corrections recorded yet.</p>
            <p className="text-[10px] text-gray-400">Run a check to log a historic revision.</p>
          </div>
        ) : (
          revisions.map((rev) => {
            const formattedDate = rev.createdAt?.seconds 
              ? new Date(rev.createdAt.seconds * 1000).toLocaleString()
              : new Date().toLocaleString();
            
            const isSelected = activeRevisionId === rev.id;

            return (
              <button
                key={rev.id}
                onClick={() => onSelectRevision(rev)}
                className={`w-full text-left p-2.5 rounded-lg border text-xs transition-all duration-150 cursor-pointer ${
                  isSelected
                    ? "bg-slate-900 text-white border-slate-950 font-medium"
                    : "bg-gray-50/50 hover:bg-gray-50 text-gray-700 border-gray-200"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-[9px] uppercase tracking-wide opacity-80 flex items-center gap-1">
                    <Calendar size={10} />
                    {formattedDate}
                  </span>
                  <span className={`text-[10px] font-bold px-1 rounded-sm shrink-0 ${
                    isSelected ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-800"
                  }`}>
                    {rev.corrections.length || 0} issues
                  </span>
                </div>
                <p className="line-clamp-2 mt-1 opacity-90 font-sans leading-relaxed text-left text-[11px]">
                  {rev.content}
                </p>
                <div className="mt-1.5 pt-1 border-t border-current/10 flex items-center justify-between text-[10px] opacity-75 font-medium">
                  <span>Restore or compare revision</span>
                  <ArrowLeftRight size={10} />
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
