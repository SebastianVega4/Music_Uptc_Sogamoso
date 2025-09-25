import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { DiscussionService, Thread } from '../../services/discussion.service';
import { AnnouncementComponent } from '../announcement/announcement.component';
import { ScheduleComponent } from "../schedule/schedule.component";

@Component({
  standalone: true,
  selector: 'app-discussion',
  templateUrl: './discussion.component.html',
  styleUrls: ['./discussion.component.scss'],
  imports: [CommonModule, FormsModule, AnnouncementComponent, ScheduleComponent, RouterModule]
})
export class DiscussionComponent implements OnInit {
  threads: Thread[] = [];
  showCreateForm = false;
  newThread = { title: '', content: '' };
  isLoading = false;
  sortBy = 'updated_at';
  error: string | null = null;

  constructor(private discussionService: DiscussionService) {}

  ngOnInit() {
    this.loadThreads();
  }

  loadThreads() {
    this.isLoading = true;
    this.error = null;
    
    this.discussionService.getThreads(this.sortBy).subscribe({
      next: (threads) => {
        this.threads = threads.map(thread => ({
          ...thread,
          user_has_liked: this.discussionService.hasUserLiked('thread', thread.id)
        }));
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading threads:', error);
        this.error = 'Error al cargar los hilos. Por favor, intenta nuevamente.';
        this.isLoading = false;
      }
    });
  }

  createThread() {
    if (!this.newThread.title.trim() || !this.newThread.content.trim()) return;

    this.discussionService.createThread(this.newThread.title, this.newThread.content).subscribe({
      next: (thread) => {
        this.threads.unshift({
          ...thread,
          user_has_liked: false
        });
        this.showCreateForm = false;
        this.newThread = { title: '', content: '' };
        this.error = null;
      },
      error: (error) => {
        console.error('Error creating thread:', error);
        this.error = 'Error al crear el hilo. Por favor, intenta nuevamente.';
      }
    });
  }

  likeThread(thread: Thread) {
    this.discussionService.likeThread(thread.id).subscribe({
      next: (response) => {
        thread.likes_count = response.new_count;
        thread.user_has_liked = response.action === 'liked';
      },
      error: (error) => {
        console.error('Error liking thread:', error);
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
}