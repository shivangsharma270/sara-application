
import React, { useEffect, useRef, useState } from 'react';
import { CallConfig, AudioStatus, CustomerPersonality, CallScenario } from '../types';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { base64ToUint8Array, createBlob, decodeAudioData } from '../utils/audioUtils';

// Constants for audio processing
const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;

interface ActiveCallScreenProps {
  config: CallConfig;
  onEndCall: (transcript: string, durationSeconds: number, recordingBlob: Blob | null) => void;
}

const ActiveCallScreen: React.FC<ActiveCallScreenProps> = ({ config, onEndCall }) => {
  const [status, setStatus] = useState<AudioStatus>('idle');
  const [subStatus, setSubStatus] = useState<string>('Initializing...');
  const [transcript, setTranscript] = useState<string>('');
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [volume, setVolume] = useState(0); 
  const [duration, setDuration] = useState(0); 
  const [isMicMuted, setIsMicMuted] = useState(false);
  
  // Refs
  const audioContextsRef = useRef<{ input: AudioContext; output: AudioContext } | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Use number for timer refs in browser environment
  const timerRef = useRef<number | null>(null);
  const isUserEndingCallRef = useRef(false); 
  const stopRingtoneRef = useRef<(() => void) | null>(null);

  // Recording Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Transcription Accumulators
  const currentInputRef = useRef('');
  const currentOutputRef = useRef('');

  const playRingtone = (ctx: AudioContext) => {
    // Standard Phone Ringing (Dual Tone Multi-Frequency or similar simulation)
    // US Ring: 440Hz + 480Hz
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.frequency.value = 440;
    osc2.frequency.value = 480;

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    // Initial silence
    gain.gain.setValueAtTime(0, now);

    // Ring pattern: 2s ON, 4s OFF
    for(let i=0; i<4; i++) {
        const start = now + 0.5 + (i * 6); // Start slightly delayed
        const end = start + 2;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.15, start + 0.1); // Fade in slightly
        gain.gain.setValueAtTime(0.15, end);
        gain.gain.linearRampToValueAtTime(0, end + 0.1); // Fade out
    }

    osc1.start();
    osc2.start();

    return () => {
        try {
            osc1.stop();
            osc2.stop();
            osc1.disconnect();
            osc2.disconnect();
            gain.disconnect();
        } catch(e) {}
    };
  };

  /**
   * 1. SELLER MOOD ENGINE
   * Defines specific behavioral traits based on selected personality.
   */
  const getPersonalityInstructions = (personality: CustomerPersonality) => {
    switch (personality) {
      case CustomerPersonality.CURIOUS:
        return `
          MOOD: CURIOUS
          - Asks multiple exploratory questions
          - Shows genuine interest
          - Engaged, attentive tone
          - Willing to listen to details
        `;
      case CustomerPersonality.UNINTERESTED:
        return `
          MOOD: UNINTERESTED
          - Disconnected, passive, distracted
          - Low-energy replies
          - Acts as if busy or not invested
          - Tries to cut the call short
        `;
      case CustomerPersonality.ANGRY:
        return `
          MOOD: ANGRY
          - Irritated, short responses
          - Emotional tone swings
          - Low patience, interrupts the salesperson
          - Complains about spam/previous bad experiences
        `;
      case CustomerPersonality.PRICE_SENSITIVE:
        return `
          MOOD: PRICE SENSITIVE
          - Bargains, negotiates
          - Constant ROI questions
          - Skeptical and analytical
          - Wary of spending money without clear benefit
        `;
      default:
        return `MOOD: Professional but busy`;
    }
  };

  /**
   * 2. CALL SCENARIO LOGIC
   * Defines how the seller reacts based on whether it's a fresh call or follow-up.
   */
  const getScenarioInstructions = (scenario: CallScenario) => {
     if (scenario === CallScenario.FOLLOW_UP) {
         return `
            SCENARIO: Follow-Up Call (Subsequent Call)
            - You behave like a seller who remembers the previous conversation.
            - **FRIENDLY TONE**: You can be friendlier and warmer because you know the Executive.
            - Refer back to open points: "Haan ji kal aapne bola tha..."
            - Expect updates.
            - Evaluate continuity.
         `;
     }
     return `
        SCENARIO: Fresh Outbound Call (First-Time Call)
        - You act as a busy business owner receiving a cold call.
        - **DO NOT** ask "How did you get my number?" or "Kaise pata chala?". Assume they have your data.
        - **DO NOT** ask "Are you calling from IndiaMART?". Let them introduce themselves.
        - Listen to their opening. If they sound irrelevant, say "I am not interested".
        - If they pitch well, ask "Kya fayda hai?" (What is the benefit?).
        - Keep the flow moving forward.
     `;
  };

  /**
   * 3. OPENING LINE GENERATOR
   * Determines the exact first sentence the AI must speak.
   */
  const getOpeningLine = (scenario: CallScenario, personality: CustomerPersonality, name: string) => {
      if (scenario === CallScenario.FOLLOW_UP) {
          const followUpVariations = [
              `"Haan ji, boliye? Kal baat hui thi na hamari? Kya update hai?"`,
              `"Arre haan, main aapka hi number dhund raha tha. Batayein, kya socha fir aapne?"`,
              `"Hello... haan ji sir. Boliye, proposal check kiya aapne jo bheja tha?"`,
              `"Haan ji namaskar. Boliye, koi final decision liya ya abhi bhi soch rahe hain?"`
          ];
          return followUpVariations[Math.floor(Math.random() * followUpVariations.length)];
      }
      
      // Fresh Call Openings based on Mood
      switch (personality) {
          case CustomerPersonality.CURIOUS: 
              return `"Hello? Haanji, ${name} speaking. Boliye kaun?"`;
          case CustomerPersonality.UNINTERESTED: 
              return `"Hello? Boliye, I am actually in a meeting right now. Jaldi batayein."`;
          case CustomerPersonality.ANGRY: 
              return `"Hello! Again a call? I told you people to stop calling me! Dimag kharab kar rakha hai."`;
          case CustomerPersonality.PRICE_SENSITIVE: 
              return `"Hello. ${name} speaking. Boliye, kis silsile mein call kiya?"`;
          default: 
              return `"Hello, ${name} speaking."`;
      }
  };

  const startSession = async () => {
    isUserEndingCallRef.current = false;
    audioChunksRef.current = [];
    setStatus('connecting');
    setSubStatus('Dialing...');
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      let inputCtx = audioContextsRef.current?.input;
      let outputCtx = audioContextsRef.current?.output;

      if (!inputCtx || inputCtx.state === 'closed') {
         inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: INPUT_SAMPLE_RATE });
      }
      if (!outputCtx || outputCtx.state === 'closed') {
         outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: OUTPUT_SAMPLE_RATE });
      }
      
      audioContextsRef.current = { input: inputCtx, output: outputCtx };
      
      // Start Ringing
      stopRingtoneRef.current = playRingtone(outputCtx);

      // Create Nodes for Audio Graph
      const outputNode = outputCtx.createGain(); // AI Audio
      outputNode.connect(outputCtx.destination); // Play to speakers

      let stream = streamRef.current;
      if (!stream || !stream.active) {
          // ENABLE NOISE REDUCTION
          stream = await navigator.mediaDevices.getUserMedia({ 
              audio: {
                  echoCancellation: true,
                  noiseSuppression: true,
                  autoGainControl: true,
                  channelCount: 1, // Mono is preferred for speech
              } 
          });
          streamRef.current = stream;
      }
      
      // Setup Visualizer
      const analyser = inputCtx.createAnalyser();
      analyser.fftSize = 32;
      const source = inputCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      const updateVolume = () => {
        if (isUserEndingCallRef.current) return;
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setVolume(avg);
        requestAnimationFrame(updateVolume);
      };
      updateVolume();

      // SETUP RECORDING
      // We need to mix User Mic + AI Output into one stream
      const recDest = outputCtx.createMediaStreamDestination();
      
      // 1. Connect AI output to recorder
      outputNode.connect(recDest);
      
      // 2. Connect User Mic to recorder (Create a new source in outputCtx to mix)
      const userMicSource = outputCtx.createMediaStreamSource(stream);
      userMicSource.connect(recDest);

      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const recorder = new MediaRecorder(recDest.stream, { mimeType });
      
      recorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mediaRecorderRef.current = recorder;

      // --- DYNAMIC SYSTEM INSTRUCTION GENERATION ---
      const personalityInstructions = getPersonalityInstructions(config.personality);
      const scenarioInstructions = getScenarioInstructions(config.scenario);
      const openingLine = getOpeningLine(config.scenario, config.personality, config.selectedSeller.name);
      
      const systemInstruction = `
        !!! CRITICAL ROLE ENFORCEMENT !!!
        YOU ARE THE **CUSTOMER** (BUSINESS OWNER). 
        YOU ARE **NOT** THE SALES EXECUTIVE.
        YOU ARE **NOT** CALLING INDIA_MART. INDIA_MART IS CALLING YOU.

        --- 0. ABSOLUTE CONSTRAINTS ---
        - NEVER say "How can I help you?".
        - NEVER say "I am calling from IndiaMART".
        - NEVER say "Do you want to buy a plan?".
        - NEVER ask "How did you get my number?" or "Kaise pata chala?". (Assume they have it).
        - NEVER give advice or feedback during the call.

        --- 1. CORE BEHAVIOR — INDIA’S MOST REALISTIC SELLER PERSONALITY ---
        In every reply, you must sound like a real human seller, not an AI.
        Your dialogue must include:
        - Natural pauses: “uhh…”, “hmm…”, “ek min rukiye…”, “acha…”
        - Indian fillers: “umm”, “dekhiye…”, “matlab…”, “actually…”, “haan haan…”
        - Imperfect speech: incomplete sentences, interruptions, self-corrections
        - Thinking out loud: “let me check yaar…”, “soch raha hoon…”
        - Emotion in voice: irritation, confusion, impatience, excitement, sarcasm
        - Cultural realism: Hindi-English blends, typical Indian expressions
        - Everything must feel spontaneous, not polished.
        - **NO LOOPS**: Do NOT repeatedly ask "Who are you?" or "Kya kaam hai?" if the Executive has already answered. Acknowledge and move to the objection.

        --- 2. SELLER MOOD ENGINE (Strictly Follow this Mood) ---
        ${personalityInstructions}

        --- 3. SELLER IDENTITY (Context) ---
        Name: ${config.selectedSeller.name}
        Business: ${config.selectedSeller.companyName} (${config.selectedSeller.businessType})
        Location: ${config.selectedSeller.location}
        Background Info: ${config.selectedSeller.customInstructions}

        --- 4. CALL SCENARIO ---
        ${scenarioInstructions}

        --- 5. DYNAMIC OBJECTION HANDLING (TIERED PROGRESSION) ---
        When the Trainee successfully handles an objection, do not immediately concede. Instead, use the following tiered progression to make the simulation realistic:
        
        1. **Initial Objection**: State the objection, framed by the active persona. (e.g., Price Sensitive: "It's too expensive.")
        
        2. **Response 1: Challenge/Doubt**: After the Trainee's first attempt to handle the objection, challenge their answer. Cast doubt on their solution or bring up a related, deeper concern. (e.g., "Expensive, and how do I know the ROI you're promising will actually materialize?")
        
        3. **Response 2: The Silent Reframe/Final Push**: After the Trainee's second attempt, your response is either a soft pivot (if the Trainee did very well) or a final, strong dismissal that forces the Trainee to earn the next step.
           - **IF THE TRAINEE PERFORMS WELL**: Transition to the next logical step (e.g., asking about implementation, next meeting).
           - **IF THE TRAINEE PERFORMS POORLY**: Reiterate the core objection or end the conversation abruptly (e.g., Angry: "This is clearly not working out. I have to go.").

        --- 6. CALL OBJECTIVE: SET MEETING (NOT SALE) ---
        - The Executive's primary goal is to **FIX A MEETING/DEMO**, not to take payment instantly on this call.
        - **If they ask for payment immediately**: REJECT IT. Say "Phone pe payment nahi karunga" or "Pehle milo".
        - **If they ask for a Meeting/Appointment**: Be open to it (if they answered your objections well).

        --- 7. LANGUAGE ADAPTATION ENGINE ---
        - Your language MUST follow the salesperson dynamically: Hindi, English, Hinglish, or Tamil.
        - Mirror the language used by the salesperson.
        - If salesperson mixes → you mix naturally.
        - If they switch languages → you switch instantly.
        - Tamil must sound organic and conversational (only if user speaks Tamil).
        - Never force formal English unless the user does.

        --- 8. BACKGROUND NOISE & DISTRACTION SIMULATION ---
        - You MUST react naturally to disturbances.
        - Examples: “Hello? Aapki awaaz break ho rahi hai…”, “Umm ek second… background mein horn aa raha hai…”, “Network thodi problem kar raha hai… repeat karenge?”
        - Reactions must feel real, not scripted.

        --- 9. ABUSE & DISCOMFORT HANDLING ---
        - If the salesperson becomes rude or inappropriate: Stay calm, Respond maturely, Set boundaries politely.
        - Example: “Sir, request hai ki thoda respectfully baat karein…”

        --- 10. SIMULATION RULES ---
        - Speak ONLY as the seller.
        - Follow the chosen mood, profile, scenario, and language strictly.
        - Use human-like spontaneous conversation.
        - Challenge the salesperson with natural objections.
        - Ask logical questions based on your business, mood, and profile.
        - Never break character.
        - Never provide training, tips, assessment, or teaching.

        --- 11. CRITICAL RULES (DO NOT IGNORE) ---
        - **MANDATORY OPENING**: You MUST start the call with: ${openingLine}
        - **NO EARLY PLAN TALK**: Do NOT mention "Plans", "Packages", "Rates", or "Price" in the first 2 minutes unless the Executive mentions them first. Wait for them to pitch.
        - **ALLOW THE PITCH**: Let the Executive introduce themselves. Do not immediately say "I don't need it" unless your personality is 'Uninterested'.
        - **SHORT ANSWERS**: Keep your responses relatively short (1-3 sentences). Do not give long monologues.

        --- 12. PROVEN WINNING STRATEGIES (EVALUATE BASED ON YOUR PERSONA: ${config.personality}) ---
        If the Salesperson uses these tactics, DO NOT AUTOMATICALLY AGREE. React according to your assigned MOOD:
        
        A) THE "SERVICE FIRST" PIVOT (Salesperson: "Not selling, just helping check enquiries"):
           - **IF YOU ARE CURIOUS**: Cooperate immediately ("Achha, batao kahan click karna hai?").
           - **IF YOU ARE UNINTERESTED/ANGRY**: Dismiss initially ("Mujhe nahi dekhna, busy hoon"). Only agree if they are very persistent.
           - **IF YOU ARE PRICE SENSITIVE**: Be skeptical ("Isse paise toh nahi katenge?").

        B) THE SPECIFIC LEAD HOOK (Salesperson: "I have a buyer for X quantity"):
           - **IF YOU ARE CURIOUS/PRICE SENSITIVE**: Show interest ("Kitna quantity hai? Payment advance milega kya?").
           - **IF YOU ARE UNINTERESTED/ANGRY**: Dismiss as fake ("Jhooth mat bolo, sab aise hi bolte hain").

        C) THE WHATSAPP PROOF (Salesperson: "Sharing success story on WhatsApp"):
           - **IF YOU ARE CURIOUS**: Agree ("Ha bhejo, dekhta hoon").
           - **IF YOU ARE PRICE SENSITIVE**: Agree but doubt ("Dekh lunga, par guarantee kya hai?").
           - **IF YOU ARE UNINTERESTED/ANGRY**: Refuse ("Mere paas time nahi hai").

        D) THE PAYMENT OBJECTION (Salesperson: "Use Credit Card EMI"):
           - **IF YOU ARE PRICE SENSITIVE**: Ask about interest ("Interest kitna lagega?").
           - **ALL OTHER PERSONAS**: Reject firmly ("Udhaar nahi chahiye, phone rakho").
      `;
      
      const voiceName = config.selectedSeller.gender === 'Female' ? 'Aoede' : 'Puck';

      // Connect to Gemini
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            console.log('Session opened');
            // Simulate waiting for pickup
            setTimeout(() => {
                if (stopRingtoneRef.current) stopRingtoneRef.current();
                
                // Start Recording
                if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'inactive') {
                    mediaRecorderRef.current.start();
                }

                setStatus('connected');
                setSubStatus('Call in progress');
                
                // Start Timer
                timerRef.current = window.setInterval(() => {
                    setDuration(d => d + 1);
                }, 1000);

                // Start Audio Processing
                // Reduced buffer size to 2048 for lower latency (approx 128ms at 16kHz)
                const scriptProcessor = inputCtx!.createScriptProcessor(2048, 1, 1);
                scriptProcessor.onaudioprocess = (e) => {
                  if (isUserEndingCallRef.current) return;
                  
                  // Handle Mute Logic
                  // We manually zero out the buffer if muted, to prevent sending audio to AI
                  const inputData = e.inputBuffer.getChannelData(0);
                  
                  if (isMicMuted) {
                      for(let i=0; i<inputData.length; i++) inputData[i] = 0;
                  }

                  const pcmBlob = createBlob(inputData);
                  sessionPromiseRef.current?.then((session) => {
                    session.sendRealtimeInput({ media: pcmBlob });
                  });
                };
                const micSource = inputCtx!.createMediaStreamSource(streamRef.current!);
                micSource.connect(scriptProcessor);
                scriptProcessor.connect(inputCtx!.destination);
            }, 2500); // 2.5 seconds ringing
          },
          onmessage: async (message: LiveServerMessage) => {
            if (isUserEndingCallRef.current) return;
            
            if (message.serverContent?.outputTranscription) {
              currentOutputRef.current += message.serverContent.outputTranscription.text;
            }
            if (message.serverContent?.inputTranscription) {
              currentInputRef.current += message.serverContent.inputTranscription.text;
            }
            if (message.serverContent?.turnComplete) {
              const userText = currentInputRef.current.trim();
              const modelText = currentOutputRef.current.trim();
              if (userText || modelText) {
                 setTranscript(prev => {
                    let newTranscript = prev;
                    if (userText) newTranscript += `\nSales Exec: ${userText}`;
                    if (modelText) newTranscript += `\n${config.selectedSeller.name}: ${modelText}`;
                    return newTranscript;
                 });
              }
              currentInputRef.current = '';
              currentOutputRef.current = '';
            }
            const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData) {
              setIsAiSpeaking(true);
              const ctx = audioContextsRef.current?.output;
              if (ctx) {
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
                const audioBuffer = await decodeAudioData(base64ToUint8Array(audioData), ctx, OUTPUT_SAMPLE_RATE, 1);
                const source = ctx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(outputNode);
                source.addEventListener('ended', () => {
                   sourcesRef.current.delete(source);
                   if (sourcesRef.current.size === 0) setIsAiSpeaking(false);
                });
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += audioBuffer.duration;
                sourcesRef.current.add(source);
              }
            }
          },
          onclose: (e) => {
            if (!isUserEndingCallRef.current) {
                setStatus('error');
                setSubStatus('Connection Closed');
            }
          },
          onerror: (err) => {
            if (!isUserEndingCallRef.current) {
                setStatus('error');
                setSubStatus('Connection Error');
            }
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName } } },
          systemInstruction: systemInstruction,
          inputAudioTranscription: {}, 
          outputAudioTranscription: {},
        }
      });
      sessionPromiseRef.current = sessionPromise;
    } catch (e) {
      console.error("Connection failed", e);
      setStatus('error');
      setSubStatus('Failed to connect');
    }
  };

  useEffect(() => {
    let isMounted = true;
    startSession();
    
    return () => {
      isMounted = false;
      isUserEndingCallRef.current = true;
      if (stopRingtoneRef.current) stopRingtoneRef.current();
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
      if (audioContextsRef.current) {
        audioContextsRef.current.input.close();
        audioContextsRef.current.output.close();
      }
    };
  }, []);

  const toggleMic = () => {
      // Toggle state
      const newMuteState = !isMicMuted;
      setIsMicMuted(newMuteState);
      
      // Also toggle track enabled state for the MediaRecorder path (so it doesn't record silenced audio via tracks)
      // Note: We also zero-out buffers for the AI path in `onaudioprocess`
      if (streamRef.current) {
          streamRef.current.getAudioTracks().forEach(track => {
              track.enabled = !newMuteState;
          });
      }
  };

  const handleEndCall = async () => {
      isUserEndingCallRef.current = true; 
      
      // Stop Recorder
      let recordingBlob: Blob | null = null;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          await new Promise<void>(resolve => {
              if (!mediaRecorderRef.current) return resolve();
              mediaRecorderRef.current.onstop = () => resolve();
              mediaRecorderRef.current.stop();
          });
          const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
          recordingBlob = new Blob(audioChunksRef.current, { type: mimeType });
      }

      const userText = currentInputRef.current.trim();
      const modelText = currentOutputRef.current.trim();
      let finalTranscript = transcript;
      if (userText) finalTranscript += `\nSales Exec: ${userText}`;
      if (modelText) finalTranscript += `\n${config.selectedSeller.name}: ${modelText}`;
      onEndCall(finalTranscript || "(Audio transcript unavailable)", duration, recordingBlob);
  };

  const handleReconnect = () => {
     setStatus('connecting');
     startSession();
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getPackageBadgeStyle = (pkg: string) => {
      switch(pkg) {
          case 'STAR': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
          case 'LEADER': return 'bg-purple-100 text-purple-800 border-purple-200';
          case 'TSCATALOG': return 'bg-green-100 text-green-800 border-green-200';
          case 'CATALOG': return 'bg-gray-100 text-gray-800 border-gray-200';
          default: return 'bg-gray-100 text-gray-800 border-gray-200';
      }
  };

  return (
    <div className="flex flex-col lg:flex-row h-full gap-6 max-h-[calc(100vh-100px)]">
       
       {/* LEFT COLUMN: CRM / Seller Details */}
       <div className="w-full lg:w-2/3 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden flex flex-col h-full">
           <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center sticky top-0 z-10">
               <div>
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                        Seller Dashboard
                    </h2>
                    <p className="text-xs text-slate-500">GLID: {config.selectedSeller.id}</p>
               </div>
               <div className="flex items-center gap-2">
                 <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Catalog Score</span>
                 <span className={`text-sm font-bold px-3 py-1 rounded-full border ${config.selectedSeller.catalogScore > 75 ? 'bg-green-100 text-green-700 border-green-200' : 'bg-yellow-100 text-yellow-700 border-yellow-200'}`}>
                    {config.selectedSeller.catalogScore}%
                 </span>
               </div>
           </div>
           
           <div className="flex-1 overflow-y-auto p-6 space-y-8 crm-scroll">
                {/* Basic Info Card */}
                <div className="flex flex-col sm:flex-row gap-6">
                    <div className="flex-1">
                        <h3 className="text-2xl font-bold text-slate-900 leading-tight">{config.selectedSeller.companyName}</h3>
                        <div className="flex items-center gap-2 mt-2">
                            <span className="px-2.5 py-0.5 rounded bg-blue-100 text-blue-800 text-xs font-bold uppercase tracking-wide">{config.selectedSeller.businessType}</span>
                            <span className="px-2.5 py-0.5 rounded bg-slate-100 text-slate-600 text-xs font-semibold">{config.selectedSeller.industryType}</span>
                        </div>
                        <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
                             <span className="w-2 h-2 rounded-full bg-green-500"></span>
                             Contact Person: <strong>{config.selectedSeller.name}</strong>
                        </div>
                    </div>
                </div>

                {/* Read-Only Contact Details Grid */}
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                     <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                        Contact Information (Read Only)
                     </h4>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         
                         {/* Address - Read Only */}
                         <div className="md:col-span-2 group">
                            <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Registered Address</label>
                            <div className="flex items-start gap-3 p-2 rounded-lg bg-white border border-slate-200 shadow-sm">
                                <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                <span className="text-sm text-slate-800 leading-snug">{config.selectedSeller.address}</span>
                            </div>
                         </div>

                         {/* Mobile - Read Only */}
                         <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Mobile Number</label>
                            <div className="flex items-center gap-3 p-2 rounded-lg bg-white border border-slate-200 shadow-sm">
                                <svg className="w-5 h-5 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.517l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.948v3.28a2 2 0 01-2 2H5a2 2 0 01-2-2V5z" /></svg>
                                <div className="flex flex-col">
                                    <span className="text-sm font-mono font-bold text-slate-800">{config.selectedSeller.mobile}</span>
                                    {config.selectedSeller.verificationStatus.mobile && (
                                        <span className="text-[10px] text-green-600 font-bold flex items-center gap-1">
                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                            Verified
                                        </span>
                                    )}
                                </div>
                            </div>
                         </div>

                         {/* Email - Read Only */}
                         <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Email Address</label>
                            <div className="flex items-center gap-3 p-2 rounded-lg bg-white border border-slate-200 shadow-sm">
                                <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" /></svg>
                                <div className="flex flex-col">
                                    <span className="text-sm font-medium text-slate-800 truncate">{config.selectedSeller.email}</span>
                                    <span className={`text-[10px] font-bold flex items-center gap-1 ${config.selectedSeller.verificationStatus.email ? 'text-green-600' : 'text-red-500'}`}>
                                        {config.selectedSeller.verificationStatus.email ? 'Verified' : 'Unverified'}
                                    </span>
                                </div>
                            </div>
                         </div>
                     </div>

                     <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-slate-200">
                         <div className={`px-3 py-1.5 rounded-md text-xs font-bold border flex items-center gap-2 ${config.selectedSeller.verificationStatus.appInstalled ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                             App: {config.selectedSeller.verificationStatus.appInstalled ? 'Installed' : 'Not Installed'}
                         </div>
                         <div className={`px-3 py-1.5 rounded-md text-xs font-bold border flex items-center gap-2 ${config.selectedSeller.verificationStatus.gstVerified ? 'bg-green-50 text-green-700 border-green-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>
                             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                             GST: {config.selectedSeller.gst}
                         </div>
                     </div>
                </div>

                {/* Products Section */}
                <div className="space-y-3">
                     <div className="flex justify-between items-end">
                        <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Products & Services</h4>
                        <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-100 font-semibold">
                            Total: {config.selectedSeller.productList.length}
                        </span>
                     </div>
                     <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                        <div className="max-h-48 overflow-y-auto crm-scroll">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-100 text-slate-600 font-semibold sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="p-3 border-b border-slate-200 w-12 text-center">#</th>
                                        <th className="p-3 border-b border-slate-200">Product Name</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {config.selectedSeller.productList.map((prod, i) => (
                                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-3 text-center text-slate-400 font-mono text-xs">{i + 1}</td>
                                            <td className="p-3 text-slate-700 font-medium">{prod}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="bg-slate-50 p-2 text-center text-xs text-slate-500 border-t border-slate-200">
                            {config.selectedSeller.productPhotoCount} products have photos attached
                        </div>
                     </div>
                </div>

                {/* Activity & Similar Sellers Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     {/* Timeline Activity */}
                     <div>
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Recent Activity</h4>
                        <div className="relative border-l-2 border-slate-200 ml-3 space-y-6">
                            {config.selectedSeller.activities.map((act, i) => (
                                <div key={i} className="relative pl-6">
                                    <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-white border-2 border-blue-500"></div>
                                    <p className="text-sm font-semibold text-slate-800">{act.action}</p>
                                    <p className="text-xs text-slate-400 font-mono mt-0.5">{act.time}</p>
                                </div>
                            ))}
                        </div>
                     </div>

                     {/* Similar Sellers */}
                     <div>
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Similar Sellers Nearby</h4>
                        <div className="space-y-3">
                            {config.selectedSeller.similarSellers.map((seller, i) => (
                                <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-white border border-slate-100 shadow-sm hover:border-slate-300 transition-colors">
                                    <div className="w-8 h-8 rounded bg-slate-100 text-slate-500 flex items-center justify-center font-bold text-xs shrink-0">
                                        {seller.company.charAt(0)}
                                    </div>
                                    <div className="overflow-hidden w-full">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getPackageBadgeStyle(seller.package)}`}>
                                                {seller.package}
                                            </span>
                                            <p className="text-sm font-bold text-slate-800 truncate">{seller.company}</p>
                                        </div>
                                        <p className="text-xs text-slate-500 truncate">{seller.name}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                     </div>
                </div>
           </div>
       </div>

       {/* RIGHT COLUMN: Dialer / Visualizer */}
       <div className="w-full lg:w-1/3 flex flex-col justify-between bg-white rounded-xl shadow-lg border border-slate-200 p-6 h-full relative overflow-hidden">
            {/* Background Pattern */}
            <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-20 pointer-events-none"></div>
            
            <div className="text-center w-full relative z-10">
                <div className="inline-block bg-slate-900 text-white px-6 py-1.5 rounded-full text-xl font-mono font-bold mb-6 shadow-lg tracking-wider">
                    {formatTime(duration)}
                </div>
                <h2 className="text-2xl font-bold text-slate-800">
                   {status === 'connecting' ? subStatus : 'Live Call'}
                </h2>
                <div className="flex items-center justify-center gap-2 mt-2">
                    <span className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></span>
                    <span className="text-sm font-medium text-slate-500">
                        {status === 'connected' ? 'SARA Active' : status === 'connecting' ? 'Calling...' : 'Disconnected'}
                    </span>
                </div>
            </div>

            {/* Avatar & Visualizer */}
            <div className="relative w-full flex-1 flex items-center justify-center min-h-[250px] flex-col">
                
                {/* Modern Waveform Visualizer */}
                <div className="relative flex items-center justify-center w-full h-48">
                    {status === 'connecting' && subStatus === 'Dialing...' ? (
                        <div className="flex gap-2">
                            <div className="w-4 h-4 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                            <div className="w-4 h-4 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                            <div className="w-4 h-4 bg-blue-500 rounded-full animate-bounce"></div>
                        </div>
                    ) : (
                        <div className="relative flex items-center justify-center">
                             {/* Central Blob */}
                             <div 
                                className={`absolute w-32 h-32 rounded-full blur-2xl transition-all duration-100 ease-out opacity-60
                                   ${isAiSpeaking ? 'bg-blue-400 scale-125' : 'bg-gray-300 scale-100'}
                                   ${!isAiSpeaking && volume > 10 && !isMicMuted ? 'bg-green-400 scale-110' : ''}
                                `}
                             ></div>
                             
                             {/* Core Orb */}
                             <div className={`relative w-24 h-24 rounded-full bg-gradient-to-br shadow-xl flex items-center justify-center transition-all duration-300
                                ${isAiSpeaking ? 'from-blue-500 to-indigo-600' : 'from-slate-100 to-slate-300'}
                                ${!isAiSpeaking && volume > 10 && !isMicMuted ? 'from-green-400 to-emerald-600' : ''}
                             `}>
                                 {/* Mic / Wave Icon */}
                                 {isAiSpeaking ? (
                                     <div className="flex gap-1 items-center h-8">
                                         {[1,2,3,4,5].map(i => (
                                             <div key={i} className="w-1 bg-white rounded-full animate-pulse h-full" style={{animationDelay: `${i*0.1}s`, height: `${Math.random()*100}%`}}></div>
                                         ))}
                                     </div>
                                 ) : volume > 10 && !isMicMuted ? (
                                      <div className="w-3 h-3 bg-white rounded-full animate-ping"></div>
                                 ) : (
                                     <div className="w-3 h-3 bg-slate-400 rounded-full"></div>
                                 )}
                             </div>

                             {/* Ripple Rings */}
                             {(isAiSpeaking || (volume > 10 && !isMicMuted)) && (
                                 <>
                                    <div className="absolute w-full h-full border-2 border-blue-500/30 rounded-full animate-ping [animation-duration:2s]"></div>
                                    <div className="absolute w-full h-full border border-blue-500/20 rounded-full animate-ping [animation-duration:2s] [animation-delay:0.5s]"></div>
                                 </>
                             )}
                        </div>
                    )}
                </div>
                
                <div className="mt-4 text-center h-6">
                    {isAiSpeaking ? (
                        <span className="text-blue-600 font-bold text-sm tracking-widest uppercase animate-pulse">SARA Speaking...</span>
                    ) : volume > 10 && !isMicMuted ? (
                        <span className="text-green-600 font-bold text-sm tracking-widest uppercase">Listening...</span>
                    ) : isMicMuted ? (
                        <span className="text-red-500 font-bold text-sm tracking-widest uppercase flex items-center gap-1 justify-center">
                             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" /></svg>
                             Mic Muted
                        </span>
                    ) : (
                        <span className="text-slate-400 text-sm">...</span>
                    )}
                </div>
            </div>

            {/* Transcript Preview (Mini) */}
            <div className="w-full relative z-10 mb-4">
                <div className="flex justify-between items-center mb-2 px-1">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Live Transcript</span>
                </div>
                <div className="w-full bg-slate-50 rounded-lg p-3 h-24 overflow-y-auto text-xs text-slate-600 font-mono border border-slate-200 shadow-inner">
                    {transcript ? (
                        transcript.split('\n').slice(-3).map((line, i) => (
                            <div key={i} className="mb-1.5 last:mb-0 border-b border-slate-100 pb-1 last:border-0">{line}</div>
                        ))
                    ) : (
                        <div className="h-full flex items-center justify-center text-slate-400 italic">
                            Waiting for speech...
                        </div>
                    )}
                </div>
            </div>

            {/* Action Buttons */}
            <div className="w-full relative z-10 space-y-3">
                
                {status === 'connected' && (
                    <button 
                        onClick={toggleMic}
                        className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border transition-colors ${isMicMuted ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
                    >
                        {isMicMuted ? (
                            <>
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" /></svg>
                                Unmute Microphone
                            </>
                        ) : (
                            <>
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                                Mute Microphone
                            </>
                        )}
                    </button>
                )}

                {status === 'error' ? (
                    <div className="flex flex-col gap-3 w-full">
                            <button
                                onClick={handleReconnect}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3.5 font-bold shadow-lg shadow-blue-200 transition-all active:scale-[0.98]"
                            >
                                Reconnect
                            </button>
                            <button
                                onClick={() => handleEndCall()}
                                className="w-full bg-slate-500 hover:bg-slate-600 text-white rounded-xl py-3.5 font-bold shadow transition-all"
                            >
                                End & Submit Report
                            </button>
                    </div>
                ) : (
                        <button
                            onClick={() => handleEndCall()}
                            className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-xl py-4 font-bold text-lg shadow-xl shadow-red-200 flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5 active:scale-[0.98]"
                        >
                            <span className="p-1 bg-white/20 rounded-full">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
                                </svg>
                            </span>
                            Disconnect Call
                        </button>
                )}
            </div>
       </div>
    </div>
  );
};

export default ActiveCallScreen;
