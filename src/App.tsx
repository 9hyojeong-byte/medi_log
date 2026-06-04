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
  FileText,
  Menu
} from 'lucide-react';
import { MedicationRecord } from './types.ts';

// Helper to compress and downscale uploaded image to avoid QuotaExceededError and keep Google Sheets sync hyper-fast.
const resizeImage = (dataUrl: string, maxWidth = 800, maxHeight = 800): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = dataUrl;
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        // Compress to JPEG with 0.7 quality (which keeps it extremely crisp but under 80KB)
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      } else {
        resolve(dataUrl);
      }
    };
    img.onerror = () => {
      resolve(dataUrl);
    };
  });
};

const hasActualSymptomVal = (val: boolean | string | undefined): boolean => {
  if (!val || val === 'false' || val === '증상 없음') {
    return false;
  }
  return true;
};

const getActiveSymptoms = (val: boolean | string | undefined): string[] => {
  if (val === true || val === 'true') {
    return ['웅웅']; // Default legacy mapping
  }
  if (!val || val === 'false' || val === '증상 없음') {
    return ['증상 없음'];
  }
  return String(val)
    .split(',')
    .map(s => {
      const trimmed = s.trim();
      return trimmed === '삐' ? '삐-' : trimmed;
    })
    .filter(Boolean);
};

export default function App() {
  const generateId = () => {
    if (typeof window !== 'undefined' && window.crypto && typeof window.crypto.randomUUID === 'function') {
      try {
        return window.crypto.randomUUID();
      } catch (e) {
        // Fallback below
      }
    }
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 11);
  };
  // Helper: Get current time in Seoul (KST) for datetime-local input (YYYY-MM-DDTHH:mm)
  const getSeoulNow = (dateInput?: string) => {
    let d = new Date();
    if (dateInput) {
      const parsed = new Date(dateInput);
      if (!isNaN(parsed.getTime())) {
        d = parsed;
      }
    }
    try {
      return new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).format(d).replace(' ', 'T');
    } catch (err) {
      console.error('Failed to format Seoul time:', err);
      // Clean pure Javascript fallback for standard date formatting
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    }
  };

  const GAS_URL = "https://script.google.com/macros/s/AKfycbxnO0KROovGYd7gEzRMv9yzi46zJqHJNwmqeV6jhBeCFIk4A-M_kSCAMV6zCzGDUBcl/exec";

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

  const [records, setRecords] = useState<MedicationRecord[]>(() => {
    try {
      const saved = localStorage.getItem('medication_records');
      const parsed = saved ? JSON.parse(saved) : [];
      const seenIds = new Set<string>();
      return (Array.isArray(parsed) ? parsed : [])
        .filter(rec => 
          rec && 
          typeof rec === 'object' && 
          typeof rec.id === 'string' && 
          rec.id.trim() !== '' && 
          typeof rec.timestamp === 'string' && 
          rec.timestamp.trim() !== ''
        )
        .map(rec => ({
          id: String(rec.id).trim(),
          type: (rec.type === 'prescription' || rec.type === 'status') ? rec.type : 'status',
          isMedicated: rec.isMedicated === true || rec.isMedicated === 'true' || rec.isMedicated === 1 || String(rec.isMedicated).toUpperCase() === 'TRUE',
          hasSymptoms: typeof rec.hasSymptoms === 'string' && rec.hasSymptoms !== 'true' && rec.hasSymptoms !== 'false'
            ? rec.hasSymptoms
            : (rec.hasSymptoms === true || rec.hasSymptoms === 'true' || rec.hasSymptoms === 1 || String(rec.hasSymptoms).toUpperCase() === 'TRUE'),
          memo: typeof rec.memo === 'string' ? rec.memo : (rec.memo ? String(rec.memo) : ''),
          imageUrl: typeof rec.imageUrl === 'string' && rec.imageUrl.trim() !== '' ? rec.imageUrl.trim() : undefined,
          timestamp: String(rec.timestamp).trim()
        }))
        .filter(rec => {
          if (seenIds.has(rec.id)) return false;
          seenIds.add(rec.id);
          return true;
        });
    } catch (e) {
      console.error('Failed to parse cached records:', e);
      return [];
    }
  });
  const [isLoading, setIsLoading] = useState(() => {
    try {
      const saved = localStorage.getItem('medication_records');
      return saved ? false : true;
    } catch {
      return true;
    }
  });
  const [loadingMessage, setLoadingMessage] = useState('처리 중...');
  const [isBackgroundFetching, setIsBackgroundFetching] = useState(false);
  const [activeTab, setActiveTab] = useState<'record' | 'history' | 'calendar' | 'symptoms'>('record');
  const [recordType, setRecordType] = useState<'status' | 'prescription'>('status');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Calendar State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isMedicated, setIsMedicated] = useState(false);
  const [hasSymptoms, setHasSymptoms] = useState<boolean | string>('증상 없음');
  const [customTimestamp, setCustomTimestamp] = useState(getSeoulNow()); 

  const handleSymptomToggle = (option: string) => {
    if (option === '증상 없음') {
      setHasSymptoms('증상 없음');
      return;
    }
    
    const active = getActiveSymptoms(hasSymptoms).filter(s => s !== '증상 없음');
    let next: string[];
    if (active.includes(option)) {
      next = active.filter(s => s !== option);
    } else {
      next = [...active, option];
    }
    
    if (next.length === 0) {
      setHasSymptoms('증상 없음');
    } else {
      setHasSymptoms(next.join(', '));
    }
  }; 
  const [memo, setMemo] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Toast State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
  };
  
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // Memo Modal State
  const [memoModal, setMemoModal] = useState<{ title: string; memo: string; timestamp: string } | null>(null);

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmModal(null);
      }
    });
  };

  // Fetch Records from GAS
  const fetchRecords = async (isBackground = false) => {
    if (!GAS_URL) {
      setIsLoading(false);
      return;
    }
    
    if (!isBackground) {
      setIsLoading(true);
    } else {
      setIsBackgroundFetching(true);
    }

    try {
      console.log('Fetching from:', GAS_URL);
      const response = await fetch(GAS_URL);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      const rawData = Array.isArray(data) ? data : [];
      
      // Parse, cast, normalize, and uniquely filter valid records returned from Google Sheets
      const seenIds = new Set<string>();
      const freshData = rawData
        .filter(rec => 
          rec && 
          typeof rec === 'object' && 
          typeof rec.id === 'string' && 
          rec.id.trim() !== '' && 
          typeof rec.timestamp === 'string' && 
          rec.timestamp.trim() !== ''
        )
        .map(rec => ({
          id: String(rec.id).trim(),
          type: (rec.type === 'prescription' || rec.type === 'status') ? rec.type : 'status',
          isMedicated: rec.isMedicated === true || rec.isMedicated === 'true' || rec.isMedicated === 1 || String(rec.isMedicated).toUpperCase() === 'TRUE',
          hasSymptoms: typeof rec.hasSymptoms === 'string' && rec.hasSymptoms !== 'true' && rec.hasSymptoms !== 'false'
            ? rec.hasSymptoms
            : (rec.hasSymptoms === true || rec.hasSymptoms === 'true' || rec.hasSymptoms === 1 || String(rec.hasSymptoms).toUpperCase() === 'TRUE'),
          memo: typeof rec.memo === 'string' ? rec.memo : (rec.memo ? String(rec.memo) : ''),
          imageUrl: typeof rec.imageUrl === 'string' && rec.imageUrl.trim() !== '' ? rec.imageUrl.trim() : undefined,
          timestamp: String(rec.timestamp).trim()
        }))
        .filter(rec => {
          if (seenIds.has(rec.id)) return false;
          seenIds.add(rec.id);
          return true;
        });
      
      setRecords(prev => {
        const hasChanged = JSON.stringify(prev) !== JSON.stringify(freshData);
        if (hasChanged) {
          try {
            localStorage.setItem('medication_records', JSON.stringify(freshData));
          } catch (e) {
            console.warn('Failed to cache fetched records in localStorage:', e);
          }
          return freshData;
        }
        return prev;
      });
    } catch (error) {
      console.error('GAS Fetch Error:', error);
      if (!isBackground) {
        showToast('데이터를 불러오는데 실패했습니다. 구글 시트 연결이나 설정을 확인해 주세요.', 'error');
      }
    } finally {
      setIsLoading(false);
      setIsBackgroundFetching(false);
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem('medication_records');
    const hasCache = !!saved;
    fetchRecords(hasCache);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('medication_records', JSON.stringify(records));
    } catch (e) {
      console.warn('Failed to save records to localStorage (likely quota exceeded):', e);
    }
  }, [records]);

  const handleSave = async () => {
    if (!GAS_URL) {
      showToast('GAS URL이 설정되지 않았습니다.', 'error');
      return;
    }

    let finalTimestamp = new Date().toISOString();
    try {
      const parsedDate = new Date(customTimestamp + ':00+09:00');
      if (!isNaN(parsedDate.getTime())) {
        finalTimestamp = parsedDate.toISOString();
      }
    } catch (err) {
      console.error('Failed to parse custom timestamp in handleSave:', err);
    }
    const id = editingId || generateId();
    
    const newRecord: MedicationRecord = {
      id,
      type: recordType,
      isMedicated: recordType === 'status' ? isMedicated : false,
      hasSymptoms: recordType === 'status' ? hasSymptoms : false,
      memo: memo.trim(),
      imageUrl: recordType === 'prescription' ? (imageUrl || undefined) : undefined,
      timestamp: finalTimestamp,
    };

    setLoadingMessage('데이터 업로드 중...');
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
      setHasSymptoms('증상 없음');
      setCustomTimestamp(getSeoulNow());
      // 기록 저장 완료 후 다른 탭으로 이동하지 않고 현재 작성 화면(디폴트 상태)에 머무름
      showToast('데이터가 저장되었습니다.', 'success');
    } catch (error) {
      console.error('Failed to save record:', error);
      showToast('기록 저장 중 오류가 발생했습니다. 다시 시도해 주세요.', 'error');
      fetchRecords(); // Rollback to server state
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (record: MedicationRecord) => {
    setEditingId(record.id);
    setRecordType(record.type || 'status');
    setIsMedicated(record.isMedicated);
    setHasSymptoms(record.hasSymptoms || '증상 없음');
    setMemo(record.memo);
    setImageUrl(record.imageUrl || null);
    setCustomTimestamp(getSeoulNow(record.timestamp));
    setActiveTab('record');
  };

  const handleDelete = (id: string) => {
    if (!GAS_URL) return;
    showConfirm(
      '기록 삭제',
      '정말로 이 기록을 삭제할까요? 이 작업은 되돌릴 수 없습니다.',
      async () => {
        setLoadingMessage('데이터 삭제 중...');
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
          showToast('기록이 삭제되었습니다.', 'info');
        } catch (error) {
          console.error('Failed to delete record:', error);
          showToast('삭제 중 오류가 발생했습니다. 다시 시도해 주세요.', 'error');
          fetchRecords(); // Rollback
        } finally {
          setIsLoading(false);
        }
      }
    );
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
            id: rec.id || generateId(),
            type: (rec.type === 'prescription' || rec.type === 'status') ? rec.type : 'status',
            isMedicated: rec.isMedicated === true || rec.isMedicated === 'true' || rec.isMedicated === 1 || String(rec.isMedicated).toUpperCase() === 'TRUE',
            hasSymptoms: typeof rec.hasSymptoms === 'string' && rec.hasSymptoms !== 'true' && rec.hasSymptoms !== 'false'
              ? rec.hasSymptoms
              : (rec.hasSymptoms === true || rec.hasSymptoms === 'true' || rec.hasSymptoms === 1 || String(rec.hasSymptoms).toUpperCase() === 'TRUE'),
            memo: typeof rec.memo === 'string' ? rec.memo : (rec.memo ? String(rec.memo) : ''),
            timestamp: rec.timestamp || new Date().toISOString()
          }));

          const validRecords = processedRecords.filter(rec => rec.timestamp);
          
          if (validRecords.length === 0) {
            showToast('유효한 데이터가 없습니다.', 'error');
            return;
          }

          showConfirm(
            '데이터 가져오기',
            `${validRecords.length}개의 기록을 가져오시겠습니까? 기존 데이터에 추가됩니다.`,
            async () => {
              setLoadingMessage('데이터 가져오는 중...');
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
                
                showToast('데이터를 성공적으로 가져왔습니다.', 'success');
              } catch (err) {
                console.error('Import sync error:', err);
                showToast('데이터 동기화 중 오류가 발생했습니다. (시트 연결 확인 필요)', 'error');
                fetchRecords(); // 오류 시 서버 데이터로 롤백
              } finally {
                setIsLoading(false);
              }
            }
          );
        }
      } catch (err) {
        showToast('파일을 읽는 중 오류가 발생했습니다. 올바른 JSON 파일인지 확인해주세요.', 'error');
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
          if (rec.type === 'prescription') {
            textLines.push(`종류 : 처방기록`);
          } else {
            textLines.push(`투약여부 : ${rec.isMedicated ? 'O' : 'X'}`);
            textLines.push(`증상 : ${hasActualSymptomVal(rec.hasSymptoms) ? rec.hasSymptoms : '증상 없음'}`);
          }
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
    // Sort all records safely by timestamp (ascending for internal day consistency)
    const sorted = [...records].sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      const valA = isNaN(timeA) ? 0 : timeA;
      const valB = isNaN(timeB) ? 0 : timeB;
      return valA - valB;
    });
    
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
    <div id="app-wrapper" className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Sidebar Menu */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-100 flex flex-col transition-transform duration-300 lg:translate-x-0 lg:static lg:h-screen lg:flex-shrink-0 ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        {/* Sidebar Title */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PlusCircle className="text-emerald-500 w-7 h-7" />
            <span className="text-lg font-extrabold text-slate-850 tracking-tight">쿠쿠증상기록</span>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(false)} 
            className="p-1 hover:bg-slate-50 rounded-full lg:hidden text-slate-400"
          >
            <X size={20} />
          </button>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          <button
            onClick={() => {
              setActiveTab('record');
              setEditingId(null);
              setMemo('');
              setImageUrl(null);
              setIsMedicated(false);
              setHasSymptoms('증상 없음');
              setCustomTimestamp(getSeoulNow());
              setIsSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'record'
                ? 'bg-emerald-50 text-emerald-700'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
            }`}
          >
            <PlusCircle size={18} />
            기록 작성 (홈)
          </button>
          <button
            onClick={() => {
              setActiveTab('history');
              setIsSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'history'
                ? 'bg-emerald-50 text-emerald-700'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
            }`}
          >
            <History size={18} />
            기록목록
          </button>
          <button
            onClick={() => {
              setActiveTab('calendar');
              setIsSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'calendar'
                ? 'bg-emerald-50 text-emerald-700'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
            }`}
          >
            <Calendar size={18} />
            달력보기
          </button>
          <button
            onClick={() => {
              setActiveTab('symptoms');
              setIsSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'symptoms'
                ? 'bg-emerald-50 text-emerald-700'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
            }`}
          >
            <AlertCircle size={18} className={activeTab === 'symptoms' ? 'text-emerald-600' : 'text-slate-400 group-hover:text-slate-600'} />
            증상 히스토리
          </button>
        </nav>

        {/* Sidebar Data Control Footer */}
        <div className="p-4 border-t border-slate-100 flex flex-col gap-2 bg-slate-50/50">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 mb-1">데이터 동기화</div>
          <button
            onClick={() => handleDownload('json')}
            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-xl transition-all w-full text-left"
          >
            <Download size={14} className="text-slate-400" />
            백업 내보내기 (JSON)
          </button>
          <label className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-xl transition-all w-full text-left cursor-pointer">
            <Download size={14} className="text-slate-400 rotate-180" />
            <span>데이터 가져오기 (JSON)</span>
            <input type="file" accept=".json" className="hidden" onChange={handleImport} />
          </label>
        </div>
      </aside>

      {/* Mobile Drawer Backdrop */}
      {isSidebarOpen && (
        <div 
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px] lg:hidden"
        />
      )}

      {/* Main Container */}
      <div id="main-scroll-container" className="flex-1 flex flex-col items-center p-4 sm:p-8 lg:p-12 overflow-y-auto h-screen w-full">
        <header className="w-full max-w-2xl flex flex-col gap-4 mb-8">
          <div className="flex items-center justify-between relative">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 -ml-2 rounded-xl hover:bg-slate-100 lg:hidden text-slate-600 transition-colors flex items-center justify-center"
                title="메뉴 열기"
              >
                <Menu size={20} />
              </button>
              <h1 id="app-title" className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <PlusCircle className="text-emerald-500 w-8 h-8" />
                쿠쿠증상기록
              </h1>
            </div>
          </div>
        </header>

        <main className="w-full max-w-2xl relative">
        <AnimatePresence mode="wait">
          {/* Background synchronization indicator (small badge, clean styling) */}
          {isBackgroundFetching && (
            <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full text-[10px] text-emerald-600 shadow-sm z-50">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
              <span className="font-semibold tracking-tight">구글시트 동기화 중...</span>
            </div>
          )}

          {/* Active save/delete loading overlay (when data already exists) */}
          {isLoading && records.length > 0 && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[100] flex items-center justify-center bg-slate-50/30 backdrop-blur-[2px] rounded-3xl"
            >
              <div className="flex flex-col items-center gap-2 bg-white/95 px-5 py-4 rounded-2xl shadow-xl shadow-slate-200 border border-slate-100">
                <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest">{loadingMessage}</p>
              </div>
            </motion.div>
          )}

          {/* Core Skeleton screen for first-load (records are empty, API is loading) */}
          {isLoading && records.length === 0 && (
            <motion.div
              key="skeleton-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-2xl flex flex-col gap-6"
            >
              {activeTab === 'record' ? (
                <div className="bg-white rounded-3xl p-6 border border-slate-100 flex flex-col gap-6 mx-auto w-full max-w-md animate-pulse">
                  <div className="h-7 bg-slate-200 rounded w-1/3 mb-4" />
                  <div className="h-10 bg-slate-100 rounded-xl" />
                  <div className="flex flex-col gap-3">
                    <div className="h-4 bg-slate-100 rounded w-1/4" />
                    <div className="h-12 bg-slate-100 rounded-xl" />
                  </div>
                  <div className="flex flex-col gap-3">
                    <div className="h-4 bg-slate-100 rounded w-1/4" />
                    <div className="flex gap-3">
                      <div className="flex-1 h-12 bg-slate-100 rounded-xl" />
                      <div className="flex-1 h-12 bg-slate-100 rounded-xl" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-3">
                    <div className="h-4 bg-slate-100 rounded w-1/4" />
                    <div className="h-28 bg-slate-100 rounded-xl" />
                  </div>
                  <div className="h-14 bg-slate-200 rounded-2xl" />
                </div>
              ) : activeTab === 'history' ? (
                <div className="flex flex-col gap-10 animate-pulse">
                  {[1, 2].map((i) => (
                    <div key={i} className="flex flex-col gap-3">
                      <div className="h-6 bg-slate-200 rounded w-1/4" />
                      {[1, 2].map((j) => (
                        <div key={j} className="bg-white rounded-3xl p-5 border border-slate-100 flex items-center justify-between shadow-sm">
                          <div className="flex items-center gap-4 w-full">
                            <div className="w-10 h-10 bg-slate-200 rounded-2xl animate-pulse" />
                            <div className="flex-1 space-y-2 py-1">
                              <div className="h-3 bg-slate-100 rounded w-1/6 animate-pulse" />
                              <div className="h-4 bg-slate-100 rounded w-1/2 animate-pulse" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-3xl p-6 border border-slate-100 animate-pulse">
                  <div className="flex justify-between items-center mb-6">
                    <div className="h-6 bg-slate-200 rounded w-1/3" />
                  </div>
                  <div className="h-[280px] bg-slate-100 rounded-2xl" />
                </div>
              )}
            </motion.div>
          )}

          {(!isLoading || records.length > 0) && activeTab === 'calendar' && (
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
                        const hasSymptoms = dayRecords.some(r => hasActualSymptomVal(r.hasSymptoms) && r.type !== 'prescription');
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
                              .sort((a, b) => {
                                const timeA = new Date(a.timestamp).getTime();
                                const timeB = new Date(b.timestamp).getTime();
                                const valA = isNaN(timeA) ? 0 : timeA;
                                const valB = isNaN(timeB) ? 0 : timeB;
                                return valA - valB;
                              })
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
                                            {hasActualSymptomVal(record.hasSymptoms) ? (
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
                                          {formatDate(record.timestamp).time}
                                          {record.type === 'prescription' && <span className="ml-2 text-[10px] text-blue-500 font-bold uppercase tracking-widest">처방기록</span>}
                                        </p>
                                        <div className="mt-1 flex flex-col gap-1">
                                          {record.type !== 'prescription' && (
                                            <p className="text-xs font-semibold text-slate-500">
                                              증상: {hasActualSymptomVal(record.hasSymptoms) ? (
                                                <span className="text-rose-600 font-bold">{record.hasSymptoms}</span>
                                              ) : (
                                                <span className="text-sky-600">증상 없음</span>
                                              )}
                                            </p>
                                          )}
                                          {record.memo ? (
                                            <p className="text-sm text-slate-700 leading-snug">{record.memo}</p>
                                          ) : (
                                            record.type === 'prescription' && (
                                              <p className="text-xs text-slate-300 italic">별도 메모 없음</p>
                                            )
                                          )}
                                        </div>
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
          )}

          {(!isLoading || records.length > 0) && activeTab === 'record' && (
            <motion.div
              key="record-view"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col mx-auto max-w-md w-full overflow-hidden"
            >
              {/* 상단 일체형 기록 유형 탭 헤더 */}
              {!editingId ? (
                <div role="tablist" className="flex border-b border-slate-100 bg-slate-50/50">
                  <button
                    role="tab"
                    aria-selected={recordType === 'status'}
                    onClick={() => setRecordType('status')}
                    className={`flex-1 py-4 px-4 text-center font-bold text-sm transition-all flex items-center justify-center gap-2 border-b-2 ${
                      recordType === 'status'
                        ? 'border-emerald-500 text-emerald-600 bg-white'
                        : 'border-transparent text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    <AlertCircle size={16} />
                    상태기록
                  </button>
                  <button
                    role="tab"
                    aria-selected={recordType === 'prescription'}
                    onClick={() => setRecordType('prescription')}
                    className={`flex-1 py-4 px-4 text-center font-bold text-sm transition-all flex items-center justify-center gap-2 border-b-2 ${
                      recordType === 'prescription'
                        ? 'border-blue-500 text-blue-600 bg-white'
                        : 'border-transparent text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    <FileText size={16} />
                    처방기록
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
                  <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Edit size={16} className="text-emerald-500" />
                    기록 수정하기
                  </h3>
                  <button 
                    id="cancel-edit"
                    onClick={() => {
                      setEditingId(null);
                      setMemo('');
                      setImageUrl(null);
                      setIsMedicated(false);
                      setHasSymptoms('증상 없음');
                      setCustomTimestamp(getSeoulNow());
                      setActiveTab('history');
                    }}
                    className="p-1 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              )}

              <div className="p-6 flex flex-col gap-6">

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

                  {/* Symptoms Multi-Select */}
                  <div id="symptoms-toggle" className="flex flex-col gap-3">
                    <label className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                      <History size={14} className="text-emerald-500" /> 증상 (복수선택 가능)
                    </label>
                    <div className="flex flex-col gap-3">
                      {/* 첫번째 줄 : 증상없음 */}
                      {(() => {
                        const activeSymptoms = getActiveSymptoms(hasSymptoms);
                        const isNoSymptom = activeSymptoms.includes('증상 없음');
                        return (
                          <button
                            type="button"
                            onClick={() => handleSymptomToggle('증상 없음')}
                            className={`w-full py-4 px-4 rounded-xl flex items-center justify-center gap-2 border-2 transition-all font-bold text-sm ${
                              isNoSymptom
                                ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm'
                                : 'border-slate-100 bg-slate-50/40 text-slate-400 hover:border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            {isNoSymptom && <CheckCircle size={18} />}
                            🙌 증상 없음
                          </button>
                        );
                      })()}

                      {/* 두번째 줄 : 압력감, 웅웅, 삐-, 어지러움 */}
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { name: '압력감', emoji: '💆' },
                          { name: '웅웅', emoji: '🔊' },
                          { name: '삐-', emoji: '⚡' },
                          { name: '어지러움', emoji: '🥴' }
                        ].map((item) => {
                          const activeSymptoms = getActiveSymptoms(hasSymptoms);
                          const isSelected = activeSymptoms.includes(item.name);
                          
                          return (
                            <button
                              key={item.name}
                              type="button"
                              onClick={() => handleSymptomToggle(item.name)}
                              className={`py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 border-2 transition-all font-bold text-sm ${
                                isSelected
                                  ? 'border-rose-500 bg-rose-50/70 text-rose-700 shadow-sm'
                                  : 'border-slate-100 bg-slate-50/40 text-slate-400 hover:border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              {isSelected && <CheckCircle2 size={18} className="flex-shrink-0" />}
                              <span className="flex items-center gap-1.5">
                                <span>{item.emoji}</span>
                                <span>{item.name}</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
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
                          reader.onloadend = async () => {
                            const rawUrl = reader.result as string;
                            try {
                              const compressedUrl = await resizeImage(rawUrl);
                              setImageUrl(compressedUrl);
                            } catch (err) {
                              setImageUrl(rawUrl);
                            }
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
            </div>
          </motion.div>
        )}

          {(!isLoading || records.length > 0) && activeTab === 'history' && (
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
                                        <div className="flex flex-wrap gap-1 justify-center max-w-[120px]">
                                          {(() => {
                                            const sVal = record.hasSymptoms;
                                            if (sVal === true || sVal === 'true') {
                                              return (
                                                <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-100 text-rose-700">
                                                  증상 있음
                                                </span>
                                              );
                                            }
                                            if (!sVal || sVal === false || sVal === 'false' || sVal === '증상 없음') {
                                              return (
                                                <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold bg-sky-100 text-sky-700">
                                                  증상 없음
                                                </span>
                                              );
                                            }
                                            const options = String(sVal).split(',').map(s => s.trim()).filter(Boolean);
                                            return options.map((opt, i) => (
                                              <span key={i} className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-100 text-rose-700">
                                                {opt}
                                              </span>
                                            ));
                                          })()}
                                        </div>
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

          {(!isLoading || records.length > 0) && activeTab === 'symptoms' && (
            <motion.div
              key="symptoms-view"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="w-full flex flex-col gap-6"
            >
              {/* Quick Insight / Summary Box */}
              {(() => {
                const statusRecords = records.filter(r => r.type !== 'prescription');
                const totalCount = statusRecords.length;
                if (totalCount === 0) return null;

                const counts: Record<string, number> = {
                  '압력감': 0,
                  '웅웅': 0,
                  '삐-': 0,
                  '어지러움': 0,
                  '증상 없음': 0,
                };

                statusRecords.forEach(r => {
                  const opts = getActiveSymptoms(r.hasSymptoms);
                  opts.forEach(opt => {
                    const norm = opt === '삐' ? '삐-' : opt;
                    if (norm in counts) {
                      counts[norm]++;
                    }
                  });
                });

                // Find top symptom (excluding "증상 없음")
                let topSymptom = '없음';
                let topCount = 0;
                Object.entries(counts).forEach(([sym, cnt]) => {
                  if (sym !== '증상 없음' && cnt > topCount) {
                    topCount = cnt;
                    topSymptom = sym;
                  }
                });

                const noSymptomCount = counts['증상 없음'];
                const noSymptomPercent = totalCount > 0 ? Math.round((noSymptomCount / totalCount) * 100) : 0;

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">총 상태 기록 횟수</span>
                      <div className="mt-2 flex items-baseline gap-1">
                        <span className="text-2xl font-extrabold text-slate-800">{totalCount}</span>
                        <span className="text-xs font-semibold text-slate-500">회</span>
                      </div>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">증상 없음 비율</span>
                      <div className="mt-2 flex items-baseline gap-1">
                        <span className="text-2xl font-extrabold text-sky-600">{noSymptomPercent}%</span>
                        <span className="text-xs font-semibold text-slate-500">({noSymptomCount}회)</span>
                      </div>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">가장 흔한 증상</span>
                      <div className="mt-2 flex items-baseline gap-1">
                        <span className={`text-xl font-extrabold ${topCount > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                          {topCount > 0 ? topSymptom : '없음'}
                        </span>
                        {topCount > 0 && <span className="text-xs font-semibold text-slate-500">({topCount}회)</span>}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Table List of Symptoms */}
              {groupedRecords.filter(([_, dateRecords]) => dateRecords.some(r => r.type !== 'prescription')).length === 0 ? (
                <div className="bg-white rounded-3xl p-12 text-center flex flex-col items-center gap-4 border border-slate-100 shadow-sm mx-auto w-full max-w-md">
                  <div className="bg-slate-50 p-4 rounded-full">
                    <History className="text-slate-300 w-12 h-12" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-800">아직 등록된 상태기록이 없어요</h3>
                  <button 
                    onClick={() => setActiveTab('record')}
                    className="mt-4 text-emerald-600 font-bold hover:underline"
                  >
                    첫 상태기록 남기기
                  </button>
                </div>
              ) : (
                [...groupedRecords]
                  .filter(([_, dateRecords]) => dateRecords.some(r => r.type !== 'prescription'))
                  .sort((a, b) => a[0].localeCompare(b[0]))
                  .map(([date, dateRecords]) => {
                    const statusRecords = dateRecords.filter(r => r.type !== 'prescription');
                    return (
                      <div key={date} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden p-4 sm:p-6 flex flex-col gap-4">
                        {/* Day Title */}
                        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                          <Calendar size={16} className="text-emerald-500" />
                          <h3 className="font-extrabold text-slate-700 text-sm tracking-tight">{date}</h3>
                          <span className="text-[10px] bg-slate-50 border border-slate-100 text-slate-400 font-bold px-2 py-0.5 rounded-full">
                            기록 {statusRecords.length}개
                          </span>
                        </div>

                        {/* Symptom Grid/Table */}
                        <div className="overflow-x-visible">
                          <table className="w-full text-left border-collapse table-fixed">
                            <thead>
                              <tr className="border-b border-slate-100">
                                <th className="py-3 px-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-left w-[50px] sm:w-[80px]">시간</th>
                                <th className="py-3 px-0.5 text-center w-[14%] sm:w-auto">
                                  <span className="block sm:hidden text-base cursor-help" title="증상 없음">🙌</span>
                                  <span className="hidden sm:inline text-xs font-bold text-slate-400 uppercase tracking-wider">증상 없음</span>
                                </th>
                                <th className="py-3 px-0.5 text-center w-[14%] sm:w-auto">
                                  <span className="block sm:hidden text-base cursor-help" title="압력감">💆</span>
                                  <span className="hidden sm:inline text-xs font-bold text-slate-400 uppercase tracking-wider">압력감</span>
                                </th>
                                <th className="py-3 px-0.5 text-center w-[14%] sm:w-auto">
                                  <span className="block sm:hidden text-base cursor-help" title="웅웅">🔊</span>
                                  <span className="hidden sm:inline text-xs font-bold text-slate-400 uppercase tracking-wider">웅웅</span>
                                </th>
                                <th className="py-3 px-0.5 text-center w-[14%] sm:w-auto">
                                  <span className="block sm:hidden text-base cursor-help" title="삐-">⚡</span>
                                  <span className="hidden sm:inline text-xs font-bold text-slate-400 uppercase tracking-wider">삐-</span>
                                </th>
                                <th className="py-3 px-0.5 text-center w-[14%] sm:w-auto">
                                  <span className="block sm:hidden text-base cursor-help" title="어지러움">🥴</span>
                                  <span className="hidden sm:inline text-xs font-bold text-slate-400 uppercase tracking-wider">어지러움</span>
                                </th>
                                <th className="py-3 px-1 text-center w-[40px] sm:w-[65px]">
                                  <span className="block sm:hidden text-base cursor-help" title="메모">📝</span>
                                  <span className="hidden sm:inline text-xs font-bold text-slate-400 uppercase tracking-wider">메모</span>
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {statusRecords.map((record) => {
                                const activeSymptoms = getActiveSymptoms(record.hasSymptoms);
                                const isNoSymptom = activeSymptoms.includes('증상 없음') || !hasActualSymptomVal(record.hasSymptoms);
                                const hasPressure = activeSymptoms.includes('압력감');
                                const hasBuzz = activeSymptoms.includes('웅웅');
                                const hasBeep = activeSymptoms.includes('삐-') || activeSymptoms.includes('삐');
                                const hasDizzy = activeSymptoms.includes('어지러움');
                                const timeStr = formatDate(record.timestamp).time;

                                return (
                                  <tr key={record.id} className="border-b border-slate-50 hover:bg-slate-50/40 transition-colors">
                                    <td className="py-3 px-1 text-xs font-bold text-slate-600 font-mono tracking-tighter sm:tracking-normal">{timeStr}</td>
                                    
                                    {/* 증상 없음 */}
                                    <td className="py-3 px-0.5 text-center">
                                      <div className="flex justify-center">
                                        {isNoSymptom ? (
                                          <span className="text-emerald-600 font-black text-xs sm:text-xs tracking-tight bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100" title="증상 없음">OK</span>
                                        ) : (
                                          <span className="text-slate-200 text-xs">-</span>
                                        )}
                                      </div>
                                    </td>

                                    {/* 압력감 */}
                                    <td className="py-3 px-0.5 text-center">
                                      <div className="flex justify-center">
                                        {hasPressure ? (
                                          <div className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 rounded-full bg-rose-500 shadow-sm border border-rose-300 ring-2 ring-rose-100" title="압력감 있음" />
                                        ) : (
                                          <span className="text-slate-200 text-xs">-</span>
                                        )}
                                      </div>
                                    </td>

                                    {/* 웅웅 */}
                                    <td className="py-3 px-0.5 text-center">
                                      <div className="flex justify-center">
                                        {hasBuzz ? (
                                          <div className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 rounded-full bg-rose-500 shadow-sm border border-rose-300 ring-2 ring-rose-100" title="웅웅 울림 있음" />
                                        ) : (
                                          <span className="text-slate-200 text-xs">-</span>
                                        )}
                                      </div>
                                    </td>

                                    {/* 삐- */}
                                    <td className="py-3 px-0.5 text-center">
                                      <div className="flex justify-center">
                                        {hasBeep ? (
                                          <div className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 rounded-full bg-rose-500 shadow-sm border border-rose-300 ring-2 ring-rose-100" title="삐- 소리 있음" />
                                        ) : (
                                          <span className="text-slate-200 text-xs">-</span>
                                        )}
                                      </div>
                                    </td>

                                    {/* 어지러움 */}
                                    <td className="py-3 px-0.5 text-center">
                                      <div className="flex justify-center">
                                        {hasDizzy ? (
                                          <div className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 rounded-full bg-rose-500 shadow-sm border border-rose-300 ring-2 ring-rose-100" title="어지러움 있음" />
                                        ) : (
                                          <span className="text-slate-200 text-xs">-</span>
                                        )}
                                      </div>
                                    </td>

                                    {/* 메모 */}
                                    <td className="py-3 px-1 text-center">
                                      <div className="flex justify-center">
                                        {record.memo && record.memo.trim() ? (
                                          <button
                                            onClick={() => setMemoModal({
                                              title: `${date} ${timeStr} 메모`,
                                              memo: record.memo,
                                              timestamp: record.timestamp
                                            })}
                                            className="p-1 sm:p-1.5 rounded-lg bg-slate-50 border border-slate-100 hover:border-emerald-200 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50/50 transition-all flex items-center justify-center shadow-sm"
                                            title="메모 열기"
                                          >
                                            <FileText size={12} className="sm:w-3.5 sm:h-3.5" />
                                          </button>
                                        ) : (
                                          <span className="text-slate-200 text-xs">-</span>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
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

      {/* Custom Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl border font-medium text-sm w-max max-w-[90vw] ${
              toast.type === 'success'
                ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
                : toast.type === 'error'
                ? 'bg-rose-50 border-rose-100 text-rose-800'
                : 'bg-slate-800 border-slate-700 text-slate-100'
            }`}
          >
            {toast.type === 'success' && <CheckCircle className="text-emerald-500 w-5 h-5 flex-shrink-0" />}
            {toast.type === 'error' && <AlertCircle className="text-rose-500 w-5 h-5 flex-shrink-0" />}
            {toast.type === 'info' && <Clock className="text-slate-300 w-5 h-5 flex-shrink-0" />}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom Confirmation Modal */}
      <AnimatePresence>
        {confirmModal && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmModal(null)}
              className="absolute inset-0 bg-slate-900"
            />
            
            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-slate-100 z-10 flex flex-col gap-4"
            >
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <AlertCircle className="text-emerald-500 w-5 h-5" />
                {confirmModal.title}
              </h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                {confirmModal.message}
              </p>
              <div className="flex gap-3 mt-2">
                <button
                   onClick={() => setConfirmModal(null)}
                  className="flex-1 py-3 px-4 rounded-xl border border-slate-200 text-sm font-bold text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={confirmModal.onConfirm}
                  className="flex-1 py-3 px-4 rounded-xl bg-slate-800 text-sm font-bold text-white hover:bg-slate-900 transition-colors"
                >
                  확인
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Memo Modal */}
      <AnimatePresence>
        {memoModal && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setMemoModal(null)}
              className="absolute inset-0 bg-slate-900"
            />
            
            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-slate-100 z-10 flex flex-col gap-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                  <FileText className="text-emerald-500 w-5 h-5" />
                  {memoModal.title}
                </h3>
                <button
                  onClick={() => setMemoModal(null)}
                  className="p-1 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed bg-slate-50/70 p-4 rounded-xl border border-slate-100 max-h-[250px] overflow-y-auto whitespace-pre-wrap">
                {memoModal.memo}
              </p>
              <div className="flex gap-3 justify-end mt-1">
                <button
                  onClick={() => setMemoModal(null)}
                  className="py-2.5 px-6 rounded-xl bg-slate-800 text-xs font-bold text-white hover:bg-slate-900 transition-colors"
                >
                  닫기
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
