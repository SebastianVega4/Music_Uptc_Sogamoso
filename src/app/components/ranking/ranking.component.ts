// components/ranking/ranking.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RankingService } from '../../services/ranking.service';
import { VotingService } from '../../services/voting';

@Component({
  standalone: true,
  selector: 'app-ranking',
  templateUrl: './ranking.component.html',
  styleUrls: ['./ranking.component.css'],
  imports: [CommonModule, FormsModule]
})
export class RankingComponent implements OnInit {
  songs: any[] = [];
  isLoading: boolean = true;
  error: string = '';
  sortBy: string = 'times_played';
  sortOrder: string = 'desc';
  filterText: string = '';
  selectedSong: any = null;
  isVoting: boolean = false;
  voteMessage: string = '';

  constructor(
    private rankingService: RankingService,
    private votingService: VotingService
  ) {}

  ngOnInit(): void {
    this.loadRanking();
  }

  loadRanking(): void {
    this.isLoading = true;
    this.error = '';
    
    this.rankingService.getSongHistory(this.sortBy, this.sortOrder)
      .subscribe({
        next: (data) => {
          this.songs = data;
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Error loading ranking:', err);
          this.error = 'Error al cargar el ranking. Intenta nuevamente.';
          this.isLoading = false;
        }
      });
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
}