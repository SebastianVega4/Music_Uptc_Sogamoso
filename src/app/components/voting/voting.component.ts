import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
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
  isLoading: boolean = false;
  isUpdatingNext: boolean = false;
  isUpdatingGenre: boolean = false;
  isUpdatingRepeat: boolean = false;
  private votingSubscription: Subscription | undefined;
  private songSubscription: Subscription | undefined;
  private statusPollingSubscription: Subscription | undefined;

  constructor(
    private votingService: VotingService,
    private spotifyService: SpotifyNowPlayingService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.loadVotingStatus();
    
    // Polling para actualizar estadísticas cada 3 segundos
    this.votingSubscription = interval(2000).subscribe(() => {
      // Solo actualizar si hay una canción reproduciéndose
      if (this.currentSong && this.currentSong.is_playing) {
        this.loadVotingStatus();
      }
    });
    
    // Suscribirse a cambios en la canción actual
    this.songSubscription = this.spotifyService.getAdminCurrentlyPlayingPolling().subscribe(
      (song: any) => {
        this.currentSong = song;
        // Si la canción cambia, resetear los votos del usuario
        if (song && song.id !== this.votingStatus?.current_song_id) {
          this.userVotes = [];
          this.lastVoteType = '';
          // Forzar actualización inmediata
          this.loadVotingStatus();
        }
      }
    );
  }

  forceRefresh(): void {
    this.loadVotingStatus();
    this.showNotification('Votaciones actualizadas', 'success');
  }

  ngOnDestroy(): void {
    if (this.votingSubscription) {
      this.votingSubscription.unsubscribe();
    }
    if (this.songSubscription) {
      this.songSubscription.unsubscribe();
    }
    if (this.statusPollingSubscription) {
      this.statusPollingSubscription.unsubscribe();
    }
  }

  loadVotingStatus(): void {
    this.votingService.getVotingStatusImmediate().subscribe({
      next: (status) => {
        // Verificar que los datos sean válidos
        if (status && status.votes) {
          this.votingStatus = status;
        } else {
          console.warn('Datos de votación inválidos recibidos:', status);
        }
      },
      error: (error) => {
        console.error('Error loading voting status:', error);
        // Intentar recargar después de un breve delay
        setTimeout(() => this.loadVotingStatus(), 1000);
      }
    });
  }

  vote(voteType: string): void {
    if (this.hasVoted(voteType)) {
      this.showNotification('Ya has votado por esta opción', 'warning');
      return;
    }
  
    this.votingService.submitVote(voteType).subscribe({
      next: (response) => {
        this.userVotes.push(voteType);
        this.lastVoteType = voteType;
        this.votingStatus = response.status;
        this.showNotification(`Voto registrado: ${this.getVoteTypeName(voteType)}`, 'success');
        
        // Actualizar estadísticas inmediatamente después de votar
        this.loadVotingStatus();
        
        this.cdr.detectChanges();
        
        setTimeout(() => {
          this.lastVoteType = '';
          this.cdr.detectChanges();
        }, 3000);
      },
      error: (error) => {
        console.error('Error submitting vote:', error);
        
        let errorMessage = 'Error al votar';
        if (error.message.includes('Ya has votado por')) {
          // Si ya votó por esta categoría específica, agregarla a userVotes
          this.userVotes.push(voteType);
          errorMessage = error.message;
          // Actualizar estadísticas para reflejar el voto existente
          this.loadVotingStatus();
        }
        
        this.showNotification(errorMessage, 'warning');
        this.cdr.detectChanges();
      }
    });
  }

  private showNotification(message: string, type: 'success' | 'error' | 'warning'): void {
    // Implementación existente de notificaciones...
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 90px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 8px;
      color: white;
      font-weight: 600;
      z-index: 10000;
      animation: slideIn 0.3s ease;
    `;
    
    if (type === 'success') {
      toast.style.background = 'linear-gradient(135deg, #1ed760, #19a34a)';
    } else if (type === 'error') {
      toast.style.background = 'linear-gradient(135deg, #ff4d4d, #cc0000)';
    } else {
      toast.style.background = 'linear-gradient(135deg, #ff9a00, #e67e00)';
    }
    
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => {
        if (document.body.contains(toast)) {
          document.body.removeChild(toast);
        }
      }, 300);
    }, 3000);
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