import React from 'react';
import Terminal from './components/Terminal.tsx';

const App = () => {
    return (
        <div className="fixed inset-0 w-full h-full bg-[#212121] text-gray-100 antialiased selection:bg-blue-500 selection:text-white overflow-hidden">
            <main className="w-full h-full relative">
                <Terminal />
            </main>
        </div>
    );
};

export default App;