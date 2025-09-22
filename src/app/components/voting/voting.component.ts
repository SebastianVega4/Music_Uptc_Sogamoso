import { Component, OnInit, OnDestroy } from '@angular/core';
import { VotingService } from '../../services/voting';
import { SpotifyNowPlayingService } from '../../services/spotify-now-playing.service';
import { Subscription, interval } from 'rxjs';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-voting',
  templateUrl: './voting.component.html',
  styleUrls: ['./voting.component.scss'],
  standalone: true,
  imports: [CommonModule]
})
export class VotingComponent implements OnInit, OnDestroy {
  votingStatus: any = null;
  currentSong: any = null;
  userVotes: string[] = []; // Array para trackear qué opciones ya votó
  lastVoteType: string = '';
  private votingSubscription: Subscription | undefined;
  private songSubscription: Subscription | undefined;

  constructor(
    private votingService: VotingService,
    private spotifyService: SpotifyNowPlayingService
  ) { }

  ngOnInit(): void {
    this.loadVotingStatus();
    
    // Actualizar cada 10 segundos
    this.votingSubscription = interval(10000).subscribe(() => {
      this.loadVotingStatus();
    });
    
    // Suscribirse a cambios en la canción actual
    this.songSubscription = this.spotifyService.getAdminCurrentlyPlayingPolling().subscribe(
      (song: any) => {
        this.currentSong = song;
        // Si la canción cambia, resetear los votos del usuario
        if (song && song.id !== this.votingStatus?.current_song_id) {
          this.userVotes = [];
          this.lastVoteType = '';
        }
      }
    );
  }

  ngOnDestroy(): void {
    if (this.votingSubscription) {
      this.votingSubscription.unsubscribe();
    }
    if (this.songSubscription) {
      this.songSubscription.unsubscribe();
    }
  }

  loadVotingStatus(): void {
    this.votingService.getVotingStatus().subscribe({
      next: (status) => {
        this.votingStatus = status;
      },
      error: (error) => {
        console.error('Error loading voting status:', error);
      }
    });
  }

  vote(voteType: string): void {
    if (this.hasVoted(voteType)) {
      return; // Ya votó por esta opción
    }

    this.votingService.submitVote(voteType).subscribe({
      next: (response) => {
        // Agregar a la lista de votos del usuario
        this.userVotes.push(voteType);
        this.lastVoteType = voteType;
        this.votingStatus = response.status;
        
        // Mostrar mensaje temporal
        setTimeout(() => {
          this.lastVoteType = '';
        }, 3000);
      },
      error: (error) => {
        console.error('Error submitting vote:', error);
        if (error.error?.error) {
          alert(error.error.error); // Mostrar mensaje de error al usuario
        }
      }
    });
  }

  hasVoted(voteType: string): boolean {
    return this.userVotes.includes(voteType);
  }

  getVoteTypeName(voteType: string): string {
    const names: {[key: string]: string} = {
      'next': 'siguiente canción',
      'genre_change': 'cambiar de género',
      'repeat': 'mantener género'
    };
    return names[voteType] || voteType;
  }
}