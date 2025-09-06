import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VotingService } from '../../services/voting';
import { SearchComponent } from "../search/search";
import { VotingListComponent } from "../voting-list/voting-list";

@Component({
  selector: 'app-home',
  templateUrl: './home.html',
  styleUrls: ['./home.scss'],
  imports: [CommonModule, SearchComponent, VotingListComponent]
})
export class HomeComponent implements OnInit {
  currentSong: any = null;

  constructor(private votingService: VotingService) {}

  ngOnInit(): void {
    this.loadCurrentSong();
  }

  loadCurrentSong(): void {
    this.votingService.getRankedSongs().subscribe({
      next: (songs) => {
        if (songs.length > 0) {
          this.currentSong = songs[0];
        }
      },
      error: (error) => {
        console.error('Error al cargar la canción actual:', error);
      },
    });
  }
}
