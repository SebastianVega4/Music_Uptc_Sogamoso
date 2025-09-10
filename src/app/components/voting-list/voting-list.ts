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

  formatTimeAgo(dateString: string): string {
    try {
      const now = new Date();
      const date = new Date(dateString);
      
      // Verificar si la fecha es válida
      if (isNaN(date.getTime())) {
        return 'reciente';
      }
      
      const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
      const diffInMinutes = Math.floor(diffInSeconds / 60);
      const diffInHours = Math.floor(diffInSeconds / 3600);
      const diffInDays = Math.floor(diffInSeconds / 86400);
      
      if (diffInSeconds < 60) {
        return 'ahora mismo';
      } else if (diffInMinutes < 60) {
        return `hace ${diffInMinutes} min`;
      } else if (diffInHours < 24) {
        return `hace ${diffInHours} h`;
      } else if (diffInDays === 1) {
        return 'ayer';
      } else {
        return `hace ${diffInDays} d`;
      }
    } catch (error) {
      console.error('Error formateando fecha:', error);
      return 'reciente';
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
