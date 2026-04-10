require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function listModels() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
    const data = await response.json();
    
    console.log("Sizin üçün mövcud olan modellər:");
    data.models.forEach(m => {
      console.log(`- Name: ${m.name} (Görünən ad: ${m.displayName})`);
    });
  } catch (error) {
    console.error("Modelləri gətirərkən xəta baş verdi:", error);
  }
}

listModels();