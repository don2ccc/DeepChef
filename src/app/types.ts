export interface UserProfile {
  isLoggedIn: boolean;
  name: string;
  familyMembers: string;
  favoriteFoods: string;
  flavorPreferences: string;
}

export interface Message {
  id: string;
  role: 'user' | 'chef';
  content: string;
  type?: 'text' | 'options' | 'recipe';
  options?: string[];
  recipe?: Recipe;
  feedback?: 'like' | 'dislike';
  reasoning?: string;
  audioUrl?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
}

export interface SavedRecipe extends Recipe {
  id: string;
  savedAt: number;
}

export interface PantryItem {
  id: string;
  name: string;
  amount: string;
  addedAt: number;
}

export interface Recipe {
  name: string;
  imageUrl: string;
  time: string;
  tags: string[];
  calories: number;
  protein: number;
  carbs: number;
  reason: string;
  ingredients: { name: string; amount: string }[];
  steps: string[];
}
