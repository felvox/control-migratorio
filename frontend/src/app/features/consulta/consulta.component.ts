import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CasosService } from '../casos/casos.service';
import { Caso } from '../../core/models/caso.model';

@Component({
  selector: 'app-consulta',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './consulta.component.html',
})
export class ConsultaComponent implements OnInit {
  private readonly casosService = inject(CasosService);

  casos: Caso[] = [];

  ngOnInit(): void {
    this.casosService.listar().subscribe((response) => {
      this.casos = response.items;
    });
  }
}
