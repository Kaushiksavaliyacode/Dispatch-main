import { GoogleGenAI } from "@google/genai";

// Initialize Gemini Client
// The API key must be obtained exclusively from the environment variable process.env.API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeData = async (summaryJSON: any) => {
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