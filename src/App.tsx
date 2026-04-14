import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileUp, FolderOpen, Play, AlertCircle, Loader2, Terminal as TerminalIcon, ChevronDown, ChevronUp } from 'lucide-react';

export default function App() {
  const [isoPath, setIsoPath] = useState<string | null>(null);
  const [destPath, setDestPath] = useState<string | null>(null);
  const [status, setStatus] = useState<'READY' | 'EXTRACTING' | 'SUCCESS' | 'ERROR'>('READY');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [progress, setProgress] = useState(0);
  const [engineStatus, setEngineStatus] = useState<{ exists: boolean, type: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/engine-status')
      .then(res => res.json())
      .then(data => setEngineStatus(data))
      .catch(() => setEngineStatus({ exists: false, type: 'ERROR' }));
  }, []);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const handleSelectFile = () => {
    fileInputRef.current?.click();
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsoPath(file.name);
      setStatus('READY');
      setProgress(0);
    }
  };

  const handleSelectDest = () => {
    const mockPath = "/volumes/external/titan_r9_output";
    setDestPath(mockPath);
    setStatus('READY');
    setProgress(0);
  };

  const startExtraction = async () => {
    if (!isoPath || !destPath) return;

    setStatus('EXTRACTING');
    setErrorMsg(null);
    setLogs([]);
    setShowLogs(true);
    setProgress(0);

    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isoPath, destinationPath: destPath }),
      });

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            if (data.log) {
              setLogs(prev => [...prev, data.log]);
              
              // Extract percentage from log line (e.g., "Extracting data blocks [25%]...")
              const match = data.log.match(/\[(\d+)%\]/);
              if (match) {
                setProgress(parseInt(match[1], 10));
              } else if (data.log.toLowerCase().includes('complete')) {
                setProgress(100);
              }
            } else if (data.success !== undefined) {
              if (data.success) {
                setStatus('SUCCESS');
                setProgress(100);
              } else {
                setStatus('ERROR');
                setErrorMsg(data.error || 'Extraction failed');
              }
            }
          }
        }
      }
    } catch (err) {
      setStatus('ERROR');
      setErrorMsg(err instanceof Error ? err.message : 'Network error');
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'READY': return 'text-green-500';
      case 'EXTRACTING': return 'text-yellow-500';
      case 'SUCCESS': return 'text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.5)]';
      case 'ERROR': return 'text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]';
      default: return 'text-green-500';
    }
  };

  return (
    <div className="min-h-screen bg-black text-white font-mono flex flex-col items-center justify-center p-6 selection:bg-red-500 selection:text-white overflow-hidden">
      {/* Background Grid Effect */}
      <div className="fixed inset-0 opacity-10 pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(#ff0000 0.5px, transparent 0.5px)', backgroundSize: '20px 20px' }}></div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-zinc-900/90 backdrop-blur-xl border-2 border-red-900/50 p-8 rounded-lg shadow-[0_0_50px_rgba(153,27,27,0.2)] relative overflow-hidden"
      >
        {/* Decorative Corner Accents */}
        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-red-600"></div>
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-red-600"></div>
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-red-600"></div>
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-red-600"></div>

        <header className="text-center mb-6">
          <h1 className="text-3xl font-black tracking-tighter text-red-600 mb-2 italic uppercase">
            TITAN R9 EXTRACTOR
          </h1>
          <div className="h-px w-full bg-gradient-to-r from-transparent via-red-900 to-transparent mb-6"></div>
          
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center justify-center gap-2">
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest">System Status:</span>
              <motion.span 
                key={status}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`text-lg font-bold tracking-widest ${getStatusColor()}`}
              >
                {status === 'EXTRACTING' ? 'PROCESSING...' : status === 'SUCCESS' ? 'SUCCESS!' : status === 'ERROR' ? 'ERROR!' : 'READY'}
              </motion.span>
            </div>

            {/* Visual Progress Bar */}
            <div className="w-full space-y-2">
              <div className="flex justify-between items-end">
                <span className="text-[8px] text-zinc-500 uppercase tracking-widest">Extraction Progress</span>
                <span className={`text-xs font-bold ${progress === 100 ? 'text-green-500' : 'text-red-500'}`}>
                  {progress}%
                </span>
              </div>
              <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden border border-zinc-700 p-[1px]">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  className={`h-full rounded-full ${progress === 100 ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.5)]'}`}
                />
              </div>
            </div>
          </div>
        </header>

        <div className="space-y-8">
          {/* Step 1: ISO Selection */}
          <section className="space-y-2">
            <button 
              onClick={handleSelectFile}
              className="w-full flex items-center justify-between px-4 py-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition-colors group"
            >
              <span className="text-sm font-bold tracking-tight">1. SELECT ISO FILE</span>
              <FileUp size={18} className="text-red-500 group-hover:scale-110 transition-transform" />
            </button>
            <p className="text-xs text-zinc-500 truncate px-1">
              {isoPath || "No file selected"}
            </p>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={onFileChange} 
              className="hidden" 
              accept=".iso"
            />
          </section>

          {/* Step 2: Destination Selection */}
          <section className="space-y-2">
            <button 
              onClick={handleSelectDest}
              className="w-full flex items-center justify-between px-4 py-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition-colors group"
            >
              <span className="text-sm font-bold tracking-tight">2. SELECT DESTINATION</span>
              <FolderOpen size={18} className="text-red-500 group-hover:scale-110 transition-transform" />
            </button>
            <p className="text-xs text-zinc-500 truncate px-1">
              {destPath || "No folder selected"}
            </p>
          </section>

          {/* Step 3: Action Button */}
          <div className="pt-4">
            <AnimatePresence mode="wait">
              {status === 'EXTRACTING' ? (
                <motion.div 
                  key="loader"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center py-4"
                >
                  <Loader2 className="w-12 h-12 text-red-600 animate-spin mb-2" />
                  <span className="text-[10px] text-zinc-500 animate-pulse">EXTRACTING DATA STREAM...</span>
                </motion.div>
              ) : (
                <motion.button
                  key="button"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={!isoPath || !destPath}
                  onClick={startExtraction}
                  className={`w-full py-4 font-black text-xl tracking-tighter transition-all flex items-center justify-center gap-3
                    ${(!isoPath || !destPath) 
                      ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed border border-zinc-700' 
                      : 'bg-red-600 hover:bg-red-500 text-white shadow-[0_0_20px_rgba(220,38,38,0.4)] border-b-4 border-red-800 active:border-b-0 active:translate-y-1'
                    }`}
                >
                  <Play size={20} fill="currentColor" />
                  3. START EXTRACTION
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Terminal Logs */}
        <div className="mt-8 border-t border-zinc-800 pt-4">
          <button 
            onClick={() => setShowLogs(!showLogs)}
            className="flex items-center gap-2 text-[10px] text-zinc-500 uppercase tracking-widest hover:text-red-500 transition-colors mb-2"
          >
            <TerminalIcon size={12} />
            Process Logs
            {showLogs ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          
          <AnimatePresence>
            {showLogs && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 160, opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="bg-black/50 border border-zinc-800 rounded p-3 overflow-y-auto font-mono text-[10px] leading-relaxed scrollbar-thin scrollbar-thumb-red-900 scrollbar-track-transparent"
              >
                {logs.length === 0 ? (
                  <span className="text-zinc-700 italic">Waiting for process initialization...</span>
                ) : (
                  logs.map((log, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="text-red-900 shrink-0">[{i.toString().padStart(3, '0')}]</span>
                      <span className={log.startsWith('ERROR') ? 'text-red-500' : 'text-zinc-400'}>
                        {log}
                      </span>
                    </div>
                  ))
                )}
                <div ref={logEndRef} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Error Message */}
        {errorMsg && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-6 p-3 bg-red-900/20 border border-red-900/50 rounded flex items-start gap-3"
          >
            <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
            <p className="text-[10px] text-red-400 leading-relaxed uppercase">
              {errorMsg}
            </p>
          </motion.div>
        )}

        {/* Footer Info */}
        <footer className="mt-10 flex justify-between items-end border-t border-zinc-800 pt-4">
          <div className="space-y-1">
            <div className="text-[8px] text-zinc-600 uppercase leading-tight">
              Titan R9 Core v2.4.0<br />
              Secure Extraction Protocol
            </div>
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${engineStatus?.exists ? (engineStatus.type === 'NATIVE' ? 'bg-green-500' : 'bg-yellow-500') : 'bg-red-500'} animate-pulse`}></div>
              <span className="text-[7px] text-zinc-500 uppercase tracking-tighter">
                Engine: {engineStatus?.type || 'CHECKING...'}
              </span>
            </div>
          </div>
          <div className="flex gap-1">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className={`w-1 h-3 ${status === 'SUCCESS' ? 'bg-green-500' : 'bg-red-900'}`}></div>
            ))}
          </div>
        </footer>
      </motion.div>

      {/* Decorative Elements */}
      <div className="mt-8 text-[10px] text-zinc-700 tracking-[0.5em] uppercase font-bold">
        Restricted Access Only
      </div>
    </div>
  );
}

