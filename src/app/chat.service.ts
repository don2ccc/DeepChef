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
  private readonly DEFAULT_MESSAGES: Message[] = [
    {
      id: '1',
      role: 'chef',
      content: '今天想吃点什么？告诉我你的冰箱里有什么食材。',
      type: 'text'
    }
  ];

  messages = signal<Message[]>([]);
  isLoading = signal<boolean>(false);

  constructor(private http: HttpClient) {
    this.loadMessages();
  }

  private loadMessages() {
    try {
      const saved = localStorage.getItem('deepchef_messages');
      if (saved) {
        this.messages.set(JSON.parse(saved));
      } else {
        this.messages.set(this.DEFAULT_MESSAGES);
      }
    } catch {
      this.messages.set(this.DEFAULT_MESSAGES);
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
    this.messages.set(this.DEFAULT_MESSAGES);
    this.saveMessages(this.DEFAULT_MESSAGES);
  }

  async sendMessage(content: string, profile?: any) {
    // Add user message optimistically
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      type: 'text'
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
    this.messages.update(msgs => {
      const newMsgs = msgs.map(m => m.id === messageId ? { ...m, feedback } : m);
      this.saveMessages(newMsgs);
      return newMsgs;
    });
    console.log(`Feedback ${feedback} saved in local storage for message ${messageId}`);
  }
}
