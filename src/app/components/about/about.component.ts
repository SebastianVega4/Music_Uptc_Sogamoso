import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MetaService } from '../../services/meta.service';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule],
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
