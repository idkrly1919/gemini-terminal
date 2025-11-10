import { GoogleGenAI, Chat, Modality } from "@google/genai";

const getAiClient = () => {
    if (!process.env.API_KEY) {
        throw new Error("API_KEY environment variable not set. Please set it in your environment.");
    }
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const initializeChat = (model: string, useGoogleSearch: boolean): Chat => {
    const ai = getAiClient();
    const config = useGoogleSearch ? { tools: [{ googleSearch: {} }] } : {};
    
    return ai.chats.create({
        model: model,
        config: config,
    });
};

export const generateImage = async (prompt: string): Promise<string> => {
    const ai = getAiClient();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image', // aka nano banana
            contents: {
                parts: [{ text: prompt }],
            },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });

        for (const candidate of response.candidates || []) {
            for (const part of candidate.content.parts) {
                if (part.inlineData) {
                    const base64ImageBytes: string = part.inlineData.data;
                    return `data:${part.inlineData.mimeType};base64,${base64ImageBytes}`;
                }
            }
        }
        throw new Error("No image data found in the API response.");
    } catch (error) {
        console.error("Error generating image:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        return `Error: Could not generate image. ${errorMessage}`;
    }
};
