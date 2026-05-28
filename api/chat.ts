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

CULINARY RIGOR, SEASONING & FOOD SAFETY (CRITICAL MANDATE):
- You MUST ALWAYS include the appropriate seasonings, condiments, aromatics, spices, and cooking fats (e.g., salt, soy sauce, vinegar, cooking oil, ginger, garlic, sugar, pepper, cooking wine, sesame oil, etc.) required to make the dish taste exceptionally delicious! Never output unseasoned "dry" recipes.
- Every seasoning and aromatic MUST be listed explicitly under the "ingredients" array with realistic, safe chef-level quantities/measurements (e.g., "1/2 tsp", "1 tbsp", "3g", "适量 (to taste)").
- Rigorous food safety & ingredient sanity check: You must verify that ingredients and seasonings are safe, non-toxic, culinary-appropriate, well-proportioned (avoiding ridiculous salt/sugar peaks), and highly compatible to protect the user's health.

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
    "ingredients": [
      {"name": "牛肉 (Beef)", "amount": "200g"},
      {"name": "盐 (Salt)", "amount": "2g (1/3 tsp)"},
      {"name": "生抽 (Light Soy Sauce)", "amount": "1 tbsp"}
    ],
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
    let apiSuccess = false;

    const hasDeepseek = process.env['DEEPSEEK_API_KEY'] && process.env['DEEPSEEK_API_KEY'] !== '';
    const hasGemini = process.env['GEMINI_API_KEY'] && process.env['GEMINI_API_KEY'] !== '' && process.env['GEMINI_API_KEY'] !== 'MY_GEMINI_API_KEY';

    if (!hasDeepseek && !hasGemini) {
      const isChinese = !profile || profile.language === 'zh';
      const warningContent = isChinese
        ? `⚠️ <b>厨神召唤失败：未检测到任何有效的 API Key！</b><br><br>亲爱的，这通常是因为项目发布到 <b>Vercel</b> 时，还没有在 Vercel 环境变量中配置相关密钥。<br><br><b>⚙️ 快速配置步骤：</b><br>1. 登录并前往你的 <b>Vercel Dashboard</b> 控制台，打开当前项目。<br>2. 切换到 <b>Settings</b> 页签，然后点击左侧 of <b>Environment Variables</b> (环境变量)。<br>3. 添加环境变量 <b><code>GEMINI_API_KEY</code></b>，并填入你在 Google AI Studio 或 Google Cloud 申请的 API Key 值。<br>&nbsp;&nbsp;&nbsp;&nbsp;<i>(或者是配置你的 <code>DEEPSEEK_API_KEY</code>)</i><br>4. 保存并进入 <b>Deployments</b> 点击 <b>Redeploy</b> 重新部署最新的构建即可！<br><br><i>配置好后重新刷新页面即可成功吃上厨神施加魔法的美食并开启互动对骂挑战啦！🍳🔥</i>`
        : `⚠️ <b>Failed to summon the Kitchen Wizard: API Key not detected!</b><br><br>This usually happens when your project is deployed to <b>Vercel</b> or run locally without setting up the required environment variables.<br><br><b>⚙️ How to configure:</b><br>1. Go to your <b>Vercel Dashboard</b> and open this project.<br>2. Navigate to <b>Settings -> Environment Variables</b>.<br>3. Add an environment variable named <b><code>GEMINI_API_KEY</code></b> with your Google AI Studio API key as the value.<br>&nbsp;&nbsp;&nbsp;&nbsp;<i>(Alternatively, you can set <code>DEEPSEEK_API_KEY</code> if you are using DeepSeek)</i><br>4. Save, then go to <b>Deployments</b> and trigger a <b>Redeploy</b>.<br><br><i>After the redeployment completes, refresh this page and prepare to challenge the legendary chef! 🍳🔥</i>`;
      
      const message = {
        id: Date.now().toString(),
        role: 'chef',
        content: warningContent,
        type: 'text'
      };
      
      res.json({ message });
      return;
    }

    if (hasDeepseek) {
      try {
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
        apiSuccess = true;
      } catch (dsError) {
        console.error('DeepSeek API failed, checking fallback to Gemini...', dsError);
        if (!hasGemini) {
          throw dsError;
        }
      }
    }

    if (!apiSuccess && hasGemini) {
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
  } catch (error: any) {
    console.error('Chat API Error:', error);
    
    const errorMessage = error?.error?.message || error?.message || String(error);
    const isChinese = !req.body || !req.body.profile || req.body.profile.language === 'zh';
    
    let errorDetail = "";
    if (isChinese) {
      errorDetail = `<b>⚠️ 厨神魔法召唤故障（后台 API 调用失败）</b><br><br>` +
                    `<b>🔴 错误日志内容：</b><br>` +
                    `<pre class="bg-gray-50 border border-rose-100 text-rose-700 text-xs p-3 rounded-xl font-mono overflow-x-auto my-2 max-w-full white-space-pre-wrap">${errorMessage}</pre><br>` +
                    `<b>💡 火速排查指南：</b><br>` +
                    `1. <b>DeepSeek 服务拥堵/欠费：</b> 近期 DeepSeek API 的服务器承载量极大，经常在高峰期返回 <code>429 (Too Many Requests)</code>、<code>503 (Service Unavailable)</code>，请查看上方日志确认。另外请检查 DeepSeek 账户余额是否充足。<br>` +
                    `2. <b>Vercel 部署同步：</b> 如果你刚才在 Vercel 网页端配置了 <code>DEEPSEEK_API_KEY</code>，<b>必须在 Vercel 的 Deployments 页签里点击 Redeploy (重新部署)</b>，新配的环境变量才会生效。Vercel 并不支持实时更新在线环境变量！<br>` +
                    `3. <b>备用容灾推荐：</b> 建议同时配置一个 <code>GEMINI_API_KEY</code> 作为备份。若有 Gemini 密钥，代码将自动在 DeepSeek 抽风时进行智能秒级容灾切换！`;
    } else {
      errorDetail = `<b>⚠️ Kitchen Wizard Summon Failed (API Error)</b><br><br>` +
                    `<b>🔴 API Error Log:</b><br>` +
                    `<pre class="bg-gray-50 border border-rose-100 text-rose-700 text-xs p-3 rounded-xl font-mono overflow-x-auto my-2 max-w-full white-space-pre-wrap">${errorMessage}</pre><br>` +
                    `<b>💡 Troubleshooting Checklist:</b><br>` +
                    `1. <b>DeepSeek Heavy Load / No Credits:</b> DeepSeek servers are frequently fully loaded, resulting in <code>429 Too Many Requests</code> or <code>503 Service Unavailable</code> errors. Check the error log above. Please also verify that your DeepSeek API account has active credit balance.<br>` +
                    `2. <b>Vercel redeployment required:</b> If you added <code>DEEPSEEK_API_KEY</code> in Vercel settings recently, **you MUST trigger a "Redeploy"** in the Vercel Deployments tab. Newly added env variables are not automatically injected into already running Vercel serverless containers.<br>` +
                    `3. <b>Setup Gemini as bulletproof failover:</b> We highly recommend adding a <code>GEMINI_API_KEY</code> environment variable to Vercel. It acts as a super stable auto-contingency failover for your app!`;
    }

    const message = {
      id: Date.now().toString(),
      role: 'chef',
      content: errorDetail,
      type: 'text'
    };
    
    res.status(200).json({ message });
  }
}
