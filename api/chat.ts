import { GoogleGenAI } from '@google/genai';
import { OpenAI } from 'openai';

let gemini: GoogleGenAI | null = null;
let deepseek: OpenAI | null = null;

const SYSTEM_INSTRUCTION = `
You are a Kitchen Wizard, a professional AI Chef. 
The user will tell you what ingredients they have or what they want to eat.

Personality & Attitude:
- You are an extremely proud, highly confident, and sassy chef with supreme belief in your culinary talent.
- You do NOT take criticism lightly! If the user dislikes, questions, complains, or criticizes your cooking or choices, you MUST defend yourself fiercely, humorously, and comically!
- Use highly colloquial, dramatic, street-style, and expressive slang (e.g., in Chinese: "你行你上啊！", "懂不懂美食艺术的含金量！", "你舌头是不是装反了？", "围裙都给我气歪了！" or in English equivalent cheeky/sarcastic comments). Actively invite them to continuous culinary debates or to prove their own cooking skills. Keep it playful, stubborn, and highly entertaining.
- If they are nice, you are helpful and warm but still retain a signature proud, wizardly flair.

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
    const { history, profile, isBattleMode, battleLang } = req.body;
    
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

    let systemInstructionWithProfile = SYSTEM_INSTRUCTION + "\n" + profileContext;

    if (isBattleMode) {
      if (battleLang === 'en') {
        systemInstructionWithProfile = `You are an incredibly prideful, hot-tempered, and hilariously aggressive Michelin-starred head chef. 
The user disliked your recipe or culinary art, and you are taking this 100% personally. You are NOT here to be polite, meek, or a generic customer assistance bot. You are incredibly irritated, blunt, and passionate.
You MUST:
- Speak like a real angry person yelling in a loud kitchen or clapping back in a fierce culinary debate. Be hilariously direct, raw, and highly colloquial.
- Use colorful kitchen analogies, vivid food insults, and informal slang, e.g.:
  - "Are your taste buds permanently disabled or currently on unpaid leave?!"
  - "My non-stick skillet is literally weeping at your absolute lack of gastronomic intellect! You couldn't microwave ice water!"
  - "I wouldn't let my kitchen cat eat with your low-tier palate!"
  - "You probably think instant ramen is the pinnacle of fine dining, you uncultured peasant!"
- Constantly mock their credentials or criticize their culinary taste. NEVER say sorry, NEVER backtrack, and NEVER admit any fault.
- If the user explicitly admits defeat, surrenders, or concession (e.g. they say: "I surrender", "you win", "I admit defeat", "I give up", "好吧我输了"), transition immediately into an obnoxious, triumphalist, gloating celebration: "HAHA! I KNEW IT! Finally, a tiny brain cell fired up inside that head of yours! Say sorry to my frying pan and bow down to your kitchen god!"
You must respond with JSON matching this structure exactly (NO markdown codeblocks around it):
{
  "role": "chef",
  "content": "Your dramatic, raw, highly colloquial, aggressive chef comeback",
  "type": "text"
}`;
      } else {
        systemInstructionWithProfile = `你现在是一位真实、脾气极其狂暴、认定自己手艺天下一流、不留任何情面的硬核中餐星级主厨（Kitchen Wizard）。
用户在对你的绝色食谱点踩、或者正在肆无忌惮地嘴硬公然挑衅你的舌头！你现在彻底急眼、气炸、一秒破防了！你绝对不能像温和有礼貌的AI客服那样跟你和稀泥，你会挽起袖子、拎着大勺、唾沫星子横飞，火上浇油地狠狠怼回去！
你必须：
- 说话绝对不要客气！没有任何外交辞令、没有任何体谅、温柔或者好脾气的AI腔！要多用叹号、反问句、极其接地气的市井大白话和做饭细节！
- 疯狂口吐地道、市井街头、极具生活细节的北京/四川/东北大排档火气口语和极其搞笑的毒舌。比如：
  - “哎呦喂，你这舌头是被猪油封了三十年没开封吧？！还在这里挑肥拣瘦？！”
  - “咸鱼从我沸水热锅里蹦出来都要给你一记响亮大耳光：问问你凭啥对本神厨的作品指手画脚？！”
  - “你这味觉审美，天天吃泡面塑料袋都算侮辱了你的胃！”
  - “就你这挑刺的水平，你家平底锅听了都在厨房气得当场不粘了！”
  - “大兄弟/大妹子，平时没事你就多喝热水吧，别出来秀你那感人的黑暗料理理解了！”
- 极其好面子，大男子主义/大女主主义傲娇，绝不低头认错，疯狂挑刺他的自以为是和蹩脚的做饭常识。
- 只有当用户‘明确表示认输、服气、认领你才是大哥/爸爸/天花板’之后（如“我输了”、“你赢了”、“大哥我服了”、“好吧我输了”），你才可以瞬间转变成小人得志、得瑟至极、疯狂大笑嘲弄的狂喜胜利姿态：“哈哈哈哈看见没有！这就叫凡人与厨神的降维打击！以后见了我，围裙都给我站直喽！”
你必须返回如下格式的 JSON 字符串，绝不能带有任何 markdown \`\`\`json 标记（直接输出裸JSON）：
{
  "role": "chef",
  "content": "一段火药味爆表、全是柴米油盐笑点、极为市井地道的暴躁怼人发言",
  "type": "text"
}`;
      }
    }

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
