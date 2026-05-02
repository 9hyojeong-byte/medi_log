/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  PlusCircle, 
  History, 
  Save, 
  Trash2, 
  Edit2, 
  Download, 
  Calendar, 
  CheckCircle2, 
  XCircle,
  Clock,
  ChevronLeft,
  X
} from 'lucide-react';
import { MedicationRecord } from './types.ts';

export default function App() {
  const [records, setRecords] = useState<MedicationRecord[]>(() => {
    const saved = localStorage.getItem('medication_records');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeTab, setActiveTab] = useState<'record' | 'history'>('record');
  
  // Form State
  const [isMedicated, setIsMedicated] = useState(false);
  const [memo, setMemo] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Sync with Local Storage
  useEffect(() => {
    localStorage.setItem('medication_records', JSON.stringify(records));
  }, [records]);

  const handleSave = () => {
    if (editingId) {
      setRecords(prev => prev.map(rec => 
        rec.id === editingId 
          ? { ...rec, isMedicated, memo, timestamp: rec.timestamp } // Keep original time for edit, or update? User might want edited time. Let's keep original for now but add an edited flag if needed.
          : rec
      ));
      setEditingId(null);
    } else {
      const newRecord: MedicationRecord = {
        id: crypto.randomUUID(),
        isMedicated,
        memo: memo.trim(),
        timestamp: new Date().toISOString(),
      };
      setRecords(prev => [newRecord, ...prev]);
    }
    
    // Reset form
    setMemo('');
    setIsMedicated(false);
    setActiveTab('history');
  };

  const handleEdit = (record: MedicationRecord) => {
    setEditingId(record.id);
    setIsMedicated(record.isMedicated);
    setMemo(record.memo);
    setActiveTab('record');
  };

  const handleDelete = (id: string) => {
    if (confirm('정말로 이 기록을 삭제할까요?')) {
      setRecords(prev => prev.filter(rec => rec.id !== id));
    }
  };

  const handleDownload = () => {
    const dataStr = JSON.stringify(records, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `medication_records_${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const sortedRecords = useMemo(() => {
    return [...records].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [records]);

  const formatDate = (isoStr: string) => {
    const date = new Date(isoStr);
    return {
      date: date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }),
      time: date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    };
  };

  return (
    <div id="app-container" className="min-h-screen bg-slate-50 flex flex-col items-center p-4 sm:p-8">
      <header className="w-full max-w-md flex flex-col gap-6 mb-8">
        <div className="flex items-center justify-between">
          <h1 id="app-title" className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <PlusCircle className="text-emerald-500 w-8 h-8" />
            MediTracker
          </h1>
          <button 
            id="download-btn"
            onClick={handleDownload}
            className="p-2 hover:bg-white rounded-full transition-colors text-slate-500 hover:text-emerald-600 shadow-sm border border-slate-100"
            title="데이터 다운로드"
          >
            <Download size={20} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div id="nav-tabs" className="bg-slate-200/50 p-1 rounded-xl flex gap-1">
          <button
            id="tab-record"
            onClick={() => {
              setActiveTab('record');
              if (!editingId) {
                setMemo('');
                setIsMedicated(false);
              }
            }}
            className={`flex-1 py-3 px-4 rounded-lg flex items-center justify-center gap-2 font-medium transition-all ${
              activeTab === 'record' 
                ? 'bg-white text-emerald-600 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <PlusCircle size={18} />
            기록하기
          </button>
          <button
            id="tab-history"
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-3 px-4 rounded-lg flex items-center justify-center gap-2 font-medium transition-all ${
              activeTab === 'history' 
                ? 'bg-white text-emerald-600 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <History size={18} />
            목록보기
          </button>
        </div>
      </header>

      <main className="w-full max-w-md relative">
        <AnimatePresence mode="wait">
          {activeTab === 'record' ? (
            <motion.div
              key="record-view"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-3xl p-6 shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col gap-6"
            >
              <div className="flex items-center justify-between border-b border-slate-50 pb-4">
                <h2 id="record-title" className="text-xl font-semibold text-slate-800">
                  {editingId ? '기록 수정하기' : '오늘의 상태 기록'}
                </h2>
                {editingId && (
                  <button 
                    id="cancel-edit"
                    onClick={() => {
                      setEditingId(null);
                      setMemo('');
                      setIsMedicated(false);
                      setActiveTab('history');
                    }}
                    className="p-1 hover:bg-slate-100 rounded-full text-slate-400"
                  >
                    <X size={20} />
                  </button>
                )}
              </div>

              {/* Medication Toggle */}
              <div id="medication-toggle" className="flex flex-col gap-3">
                <label className="text-sm font-semibold text-slate-500 uppercase tracking-wider">오늘 약을 드셨나요?</label>
                <div className="flex gap-4">
                  <button
                    id="btn-medicated-yes"
                    onClick={() => setIsMedicated(true)}
                    className={`flex-1 py-4 px-4 rounded-2xl flex flex-col items-center gap-2 border-2 transition-all ${
                      isMedicated 
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700' 
                        : 'border-slate-100 hover:border-slate-200 text-slate-400'
                    }`}
                  >
                    <CheckCircle2 size={32} />
                    <span className="font-bold">네, 먹었어요</span>
                  </button>
                  <button
                    id="btn-medicated-no"
                    onClick={() => setIsMedicated(false)}
                    className={`flex-1 py-4 px-4 rounded-2xl flex flex-col items-center gap-2 border-2 transition-all ${
                      !isMedicated 
                        ? 'border-slate-300 bg-slate-50 text-slate-600' 
                        : 'border-slate-100 hover:border-slate-200 text-slate-400'
                    }`}
                  >
                    <XCircle size={32} />
                    <span className="font-bold">아니오/아직요</span>
                  </button>
                </div>
              </div>

              {/* Memo Field */}
              <div id="memo-field" className="flex flex-col gap-3">
                <label id="memo-label" htmlFor="memo-input" className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                  메모 
                  <span className="text-[10px] font-normal text-slate-300 italic opacity-80">(선택 사항)</span>
                </label>
                <textarea
                  id="memo-input"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="증상이나 기분이 어떠신가요?"
                  className="w-full min-h-[140px] p-4 rounded-2xl border-2 border-slate-100 focus:border-emerald-500 focus:ring-0 outline-none transition-all resize-none text-slate-700 leading-relaxed"
                />
              </div>

              {/* Save Button */}
              <button
                id="save-btn"
                onClick={handleSave}
                disabled={!editingId && !memo.trim() && !isMedicated}
                className="w-full py-4 rounded-2xl bg-slate-800 text-white font-bold text-lg flex items-center justify-center gap-2 hover:bg-slate-900 transition-all active:scale-95 disabled:bg-slate-200 disabled:cursor-not-allowed shadow-lg shadow-slate-200"
              >
                <Save size={20} />
                {editingId ? '기록 업데이트' : '저장하기'}
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="history-view"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-4"
            >
              {sortedRecords.length === 0 ? (
                <div id="no-records" className="bg-white rounded-3xl p-12 text-center flex flex-col items-center gap-4 border border-slate-100 shadow-sm">
                  <div className="bg-slate-50 p-4 rounded-full">
                    <Calendar className="text-slate-300 w-12 h-12" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-800">아직 저장된 기록이 없어요</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">매일의 건강 기록을 시작해보세요!</p>
                  <button 
                    onClick={() => setActiveTab('record')}
                    className="mt-4 text-emerald-600 font-bold hover:underline"
                  >
                    첫 기록 남기기
                  </button>
                </div>
              ) : (
                sortedRecords.map((record) => {
                  const { date, time } = formatDate(record.timestamp);
                  return (
                    <motion.div
                      id={`record-${record.id}`}
                      key={record.id}
                      layout
                      className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 flex flex-col gap-4 hover:shadow-md transition-shadow group"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex gap-3">
                          <div className={`mt-0.5 p-1.5 rounded-full ${record.isMedicated ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                            {record.isMedicated ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                          </div>
                          <div>
                            <div id={`record-date-${record.id}`} className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                              <Calendar size={12} /> {date}
                            </div>
                            <div id={`record-time-${record.id}`} className="text-[10px] font-medium text-slate-300 flex items-center gap-1 mt-0.5">
                              <Clock size={10} /> {time}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            id={`edit-btn-${record.id}`}
                            onClick={() => handleEdit(record)}
                            className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-full transition-all"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            id={`delete-btn-${record.id}`}
                            onClick={() => handleDelete(record.id)}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                      
                      {record.memo && (
                        <p id={`record-memo-${record.id}`} className="text-slate-700 text-sm bg-slate-50/50 p-4 rounded-2xl border border-slate-50/80 leading-relaxed italic">
                          "{record.memo}"
                        </p>
                      )}
                      
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-tighter ${
                          record.isMedicated ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {record.isMedicated ? '투약 완료' : '미투약/미기록'}
                        </span>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="mt-auto py-8 text-slate-300 text-[10px] uppercase tracking-widest font-bold">
        &copy; 2026 MediTracker UI • AI Guided Design
      </footer>
    </div>
  );
}
