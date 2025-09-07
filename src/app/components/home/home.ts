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
  spotifyNowPlaying: any = null;
  private pollingSubscription: Subscription | null = null;

  constructor(
    private votingService: VotingService,
    private spotifyService: SpotifyNowPlayingService
  ) {}

  ngOnInit(): void {
    this.loadCurrentSong();
    this.startSpotifyPolling();
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
    this.pollingSubscription = this.spotifyService.getCurrentlyPlayingPolling().subscribe({
      next: (data) => {
        if (data.is_playing) {
          this.spotifyNowPlaying = data;
        } else {
          this.spotifyNowPlaying = null;
        }
      },
      error: (error) => {
        console.error('Error al obtener reproducción actual de Spotify:', error);
        this.spotifyNowPlaying = null;
      }
    });
  }

  // Método para iniciar autenticación manualmente si es necesario
  connectSpotify(): void {
    this.spotifyService.startSpotifyAuth().subscribe({
      next: (response) => {
        // Redirigir a la URL de autenticación de Spotify
        window.location.href = response.authUrl;
      },
      error: (error) => {
        console.error('Error al iniciar autenticación de Spotify:', error);
        alert('Error al conectar con Spotify');
      }
    });
  }
}