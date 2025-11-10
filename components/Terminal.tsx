import React, { useState, useEffect, useRef } from 'react';
import { marked } from 'marked';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenAI, Chat, Modality } from '@google/genai';

const AVAILABLE_MODELS = [
    { id: 'gemini-flash-latest', name: 'Gemini Flash Latest', aliases: ['flash', 'f'] },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', aliases: ['pro', 'p'] },
    { id: 'gemini-flash-lite-latest', name: 'Gemini Flash Lite', aliases: ['lite', 'l'] },
];

const ChevronRightIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="m9 18 6-6-6-6" />
    </svg>
);

const Terminal = () => {
    const [stage, setStage] = useState('model');
    const [selectedModel, setSelectedModel] = useState('');
    const [useGoogleSearch, setUseGoogleSearch] = useState(false);
    const [chat, setChat] = useState<Chat | null>(null);

    const [history, setHistory] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [showSources, setShowSources] = useState({});

    const inputRef = useRef(null);
    const endOfHistoryRef = useRef(null);
    
    const addMessage = (sender, content, sources, isImage = false) => {
        const messageContent = Array.isArray(content) ? content.join('\n') : content;
        setHistory(prev => [...prev, { id: uuidv4(), sender, content: messageContent, sources, isImage }]);
    };
    
    const showWelcomeMessage = () => {
        const modelList = AVAILABLE_MODELS.map(m => `*   **${m.name}**: type \`${m.aliases[0]}\``);
        addMessage('system', [
            '# Welcome to the Gemini Interactive Terminal!',
            'To get started, select a model from the list below:',
            ...modelList,
        // FIX: Added undefined for the sources argument.
        ], undefined);
    };

    const initialize = () => {
        setStage('model');
        setSelectedModel('');
        setUseGoogleSearch(false);
        setChat(null);
        setHistory([]);
        showWelcomeMessage();
    };

    useEffect(() => {
        initialize();
    }, []);

    useEffect(() => {
        inputRef.current?.focus();
    }, [isLoading, stage]);

    useEffect(() => {
        endOfHistoryRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [history, isStreaming]);
    
    const startNewChatSession = (modelId, useSearch) => {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const config = useSearch ? { tools: [{ googleSearch: {} }] } : {};
        const newChat = ai.chats.create({ model: modelId, config });
        setChat(newChat);
    };

    const handleSetup = async (command) => {
       if (stage === 'model') {
            const model = AVAILABLE_MODELS.find(m => m.aliases.includes(command));
            if (model) {
                setSelectedModel(model.id);
                setStage('search');
                // FIX: Added undefined for the sources argument.
                addMessage('system', `Model set to **${model.name}**. Use Google Search for grounding? (y/n)`, undefined);
            } else {
                // FIX: Added undefined for the sources argument.
                addMessage('system', "Invalid model selection. Please choose from the list above.", undefined);
            }
        } else if (stage === 'search') {
            const shouldUseSearch = command === 'y' || command === 'yes';
            setUseGoogleSearch(shouldUseSearch);
            startNewChatSession(selectedModel, shouldUseSearch);
            // FIX: Added undefined for the sources argument.
            addMessage('system', `Google Search **${shouldUseSearch ? 'enabled' : 'disabled'}**. You can now start chatting.`, undefined);
            // FIX: Added undefined for the sources argument.
            addMessage('system', "Type `/help` to see available commands.", undefined);
            setStage('chatting');
        }
    };
    
    const handleCommand = async (command) => {
        const [cmd, ...args] = command.trim().substring(1).split(' ');
        const argString = args.join(' ');

        switch (cmd.toLowerCase()) {
            case 'help':
                // FIX: Added undefined for the sources argument.
                addMessage('system', [
                    '**Available Commands:**',
                    '- `/help`: Show this help message.',
                    '- `/clear`: Clear the terminal screen.',
                    '- `/reset`: Reset the chat session to model selection.',
                    '- `/model <name>`: Switch model (e.g., `/model pro`). Available: ' + AVAILABLE_MODELS.map(m => m.aliases[0]).join(', '),
                    '- `/search <on|off>`: Turn Google Search grounding on or off.',
                    '- `/image <prompt>`: Generate an image with the given prompt.',
                ], undefined);
                break;
            case 'clear':
                setHistory([]);
                break;
            case 'reset':
                initialize();
                break;
            case 'model': {
                const newModelAlias = argString.toLowerCase();
                const model = AVAILABLE_MODELS.find(m => m.aliases.includes(newModelAlias));
                if (model) {
                    setSelectedModel(model.id);
                    startNewChatSession(model.id, useGoogleSearch);
                    // FIX: Added undefined for the sources argument.
                    addMessage('system', `Model changed to **${model.name}**.`, undefined);
                } else {
                    // FIX: Added undefined for the sources argument.
                    addMessage('system', `Invalid model. Available: ${AVAILABLE_MODELS.map(m => m.aliases[0]).join(', ')}`, undefined);
                }
                break;
            }
            case 'search': {
                const setting = argString.toLowerCase();
                if (setting === 'on' || setting === 'off') {
                    const newSearchState = setting === 'on';
                    setUseGoogleSearch(newSearchState);
                    startNewChatSession(selectedModel, newSearchState);
                    // FIX: Added undefined for the sources argument.
                    addMessage('system', `Google Search is now **${newSearchState ? 'ON' : 'OFF'}**.`, undefined);
                } else {
                    // FIX: Added undefined for the sources argument.
                    addMessage('system', `Invalid setting. Use \`/search on\` or \`/search off\`.`, undefined);
                }
                break;
            }
            case 'image':
                await generateImage(argString);
                break;
            default:
                // FIX: Added undefined for the sources argument.
                addMessage('system', `Unknown command: \`/${cmd}\`. Type \`/help\` for a list of commands.`, undefined);
        }
    };

    const generateImage = async (prompt) => {
        if (!prompt) {
            // FIX: Added undefined for the sources argument.
            addMessage('system', 'Please provide a prompt for the image. Usage: `/image [your prompt]`', undefined);
            return;
        }
        // FIX: Added undefined for the sources argument.
        addMessage('system', `Generating image for: "${prompt}"...`, undefined);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: { parts: [{ text: prompt }] },
                config: { responseModalities: [Modality.IMAGE] },
            });

            let foundImage = false;
            for (const candidate of response.candidates || []) {
                for (const part of candidate.content.parts) {
                    if (part.inlineData) {
                        addMessage('gemini', `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`, undefined, true);
                        foundImage = true;
                        break;
                    }
                }
                if (foundImage) break;
            }
            if (!foundImage) throw new Error("No image data found in API response.");

            const modelName = AVAILABLE_MODELS.find(m => m.id === selectedModel)?.name || 'selected';
            // FIX: Added undefined for the sources argument.
            addMessage('system', `Returning to your chat with the ${modelName} model.`, undefined);
        } catch (error) {
            console.error("Image generation error:", error);
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            // FIX: Added undefined for the sources argument.
            addMessage('system', `Image Generation Error: ${errorMessage}`, undefined);
        }
    };
    
    const processChatMessage = async (prompt) => {
        try {
            if (!chat) throw new Error("Chat is not initialized.");

            const messageId = uuidv4();
            setHistory(prev => [...prev, { id: messageId, sender: 'gemini', content: '', sources: [], isImage: false }]);
            setIsStreaming(true);

            let currentText = '';
            const stream = await chat.sendMessageStream({ message: prompt });
            
            for await (const chunk of stream) {
                const text = chunk.text;
                const sources = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
                currentText += text;
                setHistory(prev => prev.map(msg => 
                    msg.id === messageId ? { ...msg, content: currentText, sources: sources || msg.sources } : msg
                ));
            }
        } catch (error) {
            console.error("API error:", error);
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            // FIX: Added undefined for the sources argument.
            addMessage('system', `Error: ${errorMessage}`, undefined);
        } finally {
            setIsStreaming(false);
        }
    };

    const handleUserInput = async (e) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userInput = input.trim();
        // FIX: Added undefined for the sources argument.
        addMessage('user', userInput, undefined);
        setInput('');

        setIsLoading(true);
        try {
            if (stage !== 'chatting') {
                await handleSetup(userInput.toLowerCase());
            } else if (userInput.startsWith('/')) {
                await handleCommand(userInput);
            } else {
                await processChatMessage(userInput);
            }
        } catch (error) {
            console.error(error);
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            // FIX: Added undefined for the sources argument.
            addMessage('system', `Error: ${errorMessage}`, undefined);
        }
        setIsLoading(false);
    };

    const getPlaceholderText = () => {
        if (isLoading) return "Processing...";
        switch(stage) {
            case 'model': return "Select a model (e.g., 'flash', 'pro', 'lite')...";
            case 'search': return "Enable Google Search? (y/n)...";
            case 'chatting': return "Type a message or `/help` for commands...";
            default: return "Type your command...";
        }
    };

    const renderContent = (msg) => {
        if (msg.isImage) {
            return <img src={msg.content} alt="Generated" className="mt-2 rounded-lg max-w-sm" />;
        }
       
        const rawMarkup = marked.parse(msg.content);

        const lastMessage = history[history.length - 1];
        if (isStreaming && msg.id === lastMessage.id && msg.sender === 'gemini') {
            return <div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: rawMarkup + `<span class="blinking-cursor inline-block w-[1px] h-4 bg-gray-800 dark:bg-gray-200 ml-1"></span>` }} />;
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