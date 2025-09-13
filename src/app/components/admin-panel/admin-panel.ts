import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
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
  styleUrls: ['./admin-panel.scss'],
  standalone: true,
  imports: [FormsModule, CommonModule]
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
 
   // Mensajes
   successMessage: string = '';
   errorMessage: string = '';
   actionInProgress: string = '';
 
   // Timers
   private refreshTimer: any;
   private currentSongTimer: any;
   private recentlyAddedTimer: any;

  constructor(
    private spotifyNowPlaying: SpotifyNowPlayingService,
    private votingService: VotingService,
    private spotifyService: SpotifyService,
    private scheduleService: ScheduleService,
    private authService: AuthService,
    private router: Router,
    private queueService: QueueService,
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

  showMessage(message: string, isSuccess: boolean = true, duration: number = 3000) {
    if (isSuccess) {
      this.successMessage = message;
    } else {
      this.errorMessage = message;
    }

    setTimeout(() => {
      if (isSuccess) {
        this.successMessage = '';
      } else {
        this.errorMessage = '';
      }
    }, duration);
  }


  ngOnDestroy() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
    if (this.currentSongTimer) {
      clearInterval(this.currentSongTimer);
    }
    if (this.recentlyAddedTimer) {
      clearInterval(this.recentlyAddedTimer);
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
  
    // Actualizar recién agregadas cada 15 segundos
    this.recentlyAddedTimer = setInterval(() => {
      this.filterRecentlyAdded();
    }, 15000);
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
    // Forzar actualización sin caché
    this.votingService.forceRefresh().subscribe({
      next: (songs) => {
        this.songs = songs;
        this.filterRecentlyAdded();
        this.calculateVotingStats();
        this.isLoading = false;
        this.showMessage('Ranking actualizado correctamente');
      },
      error: (error) => {
        console.error('Error loading songs:', error);
        this.isLoading = false;
        this.showMessage('Error al cargar las canciones', false);
      }
    });
  }

  calculateVotingStats() {
    this.totalVotes = this.songs.reduce((sum, song) => sum + (song.votes || 0), 0);
    this.uniqueVoters = Math.floor(this.totalVotes * 0.7); // Estimación
  }

  // Filtrar canciones recientemente agregadas (últimas 6 horas)
  filterRecentlyAdded() {
    const sixHoursAgo = new Date();
    sixHoursAgo.setHours(sixHoursAgo.getHours() - 6);
  
    this.recentlyAddedSongs = this.songs
      .filter(song => {
        const songDate = new Date(song.createdat);
        return songDate > sixHoursAgo;
      })
      .sort((a, b) => new Date(b.createdat).getTime() - new Date(a.createdat).getTime())
      .slice(0, 8); // Limitar a 8 canciones
  }

  addToQueueFromRecent(song: any) {
    const trackUri = `spotify:track:${song.id}`;
    this.addToQueueFromSearch(trackUri);
  }

  // Cargar cola de reproducción
  loadQueue() {
    this.isLoadingQueue = true;
    this.queueService.getQueue().subscribe({
      next: (queue: any) => {
        this.queue = queue.queue || [];
        this.isLoadingQueue = false;
      },
      error: (error) => {
        console.error('Error loading queue:', error);
        this.isLoadingQueue = false;
        this.showMessage('Error al cargar la cola de reproducción', false);
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
    this.spotifyNowPlaying.getAdminCurrentlyPlaying().subscribe({
      next: (data: any) => {
        if (data && data.is_playing) {
          this.adminCurrentlyPlaying = data;
          this.isPlaying = data.is_playing;
        } else {
          this.adminCurrentlyPlaying = null;
          this.isPlaying = false;
        }
        this.isLoadingCurrent = false;
      },
      error: (error) => {
        console.error('Error getting currently playing:', error);
        this.adminCurrentlyPlaying = null;
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

    this.isLoading = true;

    this.spotifyService.searchTracks(this.searchQuery).subscribe({
      next: (results: any[]) => {
        // Asegúrate de que los resultados tengan la estructura correcta
        this.searchResults = results.map(track => ({
          ...track,
          // Asegurar que la imagen esté disponible
          image: track.image || track.album?.images?.[0]?.url || 'assets/default-song.png',
          // Asegurar que artists sea un array
          artists: Array.isArray(track.artists) ? track.artists :
            (typeof track.artists === 'string' ? [track.artists] :
              (track.artists ? [track.artists] : ['Artista desconocido']))
        }));
        this.isLoading = false;
      },
      error: (error: any) => {
        console.error('Error searching Spotify:', error);
        this.showMessage('Error al buscar en Spotify', false);
        this.isLoading = false;
      }
    });
  }

  // Votar desde la búsqueda
  voteFromSearch(track: any, isDislike: boolean) {
    const trackInfo = {
      id: track.id,
      name: track.name,
      artists: track.artists,
      image: track.image,
      preview_url: track.preview_url
    };

    this.votingService.voteForSong(track.id, trackInfo, isDislike).subscribe({
      next: (response: any) => {
        this.loadSongs();
        alert(isDislike ? 'Dislike registrado' : 'Like registrado');
      },
      error: (error) => {
        console.error('Error voting from search:', error);
        alert('Error al votar. Intenta nuevamente.');
      }
    });
  }

  // Voto del administrador
  adminVote(song: any, isDislike: boolean) {
    this.adminVotes[song.id] = isDislike;

    this.votingService.voteForSong(song.id, song, isDislike).subscribe({
      next: (response: any) => {
        this.loadSongs();
      },
      error: (error) => {
        console.error('Error with admin vote:', error);
        delete this.adminVotes[song.id];
        alert('Error al votar. Intenta nuevamente.');
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
        this.showMessage('Canción agregada a la cola correctamente');
      },
      error: (error) => {
        console.error('Error adding to queue:', error);
        this.showMessage('Error al agregar a la cola', false);
      }
    });
  }

  addToQueueFromSearch(trackUri: string) {
    this.actionInProgress = 'Agregando a la cola...';
    this.queueService.addToQueue(trackUri).subscribe({
      next: (response: any) => {
        this.loadQueue();
        this.showMessage('Canción agregada a la cola correctamente');
        this.actionInProgress = '';
      },
      error: (error) => {
        console.error('Error adding to queue:', error);
        this.showMessage('Error al agregar a la cola: ' + error.message, false);
        this.actionInProgress = '';
      }
    });
  }

  addToQueueFromRanking(songId: string) {
    if (confirm('¿Agregar esta canción a la cola de reproducción?')) {
      const trackUri = `spotify:track:${songId}`;
      this.addToQueueFromSearch(trackUri);
    }
  }

  playNowFromSearch(trackUri: string) {
    this.actionInProgress = 'Reproduciendo...';
    this.spotifyNowPlaying.playTrack(trackUri).subscribe({
      next: () => {
        setTimeout(() => {
          this.getAdminCurrentlyPlaying();
        }, 1000);
        this.showMessage('Reproduciendo canción');
        this.actionInProgress = '';
      },
      error: (error: any) => {
        console.error('Error playing track:', error);
        this.showMessage('Error al reproducir: ' + (error.error?.message || 'Error desconocido'), false);
        this.actionInProgress = '';
      }
    });
  }

  // Reproducir una pista
  playTrack(trackUri: string) {
    this.spotifyNowPlaying.playTrack(trackUri).subscribe({
      next: () => {
        setTimeout(() => {
          this.getAdminCurrentlyPlaying();
        }, 1000);
      },
      error: (error: any) => {
        console.error('Error playing track:', error);
        alert('Error al reproducir la canción: ' + error.message);
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
    if (confirm('¿Estás seguro de que quieres eliminar esta canción del ranking?')) {
      this.votingService.deleteSong(songId).subscribe({
        next: () => {
          this.loadSongs();
          this.showMessage('Canción eliminada correctamente');
        },
        error: (error) => {
          console.error('Error deleting song:', error);
          this.showMessage('Error al eliminar la canción', false);
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
          this.showMessage('Todos los votos han sido eliminados');
        },
        error: (error) => {
          console.error('Error deleting all votes:', error);
          this.showMessage('Error al eliminar todos los votos', false);
        }
      });
    }
  }

  // Forzar refresco
  forceRefresh() {
    this.showMessage('Actualizando todos los datos...');

    // Cargar todo simultáneamente
    Promise.all([
      new Promise(resolve => this.loadSongs()),
      new Promise(resolve => this.loadQueue()),
      new Promise(resolve => this.getSpotifyStatus()),
      new Promise(resolve => this.getAdminCurrentlyPlaying())
    ]).then(() => {
      this.showMessage('Todos los datos han sido actualizados');
    }).catch(error => {
      this.showMessage('Error al actualizar los datos', false);
    });
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