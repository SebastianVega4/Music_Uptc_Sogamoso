import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VotingService } from '../../services/voting';
import { Subscription, timer } from 'rxjs';
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
  userVotes: Map<string, boolean> = new Map();
  private pollingSubscription: Subscription | null = null;

  refreshCooldown = 30; // seconds
  countdown = 0;
  private timerSubscription: Subscription | null = null;

  constructor(private votingService: VotingService) { }

  ngOnInit(): void {
    this.startPolling();
  }

  ngOnDestroy(): void {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
    }
    if (this.timerSubscription) {
      this.timerSubscription.unsubscribe();
    }
  }

  startPolling(): void {
    this.pollingSubscription = this.votingService.getRankedSongsPolling().subscribe({
      next: (rankedSongs: any[]) => {
        this.songs = rankedSongs;

        // Obtener canciones recientes por separado
        this.votingService.getRecentlyAddedSongs().subscribe({
          next: (recentSongs: any[]) => {
            this.recentlyAddedSongs = recentSongs;
          }
        });

        this.isLoading = false;
      },
      error: (error: any) => {
        console.error('Error al cargar canciones:', error);
        this.isLoading = false;
      },
    });
  }

  forceRefresh(): void {
    if (this.isRefreshing || this.countdown > 0) return;

    this.isRefreshing = true;
    this.votingService.forceRefresh().subscribe({
      next: (rankedSongs) => {
        this.songs = rankedSongs;

        this.votingService.getRecentlyAddedSongs().subscribe({
          next: (recentSongs) => {
            this.recentlyAddedSongs = recentSongs;
            this.isRefreshing = false;
            this.startCooldown();
          }
        });
      },
      error: (error) => {
        console.error('Error al forzar actualización:', error);
        this.isRefreshing = false;
        this.startCooldown();
      }
    });
  }

  hasUserLiked(trackId: string): boolean {
    return this.userVotes.has(trackId) && this.userVotes.get(trackId) === false;
  }
  
  hasUserDisliked(trackId: string): boolean {
    return this.userVotes.has(trackId) && this.userVotes.get(trackId) === true;
  }

  formatTimeAgo(dateString: string): string {
    try {
      // Verificar si es un string de fecha válido
      if (!dateString) return 'reciente';

      let date: Date;

      // Manejar diferentes formatos de fecha
      if (typeof dateString === 'string') {
        // Si es un string ISO (con 'Z' al final)
        if (dateString.includes('Z') || dateString.includes('+')) {
          date = new Date(dateString);
        } else {
          // Si es un string sin timezone, asumir UTC
          date = new Date(dateString + 'Z');
        }
      } else {
        return 'Reciente';
      }

      // Verificar si la fecha es válida
      if (isNaN(date.getTime())) {
        console.warn('Fecha inválida:', dateString);
        return 'Reciente';
      }

      const now = new Date();
      const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
      const diffInMinutes = Math.floor(diffInSeconds / 60);
      const diffInHours = Math.floor(diffInSeconds / 3600);
      const diffInDays = Math.floor(diffInSeconds / 86400);

      if (diffInSeconds < 60) {
        return '${diffInSeconds} s';
      } else if (diffInMinutes < 60) {
        return `Hace ${diffInMinutes} min ${diffInSeconds % 60} s}`;
      } else if (diffInHours < 24) {
        return `Hace ${diffInHours} h y ${diffInMinutes % 60} min`;
      } else if (diffInDays === 1) {
        return 'Ayer';
      } else {
        return `Hace ${diffInDays} d`;
      }
    } catch (error) {
      console.error('Error formateando fecha:', error, 'Fecha recibida:', dateString);
      return 'Reciente';
    }
  }

  startCooldown(): void {
    if (this.timerSubscription) {
      this.timerSubscription.unsubscribe();
    }
    this.countdown = this.refreshCooldown;
    this.timerSubscription = timer(0, 1000)
      .subscribe(() => {
        if (this.countdown > 0) {
          this.countdown--;
        } else {
          if (this.timerSubscription) {
            this.timerSubscription.unsubscribe();
            this.timerSubscription = null;
          }
        }
      });
  }

  vote(song: any, isDislike: boolean = false): void {
    const trackInfo = {
      name: song.name,
      artists: song.artists,
      image: song.image,
      album: song.album,
      preview_url: song.preview_url,
    };

    this.votingService.voteForSong(song.id, trackInfo, isDislike).subscribe({
      next: (response: any) => {
        if (response.deleted) {
          alert('La canción ha sido eliminada por recibir muchos dislikes');
        } else {
          const voteType = isDislike ? 'dislike' : 'like';
          alert(`¡Tu ${voteType} ha sido registrado!`);

          // Actualizar el estado local de votos del usuario
          this.userVotes.set(song.id, isDislike);
        }
        this.forceRefresh();
      },
      error: (error) => {
        if (error.status === 409) {
          // Si ya votó, ofrecer cambiar el voto
          if (confirm('Ya has votado por esta canción. ¿Quieres cambiar tu voto?')) {
            this.votingService.changeVote(song.id, trackInfo, isDislike).subscribe({
              next: (response: any) => {
                if (response.deleted) {
                  alert('La canción ha sido eliminada por recibir muchos dislikes');
                } else {
                  alert('¡Tu voto ha sido cambiado!');
                  this.userVotes.set(song.id, isDislike);
                }
                this.forceRefresh();
              },
              error: (err) => {
                alert('Error al cambiar tu voto. Intenta nuevamente.');
              }
            });
          }
        } else {
          alert('Error al registrar tu voto. Intenta nuevamente.');
        }
      },
    });
  }
}
