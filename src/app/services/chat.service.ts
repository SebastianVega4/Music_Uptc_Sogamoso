// chat.service.ts - VERSIÓN CORREGIDA

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, interval, of } from 'rxjs';
import { map, tap, catchError, switchMap, startWith, distinctUntilChanged, debounceTime } from 'rxjs/operators';
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
export class ChatService {
  private apiUrl = environment.apiUrl;

  // Subjects para estado reactivo
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

  // Estado del usuario
  private currentUser: string = 'Usuario';
  private userId: string = this.generateUserId();
  private currentRoom: string = 'general';

  // Cache local para polling optimizado
  private lastMessageId: string = '';
  private isTyping: boolean = false;
  private lastTypingCheck: number = 0;

  constructor(private http: HttpClient) {
    this.loadUserFromStorage();
    this.startOptimizedPolling();
    this.loadInitialHistory();
  }

  private loadUserFromStorage(): void {
    const storedUser = localStorage.getItem('chat_user_name');
    if (storedUser) {
      this.currentUser = storedUser;
    }
  }

  private startOptimizedPolling(): void {
    // POLLING MÁS RÁPIDO Y EFICIENTE para nuevos mensajes
    interval(2000).pipe( // Reducido a 2 segundos
      switchMap(() => this.checkNewMessages()),
      catchError(error => {
        console.error('Error en polling:', error);
        this.connectedSubject.next(false);
        return of(null);
      })
    ).subscribe();
  
    // Polling para usuarios escribiendo cada 3 segundos
    interval(3000).pipe(
      switchMap(() => this.checkTypingUsers())
    ).subscribe();
  
    // Polling para estadísticas cada 30 segundos
    interval(30000).pipe(
      switchMap(() => this.loadStatsObservable())
    ).subscribe();
  
    // Polling para usuarios online cada 15 segundos
    interval(15000).pipe(
      switchMap(() => this.checkOnlineUsers())
    ).subscribe();
  }

  private loadInitialHistory(): void {
    this.http.get<{ messages: ChatMessage[] }>(`${this.apiUrl}/api/chat/messages?limit=100`)
      .subscribe({
        next: (response) => {
          const messages = response.messages || [];
          this.messagesSubject.next(messages);
          
          // Guardar el ID del último mensaje para polling futuro
          if (messages.length > 0) {
            this.lastMessageId = messages[messages.length - 1].id;
          }
        },
        error: (error) => {
          console.error('Error cargando historial inicial:', error);
        }
      });
  }

  private checkNewMessages(): Observable<any> {
    const currentMessages = this.messagesSubject.value;
    
    // Usar timestamp en lugar de ID para mejor detección
    const lastTimestamp = currentMessages.length > 0 
      ? new Date(currentMessages[currentMessages.length - 1].timestamp).getTime()
      : 0;
  
    const url = `${this.apiUrl}/api/chat/messages?limit=50&since_timestamp=${lastTimestamp}`;
  
    return this.http.get<{ messages: ChatMessage[] }>(url).pipe(
      tap({
        next: (response) => {
          const newMessages = response.messages || [];
          
          if (newMessages.length > 0) {
            // Filtrar mensajes verdaderamente nuevos
            const existingIds = new Set(currentMessages.map(m => m.id));
            const trulyNewMessages = newMessages.filter(msg => 
              !existingIds.has(msg.id) && 
              new Date(msg.timestamp).getTime() > lastTimestamp
            );
            
            if (trulyNewMessages.length > 0) {
              console.log('Nuevos mensajes detectados:', trulyNewMessages.length);
              
              // Combinar manteniendo el orden
              const allMessages = [...currentMessages, ...trulyNewMessages]
                .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
              
              // Limitar a 200 mensajes máximo para performance
              const limitedMessages = allMessages.slice(-200);
              
              this.messagesSubject.next(limitedMessages);
              
              // Actualizar último timestamp
              this.lastMessageId = trulyNewMessages[trulyNewMessages.length - 1].id;
            }
          }
        },
        error: (error) => {
          console.error('Error checking new messages:', error);
          this.connectedSubject.next(false);
        }
      }),
      catchError(error => {
        console.error('Error en polling de mensajes:', error);
        this.connectedSubject.next(false);
        return of(null);
      })
    );
  }

  private checkTypingUsers(): Observable<any> {
    // Solo verificar cada 2 segundos como máximo
    const now = Date.now();
    if (now - this.lastTypingCheck < 2000) {
      return of(null);
    }
    this.lastTypingCheck = now;

    return this.http.get<{ typing_users: string[] }>(
      `${this.apiUrl}/api/chat/typing-users?room=${this.currentRoom}`
    ).pipe(
      catchError(error => {
        console.error('Error checking typing users:', error);
        return of({ typing_users: [] });
      }),
      tap({
        next: (response) => {
          // Filtrar el usuario actual y usuarios que hayan dejado de escribir
          const otherUsers = response.typing_users.filter(user => user !== this.currentUser);
          this.typingUsersSubject.next(otherUsers);
        }
      })
    );
  }

  private checkOnlineUsers(): Observable<any> {
    return this.http.get<{ online_users: number }>(`${this.apiUrl}/api/chat/online-users`)
      .pipe(
        catchError(error => {
          console.error('Error checking online users:', error);
          return of({ online_users: 1 });
        }),
        tap({
          next: (response) => {
            this.onlineUsersSubject.next(response.online_users);
            this.connectedSubject.next(true);
          }
        })
      );
  }

  // === MÉTODOS PÚBLICOS MEJORADOS ===

  sendMessage(message: string): Observable<any> {
    if (!message.trim()) {
      throw new Error('El mensaje no puede estar vacío');
    }

    const messageData = {
      message: message.trim(),
      user: this.currentUser,
      user_id: this.userId,
      room: this.currentRoom
    };

    return this.http.post(`${this.apiUrl}/api/chat/send`, messageData).pipe(
      tap((response: any) => {
        if (response.success && response.message) {
          // Agregar el mensaje inmediatamente al estado local
          const currentMessages = this.messagesSubject.value;
          const newMessage: ChatMessage = response.message;
          
          // Verificar que no exista ya
          if (!currentMessages.find(m => m.id === newMessage.id)) {
            const updatedMessages = [...currentMessages, newMessage]
              .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            
            this.messagesSubject.next(updatedMessages);
            this.lastMessageId = newMessage.id;
          }
        }
        
        // Dejar de escribir
        this.setTyping(false);
      }),
      catchError(error => {
        console.error('Error sending message:', error);
        this.connectedSubject.next(false);
        throw error;
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
    }).pipe(
      catchError(error => {
        console.error('Error setting typing status:', error);
        return of(null);
      })
    ).subscribe();
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

  getStats(): Observable<ChatStats> {
    return this.http.get<ChatStats>(`${this.apiUrl}/api/chat/stats`);
  }

  // CORRECCIÓN: Nuevo método que retorna Observable para el polling
  private loadStatsObservable(): Observable<ChatStats | null> {
    return this.getStats().pipe(
      catchError(error => {
        console.error('Error loading stats:', error);
        return of(null);
      }),
      tap(stats => {
        if (stats) {
          this.statsSubject.next(stats);
        }
      })
    );
  }

  // Método original mantenido para compatibilidad
  loadStats(): void {
    this.loadStatsObservable().subscribe();
  }

  // === HELPERS PRIVADOS ===

  private generateUserId(): string {
    let userId = localStorage.getItem('chat_user_id');
    if (!userId) {
      userId = 'user_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('chat_user_id', userId);
    }
    return userId;
  }

  // Limpiar recursos si es necesario
  destroy(): void {
    this.setTyping(false);
  }
}