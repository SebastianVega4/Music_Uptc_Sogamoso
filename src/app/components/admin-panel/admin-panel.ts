import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VotingService } from '../../services/voting';
import { AuthService } from '../../services/auth';
import { ScheduleService } from '../../services/schedule.service';
import { RankingService } from '../../services/ranking.service';
import { Router } from '@angular/router';
import { SpotifyNowPlayingService } from '../../services/spotify-now-playing.service';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';

@Component({
  standalone: true,
  selector: 'app-admin-panel',
  templateUrl: './admin-panel.html',
  styleUrls: ['./admin-panel.scss'],
  imports: [CommonModule, FormsModule]
})
export class AdminPanelComponent implements OnInit {
  songs: any[] = [];
  isLoading: boolean = true;
  spotifyStatus: any = null;
  adminCurrentlyPlaying: any = null;
  queue: any[] = [];
  showQueue: boolean = false;
  isLoadingQueue: boolean = false;
  schedules: any[] = [];
  isEditingSchedules = false;
  isHidden = true;

  constructor(
    private votingService: VotingService,
    private authService: AuthService,
    private router: Router,
    private spotifyService: SpotifyNowPlayingService,
    private route: ActivatedRoute,
    private scheduleService: ScheduleService,
    private rankingService: RankingService
  ) { }

  checkPlayingSong(): void {
    this.spotifyService.checkAndRemovePlayingSongFromRanking().subscribe({
      next: (response: any) => {
        if (response.deleted) {
          alert(`Canción "${response.song.name}" eliminada del ranking por estar en reproducción`);
          this.loadSongs(); // Recargar la lista
        } else {
          alert(response.message || "La canción en reproducción no está en el ranking");
        }
      },
      error: (error) => {
        console.error('Error al verificar canción en reproducción:', error);
        alert('Error al verificar la canción en reproducción');
      }
    });
  }

  hideAnnouncement() {
    if (this.isHidden) {
      this.isHidden = false;
      localStorage.setItem('announcementHidden', 'false');
    } else {
      this.isHidden = true;
      localStorage.setItem('announcementHidden', 'true');
    }
  }

  ngOnInit(): void {
    this.loadSongs();
    this.checkSpotifyStatus();
    this.loadSchedules();

    this.route.queryParams.subscribe(params => {
      if (params['spotify_connected'] === 'true') {
        alert('Spotify conectado correctamente');
        setTimeout(() => {
          this.checkSpotifyStatus();
          this.getAdminCurrentlyPlaying();
        }, 2000);
      }
    });
  }

  loadSongs(): void {
    this.isLoading = true;
    this.votingService.getRankedSongs().subscribe({
      next: (data) => {
        this.songs = data;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error al cargar canciones:', error);
        this.isLoading = false;
        alert('Error al cargar la lista de canciones.');
      },
    });
  }

  checkSpotifyStatus(): void {
    this.spotifyService.getAdminSpotifyStatus().subscribe({
      next: (status) => {
        this.spotifyStatus = status;

        // Si está autenticado, obtener la canción actual
        if (status.authenticated && status.token_valid) {
          this.getAdminCurrentlyPlaying();
        }
      },
      error: (error) => {
        console.error('Error al verificar estado de Spotify:', error);
      }
    });
  }

  getAdminCurrentlyPlaying(): void {
    this.spotifyService.getAdminCurrentlyPlaying().subscribe({
      next: (data) => {
        this.adminCurrentlyPlaying = data;
      },
      error: (error) => {
        console.error('Error al obtener reproducción actual:', error);
      }
    });
  }

  connectSpotify(): void {
    this.spotifyService.startAdminSpotifyAuth().subscribe({
      next: (response) => {
        // Redirigir a la URL de autenticación de Spotify
        window.location.href = response.authUrl;
      },
      error: (error) => {
        console.error('Error al iniciar autenticación de Spotify:', error);
        alert('Error al conectar con Spotify. Verifica la configuración.');
      }
    });
  }

  disconnectSpotify(): void {
    if (!confirm('¿Estás seguro de que quieres desconectar Spotify?')) {
      return;
    }

    this.spotifyService.disconnectAdminSpotify().subscribe({
      next: () => {
        alert('Spotify desconectado correctamente');
        this.spotifyStatus = { authenticated: false };
        this.adminCurrentlyPlaying = null;
      },
      error: (error) => {
        console.error('Error al desconectar Spotify:', error);
        alert('Error al desconectar Spotify');
      }
    });
  }

  deleteSong(trackId: string): void {
    if (!confirm('¿Estás seguro de que quieres eliminar esta canción?')) {
      return;
    }

    this.votingService.deleteSong(trackId).subscribe({
      next: () => {
        alert('Canción eliminada correctamente.');
        this.loadSongs(); // Recargar la lista
      },
      error: (error) => {
        console.error('Error al eliminar canción:', error);

        if (error.status === 401) {
          alert('Error de autenticación. Vuelve a iniciar sesión.');
          this.authService.logout();
          this.router.navigate(['/admin-login']);
        } else {
          alert('Error al eliminar la canción.');
        }
      },
    });
  }

  deleteAllVotes(): void {
    if (!confirm('¿Estás seguro de que quieres eliminar TODOS los votos? Esta acción no se puede deshacer.')) {
      return;
    }

    this.votingService.deleteAllVotes().subscribe({
      next: () => {
        alert('Todos los votos han sido eliminados correctamente.');
        this.loadSongs(); // Recargar la lista
      },
      error: (error) => {
        console.error('Error al eliminar todos los votos:', error);

        if (error.status === 401) {
          alert('Error de autenticación. Vuelve a iniciar sesión.');
          this.authService.logout();
          this.router.navigate(['/admin-login']);
        } else {
          alert('Error al eliminar todos los votos.');
        }
      },
    });
  }

  // Método para agregar canción a la cola
  addToQueue(trackUri: string): void {
    this.spotifyService.addToQueue(trackUri).subscribe({
      next: () => {
        alert('Canción agregada a la cola correctamente');
        this.loadQueue(); // Recargar la cola
      },
      error: (error) => {
        console.error('Error al agregar a la cola:', error);
        alert('Error al agregar a la cola: ' + (error.error?.error || 'Error desconocido'));
      }
    });
  }

  // Método para cargar la cola de reproducción
  loadQueue(): void {
    this.isLoadingQueue = true;
    this.spotifyService.getQueue().subscribe({
      next: (data) => {
        this.queue = data;
        this.isLoadingQueue = false;
      },
      error: (error) => {
        console.error('Error al cargar la cola:', error);
        this.isLoadingQueue = false;
        alert('Error al cargar la cola de reproducción');
      }
    });
  }

  // Alternar visibilidad de la cola
  toggleQueue(): void {
    this.showQueue = !this.showQueue;
    if (this.showQueue) {
      this.loadQueue();
    }
  }

  // Método para cargar horarios
  loadSchedules(): void {
    this.scheduleService.getSchedules().subscribe({
      next: (data) => {
        this.schedules = data;
      },
      error: (error: any) => {
        console.error('Error al cargar horarios:', error);
        alert('Error al cargar los horarios');
      }
    });
  }

  // Método para guardar horarios - CORREGIDO
  saveSchedules(): void {
    this.scheduleService.updateSchedules(this.schedules).subscribe({
      next: () => {
        alert('Horarios guardados correctamente');
        this.isEditingSchedules = false;
      },
      error: (error: any) => {
        console.error('Error al guardar horarios:', error);
        alert('Error al guardar los horarios');
      }
    });
  }

  // Convertir formato de hora
  convertToAmPm(timeString: string): string {
    if (!timeString) return '';

    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;

    return `${hour12}:${minutes} ${ampm}`;
  }

  // Formatear tiempo transcurrido
  formatTimeAgo(dateString: string): string {
    if (!dateString) return 'Fecha desconocida';

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Hace un momento';
    if (diffMins < 60) return `Hace ${diffMins} minuto${diffMins !== 1 ? 's' : ''}`;
    if (diffHours < 24) return `Hace ${diffHours} hora${diffHours !== 1 ? 's' : ''}`;
    if (diffDays < 7) return `Hace ${diffDays} día${diffDays !== 1 ? 's' : ''}`;

    return date.toLocaleDateString();
  }

  forceRankSong(): void {
    this.rankingService.forceRankCurrentSong().subscribe({
      next: (response) => {
        this.showMessage('Canción agregada al ranking histórico');
      },
      error: (err) => {
        console.error('Error forcing rank:', err);
        this.showMessage('Error al agregar al ranking: ' + err.error?.error, 'error');
      }
    });
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/admin-login']);
  }
}