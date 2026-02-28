import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  Upload, 
  FileText, 
  Play, 
  Pause, 
  RotateCcw, 
  Download, 
  Settings, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  AlertCircle,
  ChevronRight,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { extractDataFromPdf, Question, ExtractionResult } from './services/gemini';
import { cn, downloadJson, fileToBase64 } from './utils';

interface FileItem {
  file: File;
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  error?: string;
  result?: Question[];
}

export default function App() {
  const [apiKeys, setApiKeys] = useState<string[]>([]);
  const [newKey, setNewKey] = useState('');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentFileIndex, setCurrentFileIndex] = useState<number | null>(null);
  const [logs, setLogs] = useState<ExtractionResult[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const processingRef = useRef(false);

  // Load API keys from localStorage on mount
  useEffect(() => {
    const savedKeys = localStorage.getItem('gemini_api_keys');
    if (savedKeys) {
      try {
        setApiKeys(JSON.parse(savedKeys));
      } catch (e) {
        console.error('Failed to parse saved API keys');
      }
    }
  }, []);

  // Save API keys to localStorage
  useEffect(() => {
    localStorage.setItem('gemini_api_keys', JSON.stringify(apiKeys));
  }, [apiKeys]);

  const addApiKey = () => {
    if (newKey.trim() && !apiKeys.includes(newKey.trim())) {
      setApiKeys([...apiKeys, newKey.trim()]);
      setNewKey('');
    }
  };

  const removeApiKey = (index: number) => {
    setApiKeys(apiKeys.filter((_, i) => i !== index));
  };

  const handleFolderUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles) return;

    const fileList = Array.from(uploadedFiles) as File[];
    const pdfFiles = fileList.filter(f => f.type === 'application/pdf');
    const newFileItems: FileItem[] = pdfFiles.map(file => ({
      file,
      id: Math.random().toString(36).substring(7),
      status: 'pending'
    }));

    setFiles(prev => [...prev, ...newFileItems]);
  };

  const processNextFile = useCallback(async () => {
    if (!processingRef.current || apiKeys.length === 0) {
      setIsProcessing(false);
      return;
    }

    const nextIndex = files.findIndex(f => f.status === 'pending' || f.status === 'error');
    
    if (nextIndex === -1) {
      setIsProcessing(false);
      processingRef.current = false;
      return;
    }

    setCurrentFileIndex(nextIndex);
    const fileItem = files[nextIndex];
    
    // Update status to processing
    setFiles(prev => prev.map((f, i) => i === nextIndex ? { ...f, status: 'processing' } : f));

    try {
      const base64 = await fileToBase64(fileItem.file);
      // Use keys in rotation or just pick the first one for now
      // A more complex implementation would handle rate limits across keys
      const apiKey = apiKeys[nextIndex % apiKeys.length];
      
      const questions = await extractDataFromPdf(base64, apiKey);
      
      setFiles(prev => prev.map((f, i) => i === nextIndex ? { ...f, status: 'completed', result: questions } : f));
      
      const logEntry: ExtractionResult = {
        fileName: fileItem.file.name,
        questions,
        status: 'success',
        timestamp: Date.now()
      };
      
      setLogs(prev => [logEntry, ...prev]);

      // Auto download
      downloadJson(questions, `${fileItem.file.name.replace('.pdf', '')}_extracted.json`);

    } catch (error: any) {
      console.error(`Error processing ${fileItem.file.name}:`, error);
      setFiles(prev => prev.map((f, i) => i === nextIndex ? { ...f, status: 'error', error: error.message } : f));
      
      setLogs(prev => [{
        fileName: fileItem.file.name,
        questions: [],
        status: 'error',
        errorMessage: error.message,
        timestamp: Date.now()
      }, ...prev]);
    }

    // Small delay to prevent UI freezing and respect rate limits slightly
    setTimeout(() => {
      if (processingRef.current) processNextFile();
    }, 1000);
  }, [files, apiKeys]);

  const startProcessing = () => {
    if (apiKeys.length === 0) {
      alert('Please add at least one API key in settings.');
      setShowSettings(true);
      return;
    }
    setIsProcessing(true);
    processingRef.current = true;
    processNextFile();
  };

  const stopProcessing = () => {
    setIsProcessing(false);
    processingRef.current = false;
  };

  const retryFailed = () => {
    setFiles(prev => prev.map(f => f.status === 'error' ? { ...f, status: 'pending', error: undefined } : f));
    if (!isProcessing) {
      setIsProcessing(true);
      processingRef.current = true;
      processNextFile();
    }
  };

  const clearFiles = () => {
    setFiles([]);
    setCurrentFileIndex(null);
    setIsProcessing(false);
    processingRef.current = false;
  };

  return (
    <div className="min-h-screen bg-[#F5F5F4] text-[#141414] font-sans">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-[#141414]/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-[#141414] p-2 rounded-lg">
            <FileText className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">PDF Quiz Extractor</h1>
            <p className="text-xs text-[#141414]/50 font-medium uppercase tracking-wider">Batch Processing Dashboard</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 hover:bg-[#141414]/5 rounded-full transition-colors relative"
          >
            <Settings className="w-5 h-5" />
            {apiKeys.length === 0 && (
              <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
            )}
          </button>
          
          <div className="h-8 w-px bg-[#141414]/10 mx-2" />
          
          {isProcessing ? (
            <button 
              onClick={stopProcessing}
              className="flex items-center gap-2 bg-amber-100 text-amber-900 px-4 py-2 rounded-full font-semibold text-sm hover:bg-amber-200 transition-colors"
            >
              <Pause className="w-4 h-4" /> Stop
            </button>
          ) : (
            <button 
              onClick={startProcessing}
              disabled={files.length === 0 || files.every(f => f.status === 'completed')}
              className="flex items-center gap-2 bg-[#141414] text-white px-6 py-2 rounded-full font-semibold text-sm hover:bg-[#141414]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="w-4 h-4" /> Start Processing
            </button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: File List */}
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-white rounded-2xl border border-[#141414]/10 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-[#141414]/10 flex items-center justify-between bg-[#141414]/[0.02]">
              <h2 className="font-bold flex items-center gap-2">
                Queue <span className="text-xs bg-[#141414]/10 px-2 py-0.5 rounded-full">{files.length}</span>
              </h2>
              <div className="flex items-center gap-2">
                <label className="cursor-pointer flex items-center gap-2 bg-white border border-[#141414]/10 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-[#141414]/5 transition-colors">
                  <Upload className="w-4 h-4" />
                  Upload Folder
                  <input 
                    type="file" 
                    className="hidden" 
                    webkitdirectory="" 
                    directory="" 
                    multiple 
                    onChange={handleFolderUpload}
                  />
                </label>
                <button 
                  onClick={clearFiles}
                  className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                  title="Clear all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="max-h-[600px] overflow-y-auto">
              {files.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center text-[#141414]/40">
                  <Upload className="w-12 h-12 mb-4 opacity-20" />
                  <p className="font-medium">No PDFs uploaded yet</p>
                  <p className="text-sm">Upload a folder containing PDF quizzes to begin</p>
                </div>
              ) : (
                <div className="divide-y divide-[#141414]/5">
                  {files.map((item, idx) => (
                    <div 
                      key={item.id} 
                      className={cn(
                        "p-4 flex items-center justify-between transition-colors",
                        currentFileIndex === idx && "bg-blue-50/50"
                      )}
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                          item.status === 'completed' ? "bg-green-100 text-green-700" :
                          item.status === 'error' ? "bg-red-100 text-red-700" :
                          item.status === 'processing' ? "bg-blue-100 text-blue-700" :
                          "bg-[#141414]/5 text-[#141414]/40"
                        )}>
                          {item.status === 'processing' ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : item.status === 'completed' ? (
                            <CheckCircle2 className="w-5 h-5" />
                          ) : item.status === 'error' ? (
                            <XCircle className="w-5 h-5" />
                          ) : (
                            <FileText className="w-5 h-5" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{item.file.name}</p>
                          <p className="text-xs text-[#141414]/50">
                            {(item.file.size / 1024 / 1024).toFixed(2)} MB • {item.status}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {item.status === 'completed' && (
                          <button 
                            onClick={() => downloadJson(item.result, item.file.name)}
                            className="p-2 hover:bg-[#141414]/5 rounded-lg text-[#141414]/60"
                            title="Download JSON"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        )}
                        {item.status === 'error' && (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-red-600 uppercase bg-red-50 px-2 py-1 rounded">Error</span>
                            <button 
                              onClick={() => {
                                setFiles(prev => prev.map((f, i) => i === idx ? { ...f, status: 'pending' } : f));
                                if (!isProcessing) startProcessing();
                              }}
                              className="p-2 hover:bg-[#141414]/5 rounded-lg text-[#141414]/60"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Right Column: Logs & Settings */}
        <div className="space-y-6">
          {/* Settings / API Keys */}
          <AnimatePresence>
            {showSettings && (
              <motion.section 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-white rounded-2xl border border-[#141414]/10 overflow-hidden shadow-lg"
              >
                <div className="p-4 border-b border-[#141414]/10 bg-[#141414] text-white flex items-center justify-between">
                  <h2 className="font-bold flex items-center gap-2">
                    <Settings className="w-4 h-4" /> API Configuration
                  </h2>
                  <button onClick={() => setShowSettings(false)} className="text-white/60 hover:text-white">
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-4 space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#141414]/50">Add Gemini API Key</label>
                    <div className="flex gap-2">
                      <input 
                        type="password"
                        value={newKey}
                        onChange={(e) => setNewKey(e.target.value)}
                        placeholder="Enter API Key..."
                        className="flex-1 bg-[#141414]/5 border border-[#141414]/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#141414]/20"
                      />
                      <button 
                        onClick={addApiKey}
                        className="bg-[#141414] text-white p-2 rounded-lg hover:bg-[#141414]/90"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#141414]/50">Active Keys ({apiKeys.length})</label>
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                      {apiKeys.length === 0 ? (
                        <p className="text-xs italic text-[#141414]/40">No keys added yet. Keys are stored locally.</p>
                      ) : (
                        apiKeys.map((key, idx) => (
                          <div key={idx} className="flex items-center justify-between bg-[#141414]/5 p-2 rounded-lg group">
                            <span className="text-xs font-mono truncate max-w-[150px]">
                              {key.substring(0, 8)}••••••••{key.substring(key.length - 4)}
                            </span>
                            <button 
                              onClick={() => removeApiKey(idx)}
                              className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          {/* Logs */}
          <section className="bg-white rounded-2xl border border-[#141414]/10 overflow-hidden shadow-sm flex flex-col h-[calc(100vh-250px)]">
            <div className="p-4 border-b border-[#141414]/10 flex items-center justify-between bg-[#141414]/[0.02]">
              <h2 className="font-bold">Activity Log</h2>
              <button 
                onClick={retryFailed}
                className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" /> Retry Failed
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {logs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-[#141414]/30 text-center">
                  <AlertCircle className="w-8 h-8 mb-2 opacity-20" />
                  <p className="text-xs font-medium">No activity recorded</p>
                </div>
              ) : (
                logs.map((log, idx) => (
                  <div 
                    key={idx} 
                    className={cn(
                      "border rounded-xl transition-all overflow-hidden",
                      log.status === 'success' ? "border-green-100 bg-green-50/30" : "border-red-100 bg-red-50/30"
                    )}
                  >
                    <button 
                      onClick={() => setExpandedLog(expandedLog === log.fileName ? null : log.fileName)}
                      className="w-full p-3 flex items-center justify-between text-left"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate">{log.fileName}</p>
                        <p className="text-[10px] text-[#141414]/50">
                          {new Date(log.timestamp).toLocaleTimeString()} • {log.status === 'success' ? `${log.questions.length} questions` : 'Failed'}
                        </p>
                      </div>
                      {expandedLog === log.fileName ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                    </button>
                    
                    <AnimatePresence>
                      {expandedLog === log.fileName && (
                        <motion.div 
                          initial={{ height: 0 }}
                          animate={{ height: 'auto' }}
                          exit={{ height: 0 }}
                          className="px-3 pb-3 overflow-hidden"
                        >
                          {log.status === 'error' ? (
                            <div className="bg-red-100/50 p-2 rounded-lg text-[10px] text-red-700 font-mono">
                              {log.errorMessage}
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {log.questions.slice(0, 3).map((q, qIdx) => (
                                <div key={qIdx} className="text-[10px] border-l-2 border-green-500 pl-2 py-1">
                                  <p className="font-bold truncate">{q.questionText}</p>
                                  <p className="text-[#141414]/60">Ans: {q.answer}</p>
                                </div>
                              ))}
                              {log.questions.length > 3 && (
                                <p className="text-[10px] text-center text-[#141414]/40 italic">
                                  + {log.questions.length - 3} more questions
                                </p>
                              )}
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Footer / Status Bar */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#141414]/10 px-6 py-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-[#141414]/40">
        <div className="flex items-center gap-4">
          <span>Status: {isProcessing ? 'Processing' : 'Idle'}</span>
          <span>•</span>
          <span>API Keys: {apiKeys.length}</span>
        </div>
        <div>
          {files.length > 0 && (
            <span>
              Progress: {files.filter(f => f.status === 'completed').length} / {files.length}
            </span>
          )}
        </div>
      </footer>
    </div>
  );
}
