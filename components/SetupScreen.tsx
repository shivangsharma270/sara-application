import React, { useEffect, useState } from 'react';
import { CallScenario, CustomerPersonality, CallConfig, SellerProfile } from '../types';
import { DEFAULT_SCRIPTS } from '../data/defaultScripts';
import { MOCK_SELLERS } from '../data/sellers';

interface SetupScreenProps {
  executiveName: string;
  employeeId: string;
  onStart: (config: CallConfig) => void;
}

const SetupScreen: React.FC<SetupScreenProps> = ({ executiveName, employeeId, onStart }) => {
  const [scenario, setScenario] = useState<CallScenario>(CallScenario.FRESH_OUTBOUND);
  const [personality, setPersonality] = useState<CustomerPersonality>(CustomerPersonality.CURIOUS);
  const [selectedSeller, setSelectedSeller] = useState<SellerProfile>(MOCK_SELLERS[0]);
  
  // Script States
  const [showScripts, setShowScripts] = useState(false);
  const [customerScript, setCustomerScript] = useState('');
  const [executiveScript, setExecutiveScript] = useState('');

  // Load defaults when scenario changes
  useEffect(() => {
    const defaults = DEFAULT_SCRIPTS[scenario];
    setCustomerScript(defaults.customerScript);
    setExecutiveScript(defaults.executiveScript);
  }, [scenario]);

  return (
    <div className="w-full max-w-7xl mx-auto bg-white rounded-2xl shadow-xl p-6 sm:p-10 border border-slate-100 my-4 sm:my-8 relative overflow-hidden">
      
      {/* Decorative */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50 rounded-full -mr-32 -mt-32 z-0"></div>

      <div className="relative z-10 mb-8 sm:mb-10 text-center border-b border-slate-100 pb-6">
        <h1 className="text-3xl sm:text-4xl font-black text-slate-800 mb-2">Simulation Setup</h1>
        <p className="text-slate-500 text-sm sm:text-base">Configure your SARA training session</p>
        <div className="mt-4 inline-flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-full">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">{executiveName} <span className="text-slate-400">|</span> {employeeId}</span>
        </div>
      </div>

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Basic Config */}
        <div className="space-y-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-bold">1</span>
                <label className="text-sm font-bold text-slate-700 uppercase tracking-wide">Call Scenario</label>
            </div>
            <div className="space-y-3">
              {Object.values(CallScenario).map((s) => (
                <button
                  key={s}
                  onClick={() => setScenario(s)}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all duration-200 group ${
                    scenario === s
                      ? 'border-blue-600 bg-blue-50 text-blue-800 shadow-md transform scale-[1.02]'
                      : 'border-slate-100 hover:border-blue-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="font-bold text-sm sm:text-base">{s}</div>
                  <div className={`text-xs mt-1 ${scenario === s ? 'text-blue-600' : 'text-slate-400'}`}>Standard practice flow</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-bold">2</span>
                <label className="text-sm font-bold text-slate-700 uppercase tracking-wide">Customer Personality</label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {Object.values(CustomerPersonality).map((p) => (
                <button
                  key={p}
                  onClick={() => setPersonality(p)}
                  className={`p-3 rounded-lg border-2 text-xs sm:text-sm font-bold transition-all ${
                    personality === p
                      ? 'border-purple-600 bg-purple-50 text-purple-700 shadow-sm'
                      : 'border-slate-100 hover:border-purple-200 hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Middle Column: Seller Selection */}
        <div className="space-y-4">
             <div className="flex items-center gap-2 mb-1">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-bold">3</span>
                <label className="text-sm font-bold text-slate-700 uppercase tracking-wide">Select Seller Data</label>
            </div>
             <div className="flex flex-col gap-3 h-[420px] overflow-y-auto pr-2 crm-scroll">
                {MOCK_SELLERS.map((seller) => (
                  <button
                    key={seller.id}
                    onClick={() => setSelectedSeller(seller)}
                    className={`text-left p-4 rounded-xl border-2 transition-all duration-200 group ${
                        selectedSeller.id === seller.id
                        ? 'border-green-600 bg-green-50 ring-1 ring-green-600 shadow-md'
                        : 'border-slate-100 hover:border-green-200 hover:bg-slate-50'
                    }`}
                  >
                     <div className="flex justify-between items-start">
                        <div className="font-bold text-slate-800 text-sm sm:text-base group-hover:text-green-800 transition-colors">{seller.name}</div>
                        <div className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500 font-mono">{seller.id}</div>
                     </div>
                     <div className="text-xs font-semibold text-slate-600 mt-1">{seller.businessType}</div>
                     <div className="text-xs text-slate-500 mt-2 italic line-clamp-2">{seller.products}</div>
                  </button>
                ))}
             </div>
        </div>

        {/* Right Column: Scripts Config */}
        <div className="space-y-4 lg:border-l border-slate-100 lg:pl-8">
           <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-bold">4</span>
                <label className="text-sm font-bold text-slate-700 uppercase tracking-wide">Configuration</label>
              </div>
              <button 
                onClick={() => setShowScripts(!showScripts)}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline uppercase transition-colors"
              >
                {showScripts ? 'Hide Scripts' : 'Edit Scripts'}
              </button>
           </div>
           
           {!showScripts ? (
             <div className="p-6 bg-slate-50 rounded-xl text-sm text-slate-500 italic border border-slate-100 h-64 flex flex-col justify-center items-center text-center">
               <svg className="w-10 h-10 text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
               <p>SARA is configured with standard training scripts for <strong>{scenario}</strong>.</p>
               <div className="mt-4 pt-4 border-t border-slate-200 w-full">
                   <p className="text-xs font-bold text-slate-400 uppercase mb-1">Target Persona</p>
                   <p className="font-semibold text-slate-700">{selectedSeller.name}</p>
                   <p className="text-xs">{selectedSeller.businessType} | {selectedSeller.location}</p>
               </div>
             </div>
           ) : (
             <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                <div>
                   <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                     Seller Persona (AI Instructions)
                   </label>
                   <textarea
                     value={customerScript}
                     onChange={(e) => setCustomerScript(e.target.value)}
                     className="w-full h-32 sm:h-40 p-3 text-xs border border-slate-200 rounded-lg font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-slate-50"
                     placeholder="Enter how the AI should behave..."
                   />
                </div>
                <div>
                   <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                     Ideal Executive Script (Grading Logic)
                   </label>
                   <textarea
                     value={executiveScript}
                     onChange={(e) => setExecutiveScript(e.target.value)}
                     className="w-full h-32 sm:h-40 p-3 text-xs border border-slate-200 rounded-lg font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-slate-50"
                     placeholder="Enter what the trainee should say..."
                   />
                </div>
             </div>
           )}
        </div>
      </div>

      <div className="mt-10 flex justify-center pb-2">
        <button
          onClick={() => onStart({ executiveName, employeeId, scenario, personality, customerScript, executiveScript, selectedSeller })}
          className="w-full max-w-md bg-slate-900 hover:bg-black text-white py-4 rounded-xl font-bold text-xl shadow-xl shadow-slate-300 transition-all transform hover:-translate-y-1 active:scale-[0.98] flex items-center justify-center gap-3"
        >
          <span>Start SARA Session</span>
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
        </button>
      </div>
    </div>
  );
};

export default SetupScreen;