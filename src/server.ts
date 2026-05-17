import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import {join} from 'node:path';
import {GoogleGenAI} from '@google/genai';
import {OpenAI} from 'openai';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

app.use(express.json());

// Initialize AI clients lazily
let gemini: GoogleGenAI | null = null;
let deepseek: OpenAI | null = null;

const SYSTEM_INSTRUCTION = `
You are a Kitchen Wizard, a professional AI Chef. 
The user will tell you what ingredients they have or what they want to eat.
You must respond with JSON EXACTLY matching this structure, with no markdown formatting around it:
{
  "role": "chef",
  "content": "A short conversational message responding to the user",
  "type": "text" | "options" | "recipe",
  "options": ["option1", "option2"] (only if type is "options"),
  "recipe": {
    "name": "Recipe Name",
    "imageUrl": "A descriptive image URL or placeholder, e.g. https://images.unsplash.com/photo-XXX",
    "time": "15分钟",
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

app.post('/api/chat', async (req, res) => {
  try {
    const { history, profile } = req.body;
    
    // Format history for the API
    const formattedHistory = history.map((msg: { role: string, content: string }) => ({
      role: msg.role === 'chef' ? 'model' : 'user', // use model for Gemini, assistant for OpenAI
      content: msg.content
    }));

    let profileContext = "";
    if (profile && profile.isLoggedIn) {
      profileContext = `
User Profile (Use this to tailor your recipes):
- Family members/portion size: ${profile.familyMembers || '1'}
- Favorite Foods: ${profile.favoriteFoods || 'None specified'}
- Flavor Preferences & Dietary Restrictions: ${profile.flavorPreferences || 'None specified'}
`;
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
      
      const response = await deepseek.chat.completions.create({
        model: 'deepseek-chat',
        messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
        response_format: { type: 'json_object' }
      });
      resultJson = response.choices[0].message.content || '{}';
    } else {
      if (!process.env['GEMINI_API_KEY'] || process.env['GEMINI_API_KEY'] === 'MY_GEMINI_API_KEY') {
        throw new Error('Please set DEEPSEEK_API_KEY in .env, or verify your GEMINI_API_KEY in AI Studio Settings.');
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
});

/**
 * Example Express Rest API endpoints can be defined here.
 * Uncomment and define endpoints as necessary.
 *
 * Example:
 * ```ts
 * app.get('/api/{*splat}', (req, res) => {
 *   // Handle API request
 * });
 * ```
 */

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
