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
      next: (rankedSongs) => {
        this.songs = rankedSongs;
        
        // Obtener canciones recientes por separado
        this.votingService.getRecentlyAddedSongs().subscribe({
          next: (recentSongs) => {
            this.recentlyAddedSongs = recentSongs;
          }
        });
        
        this.isLoading = false;
      },
      error: (error) => {
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
    const now = new Date();
    const date = new Date(dateString);
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) {
      return 'ahora mismo';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `hace ${minutes} min`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `hace ${hours} h`;
    } else {
      const days = Math.floor(diffInSeconds / 86400);
      return `hace ${days} d`;
    }
  }

}
