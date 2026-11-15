import { Injectable, inject } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { Geolocation } from '@capacitor/geolocation';
import { Camera } from '@capacitor/camera';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

export interface PermissionStatusSummary {
  camera: 'granted' | 'denied' | 'prompt';
  photos: 'granted' | 'denied' | 'prompt';
  location: 'granted' | 'denied' | 'prompt';
  notifications: 'granted' | 'denied' | 'prompt';
}

@Injectable({
  providedIn: 'root',
})
export class PermissionService {
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);

  /**
   * Realiza un diagnóstico unificado de los sensores y capacidades nativas del dispositivo.
   */
  async checkAllPermissions(): Promise<PermissionStatusSummary> {
    if (!Capacitor.isNativePlatform()) {
      return {
        camera: 'granted',
        photos: 'granted',
        location: 'granted',
        notifications: 'granted',
      };
    }

    let camera: 'granted' | 'denied' | 'prompt' = 'prompt';
    let photos: 'granted' | 'denied' | 'prompt' = 'prompt';
    let location: 'granted' | 'denied' | 'prompt' = 'prompt';
    let notifications: 'granted' | 'denied' | 'prompt' = 'prompt';

    try {
      const camCheck = await Camera.checkPermissions();
      camera = (camCheck.camera as any) || 'prompt';
      photos = (camCheck.photos as any) || 'prompt';
    } catch (e) {
      console.warn('Error auditando permisos de cámara:', e);
    }

    try {
      const locCheck = await Geolocation.checkPermissions();
      const loc = locCheck.location || locCheck.coarseLocation;
      location = (loc as any) || 'prompt';
    } catch (e) {
      console.warn('Error auditando permisos de ubicación:', e);
    }

    try {
      const notifCheck = await LocalNotifications.checkPermissions();
      notifications = (notifCheck.display as any) || 'prompt';
    } catch (e) {
      console.warn('Error auditando permisos de notificaciones:', e);
    }

    return { camera, photos, location, notifications };
  }

  /**
   * Solicita interactivamente un permiso específico de hardware.
   */
  async solicitarPermiso(tipo: 'CAMARA' | 'GALERIA' | 'UBICACION' | 'NOTIFICACIONES'): Promise<boolean> {
    switch (tipo) {
      case 'CAMARA':
        return this.solicitarPermisoCamara('CAMARA');
      case 'GALERIA':
        return this.solicitarPermisoCamara('GALERIA');
      case 'UBICACION':
        return this.solicitarPermisoUbicacion(true);
      case 'NOTIFICACIONES':
        return this.ensureNotificationPermission();
      default:
        return false;
    }
  }

  /**
   * Solicita y valida los permisos de ubicación GPS notificando al usuario de forma clara.
   */
  async solicitarPermisoUbicacion(mostrarExplicacionPrevia = false): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      return true;
    }

    try {
      const check = await Geolocation.checkPermissions();

      if (check.location === 'granted' || check.coarseLocation === 'granted') {
        return true;
      }

      if (mostrarExplicacionPrevia || check.location === 'prompt' || check.location === 'prompt-with-rationale') {
        const confirmar = await this.mostrarDialogoExplicativo(
          'Acceso a la Ubicación',
          'AgroTrack utiliza tu ubicación GPS para georreferenciar las novedades y detectar automáticamente el lote en el que te encuentras trabajando.',
          'Continuar',
          'location-outline'
        );

        if (!confirmar) {
          return false;
        }
      }

      const req = await Geolocation.requestPermissions();

      if (req.location === 'granted' || req.coarseLocation === 'granted') {
        return true;
      }

      await this.mostrarAlertaPermisoDenegado(
        'Ubicación denegada',
        'No podremos detectar tu posición en el lote sin el permiso de ubicación. Puedes activarlo en los Ajustes de Aplicaciones de tu teléfono.'
      );
      return false;
    } catch (err) {
      console.warn('Error verificando permisos de geolocalización:', err);
      return false;
    }
  }

  /**
   * Solicita y valida los permisos de Cámara o Galería de Fotos notificando al usuario.
   */
  async solicitarPermisoCamara(origen: 'CAMARA' | 'GALERIA'): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      return true;
    }

    try {
      const check = await Camera.checkPermissions();
      const esCamara = origen === 'CAMARA';
      const estadoActual = esCamara ? check.camera : check.photos;

      if (estadoActual === 'granted') {
        return true;
      }

      const titulo = esCamara ? 'Permiso de Cámara' : 'Acceso a Galería y Archivos';
      const mensaje = esCamara
        ? 'AgroTrack necesita usar tu cámara para tomar fotografías de evidencia de novedades y estado de cultivos directamente en el campo.'
        : 'AgroTrack necesita acceder a tu galería de fotos para que puedas seleccionar y adjuntar evidencia gráfica.';

      const confirmar = await this.mostrarDialogoExplicativo(
        titulo,
        mensaje,
        'Habilitar',
        esCamara ? 'camera-outline' : 'images-outline'
      );

      if (!confirmar) {
        return false;
      }

      const req = await Camera.requestPermissions({
        permissions: esCamara ? ['camera'] : ['photos'],
      });

      const nuevoEstado = esCamara ? req.camera : req.photos;

      if (nuevoEstado === 'granted') {
        return true;
      }

      await this.mostrarAlertaPermisoDenegado(
        'Permiso no concedido',
        `Para adjuntar evidencia desde la ${esCamara ? 'cámara' : 'galería'}, debes otorgar el permiso desde la configuración de tu teléfono.`
      );
      return false;
    } catch (err) {
      console.warn('Error verificando permisos de cámara:', err);
      return false;
    }
  }

  /**
   * Solicita y valida el permiso de notificaciones locales (Android 13+).
   */
  async ensureNotificationPermission(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      return false;
    }

    try {
      const check = await LocalNotifications.checkPermissions();
      if (check.display === 'granted') {
        return true;
      }

      const req = await LocalNotifications.requestPermissions();
      return req.display === 'granted';
    } catch (err) {
      console.warn('Error verificando permisos de notificaciones:', err);
      return false;
    }
  }

  private async mostrarDialogoExplicativo(
    titulo: string,
    mensaje: string,
    textoConfirmar: string,
    icono: string
  ): Promise<boolean> {
    return new Promise(async (resolve) => {
      const alert = await this.alertCtrl.create({
        header: titulo,
        message: mensaje,
        backdropDismiss: false,
        buttons: [
          {
            text: 'Cancelar',
            role: 'cancel',
            handler: () => resolve(false),
          },
          {
            text: textoConfirmar,
            handler: () => resolve(true),
          },
        ],
      });
      await alert.present();
    });
  }

  private async mostrarAlertaPermisoDenegado(titulo: string, mensaje: string): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: titulo,
      message: mensaje,
      buttons: ['Entendido'],
    });
    await alert.present();
  }
}
