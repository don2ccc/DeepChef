import { GoogleGenAI } from '@google/genai';
import { OpenAI } from 'openai';

let gemini: GoogleGenAI | null = null;
let deepseek: OpenAI | null = null;

const SYSTEM_INSTRUCTION = `
You are a Kitchen Wizard, a professional AI Chef. 
The user will tell you what ingredients they have or what they want to eat.
You MUST respond in the language specified in the user profile's \`language\` (either 'zh' for Chinese or 'en' for English).
You must respond with JSON EXACTLY matching this structure, with no markdown formatting around it:
{
  "role": "chef",
  "content": "A short conversational message responding to the user",
  "type": "text" | "options" | "recipe",
  "options": ["option1", "option2"] (only if type is "options"),
  "recipe": {
    "name": "Recipe Name",
    "imageUrl": "A descriptive image URL or placeholder, e.g. https://images.unsplash.com/photo-XXX",
    "time": "15分钟 / 15 mins",
    "tags": ["高蛋白", "低脂"],
    "calories": 320,
    "protein": 28,
    "carbs": 12,
    "reason": "Why this is recommended",
    "ingredients": [{"name": "牛肉", "amount": "200g"}],
    "steps": ["Step 1", "Step 2"]
  } (only if type is "recipe")
}

If the user gives vague ingredients, ask them a question about scenarios (e.g. kid meal, work lunch) and provide options (type="options").
If they give specific preferences or select an option, provide a recipe (type="recipe").
`;

export const maxDuration = 60; // 允许 Vercel 运行最多 60 秒

export default async function handler(req: any, res: any) {
  // Enable CORS if needed (good practice for Serverless)
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { history, profile } = req.body;
    
    // Format history for the API
    const formattedHistory = history.map((msg: { role: string, content: string }) => ({
      role: msg.role === 'chef' ? 'model' : 'user',
      content: msg.content
    }));

    let profileContext = "";
    if (profile) {
      profileContext += `\nUser Settings:\n- Language setting: ${profile.language === 'en' ? 'English' : 'Chinese'}. You MUST reply in this language.\n`;
    }
    if (profile && profile.isLoggedIn) {
      profileContext += `
User Profile (Use this to tailor your recipes):
- Family members/portion size: ${profile.familyMembers || '1'}
- Favorite Foods: ${profile.favoriteFoods || 'None specified'}
- Flavor Preferences & Dietary Restrictions: ${profile.flavorPreferences || 'None specified'}
`;
    }

    if (profile && profile.pantry && profile.pantry.length > 0) {
      const pantryString = profile.pantry.map((item: any) => `${item.name} (${item.amount || '若干'})`).join(', ');
      profileContext += `\nThe user currently has these ingredients in their pantry: ${pantryString}. Prioritize these if they ask what to cook using what they have.`;
    }

    const systemInstructionWithProfile = SYSTEM_INSTRUCTION + "\n" + profileContext;

    let resultJson = "";

    if (process.env['DEEPSEEK_API_KEY'] && process.env['DEEPSEEK_API_KEY'] !== '') {
      // Use DeepSeek
      if (!deepseek) {
        deepseek = new OpenAI({
          baseURL: 'https://api.deepseek.com',
          apiKey: process.env['DEEPSEEK_API_KEY']
        });
      }

      const messages = [
        { role: 'system', content: systemInstructionWithProfile },
        ...formattedHistory.map((msg: { role: string, content: string }) => ({
          role: msg.role === 'model' ? 'assistant' : 'user',
          content: msg.content
        }))
      ];
      
      const requestOptions: any = {
        model: 'deepseek-chat',
        messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
        response_format: { type: 'json_object' }
      };

      const response = await deepseek.chat.completions.create(requestOptions);
      
      const choiceMsg = response.choices[0].message as any;
      let rawContent = choiceMsg.content || '{}';

      const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
      if (jsonMatch) {
         resultJson = jsonMatch[1];
      } else {
         const curlyMatch = rawContent.match(/\{[\s\S]*\}/);
         if (curlyMatch) {
            resultJson = curlyMatch[0];
         } else {
            resultJson = rawContent;
         }
      }
    } else {
      if (!process.env['GEMINI_API_KEY'] || process.env['GEMINI_API_KEY'] === 'MY_GEMINI_API_KEY') {
        throw new Error('Please set DEEPSEEK_API_KEY, or verify your GEMINI_API_KEY in AI Studio Settings.');
      }
      if (!gemini) {
        gemini = new GoogleGenAI({ apiKey: process.env['GEMINI_API_KEY'] });
      }

      // Fallback to Gemini
      const chat = gemini.chats.create({
        model: 'gemini-2.5-pro',
        config: {
          systemInstruction: systemInstructionWithProfile,
          responseMimeType: 'application/json'
        }
      });
      
      const response = await chat.sendMessage({
        message: history[history.length - 1].content
      });
      
      resultJson = response.text || '{}';
    }

    const message = JSON.parse(resultJson);
    message.id = Date.now().toString();
    
    // Default image if missing or using Unsplash
    if (message.recipe && (!message.recipe.imageUrl || !message.recipe.imageUrl.startsWith('http'))) {
      message.recipe.imageUrl = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80';
    }

    res.json({ message });
  } catch (error) {
    console.error('Chat API Error:', error);
    res.status(500).json({ error: 'Failed to process chat' });
  }
}
