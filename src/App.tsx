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
  // Helper: Get current time in Seoul (KST) for datetime-local input (YYYY-MM-DDTHH:mm)
  const getSeoulNow = (dateInput?: string) => {
    const d = dateInput ? new Date(dateInput) : new Date();
    return new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(d).replace(' ', 'T');
  };

  const [records, setRecords] = useState<MedicationRecord[]>(() => {
    const saved = localStorage.getItem('medication_records');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeTab, setActiveTab] = useState<'record' | 'history'>('record');
  
  // Form State
  const [isMedicated, setIsMedicated] = useState(false);
  const [hasSymptoms, setHasSymptoms] = useState(false);
  const [customTimestamp, setCustomTimestamp] = useState(getSeoulNow()); 
  const [memo, setMemo] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Sync with Local Storage
  useEffect(() => {
    localStorage.setItem('medication_records', JSON.stringify(records));
  }, [records]);

  const handleSave = () => {
    // Treat the input string as Seoul time (+09:00)
    const finalTimestamp = new Date(customTimestamp + ':00+09:00').toISOString();
    
    if (editingId) {
      setRecords(prev => prev.map(rec => 
        rec.id === editingId 
          ? { ...rec, isMedicated, hasSymptoms, memo, timestamp: finalTimestamp } 
          : rec
      ));
      setEditingId(null);
    } else {
      const newRecord: MedicationRecord = {
        id: crypto.randomUUID(),
        isMedicated,
        hasSymptoms,
        memo: memo.trim(),
        timestamp: finalTimestamp,
      };
      setRecords(prev => [newRecord, ...prev]);
    }
    
    // Reset form
    setMemo('');
    setIsMedicated(false);
    setHasSymptoms(false);
    setCustomTimestamp(getSeoulNow());
    setActiveTab('history');
  };

  const handleEdit = (record: MedicationRecord) => {
    setEditingId(record.id);
    setIsMedicated(record.isMedicated);
    setHasSymptoms(record.hasSymptoms || false);
    setMemo(record.memo);
    setCustomTimestamp(getSeoulNow(record.timestamp));
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

  const formatDate = (isoStr: string) => {
    const date = new Date(isoStr);
    return {
      date: date.toLocaleDateString('ko-KR', { 
        timeZone: 'Asia/Seoul',
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }),
      time: date.toLocaleTimeString('ko-KR', { 
        timeZone: 'Asia/Seoul',
        hour: '2-digit', 
        minute: '2-digit' 
      })
    };
  };

  const groupedRecords = useMemo(() => {
    const groups: Record<string, MedicationRecord[]> = {};
    const sorted = [...records].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    sorted.forEach(record => {
      const { date } = formatDate(record.timestamp);
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(record);
    });
    
    return Object.entries(groups).sort((a, b) => {
      return new Date(b[1][0].timestamp).getTime() - new Date(a[1][0].timestamp).getTime();
    });
  }, [records]);

  return (
    <div id="app-container" className="min-h-screen bg-slate-50 flex flex-col items-center p-4 sm:p-8">
      <header className="w-full max-w-2xl flex flex-col gap-6 mb-8">
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
                setHasSymptoms(false);
                setCustomTimestamp(getSeoulNow());
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

      <main className="w-full max-w-2xl relative">
        <AnimatePresence mode="wait">
          {activeTab === 'record' ? (
            <motion.div
              key="record-view"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-3xl p-6 shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col gap-6 mx-auto max-w-md"
            >
              <div className="flex items-center justify-between border-b border-slate-50 pb-4">
                <h2 id="record-title" className="text-xl font-semibold text-slate-800">
                  {editingId ? '기록 수정하기' : '상태 기록하기'}
                </h2>
                {editingId && (
                  <button 
                    id="cancel-edit"
                    onClick={() => {
                      setEditingId(null);
                      setMemo('');
                      setIsMedicated(false);
                      setHasSymptoms(false);
                      setCustomTimestamp(getSeoulNow());
                      setActiveTab('history');
                    }}
                    className="p-1 hover:bg-slate-100 rounded-full text-slate-400"
                  >
                    <X size={20} />
                  </button>
                )}
              </div>

              {/* Timestamp Field */}
              <div id="timestamp-field" className="flex flex-col gap-3">
                <label className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                  <Calendar size={14} className="text-emerald-500" /> 기록 일시
                </label>
                <input
                  type="datetime-local"
                  value={customTimestamp}
                  onChange={(e) => setCustomTimestamp(e.target.value)}
                  className="w-full p-4 rounded-xl border-2 border-slate-100 focus:border-emerald-500 focus:ring-0 outline-none transition-all text-slate-700 font-medium"
                />
              </div>

              {/* Medication Toggle */}
              <div id="medication-toggle" className="flex flex-col gap-3">
                <label className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                  <PlusCircle size={14} className="text-emerald-500" /> 투약 여부
                </label>
                <div className="flex gap-3">
                  <button
                    id="btn-medicated-yes"
                    onClick={() => setIsMedicated(true)}
                    className={`flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2 border-2 transition-all font-bold text-sm ${
                      isMedicated 
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700' 
                        : 'border-slate-50 bg-slate-50/50 text-slate-400'
                    }`}
                  >
                    <CheckCircle2 size={18} />
                    먹었어요
                  </button>
                  <button
                    id="btn-medicated-no"
                    onClick={() => setIsMedicated(false)}
                    className={`flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2 border-2 transition-all font-bold text-sm ${
                      !isMedicated 
                        ? 'border-slate-300 bg-slate-100 text-slate-600' 
                        : 'border-slate-50 bg-slate-50/50 text-slate-400'
                    }`}
                  >
                    <XCircle size={18} />
                    안 먹었어요
                  </button>
                </div>
              </div>

              {/* Symptoms Toggle */}
              <div id="symptoms-toggle" className="flex flex-col gap-3">
                <label className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                  <History size={14} className="text-emerald-500" /> 증상 유무
                </label>
                <div className="flex gap-3">
                  <button
                    id="btn-symptoms-yes"
                    onClick={() => setHasSymptoms(true)}
                    className={`flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2 border-2 transition-all font-bold text-sm ${
                      hasSymptoms 
                        ? 'border-amber-500 bg-amber-50 text-amber-700' 
                        : 'border-slate-50 bg-slate-50/50 text-slate-400'
                    }`}
                  >
                    <CheckCircle2 size={18} />
                    증상 있음
                  </button>
                  <button
                    id="btn-symptoms-no"
                    onClick={() => setHasSymptoms(false)}
                    className={`flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2 border-2 transition-all font-bold text-sm ${
                      !hasSymptoms 
                        ? 'border-slate-300 bg-slate-100 text-slate-600' 
                        : 'border-slate-50 bg-slate-50/50 text-slate-400'
                    }`}
                  >
                    <XCircle size={18} />
                    증상 없음
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
                  className="w-full min-h-[100px] p-4 rounded-xl border-2 border-slate-100 focus:border-emerald-500 focus:ring-0 outline-none transition-all resize-none text-slate-700 leading-relaxed text-sm"
                />
              </div>

              {/* Save Button */}
              <button
                id="save-btn"
                onClick={handleSave}
                className="w-full py-4 rounded-2xl bg-slate-800 text-white font-bold text-lg flex items-center justify-center gap-2 hover:bg-slate-900 transition-all active:scale-95 shadow-lg shadow-slate-200"
              >
                <Save size={20} />
                {editingId ? '기록 업데이트' : '기록 저장하기'}
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="history-view"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-10"
            >
              {groupedRecords.length === 0 ? (
                <div id="no-records" className="bg-white rounded-3xl p-12 text-center flex flex-col items-center gap-4 border border-slate-100 shadow-sm mx-auto w-full max-w-md">
                  <div className="bg-slate-50 p-4 rounded-full">
                    <Calendar className="text-slate-300 w-12 h-12" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-800">아직 저장된 기록이 없어요</h3>
                  <button 
                    onClick={() => setActiveTab('record')}
                    className="mt-4 text-emerald-600 font-bold hover:underline"
                  >
                    첫 기록 남기기
                  </button>
                </div>
              ) : (
                groupedRecords.map(([date, dateRecords]) => (
                  <div key={date} className="flex flex-col gap-3">
                    <h3 className="text-sm font-bold text-slate-400 flex items-center gap-2 px-1 uppercase tracking-widest">
                      <Calendar size={14} className="text-emerald-500" />
                      {date}
                    </h3>
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm border-collapse">
                          <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-50 text-slate-400 font-bold uppercase text-[10px] tracking-tight">
                              <th className="px-4 py-3 min-w-[80px]">시간</th>
                              <th className="px-4 py-3 text-center">투약</th>
                              <th className="px-4 py-3 text-center">증상</th>
                              <th className="px-4 py-3">메모</th>
                              <th className="px-4 py-3 text-right">관리</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dateRecords.map((record) => {
                              const { time } = formatDate(record.timestamp);
                              return (
                                <tr key={record.id} className="border-b border-slate-50 hover:bg-slate-50/30 transition-colors group">
                                  <td className="px-4 py-4 font-medium text-slate-600 whitespace-nowrap">
                                    <div className="flex items-center gap-1.5">
                                      <Clock size={12} className="text-slate-300" />
                                      {time}
                                    </div>
                                  </td>
                                  <td className="px-4 py-4 text-center">
                                    <div className="flex justify-center">
                                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                        record.isMedicated ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
                                      }`}>
                                        {record.isMedicated ? 'O' : 'X'}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-4 text-center">
                                    <div className="flex justify-center">
                                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                        (record.hasSymptoms ?? false) ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-400'
                                      }`}>
                                        {(record.hasSymptoms ?? false) ? 'O' : 'X'}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-4 text-slate-500 italic min-w-[150px] whitespace-pre-wrap break-words leading-relaxed text-xs">
                                    {record.memo || <span className="text-slate-200">-</span>}
                                  </td>
                                  <td className="px-4 py-4 text-right">
                                    <div className="flex items-center justify-end gap-0.5">
                                      <button 
                                        onClick={() => handleEdit(record)}
                                        className="p-1.5 text-slate-300 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all"
                                      >
                                        <Edit2 size={14} />
                                      </button>
                                      <button 
                                        onClick={() => handleDelete(record.id)}
                                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ))
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
