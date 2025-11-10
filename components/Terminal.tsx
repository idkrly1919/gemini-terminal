import React, { useState, useEffect, useRef } from 'react';
import { marked } from 'marked';
import { sendMessage, generateImage } from '../services/geminiService.js';
import { v4 as uuidv4 } from 'uuid';

const AVAILABLE_MODELS = [
    { id: 'gemini-flash-latest', name: 'Gemini Flash Latest', aliases: ['flash', 'f'] },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', aliases: ['pro', 'p'] },
    { id: 'gemini-flash-lite-latest', name: 'Gemini Flash Lite', aliases: ['lite', 'l'] },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', aliases: [] },
];

const ChevronRightIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="m9 18 6-6-6-6" />
    </svg>
);

const Terminal = () => {
    const [stage, setStage] = useState('model');
    const [sessionId] = useState(uuidv4());
    const [selectedModel, setSelectedModel] = useState('');
    const [useGoogleSearch, setUseGoogleSearch] = useState(false);

    const [history, setHistory] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [showSources, setShowSources] = useState({});

    const inputRef = useRef(null);
    const endOfHistoryRef = useRef(null);

    useEffect(() => {
        // FIX: Add missing undefined argument for sources.
        addMessage('system', [
            'Welcome to the Gemini Interactive Terminal.',
            `Type 'flash', 'pro', 'lite', or 'extra' to choose a model.`,
        ], undefined);
    }, []);

    useEffect(() => {
        inputRef.current?.focus();
    }, [isLoading, stage]);

    useEffect(() => {
        endOfHistoryRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [history, isStreaming]);

    const addMessage = (sender, content, sources, isImage = false) => {
        setHistory(prev => [...prev, { id: Date.now().toString() + Math.random(), sender, content, sources, isImage }]);
    };
    
    const handleTerminalCommand = async (command) => {
       if (stage === 'model') {
            const extraModels = command === 'extra';
            if (extraModels) {
                const modelList = AVAILABLE_MODELS.map((m, i) => `${i + 1}. ${m.name} (${m.id})`);
                // FIX: Add missing undefined argument for sources.
                addMessage('system', ["Please choose a model by number:", ...modelList], undefined);
                return;
            }

            const modelNumber = parseInt(command, 10) - 1;
            let model;
            if (!isNaN(modelNumber) && modelNumber >= 0 && modelNumber < AVAILABLE_MODELS.length) {
                model = AVAILABLE_MODELS[modelNumber];
            } else {
                model = AVAILABLE_MODELS.find(m => m.aliases.includes(command));
            }

            if (model) {
                setSelectedModel(model.id);
                setStage('search');
                // FIX: Add missing undefined argument for sources.
                addMessage('system', `Model set to ${model.name}. Use Google Search for grounding? (y/n)`, undefined);
            } else {
                // FIX: Add missing undefined argument for sources.
                addMessage('system', "Invalid model selection. Type 'flash', 'pro', 'lite', or 'extra'.", undefined);
            }
        } else if (stage === 'search') {
            const shouldUseSearch = command === 'y' || command === 'yes';
            setUseGoogleSearch(shouldUseSearch);
            // FIX: Add missing undefined argument for sources.
            addMessage('system', `Google Search ${shouldUseSearch ? 'enabled' : 'disabled'}. You can now start chatting.`, undefined);
            setStage('chatting');
        } else if (stage === 'chatting') {
            await processChat(command);
        }
    };

    const processChat = async (prompt) => {
        if (prompt.startsWith('make an image')) {
            const imagePrompt = prompt.replace('make an image', '').trim();
            if (!imagePrompt) {
                // FIX: Add missing undefined argument for sources.
                addMessage('system', 'Please provide a prompt for the image. Usage: make an image [your prompt]', undefined);
                return;
            }
            // FIX: Add missing undefined argument for sources.
            addMessage('system', `Generating image for: "${imagePrompt}"...`, undefined);
            const result = await generateImage(imagePrompt, sessionId);
            
            if (result.error) {
                // FIX: Add missing undefined argument for sources.
                addMessage('system', result.error, undefined);
            } else if(result.imageUrl) {
                addMessage('gemini', result.imageUrl, undefined, true);
            }
            const modelName = AVAILABLE_MODELS.find(m => m.id === selectedModel)?.name || 'selected';
            // FIX: Add missing undefined argument for sources.
            addMessage('system', `Returning to your chat with the ${modelName} model.`, undefined);
            return;
        }

        const messageId = Date.now().toString();
        setHistory(prev => [...prev, { id: messageId, sender: 'gemini', content: '', sources: [], isImage: false }]);
        setIsStreaming(true);

        let currentText = '';
        await sendMessage(prompt, selectedModel, useGoogleSearch, sessionId, (chunk) => {
            if (chunk.text) {
                currentText += chunk.text;
                setHistory(prev => prev.map(msg => 
                    msg.id === messageId ? { ...msg, content: currentText, sources: chunk.sources || msg.sources } : msg
                ));
            }
             if (chunk.error) {
                 setHistory(prev => prev.map(msg => 
                    msg.id === messageId ? { ...msg, content: `An error occurred: ${chunk.error}` } : msg
                ));
             }
        });

        setIsStreaming(false);
    };

    const handleUserInput = async (e) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const command = input.trim();
        // FIX: Add missing undefined argument for sources.
        addMessage('user', input, undefined);
        setInput('');

        setIsLoading(true);
        try {
            await handleTerminalCommand(command.toLowerCase());
        } catch (error) {
            console.error(error);
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            // FIX: Add missing undefined argument for sources.
            addMessage('system', `Error: ${errorMessage}`, undefined);
        }
        setIsLoading(false);
    };

    const getPlaceholderText = () => {
        if (isLoading) return "Processing...";
        switch(stage) {
            case 'model': return "Select a model ('flash', 'pro', 'lite', 'extra')...";
            case 'search': return "Enable Google Search? (y/n)...";
            case 'chatting': return "Type your message or a command...";
            default: return "Type your command...";
        }
    };

    const renderContent = (msg) => {
        if (msg.isImage) {
            return <img src={msg.content} alt="Generated" className="mt-2 rounded-lg max-w-sm" />;
        }
        if (Array.isArray(msg.content)) {
            return msg.content.map((line, index) => <div key={index}>{line}</div>);
        }

        let rawMarkup = marked.parse(msg.content)

        const lastMessage = history[history.length - 1];
        if (isStreaming && msg.id === lastMessage.id && msg.sender === 'gemini') {
            rawMarkup += `<span class="blinking-cursor inline-block w-[1px] h-4 bg-gray-800 dark:bg-gray-200 ml-1"></span>`;
        }
        
        return <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: rawMarkup }} />;
    };

    return (
        <div className="h-[calc(100vh-80px)] max-w-4xl mx-auto flex flex-col bg-white dark:bg-black rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700">
            <div className="flex-grow p-4 overflow-y-auto">
                {history.map((msg) => (
                    <div key={msg.id} className="mb-4 break-words">
                       {msg.sender === 'user' && (
                            <div className="flex">
                                <span className="flex-shrink-0 text-blue-500 dark:text-blue-400 font-bold">user@gemini:~$</span>
                                <p className="ml-2 flex-grow">{msg.content}</p>
                            </div>
                        )}
                        {msg.sender === 'gemini' && (
                            <div>
                                {renderContent(msg)}
                                {msg.sources && msg.sources.length > 0 && (
                                    <div className="mt-2">
                                        <button onClick={() => setShowSources(p => ({...p, [msg.id]: !p[msg.id]}))} className="text-xs text-gray-500 hover:underline flex items-center">
                                            {showSources[msg.id] ? 'Hide' : 'Show'} Sources <ChevronRightIcon className={`w-4 h-4 transition-transform ${showSources[msg.id] ? 'rotate-90' : ''}`} />
                                        </button>
                                        {showSources[msg.id] && (
                                             <div className="mt-1 text-xs space-y-1">
                                                {msg.sources.map((source, i) => (
                                                    source.web && <a href={source.web.uri} target="_blank" rel="noopener noreferrer" key={i} className="block truncate text-gray-400 hover:text-blue-400">
                                                        [{i + 1}] {source.web.title}
                                                    </a>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                        {msg.sender === 'system' && (
                            <div className="text-gray-500 dark:text-gray-400">
                                {renderContent(msg)}
                            </div>
                        )}
                    </div>
                ))}
                 <div ref={endOfHistoryRef} />
            </div>
            <form onSubmit={handleUserInput} className="p-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-md">
                    <span className="text-blue-500 dark:text-blue-400 font-bold pl-3">user@gemini:~$</span>
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={getPlaceholderText()}
                        className="w-full bg-transparent p-2 ml-2 focus:outline-none"
                        disabled={isLoading}
                        aria-label="Terminal input"
                    />
                </div>
            </form>
        </div>
    );
};

export default Terminal;