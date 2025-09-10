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
  daysOfWeek = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  currentDay: number = new Date().getDay(); // 0: Domingo, 1: Lunes, etc.

  constructor(private scheduleService: ScheduleService) { }

  ngOnInit(): void {
    this.loadSchedules();
  }

  loadSchedules(): void {
    this.scheduleService.getSchedules().subscribe({
      next: (data) => {
        this.schedules = data;
      },
      error: (error) => {
        console.error('Error al cargar horarios:', error);
      }
    });
  }

  isToday(dayIndex: number): boolean {
    return dayIndex === this.currentDay;
  }

  formatTime(time: string): string {
    if (!time) return '-';
    return time.substring(0, 5); // Mostrar solo HH:MM
  }
}