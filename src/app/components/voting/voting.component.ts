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
  hasVoted: boolean = false;
  private votingSubscription: Subscription | undefined;
  private songSubscription: Subscription | undefined;

  constructor(
    private votingService: VotingService,
    private spotifyService: SpotifyNowPlayingService
  ) { }

  ngOnInit(): void {
    this.loadVotingStatus();
    
    // Actualizar cada 15 segundos
    this.votingSubscription = interval(15000).subscribe(() => {
      this.loadVotingStatus();
    });
    
    // Suscribirse a cambios en la canción actual
    this.songSubscription = this.spotifyService.getAdminCurrentlyPlayingPolling().subscribe(
      (song: any) => {
        this.currentSong = song;
        // Si la canción cambia, resetear el estado de voto
        if (song && song.id !== this.votingStatus?.current_song_id) {
          this.hasVoted = false;
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
    this.votingService.submitVote(voteType).subscribe({
      next: (response) => {
        this.hasVoted = true;
        this.votingStatus = response.status;
        // Mostrar mensaje de éxito
      },
      error: (error) => {
        console.error('Error submitting vote:', error);
        // Mostrar mensaje de error
      }
    });
  }
}