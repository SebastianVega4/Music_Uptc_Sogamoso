import { Component } from '@angular/core';
import { RouterModule } from "@angular/router";
import { FloatingChatComponent } from "./components/floating-chat/floating-chat.component";

@Component({
  standalone: true,
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrls: ['./app.scss'],
  imports: [RouterModule, FloatingChatComponent],
})
export class AppComponent {
  title = 'UPTC Music';
}