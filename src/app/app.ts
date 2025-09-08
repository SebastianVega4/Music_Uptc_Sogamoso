import { Component } from '@angular/core';
import { RouterModule } from "@angular/router";

@Component({
  standalone: true,
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrls: ['./app.scss'],
  imports: [RouterModule],
})
export class AppComponent {
  title = 'UPTC Music';
}
