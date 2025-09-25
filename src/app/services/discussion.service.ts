import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Thread {
  id: string;
  title: string;
  content: string;
  author_fingerprint: string;
  likes_count: number;
  comments_count: number;
  created_at: string;
  updated_at: string;
  user_has_liked?: boolean;
}

export interface Comment {
  id: string;
  thread_id: string;
  parent_comment_id?: string;
  author_fingerprint: string;
  content: string;
  likes_count: number;
  created_at: string;
  replies?: Comment[];
  user_has_liked?: boolean;
}

interface LikeResponse {
  action: string;
  new_count: number;
}

@Injectable({
  providedIn: 'root'
})
export class DiscussionService {
  private apiUrl = environment.apiUrl;
  private likedItems = new Set<string>(); // Cache local de likes

  constructor(private http: HttpClient) {
    this.loadLikedItemsFromStorage();
  }

  private loadLikedItemsFromStorage(): void {
    const stored = localStorage.getItem('discussion_likes');
    if (stored) {
      this.likedItems = new Set(JSON.parse(stored));
    }
  }

  private saveLikedItemsToStorage(): void {
    localStorage.setItem('discussion_likes', JSON.stringify([...this.likedItems]));
  }

  private getItemKey(type: 'thread' | 'comment', id: string): string {
    return `${type}:${id}`;
  }

  hasUserLiked(type: 'thread' | 'comment', id: string): boolean {
    return this.likedItems.has(this.getItemKey(type, id));
  }

  private updateLikeStatus(type: 'thread' | 'comment', id: string, liked: boolean): void {
    const key = this.getItemKey(type, id);
    if (liked) {
      this.likedItems.add(key);
    } else {
      this.likedItems.delete(key);
    }
    this.saveLikedItemsToStorage();
  }

  getThreads(sortBy: string = 'updated_at', order: string = 'desc'): Observable<Thread[]> {
    return this.http.get<Thread[]>(`${this.apiUrl}/api/discussion/threads?sort=${sortBy}&order=${order}`);
  }

  getThread(threadId: string): Observable<{thread: Thread, comments: Comment[]}> {
    return this.http.get<{thread: Thread, comments: Comment[]}>(`${this.apiUrl}/api/discussion/threads/${threadId}`);
  }

  createThread(title: string, content: string): Observable<Thread> {
    return this.http.post<Thread>(`${this.apiUrl}/api/discussion/threads`, {
      title,
      content
    });
  }

  addComment(threadId: string, content: string, parentCommentId?: string): Observable<Comment> {
    return this.http.post<Comment>(`${this.apiUrl}/api/discussion/threads/${threadId}/comments`, {
      content,
      parent_comment_id: parentCommentId
    });
  }

  likeThread(threadId: string): Observable<LikeResponse> {
    return this.http.post<LikeResponse>(`${this.apiUrl}/api/discussion/like`, {
      thread_id: threadId
    }).pipe(tap(response => {
      this.updateLikeStatus('thread', threadId, response.action === 'liked');
    }));
  }

  likeComment(commentId: string): Observable<LikeResponse> {
    return this.http.post<LikeResponse>(`${this.apiUrl}/api/discussion/like`, {
      comment_id: commentId
    }).pipe(tap(response => {
      this.updateLikeStatus('comment', commentId, response.action === 'liked');
    }));
  }
}