import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VotingService } from '../../services/voting';
import { SearchComponent } from "../search/search";
import { VotingListComponent } from "../voting-list/voting-list";
import { SpotifyNowPlayingService } from '../../services/spotify-now-playing.service';
import { Subscription } from 'rxjs';

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

  constructor(
    private votingService: VotingService,
    private spotifyService: SpotifyNowPlayingService
  ) {}

  ngOnInit(): void {
    this.loadCurrentSong();
    this.startAdminSpotifyPolling();
  }

  ngOnDestroy(): void {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
    }
  }

  loadCurrentSong(): void {
    this.votingService.getRankedSongs().subscribe({
      next: (songs) => {
        if (songs.length > 0) {
          this.currentSong = songs[0];
        }
      },
      error: (error) => {
        console.error('Error al cargar la canción actual:', error);
      },
    });
  }

  startSpotifyPolling(): void {
    this.pollingSubscription = this.spotifyService.getAdminCurrentlyPlayingPolling().subscribe({
      next: (data) => {
        if (data.is_playing) {
          this.adminCurrentlyPlaying = data;
        } else {
          this.adminCurrentlyPlaying = null;
        }
      },
      error: (error) => {
        console.error('Error al obtener reproducción actual de Spotify:', error);
        this.adminCurrentlyPlaying = null;
      }
    });
  }

  startAdminSpotifyPolling(): void {
    this.pollingSubscription = this.spotifyService.getAdminCurrentlyPlayingPolling().subscribe({
      next: (data) => {
        if (data.is_playing) {
          this.adminCurrentlyPlaying = data;
          console.log('Reproduciendo:', data.name);
        } else if (data.error) {
          console.warn('Error en Spotify:', data.error);
          this.adminCurrentlyPlaying = null;
        } else {
          this.adminCurrentlyPlaying = null;
          console.log('No se está reproduciendo nada');
        }
      },
      error: (error) => {
        console.error('Error al obtener reproducción actual del admin:', error);
        this.adminCurrentlyPlaying = null;
        // Reintentar después de 10 segundos
        setTimeout(() => this.startAdminSpotifyPolling(), 10000);
      }
    });
  }
}