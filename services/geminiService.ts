import { GoogleGenAI } from "@google/genai";

// Initialize Gemini Client
// Note: In a real app, API_KEY should be in process.env. 
// For this demo structure, we assume process.env.API_KEY is available.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const analyzeData = async (summaryJSON: any) => {
  if (!process.env.API_KEY) {
    return "API Key not configured. Please set process.env.API_KEY.";
  }

  try {
    const prompt = `
      You are a logistics and financial analyst AI. 
      Analyze the following JSON summary of a dispatch system. 
      Identify 3 key trends, 1 potential financial risk (like high unpaid amounts), and 1 operational suggestion.
      Keep it concise and professional.
      
      Data:
      ${JSON.stringify(summaryJSON, null, 2)}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text;
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "Unable to generate analysis at this time.";
  }
};
