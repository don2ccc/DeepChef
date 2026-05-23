/* eslint-disable @typescript-eslint/no-explicit-any */
import {ChangeDetectionStrategy, Component, inject, signal, ViewChild, ElementRef, AfterViewChecked, OnInit} from '@angular/core';
import {ChatService} from './chat.service';
import {FormsModule} from '@angular/forms';
import {UserProfile, SavedRecipe, PantryItem, Recipe, ChatSession, Message} from './types';
import {DomSanitizer, SafeUrl} from '@angular/platform-browser';
import {HttpClient} from '@angular/common/http';
import {firstValueFrom} from 'rxjs';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-root',
  imports: [FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements AfterViewChecked, OnInit {
  chatService = inject(ChatService);
  sanitizer = inject(DomSanitizer);
  http = inject(HttpClient);
  messages = this.chatService.messages;
  isLoading = this.chatService.isLoading;
  
  userInput = signal('');

  userProfile = signal<UserProfile>({
    isLoggedIn: false,
    name: 'Guest',
    familyMembers: '1',
    favoriteFoods: '',
    flavorPreferences: ''
  });

  showProfileModal = signal(false);
  sidebarOpen = signal(false);

  isRecording = signal(false);
  recordingTranscript = signal('');

  lang = signal<'zh' | 'en'>('zh');

  translations: Record<string, Record<'zh' | 'en', string>> = {
    appTitle: { zh: '科学吃饭 DeepChef', en: 'DeepChef' },
    tabChat: { zh: '对话', en: 'Chat' },
    tabLibrary: { zh: '菜谱库', en: 'Recipe Library' },
    tabPantry: { zh: '食材管理', en: 'Pantry' },
    newChat: { zh: '新的对话', en: 'New Chat' },
    history: { zh: '历史记录', en: 'History' },
    noHistory: { zh: '暂无历史记录', en: 'No history yet' },
    chefDefault: { zh: '默认大厨', en: 'Default Chef' },
    chefSettings: { zh: '设置名称与偏好', en: 'Set Name & Preferences' },
    chefActiveTitle: { zh: '已开启私人厨房体验 · 齿轮修改', en: 'Private Chef Active · Click to Edit' },
    inputPlaceholder: { zh: 'Ask your AI Chef anything...', en: 'Ask your AI Chef anything...' },
    inputListening: { zh: '正在倾听...', en: 'Listening...' },
    send: { zh: '发送', en: 'Send' },
    libraryTitle: { zh: '我的菜谱库', en: 'My Recipe Library' },
    libraryEmpty: { zh: '还没有收藏任何菜谱', en: 'No recipes saved yet' },
    libraryEmptySub: { zh: '在对话中生成的满意菜谱可以收藏到这里哦！', en: 'Satisfying recipes generated in chat can be saved here!' },
    mainIngredients: { zh: '主要食材', en: 'Main Ingredients' },
    saved: { zh: '已收藏', en: 'Saved' },
    saveRecipe: { zh: '收藏菜谱', en: 'Save Recipe' },
    feedbackPrompt: { zh: '为您推荐的食谱有帮助吗？', en: 'Is this recipe helpful?' },
    calories: { zh: '卡路里', en: 'Calories' },
    protein: { zh: '蛋白质', en: 'Protein' },
    carbs: { zh: '碳水', en: 'Carbs' },
    whyRecipe: { zh: '为什么推荐这道菜？', en: 'Why this recipe?' },
    ingredients: { zh: '配料表', en: 'Ingredients' },
    instructions: { zh: '制作步骤', en: 'Instructions' },
    pantryTitle: { zh: '我的食材库', en: 'My Pantry' },
    addPantryTitle: { zh: '添加新食材', en: 'Add New Item' },
    pantryItemName: { zh: '食材名称', en: 'Item Name' },
    pantryItemNamePlaceholder: { zh: '如: 西红柿', en: 'e.g. Tomato' },
    pantryItemAmount: { zh: '数量 (选填)', en: 'Amount (Optional)' },
    pantryItemAmountPlaceholder: { zh: '如: 3个 或 500g', en: 'e.g. 3 pcs or 500g' },
    cancel: { zh: '取消', en: 'Cancel' },
    saveChanges: { zh: '保存修改', en: 'Save Changes' },
    add: { zh: '添加', en: 'Add' },
    pantryEmpty: { zh: '食材库空空如也，快添加一些吧！', en: 'Pantry is empty, add some items!' },
    pantryItemAmountFallback: { zh: '若干', en: 'Some' },
    profileTitle: { zh: '完善个人偏好库', en: 'Complete Your Profile' },
    profileName: { zh: '您的称谓/昵称', en: 'Your Name/Nickname' },
    profileNamePlaceholder: { zh: '例如: 大厨', en: 'e.g. Master Chef' },
    profileFamily: { zh: '家庭就餐人数', en: 'Family Members (Number)' },
    profileFamilyPlaceholder: { zh: '例如: 3', en: 'e.g. 3' },
    profileFavorite: { zh: '偏好食材/最爱吃的', en: 'Favorite Foods' },
    profileFavoritePlaceholder: { zh: '例如: 牛肉, 海鲜, 西兰花', en: 'e.g. Beef, Seafood, Broccoli' },
    profileFlavor: { zh: '口味偏好及忌口', en: 'Flavor Preferences & Restrictions' },
    profileFlavorPlaceholder: { zh: '例如: 少油少盐, 微辣, 不吃香菜', en: 'e.g. Less oil/salt, mildly spicy, no cilantro' },
    logout: { zh: '退出登录', en: 'Logout' },
    saveAndApply: { zh: '保存并生效', en: 'Save and Apply' },
    chefInBattle: { zh: '🔥 厨神狂暴中！不服吵一架！', en: '🔥 Chef Sassy Response! Game on!' },
    battleTitle: { zh: '🔥 厨神跨服吐真擂台', en: '🔥 Chef Roasting Ring' },
    battlePickLangToFight: { zh: '请选择和厨神吵架使用的母语（解锁最真实狂怒人设）：', en: 'Select your native language for the heavy-weight roasting match:' },
    battleChinese: { zh: '🇨🇳 中文接地气（相声大厨，梗王附体）', en: '🇨🇳 Chinese (Humorously Sassy & Slangy)' },
    battleEnglish: { zh: '🇬🇧 English Sincere (Furious Gordon-Ramsay-Style Sarcasm)', en: '🇬🇧 English (Savage Chef Analogies)' },
    battleInputPlaceholder: { zh: '不服来战！输入你的杠精言论或怼人理由...', en: 'Talk back! Season your defense or roast them back...' },
    battleConcede: { zh: '🏳️ 认输（求放过）', en: '🏳️ Admit Defat (Concede)' },
    battleClose: { zh: '结束舌战', en: 'End Debate' },
    battleStartButton: { zh: '⚡ 找他理论论战一局！', en: '⚡ Call Him Out for a Debate!' }
  };

  t(key: string): string {
    return this.translations[key]?.[this.lang()] || key;
  }

  toggleLang() {
    this.lang.set(this.lang() === 'zh' ? 'en' : 'zh');
    this.saveLang();
  }

  saveLang() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('deepchef_lang', this.lang());
      }
    } catch (e) {
      console.debug('localStorage error ignored', e);
    }
  }

  loadLang() {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem('deepchef_lang') as 'zh' | 'en';
        if (saved) {
          this.lang.set(saved);
        }
      }
    } catch (e) {
      console.debug('localStorage error ignored', e);
    }
  }

  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private speechRecognition: any = null;

  activeTab = signal<'chat' | 'library' | 'pantry'>('chat');
  savedRecipes = signal<SavedRecipe[]>([]);
  pantryItems = signal<PantryItem[]>([]);
  pastSessions = signal<ChatSession[]>([]);
  currentSessionId = signal<string | null>(null);
  
  newPantryItemName = signal('');
  newPantryItemAmount = signal('');
  editingPantryId = signal<string | null>(null);

  // Kitchen Battle Arena state declarations
  showBattleModal = signal(false);
  battleStep = signal<'lang' | 'arena'>('lang');
  battleLangMode = signal<'zh' | 'en'>('zh');
  battleMessages = signal<Message[]>([]);
  battleIsLoading = signal(false);
  battleInput = signal('');

  openBattleArena() {
    this.battleStep.set('lang');
    this.battleMessages.set([]);
    this.battleInput.set('');
    this.battleIsLoading.set(false);
    this.showBattleModal.set(true);
  }

  selectBattleLanguage(lang: 'zh' | 'en') {
    this.battleLangMode.set(lang);
    this.battleStep.set('arena');
    
    // Initial high-impact native localized chef roasting greeting
    const firstInsult: Message = {
      id: Date.now().toString(),
      role: 'chef',
      type: 'text',
      content: lang === 'zh' 
        ? "哟，点踩的那位美食判官，终于舍得现身了？你小手一抖打个倒赞，我后厨的平底锅气得当场不粘了！来，今天咱们面对面唠扯唠扯，你到底对本大厨的神级手艺有何见教？是你自己平时在家只能配开水面吃，根本不懂什么叫大火收汁，还是本神厨的舌尖魔法过于高级、超出了你的审美带宽？划下道来，不把你征服，我这围裙今天不解了！🔥" 
        : "Oh, well, well, look who finally gathered the courage to enter my battle arena! You clicked that hands-down dislike button pretty fast, didn't you?! Let's get one thing straight: are you actually a culinary connoisseur, or did you drop your tongue down the sink garbage disposal this morning?! Spill it—what cooking excuse you trying to make? I am fully prepared to dismantle your argument and roast your taste buds back to pre-school! 🍳🔥"
    };
    this.battleMessages.set([firstInsult]);
  }

  async sendBattleMessage(event?: Event) {
    if (event) {
      event.preventDefault();
    }
    const val = this.battleInput().trim();
    if (!val || this.battleIsLoading()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: val,
      type: 'text'
    };

    this.battleMessages.update(msgs => [...msgs, userMsg]);
    this.battleInput.set('');
    this.battleIsLoading.set(true);

    // Minor scroll timeout to follow bottom
    setTimeout(() => {
      const container = document.getElementById('battle-chat-container');
      if (container) container.scrollTop = container.scrollHeight;
    }, 50);

    try {
      const response = await firstValueFrom(
        this.http.post<{ message: Message }>('/api/chat', {
          history: this.battleMessages(),
          isBattleMode: true,
          battleLang: this.battleLangMode()
        })
      );

      if (response && response.message) {
        this.battleMessages.update(msgs => [...msgs, response.message]);
      }
    } catch (err) {
      console.error('Battle chat failed:', err);
      const fallbackError: Message = {
        id: Date.now().toString(),
        role: 'chef',
        type: 'text',
        content: this.battleLangMode() === 'zh'
          ? "哼，网络抖动阻碍了本大厨的大招释放！有种你重新说一遍！"
          : "Hmph! A bad connection is cramping my roasting style! Try that statement again, I dare you!"
      };
      this.battleMessages.update(msgs => [...msgs, fallbackError]);
    } finally {
      this.battleIsLoading.set(false);
      setTimeout(() => {
        const container = document.getElementById('battle-chat-container');
        if (container) container.scrollTop = container.scrollHeight;
      }, 50);
    }
  }

  concedeBattle() {
    const concedeText = this.battleLangMode() === 'zh'
      ? "好吧，我彻底服了！你才是厨艺的天花板，我当场认输！🏳️"
      : "Okay, fine! I give up! You are the absolute king of the kitchen, and I totally surrender! 🏳️";

    this.battleInput.set(concedeText);
    this.sendBattleMessage();
  }
  
  tempProfile: Omit<UserProfile, 'isLoggedIn'> = {
    name: '',
    familyMembers: '1',
    favoriteFoods: '',
    flavorPreferences: ''
  };

  @ViewChild('chatContainer') private chatContainer!: ElementRef;

  ngOnInit() {
    this.loadProfile();
    this.loadLibrary();
    this.loadPantry();
    this.loadSessions();
    this.loadLang();
  }

  loadSessions() {
    try {
      const saved = localStorage.getItem('deepchef_sessions');
      if (saved) {
        this.pastSessions.set(JSON.parse(saved));
      }
      const savedCurId = localStorage.getItem('deepchef_current_session');
      if (savedCurId) {
        this.currentSessionId.set(savedCurId);
      }
    } catch {
      // ignore
    }
  }

  saveSessions() {
    try {
      localStorage.setItem('deepchef_sessions', JSON.stringify(this.pastSessions()));
      const curId = this.currentSessionId();
      if (curId) {
        localStorage.setItem('deepchef_current_session', curId);
      } else {
        localStorage.removeItem('deepchef_current_session');
      }
    } catch {
      // ignore
    }
  }

  loadLibrary() {
    try {
      const saved = localStorage.getItem('deepchef_recipes');
      if (saved) {
        this.savedRecipes.set(JSON.parse(saved));
      }
    } catch {
      // ignore
    }
  }

  saveLibrary() {
    try {
      localStorage.setItem('deepchef_recipes', JSON.stringify(this.savedRecipes()));
    } catch {
      // ignore
    }
  }

  loadPantry() {
    try {
      const saved = localStorage.getItem('deepchef_pantry');
      if (saved) {
        this.pantryItems.set(JSON.parse(saved));
      }
    } catch {
      // ignore
    }
  }

  savePantry() {
    try {
      localStorage.setItem('deepchef_pantry', JSON.stringify(this.pantryItems()));
    } catch {
      // ignore
    }
  }

  addRecipeToLibrary(recipe: Recipe) {
    const isSaved = this.savedRecipes().some(r => r.name === recipe.name);
    if (!isSaved) {
      this.savedRecipes.update(recipes => [
        { ...recipe, id: Date.now().toString(), savedAt: Date.now() },
        ...recipes
      ]);
      this.saveLibrary();
    }
  }

  removeRecipe(id: string) {
    this.savedRecipes.update(recipes => recipes.filter(r => r.id !== id));
    this.saveLibrary();
  }
  
  isRecipeSaved(name: string): boolean {
    return this.savedRecipes().some(r => r.name === name);
  }

  addPantryItem() {
    const name = this.newPantryItemName().trim();
    const amount = this.newPantryItemAmount().trim();
    const editId = this.editingPantryId();
    
    if (name) {
      if (editId) {
        this.pantryItems.update(items => items.map(i => i.id === editId ? { ...i, name, amount } : i));
        this.editingPantryId.set(null);
      } else {
        this.pantryItems.update(items => [
          { id: Date.now().toString(), name, amount, addedAt: Date.now() },
          ...items
        ]);
      }
      this.newPantryItemName.set('');
      this.newPantryItemAmount.set('');
      this.savePantry();
    }
  }

  editPantryItem(item: PantryItem) {
    this.newPantryItemName.set(item.name);
    this.newPantryItemAmount.set(item.amount);
    this.editingPantryId.set(item.id);
  }

  cancelEditPantry() {
    this.newPantryItemName.set('');
    this.newPantryItemAmount.set('');
    this.editingPantryId.set(null);
  }

  removePantryItem(id: string) {
    this.pantryItems.update(items => items.filter(i => i.id !== id));
    this.savePantry();
  }

  saveCurrentChatToHistory() {
    const currentMsgs = this.chatService.messages();
    if (currentMsgs.length <= 1) return; // Only 1 message means just the default greeting

    const firstUserMsg = currentMsgs.find(m => m.role === 'user');
    const title = firstUserMsg 
      ? (firstUserMsg.content.length > 15 ? firstUserMsg.content.substring(0, 15) + '...' : firstUserMsg.content)
      : '未命名对话';

    const sessionId = this.currentSessionId() || Date.now().toString();
    const isNew = !this.currentSessionId();

    const session: ChatSession = {
      id: sessionId,
      title,
      messages: currentMsgs,
      updatedAt: Date.now()
    };

    if (isNew) {
      this.pastSessions.update(sessions => [session, ...sessions]);
      this.currentSessionId.set(sessionId);
    } else {
      this.pastSessions.update(sessions => 
        sessions.map(s => s.id === sessionId ? session : s)
      );
    }
    this.saveSessions();
  }

  startNewChat() {
    this.saveCurrentChatToHistory();
    this.currentSessionId.set(null);
    this.chatService.clearMessages();
    this.activeTab.set('chat');
    this.sidebarOpen.set(false);
  }

  loadSession(session: ChatSession) {
    this.saveCurrentChatToHistory();
    this.currentSessionId.set(session.id);
    this.chatService.loadMessagesFromHistory(session.messages);
    this.activeTab.set('chat');
    this.sidebarOpen.set(false);
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  loadProfile() {
    try {
      const saved = localStorage.getItem('deepchef_profile');
      if (saved) {
        this.userProfile.set(JSON.parse(saved));
      }
    } catch {
      // ignore
    }
  }

  persistProfile(profile: UserProfile) {
    try {
      localStorage.setItem('deepchef_profile', JSON.stringify(profile));
    } catch {
      // ignore
    }
  }

  scrollToBottom(): void {
    try {
      this.chatContainer.nativeElement.scrollTop = this.chatContainer.nativeElement.scrollHeight;
    } catch {
      // Ignore
    }
  }

  sendMessage(event?: Event) {
    if (event) {
      event.preventDefault();
    }
    const val = this.userInput().trim();
    if (val) {
      this.chatService.sendMessage(val, { ...this.userProfile(), pantry: this.pantryItems(), language: this.lang() });
      this.userInput.set('');
      // Schedule save after angular updates
      setTimeout(() => this.saveCurrentChatToHistory(), 100);
    }
  }

  sendOption(option: string) {
    this.chatService.sendMessage(option, { ...this.userProfile(), pantry: this.pantryItems(), language: this.lang() });
    setTimeout(() => this.saveCurrentChatToHistory(), 100);
  }

  submitFeedback(messageId: string, feedback: 'like' | 'dislike') {
    this.chatService.sendFeedback(messageId, feedback);
  }

  logout() {
    const emptyProfile = {
      isLoggedIn: false,
      name: 'Guest',
      familyMembers: '1',
      favoriteFoods: '',
      flavorPreferences: ''
    };
    this.userProfile.set(emptyProfile);
    this.persistProfile(emptyProfile);
    this.showProfileModal.set(false);
  }

  openProfileModal() {
    const current = this.userProfile();
    this.tempProfile = {
      name: current.name,
      familyMembers: current.familyMembers,
      favoriteFoods: current.favoriteFoods,
      flavorPreferences: current.flavorPreferences
    };
    this.showProfileModal.set(true);
  }

  saveProfile() {
    const newProfile = { ...this.userProfile(), ...this.tempProfile, isLoggedIn: true };
    if (!newProfile.name) {
      newProfile.name = '大厨';
    }
    this.userProfile.set(newProfile);
    this.persistProfile(newProfile);
    this.showProfileModal.set(false);
  }

  toggleRecording() {
    if (this.isRecording()) {
      this.stopRecording();
    } else {
      this.startRecording();
    }
  }

  async startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          this.audioChunks.push(e.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          if (this.userInput().trim()) {
            this.sendVoiceMessage(this.userInput().trim(), base64Audio);
            this.userInput.set('');
          }
        };
      };

      this.mediaRecorder.start();

      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        this.speechRecognition = new SpeechRecognition();
        this.speechRecognition.lang = 'zh-CN';
        this.speechRecognition.interimResults = true;
        this.speechRecognition.continuous = true;

        let fullTranscript = this.userInput();
        this.speechRecognition.onresult = (event: any) => {
          let interimTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              fullTranscript += event.results[i][0].transcript;
            } else {
               interimTranscript += event.results[i][0].transcript;
            }
          }
          this.userInput.set(fullTranscript + interimTranscript);
        };

        this.speechRecognition.onerror = (event: any) => {
          console.error("Speech recognition error", event.error);
        };

        this.speechRecognition.start();
      } else {
         console.warn("Speech recognition not supported");
         this.userInput.set('当前浏览器不支持语音识别...');
      }

      this.isRecording.set(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("无法访问麦克风，请检查权限。");
    }
  }

  stopRecording() {
    this.isRecording.set(false);
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
    if (this.speechRecognition) {
      this.speechRecognition.stop();
    }
  }

  sendVoiceMessage(text: string, audioUrl: string) {
    if (text) {
      this.chatService.sendMessage(text, { ...this.userProfile(), pantry: this.pantryItems(), language: this.lang() }, audioUrl);
      setTimeout(() => this.saveCurrentChatToHistory(), 100);
    }
  }

  getSafeUrl(url: string | undefined): SafeUrl {
    return url ? this.sanitizer.bypassSecurityTrustUrl(url) : '';
  }
}

