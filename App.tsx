import React, { useState, useEffect } from 'react';
import Terminal from './components/Terminal.tsx';

const SunIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" />
    </svg>
);

const MoonIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
);

const App = () => {
    const [theme, setTheme] = useState('dark');

    useEffect(() => {
        const root = window.document.documentElement;
        root.classList.remove(theme === 'dark' ? 'light' : 'dark');
        root.classList.add(theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prevTheme => prevTheme === 'dark' ? 'light' : 'dark');
    };

    return (
        <div className="bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200 min-h-screen font-mono flex flex-col transition-colors duration-300">
            <header className="flex justify-between items-center bg-gray-200 dark:bg-gray-800 p-2 text-center text-sm text-gray-700 dark:text-gray-300 border-b border-gray-300 dark:border-gray-700">
                <div className="w-8"></div>
                <h1 className="font-semibold">Gemini Interactive Terminal</h1>
                <button onClick={toggleTheme} className="p-1 rounded-md hover:bg-gray-300 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {theme === 'dark' ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
                </button>
            </header>
            <main className="flex-grow p-2 sm:p-4">
                <Terminal />
            </main>
        </div>
    );
};

export default App;