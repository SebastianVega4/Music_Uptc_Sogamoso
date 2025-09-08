import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VotingService } from '../../services/voting';
import { Subscription } from 'rxjs';
import { map } from 'rxjs/operators';

@Component({
  standalone: true,
  selector: 'app-voting-list',
  templateUrl: './voting-list.html',
  styleUrls: ['./voting-list.scss'],
  imports: [CommonModule]
})
export class VotingListComponent implements OnInit, OnDestroy {
  songs: any[] = [];
  recentlyAddedSongs: any[] = [];
  isLoading: boolean = true;
  isRefreshing: boolean = false;
  private pollingSubscription: Subscription | null = null;

  constructor(private votingService: VotingService) { }

  ngOnInit(): void {
    this.startPolling();
  }

  ngOnDestroy(): void {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
    }
  }

  startPolling(): void {
    this.pollingSubscription = this.votingService.getRankedSongsPolling().pipe(
      map(rankedSongs => this.processSongs(rankedSongs))
    ).subscribe({
      next: ({ranked, recent}) => {
        this.songs = ranked;
        this.recentlyAddedSongs = recent;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error al cargar canciones:', error);
        this.isLoading = false;
      },
    });
  }

  forceRefresh(): void {
    if (this.isRefreshing) return;

    this.isRefreshing = true;
    this.votingService.getRankedSongs().pipe(
      map(rankedSongs => this.processSongs(rankedSongs))
    ).subscribe({
      next: ({ranked, recent}) => {
        this.songs = ranked;
        this.recentlyAddedSongs = recent;
        this.isRefreshing = false;
      },
      error: (error) => {
        console.error('Error al forzar actualización:', error);
        this.isRefreshing = false;
      }
    });
  }

  private processSongs(rankedSongs: any[]) {
    // Crea una nueva lista ordenada por fecha de creación para "Agregadas Recientemente"
    const recentSongs = [...rankedSongs]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3); // Limita la lista a 3 canciones

    // Retorna tanto el ranking general (ya ordenado por votos) como la lista de recientes
    return { ranked: rankedSongs, recent: recentSongs };
  }

  vote(song: any): void {
    const trackInfo = {
      name: song.name,
      artists: song.artists,
      image: song.image,
      album: song.album,
      preview_url: song.preview_url,
    };

    this.votingService.voteForSong(song.id, trackInfo).subscribe({
      next: () => {
        alert('¡Tu voto ha sido registrado!');
        this.forceRefresh(); // Actualización inmediata para feedback instantáneo
      },
      error: (error) => {
        if (error.status === 409) {
          alert('Ya has votado por esta canción con esta IP');
        } else {
          alert('Error al registrar tu voto. Intenta nuevamente.');
        }
      },
    });
  }
}
