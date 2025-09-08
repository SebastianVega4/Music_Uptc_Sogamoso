import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VotingService } from '../../services/voting';
import { SearchComponent } from "../search/search";
import { VotingListComponent } from "../voting-list/voting-list";
import { SpotifyNowPlayingService } from '../../services/spotify-now-playing.service';
import { Subscription, interval } from 'rxjs';

@Component({
  standalone: true,
  selector: 'app-home',
  templateUrl: './home.html',
  styleUrls: ['./home.scss'],
  imports: [CommonModule, SearchComponent, VotingListComponent]
})
export class HomeComponent implements OnInit, OnDestroy {
  currentSong: any = null;
  adminCurrentlyPlaying: any = null;
  private pollingSubscription: Subscription | null = null;
  private songPollingSubscription: Subscription | null = null;
  progress: number = 0;
  progressInterval: any = null;

  constructor(
    private votingService: VotingService,
    private spotifyService: SpotifyNowPlayingService
  ) {}

  ngOnInit(): void {
    this.loadCurrentSong();
    this.startAdminSpotifyPolling();
    this.startSongPolling();
  }

  ngOnDestroy(): void {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
    }
    if (this.songPollingSubscription) {
      this.songPollingSubscription.unsubscribe();
    }
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
    }
  }

  loadCurrentSong(): void {
    this.votingService.getRankedSongs().subscribe({
      next: (songs) => {
        if (songs.length > 0) {
          this.currentSong = songs[0];
        } else {
          this.currentSong = null;
        }
      },
      error: (error) => {
        console.error('Error al cargar la canción actual:', error);
      },
    });
  }

  startSongPolling(): void {
    // Actualizar la canción más votada cada 10 segundos
    this.songPollingSubscription = interval(10000).subscribe(() => {
      this.loadCurrentSong();
    });
  }

  startAdminSpotifyPolling(): void {
    this.pollingSubscription = this.spotifyService.getAdminCurrentlyPlayingPolling().subscribe({
      next: (data) => {
        if (data.is_playing) {
          this.adminCurrentlyPlaying = data;
          console.log('Reproduciendo:', data.name);
          
          // Iniciar barra de progreso si hay una canción en reproducción
          this.startProgressBar(data.progress_ms, data.duration_ms);
        } else if (data.error) {
          console.warn('Error en Spotify:', data.error);
          this.adminCurrentlyPlaying = null;
          this.stopProgressBar();
        } else {
          this.adminCurrentlyPlaying = null;
          this.stopProgressBar();
          console.log('No se está reproduciendo nada');
        }
      },
      error: (error) => {
        console.error('Error al obtener reproducción actual del admin:', error);
        this.adminCurrentlyPlaying = null;
        this.stopProgressBar();
        // Reintentar después de 10 segundos
        setTimeout(() => this.startAdminSpotifyPolling(), 10000);
      }
    });
  }

  startProgressBar(currentProgress: number, duration: number): void {
    this.stopProgressBar();
    
    // Calcular progreso inicial
    this.progress = (currentProgress / duration) * 100;
    
    // Actualizar progreso cada segundo
    this.progressInterval = setInterval(() => {
      if (this.progress < 100) {
        this.progress += (1000 / duration) * 100;
      } else {
        this.stopProgressBar();
      }
    }, 1000);
  }

  stopProgressBar(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
    this.progress = 0;
  }

  // Emitido cuando se vota desde el componente de búsqueda
  onVoteCasted(): void {
    this.loadCurrentSong(); // Actualizar la canción más votada
  }
  
  formatTime(ms: number): string {
    if (!ms) return '0:00';
    
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  }
}