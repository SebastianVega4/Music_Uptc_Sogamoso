import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MetaService } from '../../services/meta.service';
import { AnnouncementComponent } from '../announcement/announcement.component';
import { ScheduleComponent } from '../schedule/schedule.component';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule, AnnouncementComponent, ScheduleComponent],
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.scss']
})
export class AboutComponent implements OnInit {

  constructor(private metaService: MetaService) { }

  ngOnInit(): void {
    this.metaService.updatePageData(
      'Nosotros - Música Restaurante',
      'Conoce más sobre el proyecto de votación musical colaborativa desarrollado en la UPTC.'
    );
  }
}
