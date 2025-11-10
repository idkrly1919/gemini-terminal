// FIX: Switched from CommonJS require to ES Module import for TypeScript compatibility.
// FIX: Imported Chat and Modality types for better type safety and to follow SDK guidelines.
import { GoogleGenAI, Chat, Modality } from "@google/genai";

// A map to store active chat sessions in memory.
// In a real-world, scalable app, you'd use a database like Redis.
// FIX: Added type definition for the chat session map.
const chatSessions = new Map<string, Chat>();

const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method Not Allowed",
    };
  }

  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "API key is not configured on the server." }),
    };
  }
  
  try {
    const body = JSON.parse(event.body || "{}");
    const { prompt, model, useGoogleSearch, sessionId, command } = body;
    
    // Initialize chat on first message
    if (!chatSessions.has(sessionId)) {
        if (!model) {
            return { statusCode: 400, body: JSON.stringify({ error: "Model must be provided to initialize chat." }) };
        }
        const ai = new GoogleGenAI({ apiKey });
        const config = useGoogleSearch ? { tools: [{ googleSearch: {} }] } : {};
        const chat: Chat = ai.chats.create({ model, config });
        chatSessions.set(sessionId, chat);
    }
    
    const chat = chatSessions.get(sessionId);

    // Handle image generation command
    if (command === 'generateImage') {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: prompt }] },
            // FIX: Used Modality.IMAGE enum as per SDK guidelines.
            config: { responseModalities: [Modality.IMAGE] },
        });

        for (const candidate of response.candidates || []) {
            for (const part of candidate.content.parts) {
                if (part.inlineData) {
                    return {
                        statusCode: 200,
                        body: JSON.stringify({ imageUrl: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}` })
                    };
                }
            }
        }
       throw new Error("No image data found in API response.");
    }
    
    // Handle chat message streaming
    const stream = await chat.sendMessageStream({ message: prompt });
    
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const text = chunk.text;
          const sources = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
          const payload = { text, sources };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        }
        controller.close();
      },
    });

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
      body: readableStream,
    };

  } catch (error) {
    console.error("Error in Gemini function:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error instanceof Error ? error.message : "An unknown error occurred." }),
    };
  }
};

// FIX: Switched from CommonJS module.exports to ES Module export.
export { handler };
