import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VotingService } from '../../services/voting';

@Component({
  standalone: true,
  selector: 'app-voting-list',
  templateUrl: './voting-list.html',
  styleUrls: ['./voting-list.scss'],
  imports: [CommonModule] 
})
export class VotingListComponent implements OnInit {
  songs: any[] = [];
  isLoading: boolean = true;

  constructor(private votingService: VotingService) { }

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

  // Nueva función para votar desde la lista
  vote(song: any): void {
    const trackInfo = {
      name: song.name,
      artists: song.artists,
      image: song.image,
      preview_url: song.preview_url,
    };

    this.votingService.voteForSong(song.id, trackInfo).subscribe({
      next: () => {
        alert('¡Tu voto ha sido registrado!');
        this.loadSongs(); // Recargar la lista para mostrar el voto actualizado
      },
      error: (error) => {
        if (error.status === 409) {
          alert('Ya has votado por esta canción.');
        } else {
          alert('Error al registrar tu voto. Intenta nuevamente.');
        }
      },
    });
  }
}