import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Si es un error 401 (No autorizado)
      if (error.status === 401) {
        // Evitamos que llene la consola con el error rojo por defecto
        // Simplemente lo devolvemos como un error manejado o lo ignoramos
        //console.warn('Sesión expirada o inválida (401) - interceptado');
        
        // Aquí podrías agregar lógica para redirigir al login si quisieras
        // router.navigate(['/login']);
      }
      return throwError(() => error);
    })
  );
};
