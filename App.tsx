
import React, { useState } from 'react';
import LoginScreen from './components/LoginScreen';
import SetupScreen from './components/SetupScreen';
import ActiveCallScreen from './components/ActiveCallScreen';
import FeedbackScreen from './components/FeedbackScreen';
import { CallConfig, EvaluationResult } from './types';
import { generateEvaluation } from './services/evaluationService';
import { sendReportEmail } from './services/emailService';

type AppState = 'LOGIN' | 'SETUP' | 'CALL' | 'ANALYZING' | 'FEEDBACK';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>('LOGIN');
  const [user, setUser] = useState<{name: string, id: string} | null>(null);
  const [config, setConfig] = useState<CallConfig | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [lastTranscript, setLastTranscript] = useState<string>('');
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const handleLogin = (name: string, id: string) => {
    setUser({ name, id });
    setAppState('SETUP');
  };

  const handleLogout = () => {
      setUser(null);
      setConfig(null);
      setEvaluation(null);
      setLastTranscript('');
      setRecordingUrl(null);
      setEmailStatus('idle');
      setAppState('LOGIN');
  };

  const handleStartCall = (newConfig: CallConfig) => {
    setConfig(newConfig);
    setAppState('CALL');
  };

  const handleEndCall = async (transcript: string, duration: number, recordingBlob: Blob | null) => {
    setAppState('ANALYZING');
    setLastTranscript(transcript);
    setEmailStatus('idle');
    
    // Process Recording
    if (recordingBlob) {
        const url = URL.createObjectURL(recordingBlob);
        setRecordingUrl(url);
    } else {
        setRecordingUrl(null);
    }
    
    // Save locally as proof
    if (config && user) {
        const sessionProof = {
            id: Date.now().toString(),
            date: new Date().toISOString(),
            executive: user.name,
            employeeId: user.id,
            transcript: transcript,
            scenario: config.scenario
        };
        try {
            const history = JSON.parse(localStorage.getItem('sara_history') || '[]');
            history.unshift(sessionProof);
            localStorage.setItem('sara_history', JSON.stringify(history.slice(0, 50))); // Keep last 50
        } catch (e) {
            console.error("Failed to save local proof", e);
        }
    }

    if (config) {
        try {
            // If the call was too short and transcript is empty, provide minimum context
            const textToAnalyze = transcript.trim().length > 10 
                ? transcript 
                : "The call ended immediately without significant conversation.";

            const result = await generateEvaluation(textToAnalyze, config, duration);
            setEvaluation(result);
            setAppState('FEEDBACK');
            
            // Auto Send Email
            setEmailStatus('sending');
            // Simplified call - no transcript passed to email service
            sendReportEmail(config, result).then(success => {
                setEmailStatus(success ? 'sent' : 'error');
            });

        } catch (error) {
            console.error("Evaluation failed", error);
            alert("Failed to generate evaluation. Please try again.");
            setAppState('SETUP');
        }
    }
  };

  const handleRestart = () => {
    setConfig(null);
    setEvaluation(null);
    setLastTranscript('');
    setRecordingUrl(null);
    setEmailStatus('idle');
    setAppState('SETUP');
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 py-3 px-4 sm:px-6 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
                <img 
                  src="components/imlogo.jpg" 
                  alt="IndiaMART" 
                  className="h-8 sm:h-9 object-contain"
                />
                <div className="hidden sm:block h-8 w-px bg-gray-200 mx-2"></div>
                <div className="hidden sm:flex flex-col justify-center">
                    <span className="font-black text-lg text-slate-800 leading-none tracking-tight">SARA</span>
                    <span className="text-[10px] text-slate-500 font-bold tracking-widest uppercase">Skill Assessment Responsive Agent</span>
                </div>
            </div>
            {user && appState !== 'LOGIN' && (
               <div className="flex items-center gap-4">
                 <div className="flex items-center gap-3 pl-4 border-l border-gray-100">
                    <div className="flex flex-col items-end">
                        <span className="text-xs font-bold text-gray-700">{user.name}</span>
                        <span className="text-[10px] text-gray-400">{user.id}</span>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-red-700 text-white flex items-center justify-center font-bold text-sm shadow-sm ring-2 ring-white">
                        {user.name.charAt(0)}
                    </div>
                 </div>
                 <button 
                    onClick={handleLogout}
                    className="text-xs text-red-600 hover:text-red-800 font-bold border border-red-100 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-full transition-colors"
                 >
                    Logout
                 </button>
               </div>
            )}
        </div>
      </header>

      <main className="flex-grow max-w-7xl mx-auto w-full py-4 sm:py-6 px-4 sm:px-6 lg:px-8">
        {appState === 'LOGIN' && (
            <LoginScreen onLogin={handleLogin} />
        )}

        {appState === 'SETUP' && user && (
            <div className="h-full flex items-center justify-center">
                <SetupScreen 
                  executiveName={user.name} 
                  employeeId={user.id} 
                  onStart={handleStartCall} 
                />
            </div>
        )}

        {appState === 'CALL' && config && (
            <ActiveCallScreen config={config} onEndCall={handleEndCall} />
        )}

        {appState === 'ANALYZING' && (
             <div className="h-[60vh] flex flex-col items-center justify-center">
                <div className="relative">
                    <div className="w-20 h-20 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                         <span className="text-2xl">🧠</span>
                    </div>
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mt-6 mb-2">SARA is analyzing your call...</h2>
                <p className="text-gray-500 text-center px-4 max-w-md">Evaluating pitch adherence, objection handling, and communication skills against IndiaMART standards.</p>
             </div>
        )}

        {appState === 'FEEDBACK' && evaluation && config && user && (
            <FeedbackScreen 
                result={evaluation} 
                config={config} 
                transcript={lastTranscript}
                recordingUrl={recordingUrl}
                emailStatus={emailStatus}
                onRestart={handleRestart} 
            />
        )}
      </main>
    </div>
  );
};

export default App;
