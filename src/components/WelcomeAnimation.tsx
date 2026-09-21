import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Building2, User, ArrowRight, X, Heart, Sun } from 'lucide-react';

interface WelcomeAnimationProps {
  isOpen: boolean;
  onClose: () => void;
  adminName: string;
  schoolName: string;
  duration?: number; // duration in ms, default 4500
}

// Generate fixed confetti particles for predictable, smooth animation
const CONFETTI_ITEMS = [
  { id: 1, x: -140, y: -90, r: -35, color: 'bg-emerald-400', size: 'w-3 h-3 rounded-full', delay: 0.1 },
  { id: 2, x: 130, y: -110, r: 45, color: 'bg-amber-400', size: 'w-3 h-3 rotate-45', delay: 0.15 },
  { id: 3, x: -160, y: 30, r: 25, color: 'bg-indigo-400', size: 'w-2.5 h-4 rounded-sm', delay: 0.2 },
  { id: 4, x: 150, y: 40, r: -40, color: 'bg-rose-400', size: 'w-3 h-3 rounded-full', delay: 0.12 },
  { id: 5, x: -100, y: -140, r: 60, color: 'bg-cyan-400', size: 'w-2 h-3.5 rounded-sm rotate-12', delay: 0.25 },
  { id: 6, x: 110, y: -130, r: -50, color: 'bg-violet-400', size: 'w-3 h-3 rounded-full', delay: 0.18 },
  { id: 7, x: -60, y: -170, r: 15, color: 'bg-amber-300', size: 'w-2.5 h-2.5 rotate-45', delay: 0.22 },
  { id: 8, x: 70, y: -160, r: -30, color: 'bg-emerald-300', size: 'w-3 h-3 rounded-full', delay: 0.28 },
  { id: 9, x: -180, y: -40, r: 70, color: 'bg-pink-400', size: 'w-2 h-4 rounded-sm', delay: 0.14 },
  { id: 10, x: 170, y: -30, r: -65, color: 'bg-sky-400', size: 'w-2.5 h-2.5 rotate-45', delay: 0.2 },
  { id: 11, x: -120, y: 90, r: 40, color: 'bg-emerald-400', size: 'w-3 h-3 rounded-full', delay: 0.26 },
  { id: 12, x: 120, y: 100, r: -45, color: 'bg-amber-400', size: 'w-2 h-3 rounded-sm', delay: 0.24 },
  { id: 13, x: -40, y: -190, r: -20, color: 'bg-indigo-300', size: 'w-2.5 h-2.5 rounded-full', delay: 0.3 },
  { id: 14, x: 50, y: -190, r: 35, color: 'bg-rose-300', size: 'w-3 h-2 rotate-12', delay: 0.32 },
];

export default function WelcomeAnimation({
  isOpen,
  onClose,
  adminName,
  schoolName,
  duration = 4500
}: WelcomeAnimationProps) {
  // Auto-close after duration
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [isOpen, onClose, duration]);

  // Clean formatted names
  const cleanAdmin = adminName && adminName.trim() ? adminName : 'Admin';
  const cleanSchool = schoolName && schoolName.trim() && schoolName !== 'Aplikasi Pencatatan SPP Gratis' && schoolName !== 'CATATOH'
    ? schoolName
    : 'CATATOH Portal Sekolah';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 overflow-hidden font-sans select-none">
          {/* Backdrop Blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-md"
          />

          {/* Floating Confetti Particles around card */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            {CONFETTI_ITEMS.map((c) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, scale: 0, x: 0, y: 0, rotate: 0 }}
                animate={{
                  opacity: [0, 1, 1, 0],
                  scale: [0, 1.2, 1, 0.8],
                  x: c.x,
                  y: c.y,
                  rotate: c.r
                }}
                exit={{ opacity: 0, scale: 0 }}
                transition={{
                  duration: 1.8,
                  delay: c.delay,
                  ease: 'easeOut'
                }}
                className={`absolute shadow-sm ${c.color} ${c.size}`}
              />
            ))}
          </div>

          {/* Welcome Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: -20, transition: { duration: 0.25 } }}
            transition={{
              type: 'spring',
              damping: 24,
              stiffness: 300
            }}
            className="relative w-full max-w-lg bg-gradient-to-b from-white to-slate-50 rounded-3xl shadow-[0_25px_60px_-15px_rgba(79,70,229,0.3)] border border-indigo-100 overflow-hidden text-center p-7 sm:p-9 z-10"
          >
            {/* Top decorative gradient bar */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400" />

            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              title="Tutup"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Glowing Icon Header */}
            <div className="relative mx-auto mb-5 w-20 h-20 flex items-center justify-center">
              <motion.div
                animate={{
                  scale: [1, 1.15, 1],
                  rotate: [0, 5, -5, 0]
                }}
                transition={{
                  repeat: Infinity,
                  duration: 4,
                  ease: 'easeInOut'
                }}
                className="absolute inset-0 bg-gradient-to-tr from-amber-400 via-orange-400 to-yellow-300 rounded-3xl blur-lg opacity-40"
              />
              
              <motion.div
                initial={{ rotate: -15, scale: 0.5 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ type: 'spring', damping: 14, stiffness: 200, delay: 0.1 }}
                className="relative w-20 h-20 bg-gradient-to-tr from-amber-400 to-amber-300 rounded-3xl shadow-lg shadow-amber-500/20 flex items-center justify-center border-2 border-white"
              >
                <motion.div
                  animate={{ rotate: [0, 14, -8, 14, -4, 10, 0] }}
                  transition={{ duration: 2, delay: 0.4, ease: 'easeInOut' }}
                  className="text-4xl"
                >
                  👋
                </motion.div>
              </motion.div>

              {/* Sparkle badge */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.35, type: 'spring' }}
                className="absolute -bottom-1 -right-1 bg-indigo-600 text-white p-1.5 rounded-full shadow-md border-2 border-white"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
              </motion.div>
            </div>

            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 border border-indigo-200/60 rounded-full text-indigo-700 text-xs font-semibold mb-3"
            >
              <Sun className="w-3.5 h-3.5 text-amber-500" />
              <span>Login Berhasil</span>
            </motion.div>

            {/* Greeting Headline */}
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight"
            >
              Selamat Datang Kembali!
            </motion.h2>

            {/* Admin Name & School Name Highlights */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="mt-4 mb-5 p-4 bg-slate-100/70 border border-slate-200/70 rounded-2xl space-y-2"
            >
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-white border border-slate-200 rounded-xl shadow-xs">
                  <User className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold text-slate-800 text-sm sm:text-base">
                    {cleanAdmin}
                  </span>
                </div>

                <div className="inline-flex items-center gap-2 px-3 py-1 bg-white border border-slate-200 rounded-xl shadow-xs">
                  <Building2 className="w-4 h-4 text-indigo-600" />
                  <span className="font-bold text-indigo-900 text-sm sm:text-base truncate max-w-[240px]">
                    {cleanSchool}
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Have a nice day wish */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.45 }}
              className="space-y-1 mb-6"
            >
              <p className="text-base sm:text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center gap-1.5">
                <span>Have a nice day!</span>
                <Heart className="w-4 h-4 text-rose-500 fill-rose-500 inline-block animate-pulse" />
              </p>
              <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto leading-relaxed">
                Semoga harimu menyenangkan, penuh semangat, dan pekerjaanmu berjalan lancar hari ini.
              </p>
            </motion.div>

            {/* Action button */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 }}
              className="flex flex-col gap-3"
            >
              <button
                onClick={onClose}
                className="w-full py-3 px-5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 group cursor-pointer"
              >
                <span>Masuk ke Dashboard</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>

              {/* Countdown Progress Bar */}
              <div className="w-full bg-slate-200/70 h-1.5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: '100%' }}
                  animate={{ width: '0%' }}
                  transition={{ duration: duration / 1000, ease: 'linear' }}
                  className="h-full bg-indigo-500 rounded-full"
                />
              </div>
            </motion.div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
