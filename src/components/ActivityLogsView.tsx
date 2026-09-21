import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { History, Search, AlertCircle, Clock, CheckCircle2, XCircle, UserPlus, FileText } from 'lucide-react';

export default function ActivityLogsView() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    setDbError(false);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { data, error } = await supabase.from('activity_logs')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        if (error.code === '42P01') { // table does not exist
          setDbError(true);
        } else {
          console.error(error);
        }
      } else {
        setLogs(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action: string) => {
    const lower = action.toLowerCase();
    if (lower.includes('lunas') && !lower.includes('batal')) return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    if (lower.includes('batal') || lower.includes('hapus')) return <XCircle className="w-4 h-4 text-rose-500" />;
    if (lower.includes('siswa')) return <UserPlus className="w-4 h-4 text-indigo-500" />;
    return <FileText className="w-4 h-4 text-slate-500" />;
  };

  const filteredLogs = logs.filter(log => 
    log.action.toLowerCase().includes(searchQuery.toLowerCase()) || 
    log.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (dbError) {
    return (
      <div className="p-6 md:p-10 flex-1 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mb-6 shadow-sm">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Tabel Database Belum Tersedia</h2>
        <p className="text-slate-600 mb-6 max-w-md">
          Fitur Log Aktivitas memerlukan tabel baru di database Supabase Anda. Silakan jalankan perintah SQL berikut di menu SQL Editor Supabase Anda.
        </p>
        <div className="bg-slate-900 rounded-xl p-4 text-left w-full max-w-2xl overflow-x-auto shadow-md">
          <pre className="text-emerald-400 text-sm font-mono whitespace-pre-wrap">
{ `CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can insert their own logs" ON activity_logs;
DROP POLICY IF EXISTS "Users can view their own logs" ON activity_logs;

CREATE POLICY "Users can insert their own logs" ON activity_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own logs" ON activity_logs FOR SELECT USING (auth.uid() = user_id);`}
          </pre>
        </div>
        <button 
          onClick={fetchLogs}
          className="mt-6 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-sm transition-colors"
        >
          Saya Sudah Menjalankan SQL-nya
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 font-sans">
      <div className="p-6 md:px-10 md:py-8 border-b border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <History className="w-6 h-6 text-indigo-600" />
            Log Aktivitas
          </h2>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mt-1">Jejak tindakan Anda di sistem</p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Cari aktivitas..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 md:p-10">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-slate-500 text-sm">Memuat log aktivitas...</div>
            ) : filteredLogs.length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                  <History className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className="text-lg font-bold text-slate-700 mb-1">Belum Ada Aktivitas</h3>
                <p className="text-slate-500 text-sm">Aktivitas Anda akan dicatat dan ditampilkan di sini.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredLogs.map(log => (
                  <div key={log.id} className="p-5 flex items-start gap-4 hover:bg-slate-50 transition-colors">
                    <div className="mt-1 w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center shrink-0 border border-slate-200 shadow-sm">
                      {getActionIcon(log.action)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                        <h4 className="text-sm font-bold text-slate-800">{log.action}</h4>
                        <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-1 shrink-0 bg-slate-100 px-2 py-0.5 rounded-full">
                          <Clock className="w-3 h-3" />
                          {new Date(log.created_at).toLocaleString('id-ID', {
                            day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600">{log.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
