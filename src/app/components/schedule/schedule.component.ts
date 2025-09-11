import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScheduleService } from '../../services/schedule.service';

@Component({
  standalone: true,
  selector: 'app-schedule',
  templateUrl: './schedule.component.html',
  styleUrls: ['./schedule.component.scss'],
  imports: [CommonModule]
})
export class ScheduleComponent implements OnInit {
  schedules: any[] = [];
  isLoading: boolean = true;

  constructor(private scheduleService: ScheduleService) { }

  ngOnInit(): void {
    this.loadSchedules();
  }

  loadSchedules(): void {
    this.scheduleService.getSchedules().subscribe({
      next: (data) => {
        this.schedules = data;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error al cargar horarios:', error);
        this.isLoading = false;
      }
    });
  }

  // Función para convertir formato militar a AM/PM
  convertToAmPm(time: string): string {
    if (!time) return '';
    
    // Dividir la hora y los minutos
    const [hours, minutes] = time.split(':');
    const hourNum = parseInt(hours, 10);
    
    // Determinar AM o PM
    const period = hourNum >= 12 ? 'PM' : 'AM';
    
    // Convertir a formato 12 horas
    const hour12 = hourNum % 12 || 12;
    
    return `${hour12}:${minutes} ${period}`;
  }
}