import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
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
}

@Injectable({
  providedIn: 'root'
})
export class DiscussionService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

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

  likeThread(threadId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/discussion/like`, {
      thread_id: threadId
    });
  }

  likeComment(commentId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/discussion/like`, {
      comment_id: commentId
    });
  }
}