/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Message } from './types';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  getDefaultMessage(): Message[] {
    let lang = 'zh';
    if (typeof localStorage !== 'undefined') {
      lang = localStorage.getItem('deepchef_lang') || 'zh';
    }
    return [
      {
        id: '1',
        role: 'chef',
        content: lang === 'zh' ? '今天想吃点什么？' : 'What would you like to eat today?',
        type: 'text'
      }
    ];
  }

  messages = signal<Message[]>([]);
  isLoading = signal<boolean>(false);
  private http = inject(HttpClient);

  constructor() {
    this.loadMessages();
  }

  private loadMessages() {
    try {
      const saved = localStorage.getItem('deepchef_messages');
      if (saved) {
        this.messages.set(JSON.parse(saved));
      } else {
        this.messages.set(this.getDefaultMessage());
      }
    } catch {
      this.messages.set(this.getDefaultMessage());
    }
  }

  private saveMessages(msgs: Message[]) {
    try {
      localStorage.setItem('deepchef_messages', JSON.stringify(msgs));
    } catch {
      // ignore
    }
  }

  clearMessages() {
    this.messages.set(this.getDefaultMessage());
    this.saveMessages(this.getDefaultMessage());
  }

  loadMessagesFromHistory(msgs: Message[]) {
    this.messages.set(msgs);
    this.saveMessages(msgs);
  }

  async sendMessage(content: string, profile?: any, audioUrl?: string) {
    // Add user message optimistically
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      type: 'text',
      audioUrl
    };
    
    this.messages.update(msgs => {
      const newMsgs = [...msgs, userMsg];
      this.saveMessages(newMsgs);
      return newMsgs;
    });
    this.isLoading.set(true);

    try {
      // Send to backend
      const response = await firstValueFrom(
        this.http.post<{ message: Message }>('/api/chat', { 
          history: this.messages(),
          profile
        })
      );
      
      if (response && response.message) {
         this.messages.update(msgs => {
           const newMsgs = [...msgs, response.message];
           this.saveMessages(newMsgs);
           return newMsgs;
         });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Fallback message for demo/errors
      this.messages.update(msgs => {
        const fallbackMsg: Message = {
          id: Date.now().toString(),
          role: 'chef',
          content: '抱歉，我的魔法暂时失效了，请稍后再试。'
        };
        const newMsgs = [...msgs, fallbackMsg];
        this.saveMessages(newMsgs);
        return newMsgs;
      });
    } finally {
      this.isLoading.set(false);
    }
  }

  sendFeedback(messageId: string, feedback: 'like' | 'dislike') {
    let triggerConfrontation = false;

    this.messages.update(msgs => {
      const target = msgs.find(m => m.id === messageId);
      // Trigger battle if target was not already disliked and is now being disliked
      if (feedback === 'dislike' && target && target.feedback !== 'dislike') {
        triggerConfrontation = true;
      }

      const newMsgs = msgs.map(m => m.id === messageId ? { ...m, feedback } : m);
      this.saveMessages(newMsgs);
      return newMsgs;
    });

    console.log(`Feedback ${feedback} saved for message ${messageId}`);

    if (triggerConfrontation) {
      this.triggerChefConfrontation();
    }
  }

  private triggerChefConfrontation() {
    this.isLoading.set(true);

    let lang = 'zh';
    if (typeof localStorage !== 'undefined') {
      lang = localStorage.getItem('deepchef_lang') || 'zh';
    }

    const zhResponses = [
      "我超！点踩？！本大厨呕心沥血的绝世配方你也敢点踩？来来来，你行你上，告诉我你想吃什么，不服咱们就地Battle！今天不把你喂饱喂服气，我这围裙就不解了！🔥",
      "什么？你居然对我的神级料理创意点踩？！我这烹饪火候、佐料调配，连米其林三星总厨见了都要原地膜拜！你居然说不好吃？你这舌头是不是早上出门忘带了？有本事咱们在聊天框里来一场主厨决斗！说吧，想比试哪道菜？😡",
      "点踩？好家伙，谁给你的勇气！我这可是注入了灵魂与魔法的美味佳肴！口水战有什么意思，有本事你把你的私人食材库或者拿手菜在聊天里发出来，看本神厨不分分钟重做出一道全方位吊打你的至尊料理！敢不敢单挑？来战！🔥",
      "绝了！居然还有人能对本大厨的神级食谱点踩？我的围裙气得当场歪成45度！行，今天我算是跟你杠上了。不服是吧？现在就把你要整活的食材发过来，看我怎么用实力征服你的挑剔胃口，打脸你的点踩行为！🤬",
      "一言不合就点踩，看来你骨骼惊奇、天赋异彩，是个难得的美食反骨仔啊！别光用小手点踩，有本事我们直接打字来一场烹饪辩论！今天本厨神有的是时间，随时迎战！放马过来！🔥",
      "我这旷古烁今、千锤百炼的精致料理居然得了倒赞？今天这后厨有你没我！说，是我的调料不合你意还是火候不够尊贵？不服挑刺是吧，有种随时来过招！🤬"
    ];

    const enResponses = [
      "Wait, what?! A thumbs down?! On MY culinary masterpiece?! Even Michelin-starred head chefs take secret notes from me! If you think you've got better chef game, say it to my shiny tall white hat! Drop your complaint or your favorite dish right now—let's freaking battle! 🤬🔥",
      "Oh no you didn't! A dislike on this gorgeous plate?! Is your tastebud currently offline or did you drop your tongue somewhere today?! Come on, step into the kitchen arena and let's have a legendary chef showdown! Tell me what you want, and prepare to be absolutely schooled! 😡🍳",
      "A dislike?! The absolute audacity! I literally poured my wizardly soul and three generations of kitchen magic into this. Are we beefing now? Because I'm 100% ready for an epic culinary confrontation! Challenge me with ANY ingredient and prepare to eat your words! 🤬",
      "Hold up, did you just dis my dish? Let's be real—you're just jealous of my absolute aesthetic genius in the kitchen. Let's battle! Drop your absolute favorite meal in the chat, and I will show you a mind-blowing version that will make you apologize to my spatula! Game on! 🔥"
    ];

    const responses = lang === 'en' ? enResponses : zhResponses;
    const randomResponse = responses[Math.floor(Math.random() * responses.length)];

    setTimeout(() => {
      this.isLoading.set(false);
      this.messages.update(msgs => {
        const battleMsg: Message = {
          id: Date.now().toString(),
          role: 'chef',
          content: randomResponse,
          type: 'text',
          isBattle: true
        };
        const newMsgs = [...msgs, battleMsg];
        this.saveMessages(newMsgs);
        return newMsgs;
      });
    }, 1200);
  }
}
