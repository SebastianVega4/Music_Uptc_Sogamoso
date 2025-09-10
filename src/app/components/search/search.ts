import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SpotifyService } from '../../services/spotify';
import { VotingService } from '../../services/voting';

@Component({
  standalone: true,
  selector: 'app-search',
  templateUrl: './search.html',
  styleUrls: ['./search.scss'],
  imports: [CommonModule, FormsModule]
})
export class SearchComponent {
  @Output() voteCasted = new EventEmitter<void>();

  query: string = '';
  results: any[] = [];
  isLoading: boolean = false;
  searchPerformed: boolean = false;

  constructor(
    private spotifyService: SpotifyService, 
    private votingService: VotingService
  ) {}

  search(): void {
    if (!this.query.trim()) return;

    this.isLoading = true;
    this.searchPerformed = true;

    this.spotifyService.searchTracks(this.query).subscribe({
      next: (data) => {
        this.results = data;
        this.isLoading = false;
      },
      error: (error: any) => {
        console.error('Error al buscar:', error);
        this.isLoading = false;
        alert('Error al buscar canciones. Intenta nuevamente.');
      },
    });
  }

  vote(track: any): void {
    const trackInfo = {
      name: track.name,
      artists: track.artists,
      image: track.image,
      preview_url: track.preview_url,
      album: track.album
    };
  
    this.votingService.voteForSong(track.id, trackInfo).subscribe({
      next: () => {
        alert('¡Tu voto ha sido registrado!');
        this.query = '';
        this.results = [];
        this.searchPerformed = false;
        this.voteCasted.emit(); // Emitir evento para notificar
      },
      error: (error) => {
        if (error.status === 409) {
          alert('Ya has votado por esta canción.');
        } else {
          alert('Error al registrar tu voto. Intenta nuevamente.');
        }
      },
    });
  }

  formatDuration(ms: number): string {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return `${minutes}:${parseInt(seconds) < 10 ? '0' : ''}${seconds}`;
  }
}