import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { DiscussionService, Thread, Comment } from '../../services/discussion.service';
import { tap } from 'rxjs/operators';

@Component({
  standalone: true,
  selector: 'app-thread-detail',
  templateUrl: './thread-detail.component.html',
  styleUrls: ['./thread-detail.component.scss'],
  imports: [CommonModule, FormsModule, RouterModule]
})
export class ThreadDetailComponent implements OnInit {
  thread!: Thread;
  comments: Comment[] = [];
  newComment = '';
  replyingTo: string | null = null;
  replyContent = '';
  error: string | null = null;
  isLoading = true;

  constructor(
    private route: ActivatedRoute,
    private discussionService: DiscussionService
  ) {}

  ngOnInit() {
    const threadId = this.route.snapshot.paramMap.get('id');
    if (threadId) {
      this.loadThread(threadId);
    }
  }

  loadThread(threadId: string) {
    this.isLoading = true;
    this.error = null;
    
    this.discussionService.getThread(threadId).subscribe({
      next: (data) => {
        this.thread = {
          ...data.thread,
          user_has_liked: this.discussionService.hasUserLiked('thread', data.thread.id)
        };
        
        // Procesar comentarios con información de likes del usuario
        this.comments = this.buildCommentTree(data.comments).map(comment => ({
          ...comment,
          user_has_liked: this.discussionService.hasUserLiked('comment', comment.id),
          replies: comment.replies?.map(reply => ({
            ...reply,
            user_has_liked: this.discussionService.hasUserLiked('comment', reply.id)
          }))
        }));
        
        this.isLoading = false;
        this.error = null;
      },
      error: (error) => {
        console.error('Error loading thread:', error);
        this.error = 'No se pudo cargar el hilo. Por favor, intenta nuevamente.';
        this.isLoading = false;
      }
    });
  }

  buildCommentTree(comments: Comment[]): Comment[] {
    const commentMap = new Map();
    const roots: Comment[] = [];

    comments.forEach(comment => {
      comment.replies = [];
      commentMap.set(comment.id, comment);
    });

    comments.forEach(comment => {
      if (comment.parent_comment_id) {
        const parent = commentMap.get(comment.parent_comment_id);
        if (parent) {
          parent.replies!.push(comment);
        }
      } else {
        roots.push(comment);
      }
    });

    return roots;
  }

  addComment() {
    if (!this.newComment.trim()) return;

    this.discussionService.addComment(this.thread.id, this.newComment).subscribe({
      next: (comment) => {
        const newCommentWithLike = {
          ...comment,
          user_has_liked: false,
          replies: []
        };
        this.comments.push(newCommentWithLike);
        this.newComment = '';
        this.thread.comments_count++;
        this.error = null;
      },
      error: (error) => {
        console.error('Error adding comment:', error);
        this.error = 'Error al agregar el comentario. Por favor, intenta nuevamente.';
      }
    });
  }

  addReply() {
    if (!this.replyContent.trim() || !this.replyingTo) return;

    this.discussionService.addComment(this.thread.id, this.replyContent, this.replyingTo).subscribe({
      next: (comment) => {
        const parentComment = this.findCommentById(this.replyingTo!);
        if (parentComment) {
          if (!parentComment.replies) {
            parentComment.replies = [];
          }
          const newReply = {
            ...comment,
            user_has_liked: false
          };
          parentComment.replies.push(newReply);
        }
        this.replyContent = '';
        this.replyingTo = null;
        this.thread.comments_count++;
        this.error = null;
      },
      error: (error) => {
        console.error('Error adding reply:', error);
        this.error = 'Error al agregar la respuesta. Por favor, intenta nuevamente.';
      }
    });
  }

  private findCommentById(commentId: string): Comment | null {
    for (const comment of this.comments) {
      if (comment.id === commentId) {
        return comment;
      }
      if (comment.replies) {
        for (const reply of comment.replies) {
          if (reply.id === commentId) {
            return reply;
          }
        }
      }
    }
    return null;
  }

  likeThread(thread: Thread) {
    this.discussionService.likeThread(thread.id).subscribe({
      next: (response: any) => {
        thread.likes_count = response.new_count;
        thread.user_has_liked = response.action === 'liked';
      },
      error: (error) => {
        console.error('Error liking thread:', error);
        this.error = 'Error al dar like. Por favor, intenta nuevamente.';
      }
    });
  }

  likeComment(comment: Comment) {
    this.discussionService.likeComment(comment.id).subscribe({
      next: (response: any) => {
        comment.likes_count = response.new_count;
        comment.user_has_liked = response.action === 'liked';
      },
      error: (error) => {
        console.error('Error liking comment:', error);
        this.error = 'Error al dar like. Por favor, intenta nuevamente.';
      }
    });
  }

  formatTimeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Ahora mismo';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours} h`;
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `Hace ${diffDays} días`;
    if (diffDays < 30) return `Hace ${Math.floor(diffDays / 7)} sem`;
    return `Hace ${Math.floor(diffDays / 30)} mes`;
  }

  cancelReply() {
    this.replyingTo = null;
    this.replyContent = '';
  }
}