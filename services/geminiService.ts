import { GroundingChunk } from '@google/genai';

export interface StreamChunk {
    text?: string;
    sources?: GroundingChunk[];
    error?: string;
    imageUrl?: string;
}

export const sendMessage = async (
    prompt: string,
    model: string,
    useGoogleSearch: boolean,
    sessionId: string,
    onChunk: (chunk: StreamChunk) => void
): Promise<void> => {
    try {
        const response = await fetch('/.netlify/functions/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, model, useGoogleSearch, sessionId }),
        });

        if (!response.body) {
            throw new Error("Response body is null");
        }
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Request failed with status ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunkStr = decoder.decode(value);
            const lines = chunkStr.split('\n\n');
            
            for (const line of lines) {
                 if (line.startsWith('data:')) {
                    const data = JSON.parse(line.substring(5));
                    onChunk(data);
                }
            }
        }
    } catch (error) {
        console.error("Streaming error:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        onChunk({ error: errorMessage });
    }
};


export const generateImage = async (prompt: string, sessionId: string): Promise<StreamChunk> => {
    try {
        const response = await fetch('/.netlify/functions/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, sessionId, command: 'generateImage' }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Request failed with status ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error("Image generation error:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        return { error: `Could not generate image. ${errorMessage}` };
    }
};
