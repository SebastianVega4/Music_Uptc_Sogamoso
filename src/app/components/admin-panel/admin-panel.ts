import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VotingService } from '../../services/voting';
import { AuthService } from '../../services/auth';
import { Router } from '@angular/router';

@Component({
  selector: 'app-admin-panel',
  templateUrl: './admin-panel.html',
  styleUrls: ['./admin-panel.scss'],
  imports: [CommonModule]
})
export class AdminPanelComponent implements OnInit {
  songs: any[] = [];
  isLoading: boolean = true;

  constructor(
    private votingService: VotingService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadSongs();
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

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/']);
  }
}
