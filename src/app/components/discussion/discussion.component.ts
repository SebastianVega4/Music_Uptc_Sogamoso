import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { DiscussionService, Thread } from '../../services/discussion.service';

@Component({
  standalone: true,
  selector: 'app-discussion',
  templateUrl: './discussion.component.html',
  styleUrls: ['./discussion.component.scss'],
  imports: [CommonModule, FormsModule, RouterModule]
})
export class DiscussionComponent implements OnInit {
  threads: Thread[] = [];
  showCreateForm = false;
  newThread = { title: '', content: '' };
  isLoading = false;
  sortBy = 'updated_at';

  constructor(private discussionService: DiscussionService) {}

  ngOnInit() {
    this.loadThreads();
  }

  loadThreads() {
    this.isLoading = true;
    this.discussionService.getThreads(this.sortBy).subscribe({
      next: (threads) => {
        this.threads = threads;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading threads:', error);
        this.isLoading = false;
      }
    });
  }

  createThread() {
    if (!this.newThread.title.trim() || !this.newThread.content.trim()) return;

    this.discussionService.createThread(this.newThread.title, this.newThread.content).subscribe({
      next: (thread) => {
        this.threads.unshift(thread);
        this.showCreateForm = false;
        this.newThread = { title: '', content: '' };
      },
      error: (error) => {
        console.error('Error creating thread:', error);
      }
    });
  }

  likeThread(thread: Thread) {
    this.discussionService.likeThread(thread.id).subscribe({
      next: (response: any) => {
        thread.likes_count = response.new_count;
      },
      error: (error) => {
        console.error('Error liking thread:', error);
      }
    });
  }

  formatTimeAgo(dateString: string): string {
    // Reutilizar tu función existente de formatTimeAgo
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
    return `Hace ${diffDays} días`;
  }
}