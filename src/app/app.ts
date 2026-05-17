import {ChangeDetectionStrategy, Component, inject, signal, ViewChild, ElementRef, AfterViewChecked, OnInit} from '@angular/core';
import {ChatService} from './chat.service';
import {FormsModule} from '@angular/forms';
import {UserProfile, SavedRecipe, PantryItem, Recipe} from './types';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-root',
  imports: [FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements AfterViewChecked, OnInit {
  chatService = inject(ChatService);
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

  activeTab = signal<'chat' | 'library' | 'pantry'>('chat');
  savedRecipes = signal<SavedRecipe[]>([]);
  pantryItems = signal<PantryItem[]>([]);
  
  newPantryItemName = signal('');
  newPantryItemAmount = signal('');
  editingPantryId = signal<string | null>(null);
  
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

  startNewChat() {
    this.chatService.clearMessages();
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
      this.chatService.sendMessage(val, { ...this.userProfile(), pantry: this.pantryItems() });
      this.userInput.set('');
    }
  }

  sendOption(option: string) {
    this.chatService.sendMessage(option, { ...this.userProfile(), pantry: this.pantryItems() });
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
}

