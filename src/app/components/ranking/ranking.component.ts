import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { RankingService } from '../../services/ranking.service';
import { VotingService } from '../../services/voting';
import { Subscription } from 'rxjs';

@Component({
  standalone: true,
  selector: 'app-ranking',
  templateUrl: './ranking.component.html',
  styleUrls: ['./ranking.component.scss'],
  imports: [CommonModule, FormsModule, RouterModule]
})
export class RankingComponent implements OnInit, OnDestroy {
  songs: any[] = [];
  isLoading: boolean = true;
  error: string = '';
  sortBy: string = 'times_played';
  sortOrder: string = 'desc';
  filterText: string = '';
  selectedSong: any = null;
  isVoting: boolean = false;
  voteMessage: string = '';
  activeTab: string = 'all';
  stats: any = {};
  
  private pollingSubscription: Subscription | null = null;

  constructor(
    private rankingService: RankingService,
    private votingService: VotingService
  ) {}

  ngOnInit(): void {
    this.loadRanking();
    this.startPolling();
  }

  ngOnDestroy(): void {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
    }
  }

  startPolling(): void {
    // Actualizar cada 60 segundos
    this.pollingSubscription = this.votingService.getRankedSongsPolling().subscribe({
      next: () => {
        this.loadRanking();
      }
    });
  }

  loadRanking(): void {
    this.isLoading = true;
    this.error = '';
    
    this.rankingService.getSongHistory(this.sortBy, this.sortOrder)
      .subscribe({
        next: (data) => {
          this.songs = data;
          this.calculateStats();
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Error loading ranking:', err);
          this.error = 'Error al cargar el ranking. Intenta nuevamente.';
          this.isLoading = false;
        }
      });
  }
  
  // Y agregar este método para calcular estadísticas
  calculateStats(): void {
    if (this.songs.length === 0) {
      this.stats = {};
      return;
    }
  
    // Estadísticas generales
    this.stats.totalSongs = this.songs.length;
    this.stats.totalPlays = this.songs.reduce((sum, song) => sum + song.times_played, 0);
    this.stats.totalVotes = this.songs.reduce((sum, song) => sum + song.total_votes, 0);
    this.stats.totalDislikes = this.songs.reduce((sum, song) => sum + song.total_dislikes, 0);
    
    // Canción más reproducida
    this.stats.mostPlayed = this.songs.reduce((max, song) => 
      song.times_played > max.times_played ? song : max, this.songs[0]);
    
    // Canción más votada
    this.stats.mostVoted = this.songs.reduce((max, song) => 
      song.total_votes > max.total_votes ? song : max, this.songs[0]);
    
    // Canción con mejor ratio
    this.stats.bestRated = this.songs.reduce((best, song) => {
      const ratio = this.getVotePercentage(song);
      const bestRatio = this.getVotePercentage(best);
      return ratio > bestRatio ? song : best;
    }, this.songs[0]);
  }

  onSortChange(field: string): void {
    if (this.sortBy === field) {
      this.sortOrder = this.sortOrder === 'desc' ? 'asc' : 'desc';
    } else {
      this.sortBy = field;
      this.sortOrder = 'desc';
    }
    this.loadRanking();
  }

  getSortIcon(field: string): string {
    if (this.sortBy !== field) return 'fa-sort';
    return this.sortOrder === 'desc' ? 'fa-sort-down' : 'fa-sort-up';
  }

  onVote(song: any): void {
    this.isVoting = true;
    this.voteMessage = '';
    
    this.rankingService.voteFromHistory(song.track_id)
      .subscribe({
        next: (response) => {
          this.voteMessage = '¡Voto registrado! La canción ha sido agregada a la lista de votación.';
          this.isVoting = false;
          
          // Actualizar contador de votos localmente
          const index = this.songs.findIndex(s => s.track_id === song.track_id);
          if (index !== -1) {
            this.songs[index].total_votes += 1;
            this.calculateStats();
          }
        },
        error: (err) => {
          console.error('Error voting:', err);
          this.voteMessage = err.error?.error || 'Error al votar. Intenta nuevamente.';
          this.isVoting = false;
        }
      });
  }

  onShowDetails(song: any): void {
    this.selectedSong = song;
  }

  onCloseDetails(): void {
    this.selectedSong = null;
  }

  get filteredSongs(): any[] {
    if (!this.filterText) return this.songs;
    
    const searchTerm = this.filterText.toLowerCase();
    return this.songs.filter(song => 
      song.name.toLowerCase().includes(searchTerm) ||
      song.artists.some((artist: string) => 
        artist.toLowerCase().includes(searchTerm)
      )
    );
  }

  getVotePercentage(song: any): number {
    if (!song.total_votes && !song.total_dislikes) return 0;
    const total = song.total_votes + song.total_dislikes;
    return Math.round((song.total_votes / total) * 100);
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  getDaysSinceLastPlayed(song: any): number {
    const lastPlayed = new Date(song.last_played_at);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - lastPlayed.getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  setActiveTab(tab: string): void {
    this.activeTab = tab;
  }

  getTabSongs(): any[] {
    switch (this.activeTab) {
      case 'mostPlayed':
        return [...this.filteredSongs].sort((a, b) => b.times_played - a.times_played);
      case 'mostVoted':
        return [...this.filteredSongs].sort((a, b) => b.total_votes - a.total_votes);
      case 'bestRated':
        return [...this.filteredSongs].sort((a, b) => {
          const aRatio = this.getVotePercentage(a);
          const bRatio = this.getVotePercentage(b);
          return bRatio - aRatio;
        });
      default:
        return this.filteredSongs;
    }
  }
}