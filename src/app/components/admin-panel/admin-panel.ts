import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { SpotifyNowPlayingService } from '../../services/spotify-now-playing.service';
import { VotingService } from '../../services/voting';
import { SpotifyService } from '../../services/spotify';
import { ScheduleService } from '../../services/schedule.service';
import { AuthService } from '../../services/auth';
import { QueueService } from '../../services/queue.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-admin-panel',
  templateUrl: './admin-panel.html',
  styleUrls: ['./admin-panel.scss']
})
export class AdminPanelComponent implements OnInit, OnDestroy {
  // Estados de la UI
  activeSection = 'dashboard';
  showSearch = false;
  showRecentlyAdded = true;
  isEditingSchedules = false;

  // Datos
  songs: any[] = [];
  queue: any[] = [];
  recentlyAddedSongs: any[] = [];
  searchResults: any[] = [];
  schedules: any[] = [];
  spotifyStatus: any = null;
  adminCurrentlyPlaying: any = null;

  // Estados de carga
  isLoading = false;
  isLoadingQueue = false;
  isLoadingCurrent = false;
  isPlaying = false;

  // Búsqueda
  searchQuery = '';

  // Votos del admin
  adminVotes: { [key: string]: boolean } = {}; // true = dislike, false = like

   
  // Estadísticas
  totalVotes: number = 0;
  uniqueVoters: number = 0;

  // Timers
  private refreshTimer: any;
  private currentSongTimer: any;

  constructor(
    private spotifyNowPlaying: SpotifyNowPlayingService,
    private votingService: VotingService,
    private spotifyService: SpotifyService,
    private scheduleService: ScheduleService,
    private authService: AuthService,
    private router: Router,
    private queueService: QueueService
  ) { }

  ngOnInit() {
    this.loadInitialData();
    this.setupAutoRefresh();
    this.calculateStats();
  }

  calculateStats(): void {
    this.totalVotes = this.songs.reduce((sum, song) => sum + (song.votes || 0), 0);
    this.uniqueVoters = Math.floor(this.totalVotes * 0.7);
  }

  ngOnDestroy() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
    if (this.currentSongTimer) {
      clearInterval(this.currentSongTimer);
    }
  }

  loadInitialData() {
    this.loadSongs();
    this.loadQueue();
    this.getSpotifyStatus();
    this.getAdminCurrentlyPlaying();
    this.loadSchedules();
  }

  setupAutoRefresh() {
    // Actualizar cada 30 segundos
    this.refreshTimer = setInterval(() => {
      this.loadSongs();
      this.loadQueue();
      this.getSpotifyStatus();
    }, 30000);

    // Actualizar la canción actual cada 5 segundos
    this.currentSongTimer = setInterval(() => {
      this.getAdminCurrentlyPlaying();
    }, 5000);
  }

  setActiveSection(section: string) {
    this.activeSection = section;

    // Cargar datos específicos de la sección si es necesario
    if (section === 'queue') {
      this.loadQueue();
    } else if (section === 'playing') {
      this.getAdminCurrentlyPlaying();
    } else if (section === 'ranking') {
      this.loadSongs();
    } else if (section === 'schedules') {
      this.loadSchedules();
    }
  }

  toggleSearch() {
    this.showSearch = !this.showSearch;
    if (this.showSearch) {
      this.activeSection = 'dashboard';
    }
  }

  toggleRecentlyAdded() {
    this.showRecentlyAdded = !this.showRecentlyAdded;
  }

  // Cargar canciones del ranking
  loadSongs() {
    this.isLoading = true;
    this.votingService.getSongs().subscribe({
      next: (songs) => {
        this.songs = songs;
        this.filterRecentlyAdded();
        
        // Calculate total votes and unique voters
        this.calculateVotingStats();
        
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading songs:', error);
        this.isLoading = false;
      }
    });
  }

  calculateVotingStats() {
    this.totalVotes = this.songs.reduce((sum, song) => sum + (song.votes || 0) + (song.dislikes || 0), 0);
    this.uniqueVoters = Math.floor(this.totalVotes / 2);
  }

  // Filtrar canciones recientemente agregadas (últimas 6 horas)
  filterRecentlyAdded() {
    const sixHoursAgo = new Date();
    sixHoursAgo.setHours(sixHoursAgo.getHours() - 6);

    this.recentlyAddedSongs = this.songs.filter(song => {
      const songDate = new Date(song.createdat);
      return songDate > sixHoursAgo;
    }).slice(0, 8); // Limitar a 8 canciones
  }

  // Cargar cola de reproducción
  loadQueue() {
    this.isLoadingQueue = true;
    this.queueService.getQueue().subscribe({
      next: (queue) => {
        this.queue = queue;
        this.isLoadingQueue = false;
      },
      error: (error) => {
        console.error('Error loading queue:', error);
        this.isLoadingQueue = false;
      }
    });
  }

  // Obtener estado de Spotify
  getSpotifyStatus() {
    this.spotifyNowPlaying.getAdminSpotifyStatus().subscribe({
      next: (status: any) => {
        this.spotifyStatus = status;
      },
      error: (error: any) => {
        console.error('Error getting Spotify status:', error);
      }
    });
  }

  // Obtener canción actualmente en reproducción
  getAdminCurrentlyPlaying() {
    this.isLoadingCurrent = true;
    this.spotifyNowPlaying.getCurrentlyPlaying().subscribe({
      next: (data) => {
        if (data && data.item) {
          this.adminCurrentlyPlaying = {
            id: data.item.id,
            name: data.item.name,
            artists: data.item.artists.map((artist: any) => artist.name),
            image: data.item.album.images[0]?.url || 'assets/default-song.png',
            progress_ms: data.progress_ms || 0,
            duration_ms: data.item.duration_ms,
            uri: data.item.uri
          };
          this.isPlaying = data.is_playing;
        } else {
          this.adminCurrentlyPlaying = null;
        }
        this.isLoadingCurrent = false;
      },
      error: (error) => {
        console.error('Error getting currently playing:', error);
        this.isLoadingCurrent = false;
      }
    });
  }

  // Cargar horarios
  loadSchedules() {
    this.scheduleService.getSchedules().subscribe({
      next: (schedules) => {
        this.schedules = schedules;
      },
      error: (error) => {
        console.error('Error loading schedules:', error);
      }
    });
  }

  // Guardar horarios
  saveSchedules() {
    this.scheduleService.updateSchedules(this.schedules).subscribe({
      next: () => {
        this.isEditingSchedules = false;
        // Mostrar mensaje de éxito
      },
      error: (error) => {
        console.error('Error saving schedules:', error);
      }
    });
  }

  // Conectar Spotify
  connectSpotify() {
    this.spotifyNowPlaying.startAdminSpotifyAuth().subscribe({
      next: (data: any) => {
        if (data.authUrl) {
          window.location.href = data.authUrl;
        }
      },
      error: (error: any) => {
        console.error('Error connecting to Spotify:', error);
      }
    });
  }

  // Desconectar Spotify
  disconnectSpotify() {
    this.spotifyNowPlaying.disconnectAdminSpotify().subscribe({
      next: () => {
        this.getSpotifyStatus();
      },
      error: (error: any) => {
        console.error('Error disconnecting from Spotify:', error);
      }
    });
  }

  // Buscar en Spotify
  searchSpotify() {
    if (!this.searchQuery.trim()) return;
    
    this.spotifyService.searchTracks(this.searchQuery).subscribe({
      next: (results: any[]) => {
        this.searchResults = results;
      },
      error: (error: any) => {
        console.error('Error searching Spotify:', error);
      }
    });
  }

  // Votar desde la búsqueda
  voteFromSearch(track: any, isDislike: boolean) {
    const songData = {
      id: track.id,
      name: track.name,
      artists: track.artists.map((artist: any) => artist.name),
      image: track.album.images[0]?.url || 'assets/default-song.png'
    };

    this.votingService.vote(songData, isDislike, true).subscribe({
      next: () => {
        this.loadSongs();
        // Mostrar feedback visual
      },
      error: (error) => {
        console.error('Error voting from search:', error);
      }
    });
  }

  // Voto del administrador
  adminVote(song: any, isDislike: boolean) {
    // Guardar el voto del admin localmente para feedback inmediato
    this.adminVotes[song.id] = isDislike;

    this.votingService.vote(song, isDislike, true).subscribe({
      next: () => {
        this.loadSongs();
      },
      error: (error) => {
        console.error('Error with admin vote:', error);
        // Revertir el cambio visual en caso de error
        delete this.adminVotes[song.id];
      }
    });
  }

  // Verificar si el admin ha dado like
  hasAdminLiked(songId: string): boolean {
    return this.adminVotes[songId] === false;
  }

  // Verificar si el admin ha dado dislike
  hasAdminDisliked(songId: string): boolean {
    return this.adminVotes[songId] === true;
  }

  // Agregar a la cola
  addToQueue(trackUri: string) {
    this.queueService.addToQueue(trackUri).subscribe({
      next: () => {
        this.loadQueue();
        // Mostrar mensaje de éxito
      },
      error: (error) => {
        console.error('Error adding to queue:', error);
      }
    });
  }

  // Quitar de la cola
  removeFromQueue(trackUri: string) {
    this.queueService.removeFromQueue(trackUri).subscribe({
      next: () => {
        this.loadQueue();
      },
      error: (error) => {
        console.error('Error removing from queue:', error);
      }
    });
  }

  // Reproducir una pista
  playTrack(trackUri: string) {
    this.queueService.addToQueue(trackUri).subscribe({
      next: () => {
        setTimeout(() => {
          this.getAdminCurrentlyPlaying();
        }, 1000);
      },
      error: (error: any) => {
        console.error('Error playing track:', error);
      }
    });
  }

  // Siguiente canción
  nextTrack() {
    this.spotifyNowPlaying.nextTrack().subscribe({
      next: () => {
        setTimeout(() => {
          this.getAdminCurrentlyPlaying();
        }, 1000);
      },
      error: (error) => {
        console.error('Error skipping to next track:', error);
      }
    });
  }

  // Canción anterior
  previousTrack() {
    this.spotifyNowPlaying.previousTrack().subscribe({
      next: () => {
        setTimeout(() => {
          this.getAdminCurrentlyPlaying();
        }, 1000);
      },
      error: (error) => {
        console.error('Error going to previous track:', error);
      }
    });
  }

  // Pausar/Reanudar reproducción
  togglePlayback() {
    if (this.isPlaying) {
      this.spotifyNowPlaying.pausePlayback().subscribe({
        next: () => {
          this.isPlaying = false;
        },
        error: (error) => {
          console.error('Error pausing playback:', error);
        }
      });
    } else {
      this.spotifyNowPlaying.resumePlayback().subscribe({
        next: () => {
          this.isPlaying = true;
        },
        error: (error) => {
          console.error('Error resuming playback:', error);
        }
      });
    }
  }

  // Eliminar canción
  deleteSong(songId: string) {
    if (confirm('¿Estás seguro de que quieres eliminar esta canción?')) {
      this.votingService.deleteSong(songId).subscribe({
        next: () => {
          this.loadSongs();
        },
        error: (error) => {
          console.error('Error deleting song:', error);
        }
      });
    }
  }

  // Eliminar todos los votos
  deleteAllVotes() {
    if (confirm('¿Estás seguro de que quieres eliminar TODOS los votos? Esta acción no se puede deshacer.')) {
      this.votingService.deleteAllVotes().subscribe({
        next: () => {
          this.loadSongs();
        },
        error: (error) => {
          console.error('Error deleting all votes:', error);
        }
      });
    }
  }

  // Forzar refresco
  forceRefresh() {
    this.loadSongs();
    this.loadQueue();
    this.getSpotifyStatus();
    this.getAdminCurrentlyPlaying();
  }

  // Alternar vista de cola
  toggleQueue() {
    this.activeSection = 'queue';
  }

  // Agregar al histórico
  addToHistory() {
    this.spotifyNowPlaying.addToHistory().subscribe({
      next: () => {
        // Mostrar mensaje de éxito
        console.log('Canción agregada al histórico');
      },
      error: (error: any) => {
        console.error('Error adding to history:', error);
      }
    });
  }

  // Verificar en ranking
  checkPlayingSong() {
    if (this.adminCurrentlyPlaying) {
      const found = this.songs.find(song => song.id === this.adminCurrentlyPlaying.id);
      if (found) {
        // Resaltar la canción en el ranking
        this.activeSection = 'ranking';
        // Podría implementarse scroll a la canción
      } else {
        alert('Esta canción no está en el ranking.');
      }
    }
  }

  // Forzar en ranking
  forceRankSong() {
    if (this.adminCurrentlyPlaying) {
      const songData = {
        id: this.adminCurrentlyPlaying.id,
        name: this.adminCurrentlyPlaying.name,
        artists: this.adminCurrentlyPlaying.artists,
        image: this.adminCurrentlyPlaying.image
      };

      this.votingService.vote(songData, false, true).subscribe({
        next: () => {
          this.loadSongs();
          this.activeSection = 'ranking';
        },
        error: (error) => {
          console.error('Error forcing song to rank:', error);
        }
      });
    }
  }

  // Formatear tiempo (mm:ss)
  formatTime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  }

  // Formatear tiempo relativo (hace x tiempo)
  formatTimeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Ahora mismo';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours} h`;
    if (diffDays === 1) return 'Ayer';
    return `Hace ${diffDays} días`;
  }

  // Convertir a formato AM/PM
  convertToAmPm(timeString: string): string {
    if (!timeString) return '';

    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const formattedHour = hour % 12 || 12;

    return `${formattedHour}:${minutes} ${ampm}`;
  }

  // Cerrar sesión
  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}