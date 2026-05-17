import {ChangeDetectionStrategy, Component, inject, signal, ViewChild, ElementRef, AfterViewChecked, OnInit} from '@angular/core';
import {ChatService} from './chat.service';
import {FormsModule} from '@angular/forms';
import {UserProfile} from './types';

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

  showLoginModal = signal(false);
  showProfileModal = signal(false);
  
  tempProfile: Omit<UserProfile, 'isLoggedIn'> = {
    name: '',
    familyMembers: '1',
    favoriteFoods: '',
    flavorPreferences: ''
  };

  @ViewChild('chatContainer') private chatContainer!: ElementRef;

  ngOnInit() {
    this.loadProfile();
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
      this.chatService.sendMessage(val, this.userProfile());
      this.userInput.set('');
    }
  }

  sendOption(option: string) {
    this.chatService.sendMessage(option, this.userProfile());
  }

  submitFeedback(messageId: string, feedback: 'like' | 'dislike') {
    this.chatService.sendFeedback(messageId, feedback);
  }

  loginSimulate(name: string) {
    const userName = name.trim() || '大厨';
    const newProfile = { ...this.userProfile(), isLoggedIn: true, name: userName };
    this.userProfile.set(newProfile);
    this.persistProfile(newProfile);
    this.showLoginModal.set(false);
    this.openProfileModal();
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
    const newProfile = { ...this.userProfile(), ...this.tempProfile };
    this.userProfile.set(newProfile);
    this.persistProfile(newProfile);
    this.showProfileModal.set(false);
  }
}

