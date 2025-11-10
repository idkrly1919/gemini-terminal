import React, { useState, useEffect, useRef } from 'react';
import { marked } from 'marked';
import { Chat } from '@google/genai';
import { initializeChat, generateImage } from '../services/geminiService';
import { AVAILABLE_MODELS, ChatMessage } from '../types';

const ChevronRightIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="m9 18 6-6-6-6" />
    </svg>
);

const Terminal: React.FC = () => {
    const [stage, setStage] = useState<'model' | 'search' | 'chatting'>('model');
    const [selectedModel, setSelectedModel] = useState<string>('');
    const [chat, setChat] = useState<Chat | null>(null);

    const [history, setHistory] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [showSources, setShowSources] = useState<Record<string, boolean>>({});
    const [isApiKeyMissing, setIsApiKeyMissing] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);
    const endOfHistoryRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!process.env.API_KEY) {
            setIsApiKeyMissing(true);
            addMessage('system', [
                'ERROR: Gemini API Key not found.',
                'Please create a file named ".env" in the root of this project.',
                'Inside the .env file, add the following line:',
                'API_KEY=your_api_key_here',
                'Then, restart the development server.',
            ]);
        } else {
            addMessage('system', [
                'Welcome to the Gemini Interactive Terminal.',
                `First, choose a model. Type 'flash', 'pro', 'lite', or 'extra' for more options.`,
            ]);
        }
    }, []);

    useEffect(() => {
        inputRef.current?.focus();
    }, [isLoading, isApiKeyMissing]);

    useEffect(() => {
        endOfHistoryRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [history, isStreaming]);

    const addMessage = (sender: ChatMessage['sender'], content: string | string[], sources?: ChatMessage['sources'], isImage: boolean = false) => {
        setHistory(prev => [...prev, { id: Date.now().toString() + Math.random(), sender, content, sources, isImage }]);
    };

    const handleTerminalCommand = async (command: string) => {
        if (stage === 'model') {
            const extraModels = command === 'extra';
            if (extraModels) {
                const modelList = AVAILABLE_MODELS.map((m, i) => `${i + 1}. ${m.name} (${m.id})`);
                addMessage('system', ["Please choose a model by number:", ...modelList]);
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
                addMessage('system', `Model set to ${model.name}. Use Google Search for grounding? (y/n)`);
            } else {
                addMessage('system', "Invalid model selection. Type 'flash', 'pro', 'lite', or 'extra'.");
            }
        } else if (stage === 'search') {
            const useGoogleSearch = command === 'y' || command === 'yes';
            addMessage('system', `Google Search ${useGoogleSearch ? 'enabled' : 'disabled'}. You can now start chatting.`);
            try {
                const newChat = initializeChat(selectedModel, useGoogleSearch);
                setChat(newChat);
                setStage('chatting');
            } catch(e) {
                const errorMsg = e instanceof Error ? e.message : String(e);
                addMessage('system', `Error initializing chat session: ${errorMsg}`);
                setStage('model'); 
                addMessage('system', "Configuration reset. Please select a model again.");
            }
        } else if (stage === 'chatting') {
            if (!chat) {
                addMessage('system', 'Error: Chat not initialized. Resetting configuration.');
                setStage('model');
                return;
            }
            await processChat(chat, command);
        }
    };

    const processChat = async (chatInstance: Chat, prompt: string) => {
        if (prompt.startsWith('make an image')) {
            const imagePrompt = prompt.replace('make an image', '').trim();
            if (!imagePrompt) {
                addMessage('system', 'Please provide a prompt for the image. Usage: make an image [your prompt]');
                return;
            }
            addMessage('system', `Generating image for: "${imagePrompt}"...`);
            const imageUrl = await generateImage(imagePrompt);
            if (imageUrl.startsWith('Error:')) {
                addMessage('system', imageUrl);
            } else {
                addMessage('gemini', imageUrl, undefined, true);
            }
            const modelName = AVAILABLE_MODELS.find(m => m.id === selectedModel)?.name || 'selected';
            addMessage('system', `Returning to your chat with the ${modelName} model.`);
            return;
        }

        const messageId = Date.now().toString();
        setHistory(prev => [...prev, { id: messageId, sender: 'gemini', content: '', sources: [], isImage: false }]);
        setIsStreaming(true);

        try {
            const stream = await chatInstance.sendMessageStream({ message: prompt });
            let text = '';
            let finalResponse;
            for await (const chunk of stream) {
                text += chunk.text;
                setHistory(prev => prev.map(msg => msg.id === messageId ? { ...msg, content: text } : msg));
                finalResponse = chunk;
            }
            setHistory(prev => prev.map(msg => msg.id === messageId ? { ...msg, sources: finalResponse?.candidates?.[0]?.groundingMetadata?.groundingChunks } : msg));
        } catch (e) {
             const errorMsg = e instanceof Error ? e.message : String(e);
             setHistory(prev => prev.map(msg => msg.id === messageId ? { ...msg, content: `An error occurred: ${errorMsg}` } : msg));
        } finally {
            setIsStreaming(false);
        }
    };

    const handleUserInput = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading || isApiKeyMissing) return;

        const command = input.trim();
        addMessage('user', input);
        setInput('');

        setIsLoading(true);
        try {
            await handleTerminalCommand(command.toLowerCase());
        } catch (error) {
            console.error(error);
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            addMessage('system', `Error: ${errorMessage}`);
        }
        setIsLoading(false);
    };

    const renderContent = (msg: ChatMessage) => {
        if (msg.isImage) {
            return <img src={msg.content as string} alt="Generated" className="mt-2 rounded-lg max-w-sm" />;
        }
        if (Array.isArray(msg.content)) {
            return msg.content.map((line, index) => <div key={index}>{line}</div>);
        }

        let rawMarkup = marked.parse(msg.content as string) as string;
        
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
                                <p className="ml-2 flex-grow">{msg.content as string}</p>
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
                        placeholder={isApiKeyMissing ? "API Key not configured. See instructions above." : isLoading ? "Processing..." : "Type your command..."}
                        className="w-full bg-transparent p-2 ml-2 focus:outline-none"
                        disabled={isLoading || isApiKeyMissing}
                        aria-label="Terminal input"
                    />
                </div>
            </form>
        </div>
    );
};

export default Terminal;
