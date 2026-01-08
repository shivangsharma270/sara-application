
import React, { useState, useRef } from 'react';
import { EvaluationResult, CallConfig } from '../types';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface FeedbackScreenProps {
  result: EvaluationResult;
  config: CallConfig;
  transcript: string;
  recordingUrl: string | null;
  emailStatus: 'idle' | 'sending' | 'sent' | 'error';
  onRestart: () => void;
}

const FeedbackScreen: React.FC<FeedbackScreenProps> = ({ result, config, transcript, recordingUrl, emailStatus, onRestart }) => {
  const [showTranscript, setShowTranscript] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const handleDownloadPdf = async () => {
    if (!reportRef.current) return;
    
    setIsDownloading(true);
    
    try {
        const canvas = await html2canvas(reportRef.current, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff'
        });

        const imgData = canvas.toDataURL('image/png');
        
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`SARA_Report_${config.employeeId}.pdf`);

    } catch (error) {
        console.error("PDF Generation failed:", error);
        alert("Failed to generate PDF. Please try taking a screenshot manually.");
    } finally {
        setIsDownloading(false);
    }
  };

  const handleSendEmail = () => {
      const subject = `SORA Audit Report: ${config.employeeId}`;
      const body = `Overall Score: ${result.overallScore}/100\n\nSummary:\n${result.summary}`;
      window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6 sm:space-y-8 pb-12 w-full">
      
      {/* Email Status Toast */}
      {emailStatus !== 'idle' && (
          <div className={`fixed top-20 right-4 z-50 px-6 py-3 rounded-lg shadow-xl border flex items-center gap-3 transition-all transform duration-500 ${
              emailStatus === 'sent' ? 'bg-green-100 border-green-200 text-green-800' :
              emailStatus === 'error' ? 'bg-red-100 border-red-200 text-red-800' :
              'bg-blue-100 border-blue-200 text-blue-800'
          }`}>
              {emailStatus === 'sending' && <span className="font-bold animate-pulse">Sending Report...</span>}
              {emailStatus === 'sent' && <span className="font-bold">Report Emailed!</span>}
              {emailStatus === 'error' && <span className="font-bold">Email Failed.</span>}
          </div>
      )}

      {/* Short Call Warning */}
      {result.isShortCall && result.overallScore > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg text-sm font-bold flex items-center gap-2">
             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
             Call was very short ({config.selectedSeller.products}). Data may be limited.
          </div>
      )}

      {/* Main Scorecard for Printing/PDF */}
      <div ref={reportRef} className="bg-white rounded-xl shadow-lg overflow-hidden print:shadow-none print:border print:border-gray-300">
        
        {/* Header */}
        <div className="bg-slate-900 p-6 sm:p-8 text-white flex flex-col sm:flex-row justify-between items-center print:bg-white print:text-black print:border-b gap-4">
          <div className="text-center sm:text-left w-full">
            <h1 className="text-3xl font-black tracking-tight">SARA Audit Report</h1>
            <p className="opacity-80 text-sm print:text-gray-600 font-medium">
               Exec: {config.executiveName} ({config.employeeId}) | Scenario: {config.scenario}
            </p>
          </div>
          {/* Total Score removed as requested */}
        </div>

        {/* Audio Recording Player */}
        {recordingUrl && (
            <div className="mx-6 sm:mx-8 mt-6 p-4 rounded-xl border flex flex-col gap-2 bg-blue-50 border-blue-100">
                <h3 className="text-xs font-bold text-blue-800 uppercase tracking-wide flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                    Call Recording
                </h3>
                <audio controls src={recordingUrl} className="w-full h-10" />
            </div>
        )}

        {/* Meeting Status */}
        <div className="mx-6 sm:mx-8 mt-6 p-4 rounded-xl border flex items-center justify-between bg-slate-50 border-slate-200">
             <div>
                 <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Meeting Status</h3>
                 <div className="text-xl font-bold text-slate-800">
                     {result.meetingFixed ? (
                         <span className="text-green-600 flex items-center gap-2">Meeting Fixed ✅</span>
                     ) : (
                         <span className="text-slate-400">No Meeting Fixed ❌</span>
                     )}
                 </div>
             </div>
             {result.meetingFixed && result.meetingTime && (
                 <div className="text-right">
                     <span className="text-xs text-slate-500 uppercase block tracking-wide mb-1">Scheduled Time</span>
                     <span className="text-xl font-mono font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded">{result.meetingTime}</span>
                 </div>
             )}
        </div>

        {/* Sentiment Analysis Bar */}
        {result.sentiment && (
        <div className="mx-6 sm:mx-8 mt-6 p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                Executive Tone & Quality
            </h3>
            <div className="flex justify-between items-end mb-2">
                <span className={`text-lg font-bold ${result.sentiment.score >= 80 ? 'text-green-600' : 'text-orange-600'}`}>
                    {result.sentiment.label}
                </span>
                <span className="text-xl font-black text-slate-800">{result.sentiment.score}<span className="text-sm text-slate-400">/100</span></span>
            </div>
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                <div 
                    className={`h-full rounded-full transition-all duration-1000 ${result.sentiment.score >= 80 ? 'bg-green-500' : 'bg-orange-500'}`}
                    style={{ width: `${result.sentiment.score}%` }}
                ></div>
            </div>
            <p className="mt-2 text-sm text-slate-600 italic">"{result.sentiment.analysis}"</p>
        </div>
        )}

        {/* DETAILED AUDIT TABLE (Per PDF) */}
        <div className="p-6 sm:p-8">
            <h3 className="text-lg font-bold text-slate-800 mb-4 uppercase tracking-wide border-b border-slate-200 pb-2">
                Detailed Audit Parameters
            </h3>
            
            <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse border border-slate-200">
                    <thead className="bg-yellow-300 text-black font-bold uppercase text-xs">
                        <tr>
                            <th className="p-3 border border-slate-300 text-left w-1/4">Category</th>
                            <th className="p-3 border border-slate-300 text-left w-1/2">Call Audit Parameter</th>
                            <th className="p-3 border border-slate-300 text-center w-1/4">Score</th>
                        </tr>
                    </thead>
                    <tbody>
                        {result.auditReport.map((category, catIndex) => (
                            <React.Fragment key={catIndex}>
                                {category.items.map((item, itemIndex) => (
                                    <tr key={`${catIndex}-${itemIndex}`} className="hover:bg-slate-50">
                                        {/* Merge Category Cell */}
                                        {itemIndex === 0 && (
                                            <td 
                                                rowSpan={category.items.length} 
                                                className="p-3 border border-slate-300 font-bold bg-slate-50 align-top text-slate-700"
                                            >
                                                {category.category}
                                                <div className="mt-2 text-[10px] bg-slate-200 px-2 py-1 rounded inline-block">
                                                    Cat Score: {category.totalScore}/{category.maxTotalScore}
                                                </div>
                                            </td>
                                        )}
                                        <td className="p-3 border border-slate-300 text-slate-700">
                                            <div className="font-medium">{item.parameter}</div>
                                            {item.remarks && <div className="text-xs text-slate-500 mt-1 italic">Note: {item.remarks}</div>}
                                        </td>
                                        <td className="p-3 border border-slate-300 text-center font-bold">
                                            <span className={`${item.score === item.maxScore ? 'text-green-600' : item.score === 0 ? 'text-red-600' : 'text-yellow-600'}`}>
                                                {item.score}
                                            </span>
                                            <span className="text-slate-400 text-xs"> / {item.maxScore}</span>
                                        </td>
                                    </tr>
                                ))}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>

        {/* Strengths & Improvements */}
        <div className="px-6 sm:px-8 pb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-green-50 p-6 rounded-xl border border-green-100">
                <h3 className="font-bold text-green-800 mb-2">Strengths</h3>
                <ul className="list-disc list-inside text-sm text-green-700 space-y-1">
                    {result.strengths.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
            </div>
            <div className="bg-orange-50 p-6 rounded-xl border border-orange-100">
                <h3 className="font-bold text-orange-800 mb-2">Areas for Improvement</h3>
                <ul className="list-disc list-inside text-sm text-orange-700 space-y-1">
                    {result.improvements.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
            </div>
        </div>

        <div className="bg-slate-100 p-4 mx-6 mb-8 rounded-lg text-sm text-slate-600 italic">
             <strong>Summary:</strong> {result.summary}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
        <button onClick={handleSendEmail} className="bg-blue-600 text-white px-6 py-4 rounded-xl font-bold shadow-lg hover:bg-blue-700">Email Report</button>
        <button onClick={handleDownloadPdf} disabled={isDownloading} className="bg-white border border-slate-300 text-slate-700 px-6 py-4 rounded-xl font-bold shadow-sm hover:bg-slate-50">
            {isDownloading ? 'Generating PDF...' : 'Download PDF'}
        </button>
        <button onClick={onRestart} className="bg-slate-900 text-white px-8 py-4 rounded-xl font-bold shadow-lg hover:bg-black">New Session</button>
      </div>
    </div>
  );
};

export default FeedbackScreen;
