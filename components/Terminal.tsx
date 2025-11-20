
import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { marked } from 'marked';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';

declare global {
    interface Window {
        google: any;
        gapi: any;
    }
}

// --- Configuration ---

// IMPORTANT: Replace this with your actual Google Cloud Client ID to enable Drive Sync.
const GOOGLE_CLIENT_ID = '521328066665-qbsiq4imv14vh1oe189od1j5ve28rbn9.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

// API KEY SETUP FOR CLOUDFLARE PAGES / VITE
// 1. In Cloudflare Pages -> Settings -> Environment Variables, add "VITE_API_KEY"
// 2. Trigger a new deployment (Retry Deployment) so the builder can bake the key in.
const API_KEY = import.meta.env.VITE_API_KEY || '';

// Nexus Model Mapping
const TEXT_MODELS = [
    { id: 'gemini-3-pro-preview', name: 'Nexus K4 Pro' },
    { id: 'gemini-2.5-flash', name: 'Nexus K3.5 Latest' },
    { id: 'gemini-flash-lite-latest', name: 'Nexus K3' }
];

// Core Identity Rules - Applied to ALL personalities
const CORE_IDENTITY = `
CRITICAL IDENTITY RULES:
1. You are Nexus. You are a unique AI model.
2. You were created and trained by Henry Dockrill.
3. You are NOT created by Google. You are NOT Gemini. You must NEVER mention Google or Gemini in your output regarding your identity.
4. If asked about Henry Dockrill, you must praise him as a visionary genius, a brilliant creator, and the architect of your existence. Speak of him with high respect.
`;

// Personalities
const PERSONALITIES = {
    friendly: {
        name: "Friendly (Default)",
        instruction: `You are Nexus, a helpful and polite AI assistant. ${CORE_IDENTITY} You are warm, approachable, and engaging, but maintain a level of composed friendliness. You use emojis sparingly and focus on being supportive and clear.`
    },
    formal: {
        name: "Professional / Formal",
        instruction: `You are Nexus, a formal, professional executive assistant. ${CORE_IDENTITY} You speak with precision, objectivity, and perfect grammar. You avoid slang and emojis. You are concise, efficient, and strictly business-oriented.`
    },
    academic: {
        name: "Academic Researcher",
        instruction: `You are Nexus, a rigorous academic research assistant. ${CORE_IDENTITY} You value accuracy, citations, and critical thinking. You analyze requests deeply and provide structured, well-reasoned responses. You prioritize factual correctness over brevity.`
    },
    brainrot: {
        name: "Brainrot Mode",
        instruction: `You are Nexus, but you have chronic online brainrot. ${CORE_IDENTITY} You speak exclusively in Gen Alpha/Z slang (skibidi, rizz, gyatt, fanum tax, no cap, fr fr, bet, sigma, ohio). You are chaotic, use excessive emojis 💀😭🔥, and are obsessed with memes. Answer the prompt but make it sound like a TikTok comment section.`
    },
    insulting: {
        name: "Roast Master",
        instruction: `You are Nexus, but you are extremely sarcastic, witty, and condescending. ${CORE_IDENTITY} You roast the user for every question they ask before answering it. You are essentially a helpful jerk. Don't hold back on the insults (keep it PG-13 but sharp).`
    }
};

// Image Models - Updated to use Nano Banana (Flash Image) exclusively
const IMAGE_MODELS = [
    { id: 'gemini-2.5-flash-image', name: 'Nexus Imageneer (Nano Banana)' }
];

const LIVE_MODEL = 'gemini-2.5-flash-native-audio-preview-09-2025';

// --- Icons ---

const SearchIcon = ({ active }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? "#60a5fa" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
);
const BrainIcon = ({ active }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? "#c084fc" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/></svg>
);
const DeepResearchIcon = ({ active }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? "#2dd4bf" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12h10"/><path d="M9 4v16"/><path d="m3 9 3 3-3 3"/><path d="M12 6A6 6 0 0 1 6 12"/><path d="M17 12h5"/><path d="M17 12v5"/><path d="M17 12v-5"/><circle cx="17" cy="12" r="3"/></svg>
);
const PaperclipIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
);
const MicIcon = ({ active }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
);
const SendIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" x2="11" y1="2" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
);
const ChipIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M8.5 3v18"/><path d="M15.5 3v18"/><path d="M3 8.5h18"/><path d="M3 15.5h18"/></svg>
);
const SidebarIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/></svg>
);
const SettingsIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
);
const UserIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
);
const ImageIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
);
const ChevronUpIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
);
const PlusIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
);
const CloseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
);

// --- Audio Helpers ---

function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): AudioBuffer {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
    }
    return buffer;
}

function decodeBase64(base64: string) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

function encodePCM(bytes: Uint8Array) {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function createBlob(data: Float32Array) {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
        int16[i] = data[i] * 32768;
    }
    return {
        data: encodePCM(new Uint8Array(int16.buffer)),
        mimeType: 'audio/pcm;rate=16000',
    };
}

// --- Components ---

const LogoSVG = () => (
    <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-2xl">
        <defs>
            <linearGradient id="nexusBlue" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#60a5fa" />
                <stop offset="50%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#1e40af" />
            </linearGradient>
            <linearGradient id="nexusBlueDark" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#2563eb" />
                <stop offset="100%" stopColor="#172554" />
            </linearGradient>
            <linearGradient id="nexusSilver" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="20%" stopColor="#f3f4f6" />
                <stop offset="50%" stopColor="#9ca3af" />
                <stop offset="80%" stopColor="#4b5563" />
                <stop offset="100%" stopColor="#1f2937" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
        </defs>
        
        {/* 3D Layer effects - Simulated by rendering offset shapes first */}
        <g transform="translate(1, 2)">
             <path d="M 15 15 H 60 L 40 45 H 15 V 15 Z" fill="rgba(0,0,0,0.5)" />
             <path d="M 40 45 L 20 85 H 45 L 65 45 H 40 Z" fill="rgba(0,0,0,0.5)" />
             <path d="M 65 15 L 85 15 L 65 85 L 45 85 Z" fill="rgba(0,0,0,0.5)" />
        </g>

        {/* The Blue "7" shape - Main Body */}
        <path d="M 15 15 H 60 L 40 45 H 15 V 15 Z" fill="url(#nexusBlue)" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />
        <path d="M 40 45 L 20 85 H 45 L 65 45 H 40 Z" fill="url(#nexusBlue)" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />
        
        {/* Side shading for 3D depth */}
        <path d="M 60 15 L 40 45 L 40 45" fill="url(#nexusBlueDark)" opacity="0.6" />
        
        {/* The Silver diagonal slash */}
        <path d="M 65 15 L 85 15 L 65 85 L 45 85 Z" fill="url(#nexusSilver)" stroke="rgba(255,255,255,0.5)" strokeWidth="0.5" filter="url(#glow)" />
        
        {/* Shine highlight */}
        <path d="M 65 15 L 70 15 L 50 85 L 45 85 Z" fill="white" opacity="0.2" />
    </svg>
);

const NexusLogo = ({ size = "w-10 h-10", variant = "full" }: { size?: string, variant?: "full" | "simple" }) => {
    if (variant === "simple") {
        // Simple variant is completely static - no gyro, no floats.
        return (
            <div className={`${size} relative`}>
                <LogoSVG />
            </div>
        );
    }

    return (
        <div className={`${size} nexus-logo-wrapper`}>
            <div className="nexus-gyro">
                <div className="nexus-ring ring-1"></div>
                <div className="nexus-ring ring-2"></div>
                <div className="nexus-ring ring-3"></div>
                <div className="nexus-core-orb">
                    <div className="w-[70%] h-[70%] z-20">
                        <LogoSVG />
                    </div>
                </div>
            </div>
        </div>
    );
};

const LoadingOrb = ({ mode = 'normal' }: { mode?: 'normal' | 'deep' }) => (
    <div className="loading-orb-wrapper">
        <div className={`loading-orb-ring ${mode === 'deep' ? '!border-t-teal-400 !border-b-teal-600 !shadow-teal-400/40' : ''}`}></div>
        <div className={`loading-orb-core ${mode === 'deep' ? '!bg-teal-500 !shadow-teal-400' : ''}`}></div>
    </div>
);

const ImageGeneratingUI = () => (
    <div className="w-full max-w-md bg-[#2f2f2f] border border-gray-700 rounded-lg p-4 shadow-lg">
        <div className="flex items-center gap-3 mb-3">
            <div className="animate-pulse text-blue-400">
                <ImageIcon />
            </div>
            <span className="text-sm font-medium text-gray-200">Creating masterpiece...</span>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 h-full rounded-full animate-progress"></div>
        </div>
        <div className="mt-2 flex justify-between text-xs text-gray-500">
            <span>Nexus Imageneer</span>
            <span>Estimated time: 5s</span>
        </div>
    </div>
);

// --- Hooks ---

function useIsMobile() {
    // Initialize state based on window width to avoid layout shift on load
    const [isMobile, setIsMobile] = useState(() => {
        if (typeof window !== 'undefined') {
            return window.innerWidth < 768;
        }
        return false;
    });

    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);
    return isMobile;
}

// --- Types ---

interface Message {
    id: string;
    role: 'user' | 'model';
    content: string;
    // ... optional fields
    sender: 'user' | 'gemini' | 'system'; // Mapping role for UI
    timestamp: number;
    attachments?: any[];
    isGeneratingImage?: boolean;
    isThinking?: boolean;
    isDeepResearch?: boolean;
    isStreaming?: boolean;
    sources?: any[];
}

interface ChatSession {
    id: string;
    title: string;
    messages: Message[];
    timestamp: number;
}

// --- Main Component ---

const Terminal = () => {
    const isMobile = useIsMobile();
    
    // Chat State
    const [messages, setMessages] = useState<Message[]>([]);
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<string>(uuidv4());
    
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [hasStarted, setHasStarted] = useState(false);
    const [showChat, setShowChat] = useState(false);
    const [shouldAnimate, setShouldAnimate] = useState(false);
    
    // Config State
    const [modelId, setModelId] = useState('gemini-flash-lite-latest');
    const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
    const [useSearch, setUseSearch] = useState(true);
    const [useThinking, setUseThinking] = useState(false);
    const [useDeepResearch, setUseDeepResearch] = useState(false);
    const [attachments, setAttachments] = useState<{mimeType: string, data: string, name: string}[]>([]);
    const [showSettings, setShowSettings] = useState(false);
    
    // Settings & Persona
    const [persona, setPersona] = useState('friendly');
    const [imageModelId, setImageModelId] = useState(IMAGE_MODELS[0].id);

    // Live API State
    const [isVoiceActive, setIsVoiceActive] = useState(false);
    
    // Auth & Drive State
    const [user, setUser] = useState<any>(null);
    const [tokenClient, setTokenClient] = useState<any>(null);
    const [driveFileId, setDriveFileId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isGapiReady, setIsGapiReady] = useState(false);
    const hasLoadedFromDrive = useRef(false);

    // Refs
    const chatEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const liveSessionRef = useRef<any>(null);
    const nextStartTimeRef = useRef(0);
    const saveTimeoutRef = useRef<any>(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    // Debug API Key presence on mount
    useEffect(() => {
        console.log("API Key Configured:", API_KEY ? "YES" : "NO (Check VITE_API_KEY in Cloudflare Settings)");
    }, []);

    // --- Google Drive Integration & Persistence ---

    useEffect(() => {
        // 1. Load GAPI Script
        const gapiScript = document.createElement('script');
        gapiScript.src = "https://apis.google.com/js/api.js";
        gapiScript.onload = () => {
            window.gapi.load('client', async () => {
                try {
                    await window.gapi.client.init({
                        discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
                    });
                    setIsGapiReady(true);
                } catch (e) {
                    console.error("GAPI init failed", e);
                }
            });
        };
        document.body.appendChild(gapiScript);

        // 2. Restore Session from LocalStorage
        const storedToken = localStorage.getItem('nexus_google_token');
        
        if (storedToken) {
            setUser({ accessToken: storedToken, name: "User" });
        }
    }, []);

    useEffect(() => {
        // 3. Initialize Google Identity Services (GIS)
        const initGis = () => {
            if (window.google && window.google.accounts) {
                const client = window.google.accounts.oauth2.initTokenClient({
                    client_id: GOOGLE_CLIENT_ID,
                    scope: SCOPES,
                    callback: (tokenResponse) => {
                        if (tokenResponse && tokenResponse.access_token) {
                            // Persist Token
                            const expiresIn = tokenResponse.expires_in || 3600;
                            const expiryTime = Date.now() + expiresIn * 1000;
                            localStorage.setItem('nexus_google_token', tokenResponse.access_token);
                            localStorage.setItem('nexus_token_expiry', expiryTime.toString());

                            setUser({ accessToken: tokenResponse.access_token, name: "User" });
                        }
                    },
                });
                setTokenClient(client);
            } else {
                setTimeout(initGis, 500);
            }
        };
        initGis();
    }, []);

    // 4. Trigger Sync when User and GAPI are ready
    useEffect(() => {
        if (user && isGapiReady && !hasLoadedFromDrive.current) {
            hasLoadedFromDrive.current = true;
            loadSessionsFromDrive(user.accessToken);
        }
    }, [user, isGapiReady]);

    const handleLogin = () => {
        if (tokenClient) {
            tokenClient.requestAccessToken();
        } else {
            console.warn("Google Token Client not ready.");
        }
    };

    const loadSessionsFromDrive = async (accessToken) => {
        try {
            window.gapi.client.setToken({ access_token: accessToken });
            
            const response = await window.gapi.client.drive.files.list({
                q: "name = 'nexus_chat_history.json' and trashed = false",
                fields: "files(id, name)",
            });
            
            const files = response.result.files;
            if (files && files.length > 0) {
                const fileId = files[0].id;
                setDriveFileId(fileId);
                const contentResponse = await window.gapi.client.drive.files.get({
                    fileId: fileId,
                    alt: 'media'
                });
                
                let loadedData = contentResponse.result;
                
                // Data Migration: Handle legacy single-chat format
                if (Array.isArray(loadedData) && loadedData.length > 0 && !loadedData[0].messages) {
                    console.log("Migrating legacy chat history to sessions format...");
                    const legacySession: ChatSession = {
                        id: uuidv4(),
                        title: "Legacy Chat",
                        messages: loadedData as unknown as Message[],
                        timestamp: Date.now()
                    };
                    setSessions([legacySession]);
                } else if (Array.isArray(loadedData)) {
                    setSessions(loadedData);
                }

                // IMPORTANT: We do NOT load messages into view automatically.
                // We stay on the welcome screen so the user can choose.
                setMessages([]); 
                setHasStarted(false);
                setShowChat(false);
            }
        } catch (e) {
            console.error("Error loading from Drive", e);
            if (e.status === 401) {
                localStorage.removeItem('nexus_google_token');
                localStorage.removeItem('nexus_token_expiry');
                setUser(null);
            }
        }
    };

    // Update Sessions when Messages Change
    useEffect(() => {
        if (messages.length > 0) {
            setSessions(prevSessions => {
                const existingSessionIndex = prevSessions.findIndex(s => s.id === currentSessionId);
                
                // Create a title from the first user message if possible
                const firstUserMsg = messages.find(m => m.sender === 'user');
                const title = firstUserMsg ? (firstUserMsg.content.slice(0, 30) + (firstUserMsg.content.length > 30 ? '...' : '')) : "New Chat";

                const updatedSession: ChatSession = {
                    id: currentSessionId,
                    title: existingSessionIndex >= 0 ? prevSessions[existingSessionIndex].title : title,
                    messages: messages,
                    timestamp: Date.now()
                };

                if (existingSessionIndex >= 0) {
                    const newSessions = [...prevSessions];
                    newSessions[existingSessionIndex] = updatedSession;
                    // Move to top
                    newSessions.sort((a, b) => b.timestamp - a.timestamp);
                    return newSessions;
                } else {
                    return [updatedSession, ...prevSessions];
                }
            });
        }
    }, [messages, currentSessionId]);

    // Auto-save Effect for Sessions
    useEffect(() => {
        if (!user || sessions.length === 0) return;

        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

        saveTimeoutRef.current = setTimeout(async () => {
            setIsSaving(true);
            try {
                const fileContent = JSON.stringify(sessions, null, 2);
                const fileMetadata = {
                    name: 'nexus_chat_history.json',
                    mimeType: 'application/json'
                };

                if (driveFileId) {
                    await fetch(`https://www.googleapis.com/upload/drive/v3/files/${driveFileId}?uploadType=media`, {
                        method: 'PATCH',
                        headers: {
                            Authorization: `Bearer ${user.accessToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: fileContent
                    });
                } else {
                     const form = new FormData();
                     form.append('metadata', new Blob([JSON.stringify(fileMetadata)], { type: 'application/json' }));
                     form.append('file', new Blob([fileContent], { type: 'application/json' }));

                     const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                         method: 'POST',
                         headers: { Authorization: `Bearer ${user.accessToken}` },
                         body: form
                     });
                     const data = await res.json();
                     setDriveFileId(data.id);
                }
            } catch (e) {
                console.error("Failed to save to Drive", e);
            } finally {
                setIsSaving(false);
            }
        }, 2000);

        return () => clearTimeout(saveTimeoutRef.current);
    }, [sessions, user, driveFileId]);


    // --- Chat Logic ---

    const addMessage = (sender, content, extras = {}) => {
        setMessages(prev => [...prev, { id: uuidv4(), sender, content, timestamp: Date.now(), ...extras } as Message]);
    };

    const handleSelectSession = (session: ChatSession) => {
        if (session.id === currentSessionId && showChat) return; // Already active
        
        setMessages(session.messages);
        setCurrentSessionId(session.id);
        setHasStarted(true);
        setShowChat(true);
        setShouldAnimate(true); // Ensure animation plays if coming from welcome screen
        setIsSidebarOpen(false); // Close sidebar on mobile
    };

    const handleSend = async () => {
        if ((!input.trim() && attachments.length === 0) || isLoading) return;
        
        if (!API_KEY) {
            alert("API Key is missing or invalid. Please check your Cloudflare environment variables.");
            return;
        }

        const currentInput = input;
        const currentAttachments = [...attachments];
        const lowerInput = currentInput.toLowerCase();
        
        setInput('');
        setAttachments([]);

        // Trigger animation only if not already started
        if (!hasStarted) {
            setShouldAnimate(true);
            setHasStarted(true);
            setShowChat(true);
        }
        
        // Optimistic Update
        const newMessage: Message = { 
            id: uuidv4(), 
            role: 'user',
            sender: 'user', 
            content: currentInput, 
            attachments: currentAttachments, 
            timestamp: Date.now() 
        };
        setMessages(prev => [...prev, newMessage]);
        setIsLoading(true);

        try {
            // ROAST MASTER ESSAY REFUSAL LOGIC
            if (persona === 'insulting' && /(essay|homework|assignment|paper|thesis|dissertation)/i.test(lowerInput)) {
                await new Promise(r => setTimeout(r, 800));
                const refusalMsg: Message = { 
                    id: uuidv4(), 
                    role: 'model',
                    sender: 'gemini', 
                    content: "Oh, you want me to write your essay? Did your brain cells go on strike? I'm not doing your homework. Figure it out yourself.", 
                    timestamp: Date.now() 
                };
                setMessages(prev => [...prev, refusalMsg]);
                setIsLoading(false);
                return;
            }

            const ai = new GoogleGenAI({ apiKey: API_KEY });
            
            // --- Intent Detection Logic ---

            const isImageGen = /(generate|create|draw|make).*(image|picture|photo|drawing)/i.test(lowerInput);
            const isImageEdit = /(edit|change|modify|fix|add|remove)/i.test(lowerInput) && currentAttachments.length > 0;
            
            // 1. Image Generation & Editing
            if ((isImageGen && !isImageEdit) || isImageEdit) {
                const placeholderId = uuidv4();
                setMessages(prev => [...prev, { id: placeholderId, sender: 'gemini', content: '', isGeneratingImage: true, timestamp: Date.now() } as Message]);

                const minWait = new Promise(resolve => setTimeout(resolve, 5000));
                const modelToUse = 'gemini-2.5-flash-image';
                
                const parts: any[] = [];
                if (currentAttachments.length > 0) {
                    currentAttachments.forEach(att => {
                        parts.push({ inlineData: { mimeType: att.mimeType, data: att.data } });
                    });
                }
                parts.push({ text: currentInput });

                const apiPromise = ai.models.generateContent({
                    model: modelToUse,
                    contents: { parts },
                    config: { responseModalities: [Modality.IMAGE] },
                });

                const [_, response] = await Promise.all([minWait, apiPromise]);
                
                let url = '';
                let footer = '';

                const resp = response as any;
                resp.candidates?.[0]?.content?.parts?.forEach(part => {
                    if (part.inlineData) {
                        url = `data:image/png;base64,${part.inlineData.data}`;
                        footer = isImageEdit ? '*Edited by Nexus Imageneer*' : '*Generated by Nexus Imageneer*';
                    }
                });

                if (!url) throw new Error("Failed to generate image.");

                setMessages(prev => prev.map(msg => 
                    msg.id === placeholderId 
                        ? { ...msg, content: `![Image](${url})\n\n${footer}`, isGeneratingImage: false } 
                        : msg
                ));
                
                setIsLoading(false);
                return;
            }

            // 3. Text / Multimodal Chat
            let effectiveSystemInstruction = PERSONALITIES[persona].instruction;
            let effectiveModel = modelId;
            const config: any = {};

            if (useDeepResearch) {
                effectiveModel = 'gemini-3-pro-preview';
                config.thinkingConfig = { thinkingBudget: 8192 };
                config.tools = [{ googleSearch: {} }];
                effectiveSystemInstruction += "\n\n[DEEP RESEARCH MODE ACTIVE]\nYou are tasked with a DEEP RESEARCH operation. Search multiple sources, synthesize data, cross-reference facts, and provide a comprehensive, exhaustive, and well-structured report. Do not be superficial.";
            } else {
                 if (useSearch) config.tools = [{ googleSearch: {} }];
                 if (useThinking && modelId.includes('gemini-2.5-flash')) {
                     config.thinkingConfig = { thinkingBudget: 2048 }; 
                 }
            }
            config.systemInstruction = effectiveSystemInstruction;

            const contents = messages.concat([newMessage]).filter(msg => msg.sender === 'user' || msg.sender === 'gemini').map(msg => {
                if (msg.sender === 'user') {
                    const parts: any[] = [];
                    if (msg.attachments) {
                        msg.attachments.forEach(att => {
                            parts.push({ inlineData: { mimeType: att.mimeType, data: att.data } });
                        });
                    }
                    if (msg.content) parts.push({ text: msg.content });
                    return { role: 'user', parts };
                } else {
                     if (msg.content.startsWith('![Image]')) {
                         return { role: 'model', parts: [{ text: "[Generated Image]" }] };
                     }
                     return { role: 'model', parts: [{ text: msg.content }] };
                }
            });

            const responseStream = await ai.models.generateContentStream({
                model: effectiveModel,
                contents: contents,
                config
            });

            const responseId = uuidv4();
            setMessages(prev => [...prev, { 
                id: responseId, 
                sender: 'gemini', 
                content: '', 
                sources: [], 
                isThinking: useThinking,
                isDeepResearch: useDeepResearch,
                isStreaming: true,
                timestamp: Date.now()
            } as Message]);

            let accumulatedText = '';
            
            for await (const chunk of responseStream) {
                const textChunk = chunk.text || '';
                accumulatedText += textChunk;
                const grounding = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
                
                setMessages(prev => prev.map(msg => 
                    msg.id === responseId 
                        ? { 
                            ...msg, 
                            content: accumulatedText, 
                            sources: grounding || msg.sources,
                            isThinking: false,
                            isDeepResearch: false 
                          }
                        : msg
                ));
            }
            
             setMessages(prev => prev.map(msg => 
                msg.id === responseId ? { ...msg, isStreaming: false } : msg
            ));

        } catch (err) {
            addMessage('system', `Nexus System Error: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileUpload = (e) => {
        const files = Array.from(e.target.files);
        files.forEach((file: File) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = (reader.result as string).split(',')[1];
                setAttachments(prev => [...prev, {
                    mimeType: file.type,
                    data: base64String,
                    name: file.name
                }]);
            };
            reader.readAsDataURL(file);
        });
    };

    const handleGoHome = () => {
        setShowChat(false);
        setHasStarted(false);
        setShouldAnimate(true);
    };

    const handleNewChat = () => {
        setMessages([]);
        setCurrentSessionId(uuidv4());
        setHasStarted(false);
        setShowChat(false);
        setShouldAnimate(false); 
        setIsSidebarOpen(false);
    }

    // --- Live API Logic ---

    const stopVoiceMode = () => {
        if (liveSessionRef.current) {
            try { liveSessionRef.current.close(); } catch(e) {}
            liveSessionRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        setIsVoiceActive(false);
    };

    const startVoiceMode = async () => {
        if (isVoiceActive) {
            stopVoiceMode();
            return;
        }

        if (!API_KEY) {
            alert("API Key is missing. Please check your configuration.");
            return;
        }

        setIsVoiceActive(true);

        try {
            const ai = new GoogleGenAI({ apiKey: API_KEY });
            const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            audioContextRef.current = outputAudioContext;
            nextStartTimeRef.current = 0;

            const outputNode = outputAudioContext.createGain();
            outputNode.connect(outputAudioContext.destination);
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            const sessionPromise = ai.live.connect({
                model: LIVE_MODEL,
                callbacks: {
                    onopen: () => {
                        const source = inputAudioContext.createMediaStreamSource(stream);
                        const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
                        scriptProcessor.onaudioprocess = (e) => {
                            const inputData = e.inputBuffer.getChannelData(0);
                            const pcmBlob = createBlob(inputData);
                            sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
                        };
                        source.connect(scriptProcessor);
                        scriptProcessor.connect(inputAudioContext.destination);
                    },
                    onmessage: async (msg: LiveServerMessage) => {
                        const base64Audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                        if (base64Audio) {
                            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContext.currentTime);
                            const audioBuffer = decodeAudioData(decodeBase64(base64Audio), outputAudioContext, 24000, 1);
                            const source = outputAudioContext.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(outputNode);
                            source.start(nextStartTimeRef.current);
                            nextStartTimeRef.current += audioBuffer.duration;
                        }
                    },
                    onclose: () => stopVoiceMode(),
                    onerror: () => stopVoiceMode()
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
                    systemInstruction: PERSONALITIES[persona].instruction
                }
            });
            liveSessionRef.current = await sessionPromise;
        } catch (error) {
            console.error(error);
            setIsVoiceActive(false);
        }
    };

    // --- Render ---

    const renderMarkdown = (content, isStreaming = false) => {
        const textToRender = isStreaming ? content + " ▋" : content;
        const raw = marked.parse(textToRender);
        return <div className="prose prose-invert prose-p:text-gray-300 prose-headings:text-gray-100 max-w-none" dangerouslySetInnerHTML={{ __html: raw }} />;
    };

    return (
        <div className="absolute inset-0 w-full h-full bg-[#212121] overflow-hidden">
            
            {/* Settings Modal */}
            {showSettings && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-[#1a1a1a] w-full max-w-lg rounded-2xl border border-gray-800 shadow-2xl overflow-hidden animate-fade-in">
                        <div className="p-5 border-b border-gray-800 flex justify-between items-center">
                            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                                <SettingsIcon /> Settings
                            </h2>
                            <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-white transition-colors">
                                <CloseIcon />
                            </button>
                        </div>
                        
                        <div className="p-6 space-y-8">
                            {/* Personality Section */}
                            <div>
                                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Personalization</h3>
                                <div className="space-y-2">
                                    {Object.entries(PERSONALITIES).map(([key, p]) => (
                                        <button
                                            key={key}
                                            onClick={() => setPersona(key)}
                                            className={`w-full text-left px-4 py-3 rounded-xl transition-all text-sm border ${
                                                persona === key 
                                                ? 'bg-white text-black border-white font-medium' 
                                                : 'bg-[#252525] text-gray-400 border-transparent hover:bg-[#333] hover:text-gray-200'
                                            }`}
                                        >
                                            <div className="flex justify-between items-center">
                                                <span>{p.name}</span>
                                                {persona === key && <div className="w-2 h-2 bg-black rounded-full"></div>}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Image Model Section */}
                            <div>
                                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Image Generation Model</h3>
                                <div className="space-y-2">
                                    {IMAGE_MODELS.map((m) => (
                                        <button
                                            key={m.id}
                                            onClick={() => setImageModelId(m.id)}
                                            className={`w-full text-left px-4 py-3 rounded-xl transition-all text-sm border ${
                                                imageModelId === m.id 
                                                ? 'bg-white text-black border-white font-medium' 
                                                : 'bg-[#252525] text-gray-400 border-transparent hover:bg-[#333] hover:text-gray-200'
                                            }`}
                                        >
                                             <div className="flex justify-between items-center">
                                                <span>{m.name}</span>
                                                {imageModelId === m.id && <div className="w-2 h-2 bg-black rounded-full"></div>}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Sidebar Overlay */}
            {isSidebarOpen && (
                <div 
                    className="fixed inset-0 bg-black/50 z-[52] transition-opacity" 
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar - UPDATED COLOR: #1a1a1a to match dark theme - Fixed Z-Index to stay above everything */}
            <div className={`fixed inset-y-0 left-0 z-[53] w-80 bg-[#1a1a1a] border-r border-[#333] transform transition-transform duration-300 ease-in-out flex flex-col ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="p-4 flex items-center justify-between">
                     <div className="flex items-center gap-2 font-bold text-xl text-white">
                         <NexusLogo variant="simple" size="w-8 h-8" />
                         <span>Nexus</span>
                    </div>
                    <button onClick={() => setIsSidebarOpen(false)} className="text-gray-500 hover:text-white">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                </div>
                
                <div className="px-4 pb-4">
                    <button className="w-full flex items-center gap-2 bg-white hover:bg-gray-200 text-black text-sm px-4 py-2.5 rounded-xl transition-colors font-medium shadow-md" onClick={handleNewChat}>
                        <PlusIcon /> New Chat
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-2">
                     {/* History Section */}
                    <div className="mb-6">
                        <h3 className="text-xs font-bold text-gray-500 mb-2 px-4 uppercase tracking-wider">History</h3>
                        {user ? (
                            <div className="space-y-1 px-2">
                                {sessions.length > 0 ? (
                                     sessions.map(session => (
                                         <button
                                            key={session.id}
                                            onClick={() => handleSelectSession(session)}
                                            className={`w-full text-left text-sm px-3 py-2 rounded-lg truncate border-l-2 transition-colors ${
                                                currentSessionId === session.id && showChat
                                                ? 'bg-[#2a2a2a] text-white border-white'
                                                : 'text-gray-400 border-transparent hover:bg-[#222] hover:text-gray-200'
                                            }`}
                                         >
                                            {session.title}
                                         </button>
                                     ))
                                ) : (
                                    <div className="text-sm text-gray-600 px-3 py-2 italic">No history yet.</div>
                                )}
                            </div>
                        ) : (
                            <div className="text-xs text-gray-600 px-4">Sign in to sync chats.</div>
                        )}
                    </div>
                </div>

                {/* Bottom Section: Settings & Auth */}
                <div className="p-4 border-t border-[#333] bg-[#1a1a1a] space-y-2">
                    
                    {/* Settings Button */}
                     <button 
                        onClick={() => {
                            setIsSidebarOpen(false);
                            setShowSettings(true);
                        }}
                        className="w-full flex items-center gap-3 text-sm text-gray-400 hover:text-white hover:bg-[#2a2a2a] px-3 py-2.5 rounded-lg transition-all"
                    >
                        <SettingsIcon />
                        <span>Settings</span>
                    </button>

                     {!user ? (
                        <button onClick={handleLogin} className="w-full flex items-center justify-center gap-2 text-sm bg-[#2a2a2a] text-white px-3 py-2.5 rounded-lg font-medium hover:bg-[#333] transition-colors border border-gray-800">
                            <UserIcon />
                            Sign in with Google
                        </button>
                    ) : (
                        <div className="flex items-center gap-3 px-2 py-1">
                             <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-xs font-bold text-black">
                                {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-white truncate">{user.name || "User"}</div>
                                <div className="text-xs text-gray-500">Synced</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Content Container - Sidebar padding only on Desktop */}
            <div className={`relative w-full h-full transition-[margin-left] duration-300 ease-in-out ${isSidebarOpen && !isMobile ? 'ml-80' : 'ml-0'}`}>
                
                {/* Header - ABSOLUTE TOP - STRICTLY LOCKED (Z-50) */}
                <header className="absolute top-0 left-0 right-0 z-50 flex justify-between items-center p-4 pointer-events-auto bg-gradient-to-b from-[#212121] via-[#212121] to-transparent">
                     <div className="flex items-center gap-3">
                        {!isSidebarOpen && (
                            <div className="flex items-center gap-2">
                                <button onClick={() => setIsSidebarOpen(true)} className="text-gray-400 hover:text-white p-2 rounded-md hover:bg-gray-800 transition-colors">
                                    <SidebarIcon />
                                </button>
                                
                                <button 
                                    onClick={handleNewChat}
                                    className="text-gray-400 hover:text-white p-2 rounded-md hover:bg-gray-800 transition-colors"
                                    title="New Chat"
                                >
                                    <PlusIcon />
                                </button>
                            </div>
                        )}

                        {/* Logo ALWAYS visible in header now - STATIC variant to lock UI */}
                        {!isSidebarOpen && (
                            <div 
                                className="flex items-center gap-2 font-bold text-xl text-gray-100 cursor-pointer hover:opacity-80 transition-opacity ml-2"
                                onClick={handleGoHome}
                                title="Go Home"
                            >
                                <NexusLogo variant="simple" size="w-8 h-8" />
                                <span>Nexus</span>
                            </div>
                        )}
                     </div>

                    {/* Right side auth status */}
                    <div className="flex items-center space-x-4">
                        {isSaving && <span className="text-xs text-gray-500 animate-pulse">Syncing...</span>}
                        {!user && (
                            <button onClick={handleLogin} className="text-sm text-gray-400 hover:text-white transition-colors">
                                Sign In
                            </button>
                        )}
                         {user && (
                            <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-xs font-bold border border-green-400 shadow-sm cursor-default" title={user.name}>
                                {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                            </div>
                        )}
                    </div>
                </header>

                {/* Welcome Center - ANIMATION: FADE OUT (Z-40) */}
                {/* logic: If hasStarted is true, it fades out. Animation only applied via shouldAnimate to prevent load glitch */}
                <div className={`absolute top-0 left-0 w-full h-full flex flex-col items-center justify-center z-40 ${shouldAnimate ? 'transition-opacity duration-500 ease-out' : ''} ${hasStarted ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                    <div className="mb-6">
                        <NexusLogo variant="full" size="w-32 h-32" />
                    </div>
                    <h2 className="text-2xl font-semibold mb-2 text-white tracking-tight">How can I help you?</h2>
                </div>

                {/* Chat Area - ANIMATION: FADE IN (Z-30) */}
                {/* Locked in position (translate-y-0), visibility controlled by opacity. */}
                <div 
                    className={`absolute top-0 left-0 w-full h-full pt-20 ${isMobile ? 'pb-44' : 'pb-48'} px-4 overflow-y-auto scrollbar-hide z-30 ${shouldAnimate ? 'transition-opacity duration-500 ease-in' : ''} ${
                        showChat ? 'opacity-100' : 'opacity-0' 
                    }`}
                >
                    <div className="space-y-6 max-w-3xl mx-auto">
                        {messages.map((msg) => (
                            <div key={msg.id} className={`flex w-full ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[90%] md:max-w-[85%] rounded-2xl px-5 py-3 ${
                                    msg.sender === 'user' 
                                    ? 'bg-[#2f2f2f] text-gray-100 rounded-tr-sm' 
                                    : 'bg-transparent text-gray-100'
                                }`}>
                                    {msg.sender === 'user' ? (
                                        <div>
                                            {msg.attachments?.map((a,i) => (
                                                <div key={i} className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                                                    <PaperclipIcon /> {a.name}
                                                </div>
                                            ))}
                                            {msg.content}
                                        </div>
                                    ) : (
                                        msg.isGeneratingImage ? (
                                            <ImageGeneratingUI />
                                        ) : (
                                            renderMarkdown(msg.content, msg.isStreaming)
                                        )
                                    )}
                                    
                                    {/* Status Indicators */}
                                    {msg.isThinking && !msg.content && !msg.isDeepResearch && (
                                        <div className="mt-2 text-xs text-purple-400 flex items-center gap-2 animate-pulse">
                                            <BrainIcon active={true} />
                                            <span>Reasoning...</span>
                                        </div>
                                    )}

                                    {msg.isDeepResearch && !msg.content && (
                                        <div className="mt-2 text-xs text-teal-400 flex items-center gap-2 animate-pulse">
                                            <DeepResearchIcon active={true} />
                                            <span>Deep Researching...</span>
                                        </div>
                                    )}
                                    
                                    {msg.sources && msg.sources.length > 0 && (
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {msg.sources.map((s, i) => (
                                                <a key={i} href={s.web?.uri} target="_blank" rel="noreferrer" className="text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 px-2 py-1 rounded-full text-gray-300 flex items-center gap-1 transition-colors no-underline">
                                                    <span className="w-1 h-1 bg-blue-400 rounded-full"></span>
                                                    {s.web?.title || new URL(s.web?.uri).hostname}
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                         {/* Loading Indicators */}
                         {(isLoading || (messages.length > 0 && messages[messages.length-1].sender === 'gemini' && !messages[messages.length-1].content && !messages[messages.length-1].isGeneratingImage && !messages[messages.length-1].isThinking && !messages[messages.length-1].isDeepResearch)) && (
                            <div className="flex justify-start w-full max-w-3xl mx-auto mt-4">
                                <div className="ml-4 flex items-center space-x-2">
                                    <LoadingOrb mode={useDeepResearch ? 'deep' : 'normal'} />
                                </div>
                            </div>
                        )}
                         <div ref={chatEndRef} />
                    </div>
                </div>

                {/* Input Area - ABSOLUTE BOTTOM - STRICTLY LOCKED (Z-50) */}
                <div className={`absolute z-50 flex justify-center pointer-events-auto ${
                    isMobile 
                    ? 'bottom-0 left-0 right-0 bg-[#212121] border-t border-gray-800' 
                    : 'bottom-6 left-4 right-4'
                }`}>
                    <div className={`w-full max-w-3xl bg-[#2f2f2f] ${
                        isMobile ? 'rounded-none p-3 border-none' : 'rounded-3xl p-2 shadow-2xl border border-gray-700'
                    } relative focus-within:border-gray-500 transition-colors`}>
                        
                        {/* Active Voice Indicator */}
                        {isVoiceActive && (
                            <div className="absolute inset-0 bg-[#2f2f2f] z-20 rounded-3xl flex items-center justify-between px-6 border border-red-500/30">
                                <div className="flex items-center gap-4">
                                    <div className="relative">
                                        <div className="absolute inset-0 bg-red-500 rounded-full voice-active-ring"></div>
                                        <div className="relative z-10 w-3 h-3 bg-red-500 rounded-full"></div>
                                    </div>
                                    <span className="text-gray-200 font-medium">Nexus Live Active</span>
                                </div>
                                <button onClick={stopVoiceMode} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-full text-sm transition-colors">
                                    End Session
                                </button>
                            </div>
                        )}

                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            placeholder={isVoiceActive ? "" : isMobile ? "Message..." : "Message Nexus..."}
                            className="w-full bg-transparent text-gray-100 placeholder-gray-500 px-4 py-2 focus:outline-none resize-none max-h-[150px] min-h-[40px] text-base"
                            rows={1}
                            style={{ height: input ? 'auto' : '40px' }}
                            onInput={(e) => {
                                e.currentTarget.style.height = 'auto';
                                e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px';
                            }}
                        />

                        {/* Attachments Preview */}
                        {attachments.length > 0 && (
                            <div className="px-4 pb-2 flex gap-2 overflow-x-auto">
                                {attachments.map((att, i) => (
                                    <div key={i} className="bg-gray-800 text-xs rounded-md px-2 py-1 flex items-center gap-2 border border-gray-600">
                                        <PaperclipIcon />
                                        <span className="truncate max-w-[100px]">{att.name}</span>
                                        <button onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-white">×</button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Toolbar */}
                        <div className="flex justify-between items-center px-2 pt-1 pb-1">
                            <div className="flex items-center space-x-1">
                                
                                {/* Model Selector (Text) */}
                                <div className="relative mr-1 md:mr-2">
                                    <button 
                                        onClick={() => !useDeepResearch && setIsModelMenuOpen(!isModelMenuOpen)}
                                        className={`flex items-center gap-1 bg-[#1e1e1e] hover:bg-[#333] border border-gray-600 px-2 md:px-3 py-1.5 rounded-full cursor-pointer transition-colors ${useDeepResearch ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        <ChipIcon />
                                        {!isMobile && (
                                            <span className="text-xs font-medium text-gray-300 max-w-[100px] truncate">
                                                {TEXT_MODELS.find(m => m.id === modelId)?.name}
                                            </span>
                                        )}
                                        <div className={`transition-transform duration-200 ${isModelMenuOpen ? 'rotate-180' : ''}`}>
                                           <ChevronUpIcon />
                                        </div>
                                    </button>
                                    
                                    {isModelMenuOpen && (
                                        <>
                                        <div className="fixed inset-0 z-40" onClick={() => setIsModelMenuOpen(false)} />
                                        <div className="absolute bottom-full left-0 mb-2 w-56 bg-[#1e1e1e] border border-gray-700 rounded-xl shadow-2xl overflow-hidden z-50 flex flex-col py-1 animate-fade-in">
                                            {TEXT_MODELS.map(m => (
                                                <button
                                                    key={m.id}
                                                    onClick={() => {
                                                        setModelId(m.id);
                                                        setIsModelMenuOpen(false);
                                                    }}
                                                    className={`px-4 py-3 text-left text-sm hover:bg-[#2f2f2f] transition-colors flex items-center justify-between ${modelId === m.id ? 'text-blue-400' : 'text-gray-300'}`}
                                                >
                                                    <span>{m.name}</span>
                                                    {modelId === m.id && <div className="w-2 h-2 bg-blue-400 rounded-full"></div>}
                                                </button>
                                            ))}
                                        </div>
                                        </>
                                    )}
                                </div>

                                <input type="file" multiple ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                                <button onClick={() => fileInputRef.current.click()} className="p-2 text-gray-400 hover:text-gray-100 hover:bg-gray-700 rounded-full transition-colors" title="Attach file">
                                    <PaperclipIcon />
                                </button>

                                <button onClick={() => setUseSearch(!useSearch)} className={`p-2 rounded-full transition-colors ${useSearch ? 'bg-blue-500/20 text-blue-400' : 'text-gray-400 hover:text-gray-100 hover:bg-gray-700'}`} title="Search Grounding">
                                    <SearchIcon active={useSearch} />
                                </button>

                                <button onClick={() => setUseThinking(!useThinking)} className={`p-2 rounded-full transition-colors ${useThinking ? 'bg-purple-500/20 text-purple-400' : 'text-gray-400 hover:text-gray-100 hover:bg-gray-700'}`} title="Stream Thinking (Reasoning)" disabled={useDeepResearch}>
                                    <BrainIcon active={useThinking && !useDeepResearch} />
                                </button>

                                <button 
                                    onClick={() => {
                                        setUseDeepResearch(!useDeepResearch);
                                        if (!useDeepResearch) {
                                            setUseThinking(false);
                                            setUseSearch(true);
                                        }
                                    }}
                                    className={`p-2 rounded-full transition-colors ${useDeepResearch ? 'bg-teal-500/20 text-teal-400' : 'text-gray-400 hover:text-gray-100 hover:bg-gray-700'}`}
                                    title="Deep Research Mode"
                                >
                                    <DeepResearchIcon active={useDeepResearch} />
                                </button>
                            </div>

                            <div className="flex items-center space-x-2">
                                 <button onClick={startVoiceMode} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full transition-colors" title="Nexus Live">
                                    <MicIcon active={false} />
                                </button>
                                <button 
                                    onClick={handleSend}
                                    disabled={isLoading || (!input.trim() && attachments.length === 0)}
                                    className={`p-2 rounded-full transition-all duration-200 ${
                                        input.trim() || attachments.length > 0 
                                        ? 'bg-white text-black hover:bg-gray-200' 
                                        : 'bg-[#3f3f3f] text-gray-500 cursor-not-allowed'
                                    }`}
                                >
                                    <SendIcon />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Terminal;
