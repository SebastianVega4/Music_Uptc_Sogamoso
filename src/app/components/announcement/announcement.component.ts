import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-announcement',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './announcement.component.html',
  styleUrls: ['./announcement.component.scss']
})
export class AnnouncementComponent {
  isHidden = false;

  hideAnnouncement() {
    this.isHidden = true;
    // Opcional: guardar en localStorage para no mostrar nuevamente
    localStorage.setItem('announcementHidden', 'true');
  }

  ngOnInit() {
    // Opcional: verificar si ya fue ocultado anteriormente
    const hidden = localStorage.getItem('announcementHidden');
    if (hidden === 'true') {
      this.isHidden = true;
    }
  }
}