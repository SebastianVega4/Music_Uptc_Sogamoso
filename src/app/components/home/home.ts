import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SearchComponent } from "../search/search";
import { VotingListComponent } from "../voting-list/voting-list";
import { SpotifyNowPlayingService } from '../../services/spotify-now-playing.service';
import { Subscription } from 'rxjs';
import { VotingService } from '../../services/voting';
import { VotingComponent } from '../voting/voting.component';
import { QueueService } from '../../services/queue.service';

@Component({
  standalone: true,
  selector: 'app-home',
  templateUrl: './home.html',
  styleUrls: ['./home.scss'],
  imports: [CommonModule, SearchComponent, VotingListComponent, VotingComponent]
})
export class HomeComponent implements OnInit, OnDestroy {
  adminCurrentlyPlaying: any = null;
  progress: number = 0; // Progress percentage (0-100)
  songDurationMs: number = 0; // Made public for template access
  isUpdating: boolean = false;
  nextSong: any = null;

  private pollingSubscription: Subscription | null = null;
  private progressInterval: any = null;

  // Properties for robust progress tracking
  private songInitialProgressMs: number = 0;
  private lastSyncTime: number = 0;

  constructor(
    private spotifyService: SpotifyNowPlayingService,
    private votingService: VotingService,
    private queueService: QueueService
  ) { }

  ngOnInit(): void {
    this.startAdminSpotifyPolling();
    this.loadNextSong();
    
    // Actualizar próxima canción cada 30 segundos
    setInterval(() => {
      this.loadNextSong();
    }, 30000);
  }

  ngOnDestroy(): void {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
    }
    this.stopProgressBar();
  }

  loadNextSong(): void {
    this.queueService.getNextSong().subscribe({
      next: (data) => {
        if (data && data.next_song) {
          this.nextSong = data.next_song;
        } else {
          this.nextSong = null;
        }
      },
      error: (error) => {
        console.error('Error loading next song:', error);
        this.nextSong = null; // Ensure it's null on error
      }
    });
  }

  startAdminSpotifyPolling(): void {
    this.pollingSubscription = this.spotifyService.getAdminCurrentlyPlayingPolling().subscribe({
      next: (data) => {
        if (data && data.is_playing) {
          if (!this.adminCurrentlyPlaying || this.adminCurrentlyPlaying.id !== data.id) {
            this.adminCurrentlyPlaying = data;
            this.startProgressBar(data.progress_ms, data.duration_ms);
            // Verificar inmediatamente si esta canción está en el ranking
            this.checkAndRemovePlayingSong();
            // También actualizar la siguiente canción cuando cambia la actual
            this.loadNextSong();
          } else {
            this.syncProgressBar(data.progress_ms, data.duration_ms);
          }
        } else {
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