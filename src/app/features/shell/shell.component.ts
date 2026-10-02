import { Component, ChangeDetectionStrategy, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './shell.component.html',
  styleUrls: ['./shell.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellComponent implements OnInit {
  private auth = inject(AuthService);

  readonly admin = this.auth.currentUser;

  /** (02-oct-2026) Fase 3: al entrar se toma el rol vigente (pudo cambiar desde el último inicio de sesión). */
  ngOnInit(): void {
    this.auth.cargarPerfil().subscribe({ error: () => {} });
  }

  puede(permiso: string): boolean {
    return this.auth.puede(permiso);
  }

  logout(): void {
    this.auth.logout();
  }
}
