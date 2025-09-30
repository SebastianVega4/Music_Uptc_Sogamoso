import {
  Component,
  OnInit,
  OnDestroy,
  HostListener,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  ElementRef,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService, ChatMessage, ChatStats } from '../../services/chat.service';
import { Observable, Subscription, of } from 'rxjs';
import { take, tap } from 'rxjs/operators';

@Component({
  standalone: true,
  selector: 'app-floating-chat',
  templateUrl: './floating-chat.component.html',
  styleUrls: ['./floating-chat.component.scss'],
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FloatingChatComponent implements OnInit, OnDestroy {
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('chatContainer') private chatContainer!: ElementRef<HTMLElement>;

  isChatOpen = false;
  newMessage = '';
  showUserModal = false;
  unreadMessages = 0;
  
  public messages$: Observable<ChatMessage[]>;
  public typingUsers$: Observable<string[]>;
  public onlineUsers$: Observable<number>;
  public connected$: Observable<boolean>;
  public stats$: Observable<ChatStats | null>;
  public currentUser$: Observable<string>;

  private subscriptions = new Subscription();
  private typingTimeout: any;

  constructor(
    public chatService: ChatService,
    private cdr: ChangeDetectorRef,
    private elementRef: ElementRef
  ) {
    this.messages$ = this.chatService.messages$;
    this.typingUsers$ = this.chatService.typingUsers$;
    this.onlineUsers$ = this.chatService.onlineUsers$;
    this.connected$ = this.chatService.connected$;
    this.stats$ = this.chatService.stats$;
    this.currentUser$ = of(this.chatService.getUser());
  }

  ngOnInit(): void {
    const messagesSub = this.messages$.subscribe(messages => {
        this.handleNewMessages(messages);
        this.cdr.markForCheck();
        this.autoScrollToBottom();
    });
    this.subscriptions.add(messagesSub);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }
  }
  
  private handleNewMessages(messages: ChatMessage[]): void {
    const previousCount = this.messagesContainer?.nativeElement?.childElementCount ?? messages.length;
    if (this.isChatOpen && messages.length > previousCount) {
      // If chat is open, just scroll
      this.autoScrollToBottom();
    } else if (!this.isChatOpen && messages.length > previousCount) {
      // If chat is closed, update unread count
      const newMessagesCount = messages.length - previousCount;
      this.unreadMessages += newMessagesCount;
      this.showNewMessageNotification(this.unreadMessages);
    }
  }

  private autoScrollToBottom(): void {
    if (this.isChatOpen && this.messagesContainer) {
      setTimeout(() => {
        const el = this.messagesContainer.nativeElement;
        const isNearBottom = el.scrollHeight - el.clientHeight - el.scrollTop < 250;
        if (isNearBottom) {
          el.scrollTop = el.scrollHeight;
        }
      }, 100);
    }
  }

  sendMessage(): void {
    this.connected$.pipe(take(1)).subscribe(isConnected => {
      if (this.newMessage.trim() && isConnected) {
        const messageText = this.newMessage.trim();
        this.newMessage = '';
        this.cdr.markForCheck();

        this.chatService.sendMessage(messageText).subscribe({
          next: () => {
            this.stopTyping();
            this.scrollToBottom();
          },
          error: () => {
            // Restore message on error
            this.newMessage = messageText;
            this.cdr.markForCheck();
          }
        });
      } 
    });
  }

  scrollToBottom(): void {
    if(this.messagesContainer) {
        setTimeout(() => this.messagesContainer.nativeElement.scrollTop = this.messagesContainer.nativeElement.scrollHeight, 50);
    }
  }

  private showNewMessageNotification(count: number): void {
    if (!document.hasFocus() && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(`Tienes ${count} nuevo${count > 1 ? 's' : ''} mensaje${count > 1 ? 's' : ''}`);
    }
  }

  toggleChat(): void {
    this.isChatOpen = !this.isChatOpen;
    if (this.isChatOpen) {
      this.unreadMessages = 0;
      this.chatService.loadStats(); // Refresh stats on open
      this.scrollToBottom();
    }
  }
  
  onInputChange(): void {
    this.connected$.pipe(take(1)).subscribe(isConnected => {
      if (this.newMessage.trim() && isConnected) {
        this.chatService.setTyping(true);
        if (this.typingTimeout) clearTimeout(this.typingTimeout);
        this.typingTimeout = setTimeout(() => this.stopTyping(), 2500);
      } else {
        this.stopTyping();
      }
    });
  }

  stopTyping(): void {
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
      this.typingTimeout = null;
    }
    this.chatService.setTyping(false);
  }

  updateUser(currentUser: string | null): void {
    const newName = currentUser?.trim();
    if (newName) {
      this.chatService.setUser(newName);
      this.currentUser$ = of(newName);
      this.showUserModal = false;
      this.cdr.markForCheck();
    }
  }

  formatTime(timestamp: string): string {
    return new Date(timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }

  trackByMessage(index: number, message: ChatMessage): string {
    return message.id;
  }
  
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    // Use ElementRef for safer, more Angular-friendly DOM checking
    if (this.isChatOpen && !this.elementRef.nativeElement.contains(event.target)) {
        this.isChatOpen = false;
        this.cdr.markForCheck();
    }
  }
}
