'use client';

import { motion } from 'framer-motion';

export function StatCard({
  icon,
  label,
  total,
  confirmed,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  total: number;
  confirmed: number;
  onClick: () => void;
}) {
  const progress =
    total > 0 ? Math.round((confirmed / total) * 100) : 0;

  const complete = total > 0 && confirmed === total;

  return (
    <motion.button
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="
        group relative text-left
        bg-white/90 backdrop-blur-xl
        rounded-3xl p-6
        border border-white
        shadow-xl hover:shadow-2xl
        transition-all
      "
    >
      {/* ICON */}
      <div
        className={`
          w-12 h-12 rounded-xl flex items-center justify-center
          text-white mb-4
          ${
            complete
              ? 'bg-emerald-500'
              : 'bg-gradient-to-br from-violet-500 to-fuchsia-500'
          }
        `}
      >
        {icon}
      </div>

      {/* TOTAL */}
      <div className="text-4xl font-black text-stone-800 mb-1">
        {total}
      </div>

      {/* LABEL */}
      <div className="text-sm font-bold text-stone-600 mb-4">
        {label}
      </div>

      {/* PROGRESS */}
      <div className="flex justify-between text-xs font-bold mb-2">
        <span className="text-stone-600">
          {confirmed} confirmed
        </span>
        <span className="text-stone-500">{progress}%</span>
      </div>

      <div className="h-2 rounded-full bg-stone-200 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className={`
            h-full
            ${
              complete
                ? 'bg-emerald-500'
                : 'bg-gradient-to-r from-violet-500 to-fuchsia-500'
            }
          `}
        />
      </div>

      {/* HOVER */}
      <div className="absolute top-4 right-4 text-xs font-black text-violet-600 opacity-0 group-hover:opacity-100 transition">
        View →
      </div>
    </motion.button>
  );
}
