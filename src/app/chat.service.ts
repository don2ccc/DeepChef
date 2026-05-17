import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Message } from './types';
import { firstValueFrom } from 'rxjs';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase only if environment variables are provided
const supabaseUrl = ''; // Configured in backend or loaded somehow if we needed it client side.
// Wait, client side doesn't have access to process.env easily. 
// We will just do a console log stub for Supabase in this snippet to indicate where it goes.

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  messages = signal<Message[]>([
    {
      id: '1',
      role: 'chef',
      content: '今天想吃点什么？告诉我你的冰箱里有什么食材。',
      type: 'text'
    }
  ]);
  
  isLoading = signal<boolean>(false);

  constructor(private http: HttpClient) {}

  async sendMessage(content: string, profile?: any) {
    // Add user message optimistically
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      type: 'text'
    };
    
    this.messages.update(msgs => [...msgs, userMsg]);
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
         this.messages.update(msgs => [...msgs, response.message]);
         this.saveToSupabase(userMsg, response.message);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Fallback message for demo/errors
      this.messages.update(msgs => [...msgs, {
        id: Date.now().toString(),
        role: 'chef',
        content: '抱歉，我的魔法暂时失效了，请稍后再试。'
      }]);
    } finally {
      this.isLoading.set(false);
    }
  }

  private saveToSupabase(userMsg: Message, chefMsg: Message) {
    // This is where you would save to Supabase.
    // Example:
    // supabase.from('conversations').insert([{ user_msg: userMsg, chef_msg: chefMsg }])
    console.log('Would save to Supabase:', { userMsg, chefMsg });
  }

  sendFeedback(messageId: string, feedback: 'like' | 'dislike') {
    this.messages.update(msgs => msgs.map(m => m.id === messageId ? { ...m, feedback } : m));
    // Simulated backend call to update feedback in DB
    console.log(`Feedback ${feedback} saved for message ${messageId}`);
  }
}
