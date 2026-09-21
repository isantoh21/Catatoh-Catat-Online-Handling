import React, { useState } from 'react';
import { ShieldCheck, Users, Settings, FileText } from 'lucide-react';
import TeacherList from './teachers/TeacherList';
import AttendanceSettings from './teachers/AttendanceSettings';
import AttendanceReports from './teachers/AttendanceReports';

export default function TeachersView() {
  const [activeTab, setActiveTab] = useState<'list' | 'settings' | 'reports'>('list');

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Manajemen Presensi Guru</h1>
            <p className="text-sm text-slate-500">Kelola data guru, biometrik wajah Kiosk, dan laporan absensi.</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl overflow-x-auto">
          <button
            onClick={() => setActiveTab('list')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === 'list' ? 'bg-white text-indigo-900 shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Data & Wajah Guru</span>
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === 'reports' ? 'bg-white text-indigo-900 shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Laporan Presensi</span>
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === 'settings' ? 'bg-white text-indigo-900 shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Pengaturan</span>
          </button>
        </div>
      </div>

      {activeTab === 'list' && <TeacherList onNavigateToSettings={() => setActiveTab('settings')} />}
      {activeTab === 'reports' && <AttendanceReports />}
      {activeTab === 'settings' && <AttendanceSettings />}
    </div>
  );
}
