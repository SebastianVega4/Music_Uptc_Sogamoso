import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SearchComponent } from "../search/search";
import { VotingListComponent } from "../voting-list/voting-list";
import { SpotifyNowPlayingService } from '../../services/spotify-now-playing.service';
import { Subscription } from 'rxjs';
import { AnnouncementComponent } from '../announcement/announcement.component';
import { ScheduleComponent } from "../schedule/schedule.component";
import { VotingService } from '../../services/voting';
import { VotingComponent } from '../voting/voting.component';

@Component({
  standalone: true,
  selector: 'app-home',
  templateUrl: './home.html',
  styleUrls: ['./home.scss'],
  imports: [CommonModule, SearchComponent, VotingListComponent, AnnouncementComponent, ScheduleComponent, VotingComponent]
})
export class HomeComponent implements OnInit, OnDestroy {
  adminCurrentlyPlaying: any = null;
  progress: number = 0; // Progress percentage (0-100)
  songDurationMs: number = 0; // Made public for template access
  isUpdating: boolean = false;

  private pollingSubscription: Subscription | null = null;
  private progressInterval: any = null;

  // Properties for robust progress tracking
  private songInitialProgressMs: number = 0;
  private lastSyncTime: number = 0;

  constructor(
    private spotifyService: SpotifyNowPlayingService,
    private votingService: VotingService
  ) { }

  ngOnInit(): void {
    this.startAdminSpotifyPolling();
  }

  ngOnDestroy(): void {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
    }
    this.stopProgressBar();
  }

  startAdminSpotifyPolling(): void {
    // The service observable will poll every 3 seconds
    this.pollingSubscription = this.spotifyService.getAdminCurrentlyPlayingPolling().subscribe({
      next: (data) => {
        if (data && data.is_playing) {
          // If song changed or wasn't playing before, reset the progress bar
          if (!this.adminCurrentlyPlaying || this.adminCurrentlyPlaying.id !== data.id) {
            this.adminCurrentlyPlaying = data;
            this.startProgressBar(data.progress_ms, data.duration_ms);
          } else {
            // If it's the same song, just re-sync the progress to correct any drift
            this.syncProgressBar(data.progress_ms, data.duration_ms);
          }
        } else {
          // Nothing is playing
          this.adminCurrentlyPlaying = null;
          this.stopProgressBar();
        }
      },
      error: (error) => {
        console.error('Error al obtener reproducción actual del admin:', error);
        this.adminCurrentlyPlaying = null;
        this.stopProgressBar();
      }
    });
  }

  forceUpdate(): void {
    if (this.isUpdating) return;

    this.isUpdating = true;
    this.spotifyService.getAdminCurrentlyPlaying().subscribe({
      next: (data) => {
        if (data && data.is_playing) {
          if (!this.adminCurrentlyPlaying || this.adminCurrentlyPlaying.id !== data.id) {
            this.adminCurrentlyPlaying = data;
            this.startProgressBar(data.progress_ms, data.duration_ms);
          } else {
            this.syncProgressBar(data.progress_ms, data.duration_ms);
          }
        } else {
          this.adminCurrentlyPlaying = null;
          this.stopProgressBar();
        }
        this.isUpdating = false;
      },
      error: (error) => {
        console.error('Error al forzar la actualización:', error);
        this.adminCurrentlyPlaying = null;
        this.stopProgressBar();
        this.isUpdating = false;
      }
    });
  }

  private startProgressBar(progressMs: number, durationMs: number): void {
    this.stopProgressBar();
    this.syncProgressBar(progressMs, durationMs);
    
    this.progressInterval = setInterval(() => {
      this.updateProgress();
    }, 500);
  }

  private syncProgressBar(progressMs: number, durationMs: number): void {
    this.songInitialProgressMs = progressMs;
    this.songDurationMs = durationMs;
    this.lastSyncTime = Date.now();
    this.updateProgress(); // Update progress immediately on sync
  }

  private updateProgress(): void {
    if (!this.adminCurrentlyPlaying || this.songDurationMs <= 0) {
      this.progress = 0;
      return;
    }

    const elapsedTimeSinceSync = Date.now() - this.lastSyncTime;
    const currentProgressMs = this.songInitialProgressMs + elapsedTimeSinceSync;

    this.progress = Math.min((currentProgressMs / this.songDurationMs) * 100, 100);

    if (this.progress >= 100) {
      // Let the polling handle the next state, just stop the local timer
      this.stopProgressBar();
    }
  }

  private stopProgressBar(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
    // Don't reset progress to 0 here to avoid flicker. Let the next poll handle it.
  }
  onVoteCasted(): void {
    // Forzar actualización de la lista de votación
    const votingList = document.querySelector('app-voting-list');
    if (votingList && (votingList as any).forceRefresh) {
      (votingList as any).forceRefresh();
    }
  }

  private checkAndRemovePlayingSong(): void {
    if (this.adminCurrentlyPlaying && this.adminCurrentlyPlaying.id) {
      // Pequeña demora para asegurar que la canción está realmente reproduciéndose
      setTimeout(() => {
        this.spotifyService.checkAndRemovePlayingSongFromRanking().subscribe({
          next: (response: any) => {
            if (response.deleted) {
              console.log('Canción eliminada del ranking:', response.song.name);
              // Forzar actualización de la lista de votación
              this.votingService.forceRefresh().subscribe();
            }
          },
          error: (error) => {
            console.error('Error al verificar canción en reproducción:', error);
          }
        });
      }, 3000); // Esperar 3 segundos antes de verificar
    }
  }

  formatTime(ms: number): string {
    if (!ms) return '0:00';

    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  }
}