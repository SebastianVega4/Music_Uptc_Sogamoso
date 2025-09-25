import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { DiscussionService, Thread, Comment } from '../../services/discussion.service';

@Component({
  standalone: true,
  selector: 'app-thread-detail',
  templateUrl: './thread-detail.component.html',
  styleUrls: ['./thread-detail.component.scss'],
  imports: [CommonModule, FormsModule]
})
export class ThreadDetailComponent implements OnInit {
  thread!: Thread;
  comments: Comment[] = [];
  newComment = '';
  replyingTo: string | null = null;
  replyContent = '';

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
    this.discussionService.getThread(threadId).subscribe({
      next: (data) => {
        this.thread = data.thread;
        this.comments = this.buildCommentTree(data.comments);
      },
      error: (error) => {
        console.error('Error loading thread:', error);
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

    this.discussionService.addComment(this.thread.id, this.newComment, this.replyingTo || undefined).subscribe({
      next: (comment) => {
        this.comments.push(comment);
        this.newComment = '';
        this.replyingTo = null;
        this.thread.comments_count++;
      },
      error: (error) => {
        console.error('Error adding comment:', error);
      }
    });
  }

  likeComment(comment: Comment) {
    this.discussionService.likeComment(comment.id).subscribe({
      next: (response: any) => {
        comment.likes_count = response.new_count;
      },
      error: (error) => {
        console.error('Error liking comment:', error);
      }
    });
  }
}