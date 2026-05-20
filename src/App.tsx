/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
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
  ChevronRight,
  ChevronDown,
  CheckCircle,
  AlertCircle,
  Edit,
  X,
  Camera,
  Image as ImageIcon,
  FileText
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

  const GAS_URL = "https://script.google.com/macros/s/AKfycbxR5Wc7rJU_SStXj_Nyo3ocplNO8UVJ7VE5oy7YJjstpRU5VgTWhlkhLsBS77BK018M/exec";

  const getKSTDateStr = (isoString: string) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) {
        if (typeof isoString === 'string') {
          return isoString.split(/[ T]/)[0] || '';
        }
        return '';
      }
      return new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(date);
    } catch {
      return typeof isoString === 'string' ? isoString.split(/[ T]/)[0] : '';
    }
  };

  const [records, setRecords] = useState<MedicationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'record' | 'history' | 'calendar'>('record');
  const [recordType, setRecordType] = useState<'status' | 'prescription'>('status');
  
  // Calendar State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isMedicated, setIsMedicated] = useState(false);
  const [hasSymptoms, setHasSymptoms] = useState(false);
  const [customTimestamp, setCustomTimestamp] = useState(getSeoulNow()); 
  const [memo, setMemo] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Fetch Records from GAS
  const fetchRecords = async () => {
    if (!GAS_URL) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    try {
      console.log('Fetching from:', GAS_URL);
      const response = await fetch(GAS_URL);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      setRecords(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('GAS Fetch Error:', error);
      alert('데이터를 불러오는데 실패했습니다.\n1. GAS 배포 시 "모든 사용자(Anyone)" 권한을 주었는지 확인하세요.\n2. 브라우저에서 GAS URL을 직접 열었을 때 데이터가 보이는지 확인하세요.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history' || activeTab === 'calendar') {
      fetchRecords();
    }
  }, [activeTab]);

  const handleSave = async () => {
    if (!GAS_URL) {
      alert('GAS URL이 설정되지 않았습니다.');
      return;
    }

    const finalTimestamp = new Date(customTimestamp + ':00+09:00').toISOString();
    const id = editingId || crypto.randomUUID();
    
    const newRecord: MedicationRecord = {
      id,
      type: recordType,
      isMedicated: recordType === 'status' ? isMedicated : false,
      hasSymptoms: recordType === 'status' ? hasSymptoms : false,
      memo: memo.trim(),
      imageUrl: recordType === 'prescription' ? (imageUrl || undefined) : undefined,
      timestamp: finalTimestamp,
    };

    setIsLoading(true);
    try {
      // Optimistic update
      if (editingId) {
        setRecords(prev => prev.map(rec => rec.id === editingId ? newRecord : rec));
      } else {
        setRecords(prev => [...prev, newRecord]);
      }

      await fetch(GAS_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: JSON.stringify({ 
          action: 'save', 
          record: newRecord 
        }),
      });

      // no-cors 모드에서는 응답을 읽을 수 없으므로 성공했다고 가정하고 상태 업데이트
      setEditingId(null);
      setMemo('');
      setImageUrl(null);
      setIsMedicated(false);
      setHasSymptoms(false);
      setCustomTimestamp(getSeoulNow());
      setActiveTab('history');
    } catch (error) {
      console.error('Failed to save record:', error);
      alert('기록 저장 중 오류가 발생했습니다.');
      fetchRecords(); // Rollback to server state
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (record: MedicationRecord) => {
    setEditingId(record.id);
    setRecordType(record.type || 'status');
    setIsMedicated(record.isMedicated);
    setHasSymptoms(record.hasSymptoms || false);
    setMemo(record.memo);
    setImageUrl(record.imageUrl || null);
    setCustomTimestamp(getSeoulNow(record.timestamp));
    setActiveTab('record');
  };

  const handleDelete = async (id: string) => {
    if (!GAS_URL) return;
    if (!confirm('정말로 이 기록을 삭제할까요?')) return;

    setIsLoading(true);
    try {
      // Optimistic update
      setRecords(prev => prev.filter(rec => rec.id !== id));

      await fetch(GAS_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: JSON.stringify({ 
          action: 'delete', 
          id 
        }),
      });
    } catch (error) {
      console.error('Failed to delete record:', error);
      alert('삭제 중 오류가 발생했습니다.');
      fetchRecords(); // Rollback
    } finally {
      setIsLoading(false);
    }
  };

  const [showExportOptions, setShowExportOptions] = useState(false);

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (Array.isArray(json)) {
          // Add IDs to records that don't have them
          const processedRecords = json.map(rec => ({
            ...rec,
            id: rec.id || crypto.randomUUID(),
            timestamp: rec.timestamp || new Date().toISOString()
          }));

          const validRecords = processedRecords.filter(rec => rec.timestamp);
          
          if (validRecords.length === 0) {
            alert('유효한 데이터가 없습니다.');
            return;
          }

          if (confirm(`${validRecords.length}개의 기록을 가져오시겠습니까?`)) {
            setIsLoading(true);
            try {
              // 1. UI에 즉시 반영 (낙관적 업데이트)
              setRecords(prev => {
                const existingIds = new Set(prev.map(r => r.id));
                const uniqueNewRecords = validRecords.filter(r => !existingIds.has(r.id));
                return [...uniqueNewRecords, ...prev]; // 새 기록을 위로
              });

              // 2. 구글 시트로 동기화 전송
              if (GAS_URL) {
                await fetch(GAS_URL, {
                  method: 'POST',
                  mode: 'no-cors',
                  headers: { 'Content-Type': 'text/plain' },
                  body: JSON.stringify({ 
                    action: 'bulk_save', 
                    records: validRecords 
                  }),
                });
                
                // 전송 후 서버 상태와 최종 동기화
                setTimeout(() => fetchRecords(), 1000); 
              }
              
              alert('데이터를 성공적으로 가져왔습니다.');
            } catch (err) {
              console.error('Import sync error:', err);
              alert('데이터 동기화 중 오류가 발생했습니다. (시트 연결 확인 필요)');
              fetchRecords(); // 오류 시 서버 데이터로 롤백
            } finally {
              setIsLoading(false);
            }
          }
        }
      } catch (err) {
        alert('파일을 읽는 중 오류가 발생했습니다. 올바른 JSON 파일인지 확인해주세요.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
    setShowExportOptions(false);
  };

  const handleDownload = (type: 'json' | 'text') => {
    let content = '';
    let mimeType = '';
    let extension = '';

    if (type === 'json') {
      content = JSON.stringify(records, null, 2);
      mimeType = 'application/json';
      extension = 'json';
    } else {
      // Process Text Format
      const textLines: string[] = [];
      groupedRecords.forEach(([date, dateRecords]) => {
        textLines.push(`${date}\n`);
        dateRecords.forEach((rec) => {
          const { time } = formatDate(rec.timestamp);
          textLines.push(time);
          textLines.push(`투약여부 : ${rec.isMedicated ? 'O' : 'X'}`);
          textLines.push(`증상유무 : ${rec.hasSymptoms ? 'O' : 'X'}`);
          textLines.push(`메모 : ${rec.memo || ''}`);
          textLines.push(''); // Empty line between records
        });
        textLines.push(''); // Extra empty line between days
      });
      content = textLines.join('\n');
      mimeType = 'text/plain';
      extension = 'txt';
    }

    const dataUri = `data:${mimeType};charset=utf-8,` + encodeURIComponent(content);
    const exportFileDefaultName = `medication_records_${new Date().toISOString().split('T')[0]}.${extension}`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    setShowExportOptions(false);
  };

  const formatDate = (isoStr: string) => {
    if (!isoStr) return { date: '-', time: '-' };
    try {
      const date = new Date(isoStr);
      if (isNaN(date.getTime())) {
        // Fallback for non-standard formats often found in spreadsheets
        if (typeof isoStr === 'string' && isoStr.includes('-')) {
          const parts = isoStr.split(/[ T]/);
          return { date: parts[0] || 'Invalid', time: parts[1] || '00:00' };
        }
        return { date: 'Invalid Date', time: 'Invalid Time' };
      }
      return {
        date: date.toLocaleDateString('sv-SE', {
          timeZone: 'Asia/Seoul',
        }),
        time: date.toLocaleTimeString('ko-KR', { 
          timeZone: 'Asia/Seoul',
          hour: '2-digit', 
          minute: '2-digit',
          hour12: false
        })
      };
    } catch (e) {
      return { date: 'Error', time: 'Error' };
    }
  };

  const groupedRecords = useMemo(() => {
    const groups: Record<string, MedicationRecord[]> = {};
    // Sort all records by timestamp (ascending for internal day consistency)
    const sorted = [...records].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    sorted.forEach(record => {
      const { date } = formatDate(record.timestamp);
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(record);
    });
    
    // Sort day groups by date descending (recent days first)
    return Object.entries(groups).sort((a, b) => {
      return b[0].localeCompare(a[0]);
    });
  }, [records]);

  return (
    <div id="app-container" className="min-h-screen bg-slate-50 flex flex-col items-center p-4 sm:p-8">
      <header className="w-full max-w-2xl flex flex-col gap-6 mb-8">
        <div className="flex items-center justify-between relative">
          <h1 id="app-title" className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <PlusCircle className="text-emerald-500 w-8 h-8" />
            쿠쿠증상기록
          </h1>
          <div className="relative">
            <button 
              id="download-btn"
              onClick={() => setShowExportOptions(!showExportOptions)}
              className={`p-2 rounded-full transition-all shadow-sm border ${
                showExportOptions 
                  ? 'bg-emerald-500 text-white border-emerald-500' 
                  : 'bg-white text-slate-500 hover:text-emerald-600 border-slate-100 hover:bg-slate-50'
              }`}
              title="데이터 다운로드"
            >
              <Download size={20} />
            </button>
            
            <AnimatePresence>
              {showExportOptions && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowExportOptions(false)} 
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 z-50 overflow-hidden py-2"
                  >
                    <div className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-50 mb-1">
                      데이터 관리
                    </div>
                    <button
                      onClick={() => handleDownload('json')}
                      className="w-full px-4 py-3 text-left text-sm font-medium hover:bg-slate-50 flex items-center justify-between text-slate-700"
                    >
                      데이터 내보내기 (JSON)
                      <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-400">Export</span>
                    </button>
                    <button
                      onClick={() => handleDownload('text')}
                      className="w-full px-4 py-3 text-left text-sm font-medium hover:bg-slate-50 flex items-center justify-between text-slate-700"
                    >
                      텍스트로 저장 (.txt)
                      <span className="text-[10px] bg-emerald-100 px-1.5 py-0.5 rounded text-emerald-600">Print</span>
                    </button>
                    <div className="h-[1px] bg-slate-50 my-1" />
                    <label className="w-full px-4 py-3 text-left text-sm font-medium hover:bg-slate-50 flex items-center justify-between text-slate-700 cursor-pointer">
                      <span>데이터 가져오기 (JSON)</span>
                      <span className="text-[10px] bg-blue-100 px-1.5 py-0.5 rounded text-blue-600">Import</span>
                      <input 
                        type="file" 
                        accept=".json" 
                        className="hidden" 
                        onChange={handleImport}
                      />
                    </label>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
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
            기록
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
            기록목록
          </button>
          <button
            id="tab-calendar"
            onClick={() => setActiveTab('calendar')}
            className={`flex-1 py-3 px-4 rounded-lg flex items-center justify-center gap-2 font-medium transition-all ${
              activeTab === 'calendar' 
                ? 'bg-white text-emerald-600 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Calendar size={18} />
            달력보기
          </button>
        </div>
      </header>

      <main className="w-full max-w-2xl relative">
        <AnimatePresence mode="wait">
          {isLoading && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[100] flex items-center justify-center bg-slate-50/50 backdrop-blur-sm rounded-3xl"
            >
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest">연결 중...</p>
              </div>
            </motion.div>
          )}


          {activeTab === 'calendar' ? (
            <motion.div
              key="calendar-view"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="bg-white rounded-3xl shadow-xl shadow-emerald-900/5 border border-slate-100 overflow-hidden p-6">
                <div className="flex flex-col gap-6">
                  {/* Calendar Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
                        className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
                      >
                        <ChevronLeft size={20} />
                      </button>
                      <h2 className="text-lg font-bold text-slate-800">
                        {currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월
                      </h2>
                      <button 
                        onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
                        className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
                      >
                        <ChevronRight size={20} />
                      </button>
                    </div>
                  </div>

                  {/* Calendar Grid */}
                  <div className="grid grid-cols-7 gap-1">
                    {['일', '월', '화', '수', '목', '금', '토'].map((day, idx) => (
                      <div key={day} className={`text-center py-2 text-[10px] font-bold uppercase tracking-widest ${idx === 0 ? 'text-rose-400' : idx === 6 ? 'text-blue-400' : 'text-slate-400'}`}>
                        {day}
                      </div>
                    ))}
                    {(() => {
                      const year = currentDate.getFullYear();
                      const month = currentDate.getMonth();
                      const firstDay = new Date(year, month, 1).getDay();
                      const daysInMonth = new Date(year, month + 1, 0).getDate();
                      
                      const cells = [];
                      for (let i = 0; i < firstDay; i++) {
                        cells.push(<div key={`empty-${i}`} className="aspect-square" />);
                      }
                      
                      for (let d = 1; d <= daysInMonth; d++) {
                        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                        const isToday = getKSTDateStr(new Date().toISOString()) === dateStr;
                        const isSelected = selectedDate === dateStr;
                        
                        // Check if day has data for current mode matching KST date
                        const dayRecords = records.filter(r => getKSTDateStr(r.timestamp) === dateStr);
                        const hasMedication = dayRecords.some(r => r.isMedicated && r.type !== 'prescription');
                        const hasSymptoms = dayRecords.some(r => r.hasSymptoms && r.type !== 'prescription');
                        const hasPrescription = dayRecords.some(r => r.type === 'prescription');
                        const hasAnyRecord = dayRecords.length > 0;

                        cells.push(
                          <button
                            key={d}
                            onClick={() => {
                              if (!hasAnyRecord) {
                                setSelectedDate(null);
                              } else {
                                setSelectedDate(selectedDate === dateStr ? null : dateStr);
                              }
                            }}
                            className={`aspect-square relative flex flex-col items-center justify-center rounded-2xl transition-all group ${
                              isSelected 
                                ? 'bg-slate-800 text-white shadow-lg shadow-slate-200' 
                                : 'hover:bg-slate-50'
                            }`}
                          >
                            <span className={`text-sm font-medium ${isSelected ? 'text-white' : isToday ? 'text-emerald-600 font-bold underline' : 'text-slate-700'}`}>
                              {d}
                            </span>
                            <div className="mt-1 flex gap-0.5 justify-center flex-wrap max-w-full px-1">
                              {hasMedication && (
                                <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-emerald-400' : 'bg-emerald-500'}`} />
                              )}
                              {hasSymptoms && (
                                <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-rose-300' : 'bg-rose-500'}`} />
                              )}
                              {hasPrescription && (
                                <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-blue-300' : 'bg-blue-500'}`} />
                              )}
                            </div>
                          </button>
                        );
                      }
                      return cells;
                    })()}
                  </div>

                  {/* Selected Date Detail */}
                  <AnimatePresence>
                    {selectedDate && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden border-t border-slate-100 pt-6"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-emerald-500 rounded-full" />
                            {selectedDate.split('-')[1]}월 {selectedDate.split('-')[2]}일 기록
                          </h3>
                          <button 
                            onClick={() => setSelectedDate(null)}
                            className="text-xs text-slate-400 hover:text-slate-600"
                          >
                            닫기
                          </button>
                        </div>
                        
                        <div className="space-y-3 max-h-60 overflow-y-auto pr-2 pb-2">
                          {records.filter(r => getKSTDateStr(r.timestamp) === selectedDate).length > 0 ? (
                            records
                              .filter(r => getKSTDateStr(r.timestamp) === selectedDate)
                              .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                              .map(record => (
                                <div key={record.id} className="p-3 bg-slate-50 rounded-2xl flex flex-col gap-3 group">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <div className="flex gap-1.5 min-w-max">
                                        {record.type === 'prescription' ? (
                                          <div className="p-1.5 bg-white rounded-lg shadow-sm border border-blue-100">
                                            <FileText size={14} className="text-blue-500" />
                                          </div>
                                        ) : (
                                          <>
                                            {record.isMedicated && (
                                              <div className="p-1.5 bg-white rounded-lg shadow-sm border border-emerald-100">
                                                <PlusCircle size={14} className="text-emerald-500" />
                                              </div>
                                            )}
                                            {record.hasSymptoms ? (
                                              <div className="p-1.5 bg-white rounded-lg shadow-sm border border-rose-100">
                                                <AlertCircle size={14} className="text-rose-500" />
                                              </div>
                                            ) : (
                                              <div className="p-1.5 bg-white rounded-lg shadow-sm border border-sky-100">
                                                <CheckCircle size={14} className="text-sky-500" />
                                              </div>
                                            )}
                                          </>
                                        )}
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-xs text-slate-400 font-mono">
                                          {new Date(record.timestamp).toLocaleTimeString('ko-KR', { 
                                            hour: '2-digit', 
                                            minute: '2-digit', 
                                            hour12: false,
                                            timeZone: 'Asia/Seoul'
                                          })}
                                          {record.type === 'prescription' && <span className="ml-2 text-[10px] text-blue-500 font-bold uppercase tracking-widest">처방기록</span>}
                                        </p>
                                        {record.memo ? (
                                          <p className="text-sm text-slate-700 leading-snug mt-0.5">{record.memo}</p>
                                        ) : (
                                          <p className="text-xs text-slate-300 italic mt-0.5">
                                            {record.type === 'prescription' ? '별도 메모 없음' : '증상 없음. 별도 기록 내용 없음'}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                                      <button onClick={() => handleEdit(record)} className="p-1.5 hover:bg-white rounded-lg text-slate-400 hover:text-emerald-600 transition-colors">
                                        <Edit size={14} />
                                      </button>
                                      <button onClick={() => handleDelete(record.id)} className="p-1.5 hover:bg-white rounded-lg text-slate-400 hover:text-rose-500 transition-colors">
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  </div>
                                  {record.imageUrl && (
                                    <div className="rounded-xl overflow-hidden border border-slate-100 aspect-video bg-white">
                                      <img src={record.imageUrl} alt="Prescription" className="w-full h-full object-contain cursor-pointer" onClick={() => window.open(record.imageUrl, '_blank')} />
                                    </div>
                                  )}
                                </div>
                              ))
                          ) : (
                            <div className="py-8 text-center text-slate-400 text-xs italic">
                              기록이 없습니다.
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          ) : activeTab === 'record' ? (
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
                  {editingId ? '기록 수정하기' : recordType === 'status' ? '상태 기록하기' : '처방 기록하기'}
                </h2>
                {editingId && (
                  <button 
                    id="cancel-edit"
                    onClick={() => {
                      setEditingId(null);
                      setMemo('');
                      setImageUrl(null);
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

              {/* Record Type Toggle */}
              {!editingId && (
                <div role="tablist" className="flex bg-slate-100 p-1 rounded-xl">
                  <button
                    role="tab"
                    aria-selected={recordType === 'status'}
                    onClick={() => setRecordType('status')}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                      recordType === 'status' 
                        ? 'bg-white text-emerald-600 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <AlertCircle size={16} />
                    상태 기록
                  </button>
                  <button
                    role="tab"
                    aria-selected={recordType === 'prescription'}
                    onClick={() => setRecordType('prescription')}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                      recordType === 'prescription' 
                        ? 'bg-white text-blue-600 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <FileText size={16} />
                    처방 기록
                  </button>
                </div>
              )}

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

              {recordType === 'status' ? (
                <>
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
                            ? 'border-rose-500 bg-rose-50 text-rose-700' 
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
                            ? 'border-sky-500 bg-sky-50 text-sky-700' 
                            : 'border-slate-50 bg-slate-50/50 text-slate-400'
                        }`}
                      >
                        <CheckCircle size={18} />
                        증상 없음
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                /* Prescription Image Upload */
                <div id="prescription-upload" className="flex flex-col gap-3">
                  <label className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <Camera size={14} className="text-blue-500" /> 처방전 사진 첨부
                  </label>
                  <div className="relative group">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setImageUrl(reader.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="hidden"
                      id="prescription-file"
                    />
                    <label
                      htmlFor="prescription-file"
                      className={`w-full h-48 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-3 cursor-pointer transition-all overflow-hidden bg-slate-50/50 ${
                        imageUrl 
                          ? 'border-blue-500 p-0' 
                          : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50'
                      }`}
                    >
                      {imageUrl ? (
                        <div className="relative w-full h-full">
                          <img src={imageUrl} alt="Prescription" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Camera className="text-white" size={32} />
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="p-4 bg-blue-50 text-blue-500 rounded-full">
                            <Camera size={24} />
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-bold text-slate-600">사진 촬영 또는 업로드</p>
                            <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-bold">Tap to capture</p>
                          </div>
                        </>
                      )}
                    </label>
                    {imageUrl && (
                      <button 
                        onClick={() => setImageUrl(null)}
                        className="absolute -top-2 -right-2 p-1.5 bg-rose-500 text-white rounded-full shadow-lg hover:bg-rose-600 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Memo Field */}
              <div id="memo-field" className="flex flex-col gap-3">
                <label id="memo-label" htmlFor="memo-input" className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                  {recordType === 'status' ? '메모' : '처방 정보 메모'}
                  <span className="text-[10px] font-normal text-slate-300 italic opacity-80">(선택 사항)</span>
                </label>
                <textarea
                  id="memo-input"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder={recordType === 'status' ? "증상이나 기분이 어떠신가요?" : "어떤 약을 처방받으셨나요?"}
                  className="w-full min-h-[100px] p-4 rounded-xl border-2 border-slate-100 focus:border-emerald-500 focus:ring-0 outline-none transition-all resize-none text-slate-700 leading-relaxed text-sm"
                />
              </div>

              {/* Save Button */}
              <button
                id="save-btn"
                onClick={handleSave}
                disabled={recordType === 'prescription' && !imageUrl}
                className={`w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-slate-200 ${
                  recordType === 'prescription' && !imageUrl
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-slate-800 text-white hover:bg-slate-900 shadow-slate-200'
                }`}
              >
                <Save size={20} />
                {editingId ? '기록 업데이트' : '기록 저장하기'}
                {recordType === 'prescription' && !imageUrl && ' (사진 필수)'}
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
                              <th className="px-4 py-3 min-w-[100px]">유형</th>
                              <th className="px-4 py-3 text-center">투약</th>
                              <th className="px-4 py-3 text-center">증상</th>
                              <th className="px-4 py-3">메모 / 사진</th>
                              <th className="px-4 py-3 text-right">관리</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dateRecords.map((record) => {
                              const { time } = formatDate(record.timestamp);
                              const isPrescription = record.type === 'prescription';
                              return (
                                <tr key={record.id} className="border-b border-slate-50 hover:bg-slate-50/30 transition-colors group">
                                  <td className="px-4 py-4 font-medium text-slate-600 whitespace-nowrap">
                                    <div className="flex items-center gap-1.5">
                                      <Clock size={12} className="text-slate-300" />
                                      {time}
                                    </div>
                                  </td>
                                  <td className="px-4 py-4 whitespace-nowrap">
                                    {isPrescription ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">
                                        <FileText size={10} /> 처방전
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                                        <AlertCircle size={10} /> 상태
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-4 text-center">
                                    <div className="flex justify-center">
                                      {!isPrescription && (
                                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                          record.isMedicated ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
                                        }`}>
                                          {record.isMedicated ? 'O' : 'X'}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-4 text-center">
                                    <div className="flex justify-center">
                                      {!isPrescription && (
                                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                          (record.hasSymptoms ?? false) ? 'bg-rose-100 text-rose-700' : 'bg-sky-100 text-sky-700'
                                        }`}>
                                          {(record.hasSymptoms ?? false) ? 'O' : 'OK'}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-4 text-slate-500 italic min-w-[150px] whitespace-pre-wrap break-words leading-relaxed text-xs">
                                    <div className="flex flex-col gap-2">
                                      {record.memo || (isPrescription ? '' : <span className="text-slate-200">-</span>)}
                                      {record.imageUrl && (
                                        <div 
                                          className="w-12 h-12 rounded-lg border border-slate-100 overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                                          onClick={() => window.open(record.imageUrl, '_blank')}
                                        >
                                          <img src={record.imageUrl} alt="Prescription" className="w-full h-full object-cover" />
                                        </div>
                                      )}
                                    </div>
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
