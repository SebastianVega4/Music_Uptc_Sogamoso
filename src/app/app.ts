import { Component } from '@angular/core';
import { AppRoutingModule } from "./app.routes";

@Component({
  standalone: true,
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrls: ['./app.scss'],
  imports: [AppRoutingModule],
})
export class AppComponent {
  title = 'UPTC Restaurant Music';
}
