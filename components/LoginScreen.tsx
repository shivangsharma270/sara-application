import React, { useState } from 'react';

interface LoginScreenProps {
  onLogin: (name: string, id: string) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [name, setName] = useState('');
  const [id, setId] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && id.trim()) {
      onLogin(name, id);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-gray-100 relative overflow-hidden">
        
        {/* Decorative Top Bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-red-600 via-purple-600 to-blue-600"></div>

        <div className="text-center mb-8 mt-2">
           <img 
             src="components/imlogo.jpg" 
             alt="IndiaMART" 
             className="h-12 mx-auto mb-6 object-contain"
           />
           <h2 className="text-3xl font-black text-slate-800 tracking-tight">SARA</h2>
           <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1 mb-2">Skill Assessment Responsive Agent</p>
           <p className="text-slate-400 text-sm">Log in to start your training simulation</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1 ml-1">Employee Name</label>
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                </div>
                <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Shivang Sharma"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all bg-gray-50 text-gray-900 placeholder-gray-400 font-medium"
                />
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1 ml-1">Employee ID</label>
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0c0 .883-.393 6.32-6.32 6.32" /></svg>
                </div>
                <input
                type="text"
                required
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="e.g. IM-12345"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all bg-gray-50 text-gray-900 placeholder-gray-400 font-medium"
                />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-slate-900 hover:bg-black text-white font-bold py-4 rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 active:scale-[0.98] mt-4"
          >
            Start Session
          </button>
        </form>
      </div>
      <p className="mt-8 text-xs text-gray-400">© IndiaMART InterMESH Ltd. All rights reserved.</p>
    </div>
  );
};

export default LoginScreen;