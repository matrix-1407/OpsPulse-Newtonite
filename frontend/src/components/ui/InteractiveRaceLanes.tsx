import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, Lock } from 'lucide-react';

interface RaceLane {
  actorId: string;
  actorName: string;
  statusCode: number;
  outcome: 'WINNER' | 'BLOCKED' | 'ERROR';
  latencyMs: number;
  message: string;
}

interface InteractiveRaceLanesProps {
  lanes: RaceLane[];
  isRunning?: boolean;
}

export const InteractiveRaceLanes: React.FC<InteractiveRaceLanesProps> = ({
  lanes,
  isRunning = false,
}) => {
  return (
    <div className="space-y-3">
      {lanes.map((lane, idx) => {
        const isWinner = lane.outcome === 'WINNER';
        // Winner reaches 100%, blockers stop at 82% (at the lock barrier)
        const targetFill = isWinner ? 1 : 0.82;

        return (
          <div key={lane.actorId} className="space-y-1.5">
            {/* Lane Header */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    isWinner
                      ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {lane.actorName.charAt(0)}
                </div>
                <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs">{lane.actorName}</span>
                <span className="text-slate-400 dark:text-slate-500 font-mono text-[10px]">({lane.actorId})</span>
              </div>
              <div className="flex items-center gap-2">
                {isWinner ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                    <CheckCircle2 className="w-3 h-3" />
                    LOCK ACQUIRED
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                    <XCircle className="w-3 h-3" />
                    409 ALREADY_CLAIMED
                  </span>
                )}
                <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 tabular-nums">
                  {lane.latencyMs} ms
                </span>
              </div>
            </div>

            {/* Animated Race Track */}
            <div className="relative h-3 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
              {/* Lock Barrier Line at 82% */}
              {!isWinner && (
                <div
                  className="absolute top-0 bottom-0 w-px bg-slate-400/60 dark:bg-slate-500/80 z-10"
                  style={{ left: '82%' }}
                />
              )}

              {/* Lane Fill */}
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: isRunning ? 0 : targetFill }}
                transition={{
                  type: 'spring',
                  stiffness: isWinner ? 160 : 140,
                  damping: 22,
                  delay: idx * 0.04,
                }}
                style={{ transformOrigin: 'left' }}
                className={`h-full w-full rounded-full ${
                  isWinner
                    ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                    : 'bg-gradient-to-r from-slate-300 to-slate-400 dark:from-slate-600 dark:to-slate-700'
                }`}
              />

              {/* Winner lock icon at end */}
              {isWinner && (
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: isRunning ? 0 : 1, scale: isRunning ? 0 : 1 }}
                  transition={{ delay: idx * 0.04 + 0.3, type: 'spring', stiffness: 300, damping: 20 }}
                  className="absolute right-1 top-1/2 -translate-y-1/2"
                >
                  <Lock className="w-2.5 h-2.5 text-white" />
                </motion.div>
              )}
            </div>
          </div>
        );
      })}

      {/* Lock Barrier Legend */}
      <div className="flex items-center gap-3 pt-1 text-[10px] font-mono text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-1">
          <div className="w-3 h-px bg-slate-400 dark:bg-slate-500" />
          <span>SELECT ... FOR UPDATE barrier (82%)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-2 rounded-sm bg-emerald-400" />
          <span>Winner — exclusive lock</span>
        </div>
      </div>
    </div>
  );
};
