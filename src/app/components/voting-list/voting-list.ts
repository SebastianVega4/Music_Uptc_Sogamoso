import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VotingService } from '../../services/voting';
import { forkJoin } from 'rxjs';

@Component({
  standalone: true,
  selector: 'app-voting-list',
  templateUrl: './voting-list.html',
  styleUrls: ['./voting-list.scss'],
  imports: [CommonModule]
})
export class VotingListComponent implements OnInit {
  songs: any[] = [];
  recentlyAddedSongs: any[] = [];
  isLoading: boolean = true;

  constructor(private votingService: VotingService) { }

  ngOnInit(): void {
    this.loadSongs();
  }

  loadSongs(): void {
    this.isLoading = true;
    const rankedSongs$ = this.votingService.getRankedSongs();
    const recentlyAddedSongs$ = this.votingService.getRecentlyAddedSongs();

    forkJoin({ranked: rankedSongs$, recent: recentlyAddedSongs$}).subscribe({
      next: ({ranked, recent}) => {
        this.songs = ranked;
        this.recentlyAddedSongs = recent;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error al cargar canciones:', error);
        this.isLoading = false;
        alert('Error al cargar la lista de canciones.');
      },
    });
  }

  vote(song: any): void {
    const trackInfo = {
      name: song.name,
      artists: song.artists,
      image: song.image,
      album: song.album,
      preview_url: song.preview_url,
    };

    this.votingService.voteForSong(song.id, trackInfo).subscribe({
      next: () => {
        alert('¡Tu voto ha sido registrado!');
        this.loadSongs();
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
