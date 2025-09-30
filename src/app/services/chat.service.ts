import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, of, Subscription, timer } from 'rxjs';
import { map, tap, catchError, switchMap, distinctUntilChanged } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface ChatMessage {
  id: string;
  user: string;
  user_id: string;
  message: string;
  timestamp: string;
  room: string;
  type: 'message' | 'system';
}

export interface ChatStats {
  total_messages: number;
  messages_today: number;
  online_users: number;
  timestamp: string;
}

@Injectable({
  providedIn: 'root'
})
export class ChatService implements OnDestroy {
  private apiUrl = environment.apiUrl;

  // Subjects for reactive state
  private messagesSubject = new BehaviorSubject<ChatMessage[]>([]);
  public messages$ = this.messagesSubject.asObservable();

  private typingUsersSubject = new BehaviorSubject<string[]>([]);
  public typingUsers$ = this.typingUsersSubject.asObservable();

  private statsSubject = new BehaviorSubject<ChatStats | null>(null);
  public stats$ = this.statsSubject.asObservable();

  private connectedSubject = new BehaviorSubject<boolean>(true);
  public connected$ = this.connectedSubject.asObservable();

  private onlineUsersSubject = new BehaviorSubject<number>(1);
  public onlineUsers$ = this.onlineUsersSubject.asObservable();

  // User state
  private currentUser: string = 'Usuario';
  private userId: string = this.generateUserId();
  private currentRoom: string = 'general';
  private isTyping: boolean = false;

  // Adaptive Polling
  private minPollingInterval = 2000; // 2 seconds
  private maxPollingInterval = 10000; // 10 seconds
  private currentPollingInterval = this.minPollingInterval;
  private noMessagesStreak = 0;

  // Subscriptions management
  private pollingSubscription: Subscription | null = null;
  private subscriptions: Subscription[] = [];

  constructor(private http: HttpClient) {
    this.loadUserFromStorage();
    this.loadInitialHistory().subscribe(() => {
        this.startAdaptivePolling();
    });

    this.subscriptions.push(
      timer(0, 30000).pipe(switchMap(() => this.loadStatsObservable())).subscribe(),
      timer(0, 3000).pipe(switchMap(() => this.checkTypingUsers())).subscribe(),
      timer(0, 15000).pipe(switchMap(() => this.checkOnlineUsers())).subscribe()
    );
  }

  ngOnDestroy(): void {
    // Clean up all subscriptions to prevent memory leaks
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
    }
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.setTyping(false); // Notify backend that user is no longer typing
  }

  private loadUserFromStorage(): void {
    const storedUser = localStorage.getItem('chat_user_name');
    if (storedUser) {
      this.currentUser = storedUser;
    }
  }

  private startAdaptivePolling(): void {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
    }

    this.pollingSubscription = timer(0, this.currentPollingInterval)
      .pipe(switchMap(() => this.checkNewMessages()))
      .subscribe();
  }

  private adjustPollingInterval(foundMessages: boolean): void {
      if (foundMessages) {
          this.noMessagesStreak = 0;
          this.currentPollingInterval = this.minPollingInterval;
      } else {
          this.noMessagesStreak++;
          // Increase interval only after a few empty checks
          if (this.noMessagesStreak > 2) {
              this.currentPollingInterval = Math.min(this.maxPollingInterval, this.currentPollingInterval + 1000);
          }
      }

      // Restart polling with the new interval
      this.startAdaptivePolling();
  }


  public loadInitialHistory(): Observable<any> {
    return this.http.get<{ messages: ChatMessage[] }>(`${this.apiUrl}/api/chat/messages?limit=100`).pipe(
      tap({
        next: (response) => {
          const messages = response.messages || [];
          this.messagesSubject.next(messages);
          this.connectedSubject.next(true);
        },
        error: (error) => {
          console.error('Error loading initial history:', error);
          this.connectedSubject.next(false);
        }
      }),
      catchError(error => {
          console.error('API call failed for initial history:', error);
          this.connectedSubject.next(false);
          return of(null);
      })
    );
  }

  private checkNewMessages(): Observable<any> {
    const currentMessages = this.messagesSubject.value;
    const lastTimestamp = currentMessages.length > 0
      ? new Date(currentMessages[currentMessages.length - 1].timestamp).toISOString()
      : new Date(0).toISOString();

    const url = `${this.apiUrl}/api/chat/messages?since_iso=${lastTimestamp}`;

    return this.http.get<{ messages: ChatMessage[] }>(url).pipe(
      tap({
        next: (response) => {
          this.connectedSubject.next(true);
          const newMessages = response.messages || [];

          if (newMessages.length > 0) {
            const currentMessages = this.messagesSubject.getValue();
            const existingIds = new Set(currentMessages.map(m => m.id));
            const trulyNewMessages = newMessages.filter(msg => !existingIds.has(msg.id));

            if (trulyNewMessages.length > 0) {
              const allMessages = [...currentMessages, ...trulyNewMessages]
                .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

              const limitedMessages = allMessages.slice(-200); // Keep chat history lean
              this.messagesSubject.next(limitedMessages);
              this.adjustPollingInterval(true);
            } else {
              this.adjustPollingInterval(false);
            }
          } else {
            this.adjustPollingInterval(false);
          }
        },
        error: (error) => {
          console.error('Error checking new messages:', error);
          this.connectedSubject.next(false);
          // Don't adjust interval on error, just wait for next attempt
        }
      }),
      catchError(error => {
        this.connectedSubject.next(false);
        return of(null); // Continue polling loop
      })
    );
  }

  private checkTypingUsers(): Observable<any> {
    return this.http.get<{ typing_users: { [key: string]: string } }>(
      `${this.apiUrl}/api/chat/typing-users?room=${this.currentRoom}`
    ).pipe(
      catchError(error => of({ typing_users: {} })),
      tap(response => {
        const typingUsers = Object.values(response.typing_users || {}).map(String).filter(user => user !== this.currentUser);
        this.typingUsersSubject.next(typingUsers);
      })
    );
  }

  private checkOnlineUsers(): Observable<any> {
    return this.http.get<{ online_users: number }>(`${this.apiUrl}/api/chat/online-users`).pipe(
      catchError(error => of({ online_users: 1 })),
      tap(response => this.onlineUsersSubject.next(response.online_users))
    );
  }

  sendMessage(message: string): Observable<any> {
    if (!message.trim()) return of(null);

    const messageData = {
      message: message.trim(),
      user: this.currentUser,
      user_id: this.userId,
      room: this.currentRoom
    };

    return this.http.post<{ success: boolean, message: ChatMessage }>(`${this.apiUrl}/api/chat/send`, messageData).pipe(
      tap(response => {
        if (response.success && response.message) {
          // Add message optimistically
          const currentMessages = this.messagesSubject.getValue();
          if (!currentMessages.find(m => m.id === response.message.id)) {
            this.messagesSubject.next([...currentMessages, response.message]);
          }
          // Reset polling to be fast after sending a message
          this.adjustPollingInterval(true);
        }
        this.setTyping(false);
      }),
      catchError(error => {
        console.error('Error sending message:', error);
        this.connectedSubject.next(false);
        throw error; // Re-throw to be handled by the component
      })
    );
  }

  setTyping(isTyping: boolean): void {
    if (this.isTyping === isTyping) return;
    this.isTyping = isTyping;

    this.http.post(`${this.apiUrl}/api/chat/typing`, {
      user: this.currentUser,
      room: this.currentRoom,
      is_typing: isTyping
    }).pipe(catchError(() => of(null))).subscribe();
  }

  setUser(name: string): void {
    if (name && name.trim()) {
      this.currentUser = name.trim();
      localStorage.setItem('chat_user_name', this.currentUser);
    }
  }

  getUser(): string {
    return this.currentUser;
  }

  private loadStatsObservable(): Observable<ChatStats | null> {
    return this.http.get<ChatStats>(`${this.apiUrl}/api/chat/stats`).pipe(
      catchError(() => of(null)),
      tap(stats => {
        if (stats) this.statsSubject.next(stats);
      })
    );
  }

  loadStats(): void {
    this.loadStatsObservable().subscribe();
  }

  private generateUserId(): string {
    let userId = localStorage.getItem('chat_user_id');
    if (!userId) {
      userId = `user_${Math.random().toString(36).substring(2, 11)}`;
      localStorage.setItem('chat_user_id', userId);
    }
    return userId;
  }
}
