import { Component, OnInit } from '@angular/core';
import { SearchComponent } from "../search/search";
import { VotingListComponent } from "../voting-list/voting-list";

@Component({
  selector: 'app-home',
  templateUrl: './home.html',
  styleUrls: ['./home.scss'],
  imports: [SearchComponent, VotingListComponent],
})
export class HomeComponent implements OnInit {
  currentSong: any = null;

  constructor() {}

  ngOnInit(): void {
    // Aquí podrías implementar la lógica para obtener la canción actual
  }
}
