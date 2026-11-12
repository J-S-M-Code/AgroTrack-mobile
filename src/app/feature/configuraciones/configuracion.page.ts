import { Component, OnInit, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonContent,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonIcon,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonItem,
  IonInput,
  IonTextarea,
  IonButton,
  IonSpinner,
  IonBadge,
  IonToggle,
  IonSelect,
  IonSelectOption,
  IonModal,
  AlertController,
  ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  personOutline,
  lockClosedOutline,
  shieldCheckmarkOutline,
  optionsOutline,
  businessOutline,
  hardwareChipOutline,
  logOutOutline,
  cameraOutline,
  imagesOutline,
  locationOutline,
  notificationsOutline,
  checkmarkCircleOutline,
  alertCircleOutline,
  refreshOutline,
  saveOutline,
  createOutline,
  trashOutline,
  addOutline,
  batteryHalfOutline,
  eyeOutline,
  eyeOffOutline,
  warningOutline,
} from 'ionicons/icons';
import { UserService } from '../../core/services/user.service';
import { ContextService } from '../../core/services/context.service';
import { AuthService } from '../../core/auth/services/auth.service';
import { PermissionService, PermissionStatusSummary } from '../../core/services/permission.service';
import { PreferencesService, AppPreferences } from '../../core/services/preferences.service';
import { FarmService } from '../../core/services/farm.service';
import { CollarService } from '../../core/services/collar.service';
import { User, UpdateProfileDto, UpdatePasswordDto } from '../../core/models/user.model';
import { Finca } from '../../core/models/finca.model';
import { Collar, CollarEstadoLabel } from '../../core/models/collar.model';

@Component({
  selector: 'app-configuracion',
  templateUrl: './configuracion.page.html',
  styleUrls: ['./configuracion.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonContent,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonIcon,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardSubtitle,
    IonCardContent,
    IonItem,
    IonInput,
    IonTextarea,
    IonButton,
    IonSpinner,
    IonBadge,
    IonToggle,
    IonSelect,
    IonSelectOption,
    IonModal,
  ],
})
export class ConfiguracionPage implements OnInit, OnDestroy {
  private userService = inject(UserService);
  public contextService = inject(ContextService);
  private authService = inject(AuthService);
  private permissionService = inject(PermissionService);
  public preferencesService = inject(PreferencesService);
  private farmService = inject(FarmService);
  private collarService = inject(CollarService);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  pestanaActiva: 'perfil' | 'preferencias' | 'fincas' | 'collares' = 'perfil';

  // --- PERFIL ---
  usuario: User | null = null;
  cargandoUsuario = true;
  modoEdicionPerfil = false;
  guardandoPerfil = false;
  datosPerfil: UpdateProfileDto = { name: '', lastName: '', phone: '', address: '' };

  // --- CONTRASEÑA ---
  mostrarSeccionPassword = false;
  guardandoPassword = false;
  passwordData: UpdatePasswordDto & { confirmPassword: string } = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  };
  verPasswordActual = false;
  verPasswordNueva = false;

  // --- PERMISOS NATIVOS ---
  permisos: PermissionStatusSummary = {
    camera: 'prompt',
    photos: 'prompt',
    location: 'prompt',
    notifications: 'prompt',
  };
  verificandoPermisos = false;

  // --- PREFERENCIAS ---
  preferencias: AppPreferences = {
    unidadSuperficie: 'ha',
    unidadTemperatura: 'C',
    altoContraste: false,
    notificacionesHabilitadas: true,
  };

  // --- GESTIÓN DE FINCAS ---
  fincas: Finca[] = [];
  cargandoFincas = false;
  fincaActiva: Finca | null = null;

  modalEdicionFincaAbierto = false;
  guardandoFinca = false;
  fincaEnEdicion: Finca | null = null;
  datosEdicionFinca: Partial<Finca> = {};

  modalEliminarFincaAbierto = false;
  eliminandoFinca = false;
  fincaAEliminar: Finca | null = null;
  confirmacionCuitFinca = '';
  motivoEliminacionFinca = '';

  // --- GESTIÓN DE COLLARES IOT ---
  fincaIdCollares = '';
  collares: Collar[] = [];
  cargandoCollares = false;

  modalCollarAbierto = false;
  esEdicionCollar = false;
  guardandoCollar = false;
  collarForm: { id?: string; rfid: string; modelo: string; estado: CollarEstadoLabel; bateria: number } = {
    rfid: '',
    modelo: '',
    estado: 'Disponible',
    bateria: 100,
  };

  modalEliminarCollarAbierto = false;
  eliminandoCollar = false;
  collarAEliminar: Collar | null = null;
  confirmacionRfidCollar = '';
  motivoEliminacionCollar = '';

  private sub = new Subscription();

  get inicialesUsuario(): string {
    const n = this.usuario?.name ? this.usuario.name.charAt(0).toUpperCase() : 'U';
    const l = this.usuario?.lastName ? this.usuario.lastName.charAt(0).toUpperCase() : '';
    return `${n}${l}`;
  }

  get puedeGestionarCollares(): boolean {
    const finca = this.fincas.find((f) => f.id === this.fincaIdCollares) || this.fincaActiva;
    const rol = finca?.myRole || '';
    return rol === 'OWNER' || rol === 'FOREMAN';
  }

  constructor() {
    addIcons({
      personOutline,
      lockClosedOutline,
      shieldCheckmarkOutline,
      optionsOutline,
      businessOutline,
      hardwareChipOutline,
      logOutOutline,
      cameraOutline,
      imagesOutline,
      locationOutline,
      notificationsOutline,
      checkmarkCircleOutline,
      alertCircleOutline,
      refreshOutline,
      saveOutline,
      createOutline,
      trashOutline,
      addOutline,
      batteryHalfOutline,
      eyeOutline,
      eyeOffOutline,
      warningOutline,
    });
  }

  ngOnInit() {
    this.cargarDatosUsuario();
    this.cargarAuditoriaPermisos();
    this.cargarFincasYCollares();

    this.sub.add(
      this.preferencesService.preferences$.subscribe((prefs) => {
        this.preferencias = { ...prefs };
        this.cdr.detectChanges();
      })
    );

    this.sub.add(
      this.contextService.selectedFarm$.subscribe((finca) => {
        this.fincaActiva = finca;
        if (finca?.id && !this.fincaIdCollares) {
          this.fincaIdCollares = finca.id;
          this.cargarCollares(finca.id);
        }
        this.cdr.detectChanges();
      })
    );
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
  }

  onTabChange() {
    this.cdr.detectChanges();
  }

  // ==================== PERFIL Y DATOS PERSONALES ====================
  async cargarDatosUsuario() {
    // 1. Renderizado instantáneo (0ms) desde snapshot en memoria o caché local
    const snapshot = this.userService.currentUserSnapshot;
    if (snapshot) {
      this.aplicarUsuario(snapshot);
      this.cargandoUsuario = false;
      this.cdr.detectChanges();
    } else {
      this.cargandoUsuario = true;
      this.cdr.detectChanges();
      const cached = await this.userService.getCachedUser();
      if (cached) {
        this.aplicarUsuario(cached);
        this.cargandoUsuario = false;
        this.cdr.detectChanges();
      }
    }

    // 2. Actualización Online-First en segundo plano desde el Backend
    this.sub.add(
      this.userService.getCurrentUser().subscribe({
        next: (u) => {
          this.usuario = u;
          if (!this.modoEdicionPerfil) {
            this.aplicarUsuario(u);
          }
          this.cargandoUsuario = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.cargandoUsuario = false;
          this.cdr.detectChanges();
        },
      })
    );
  }

  private aplicarUsuario(u: User) {
    this.usuario = u;
    this.datosPerfil = {
      name: u.name || '',
      lastName: u.lastName || '',
      phone: u.phone || '',
      address: u.address || '',
    };
  }

  activarEdicionPerfil() {
    if (this.usuario) {
      this.aplicarUsuario(this.usuario);
    }
    this.modoEdicionPerfil = true;
    this.cdr.detectChanges();
  }

  cancelarEdicionPerfil() {
    if (this.usuario) {
      this.aplicarUsuario(this.usuario);
    }
    this.modoEdicionPerfil = false;
    this.cdr.detectChanges();
  }

  guardarPerfil() {
    if (!this.datosPerfil.name.trim() || !this.datosPerfil.lastName.trim()) {
      this.mostrarToast('El nombre y el apellido son obligatorios.', 'warning');
      return;
    }

    this.guardandoPerfil = true;
    this.cdr.detectChanges();

    this.sub.add(
      this.userService.updateMyProfile(this.datosPerfil).subscribe({
        next: () => {
          this.guardandoPerfil = false;
          this.modoEdicionPerfil = false;
          if (this.usuario) {
            this.usuario = {
              ...this.usuario,
              name: this.datosPerfil.name,
              lastName: this.datosPerfil.lastName,
              phone: this.datosPerfil.phone,
              address: this.datosPerfil.address,
            };
          }
          this.cdr.detectChanges();
          this.mostrarToast('Perfil actualizado correctamente.', 'success');
        },
        error: (err) => {
          this.guardandoPerfil = false;
          this.cdr.detectChanges();
          console.error('Error al actualizar perfil:', err);
          this.mostrarToast('No se pudo guardar el perfil. Revisa tu conexión.', 'danger');
        },
      })
    );
  }

  // ==================== CAMBIO DE CONTRASEÑA ====================
  toggleSeccionPassword() {
    this.mostrarSeccionPassword = !this.mostrarSeccionPassword;
    this.cdr.detectChanges();
  }

  actualizarPassword() {
    if (!this.passwordData.currentPassword) {
      this.mostrarToast('Ingresa tu contraseña actual.', 'warning');
      return;
    }
    if (this.passwordData.newPassword.length < 6) {
      this.mostrarToast('La nueva contraseña debe tener al menos 6 caracteres.', 'warning');
      return;
    }
    if (this.passwordData.newPassword !== this.passwordData.confirmPassword) {
      this.mostrarToast('Las contraseñas nuevas no coinciden.', 'warning');
      return;
    }

    this.guardandoPassword = true;
    this.cdr.detectChanges();

    this.sub.add(
      this.userService
        .updateMyPassword({
          currentPassword: this.passwordData.currentPassword,
          newPassword: this.passwordData.newPassword,
        })
        .subscribe({
          next: () => {
            this.guardandoPassword = false;
            this.passwordData = { currentPassword: '', newPassword: '', confirmPassword: '' };
            this.mostrarSeccionPassword = false;
            this.cdr.detectChanges();
            this.mostrarToast('Contraseña actualizada correctamente.', 'success');
          },
          error: (err) => {
            this.guardandoPassword = false;
            this.cdr.detectChanges();
            console.error('Error al cambiar contraseña:', err);
            const msg =
              err.status === 400 || err.status === 403
                ? 'Verifica tu contraseña actual y que la nueva cumpla los requisitos.'
                : 'Error al cambiar la contraseña. Inténtalo más tarde.';
            this.mostrarToast(msg, 'danger');
          },
        })
    );
  }

  // ==================== PERMISOS Y PREFERENCIAS ====================
  async cargarAuditoriaPermisos() {
    this.verificandoPermisos = true;
    this.cdr.detectChanges();
    try {
      this.permisos = await this.permissionService.checkAllPermissions();
    } finally {
      this.verificandoPermisos = false;
      this.cdr.detectChanges();
    }
  }

  async solicitarPermiso(tipo: 'CAMARA' | 'GALERIA' | 'UBICACION' | 'NOTIFICACIONES') {
    await this.permissionService.solicitarPermiso(tipo);
    await this.cargarAuditoriaPermisos();
  }

  async actualizarPreferencia(clave: keyof AppPreferences, valor: any) {
    await this.preferencesService.setPreferences({ [clave]: valor });
    this.cdr.detectChanges();
    this.mostrarToast('Preferencia guardada.', 'success');
  }

  // ==================== GESTIÓN DE FINCAS ====================
  cargarFincasYCollares() {
    this.cargandoFincas = true;
    this.cdr.detectChanges();

    this.sub.add(
      this.farmService.getFincas().subscribe({
        next: (data) => {
          this.fincas = data || [];
          this.cargandoFincas = false;

          if (!this.fincaIdCollares) {
            const preferida = this.fincaActiva?.id || this.fincas[0]?.id || '';
            if (preferida) {
              this.fincaIdCollares = preferida;
              this.cargarCollares(preferida);
            }
          }
          this.cdr.detectChanges();
        },
        error: () => {
          this.cargandoFincas = false;
          if (this.fincaActiva && this.fincas.length === 0) {
            this.fincas = [this.fincaActiva];
          }
          this.cdr.detectChanges();
        },
      })
    );
  }

  abrirModalEdicionFinca(finca: Finca) {
    this.fincaEnEdicion = finca;
    this.datosEdicionFinca = {
      name: finca.name,
      companyName: finca.companyName || '',
      cuit: finca.cuit || '',
      numberRENAPSA: finca.numberRENAPSA || '',
      productiveOrientation: finca.productiveOrientation || 'MIXED',
      location: finca.location || '',
      surface: finca.surface,
    };
    this.modalEdicionFincaAbierto = true;
    this.cdr.detectChanges();
  }

  cerrarModalEdicionFinca() {
    this.modalEdicionFincaAbierto = false;
    this.fincaEnEdicion = null;
    this.datosEdicionFinca = {};
    this.cdr.detectChanges();
  }

  guardarDatosFinca() {
    if (!this.fincaEnEdicion || !this.datosEdicionFinca.name?.trim()) {
      this.mostrarToast('El nombre de la finca es obligatorio.', 'warning');
      return;
    }

    this.guardandoFinca = true;
    this.cdr.detectChanges();

    // Preservar el polígono existente de la finca en formato GeoJSON
    let polygonLimit = null;
    if (Array.isArray(this.fincaEnEdicion.polygon) && this.fincaEnEdicion.polygon.length >= 3) {
      const coords = this.fincaEnEdicion.polygon.map((p: any) => [p[1], p[0]]);
      const first = coords[0];
      const last = coords[coords.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        coords.push([first[0], first[1]]);
      }
      polygonLimit = { type: 'Polygon', coordinates: [coords] };
    }

    const payload = {
      name: this.datosEdicionFinca.name.trim(),
      companyName: this.datosEdicionFinca.companyName || '',
      cuit: this.datosEdicionFinca.cuit || '',
      numberRENAPSA: this.datosEdicionFinca.numberRENAPSA || '',
      productiveOrientation: this.datosEdicionFinca.productiveOrientation || 'MIXED',
      address: this.datosEdicionFinca.location || '',
      polygonLimit,
      surface: this.datosEdicionFinca.surface || this.fincaEnEdicion.surface || 1,
      imageUrl: this.fincaEnEdicion.imageUrl || '',
    };

    const id = this.fincaEnEdicion.id;
    const roleActual = this.fincaEnEdicion.myRole;

    this.sub.add(
      this.farmService.updateFarm(id, payload).subscribe({
        next: (actualizada) => {
          actualizada.myRole = roleActual;
          this.fincas = this.fincas.map((f) => (f.id === id ? actualizada : f));
          if (this.fincaActiva?.id === id) {
            this.contextService.setFarmContext(actualizada);
          }
          this.guardandoFinca = false;
          this.cerrarModalEdicionFinca();
          this.cdr.detectChanges();
          this.mostrarToast('Finca actualizada con éxito.', 'success');
        },
        error: (err) => {
          this.guardandoFinca = false;
          this.cdr.detectChanges();
          console.error('Error al actualizar finca:', err);
          this.mostrarToast('Error al guardar los cambios de la finca.', 'danger');
        },
      })
    );
  }

  abrirModalEliminarFinca(finca: Finca) {
    this.fincaAEliminar = finca;
    this.confirmacionCuitFinca = '';
    this.motivoEliminacionFinca = '';
    this.modalEliminarFincaAbierto = true;
    this.cdr.detectChanges();
  }

  cerrarModalEliminarFinca() {
    this.modalEliminarFincaAbierto = false;
    this.fincaAEliminar = null;
    this.confirmacionCuitFinca = '';
    this.motivoEliminacionFinca = '';
    this.cdr.detectChanges();
  }

  confirmarEliminacionFinca() {
    if (
      !this.fincaAEliminar ||
      this.confirmacionCuitFinca !== (this.fincaAEliminar.cuit || this.fincaAEliminar.name) ||
      !this.motivoEliminacionFinca.trim()
    ) {
      return;
    }

    const id = this.fincaAEliminar.id;
    this.eliminandoFinca = true;
    this.cdr.detectChanges();

    this.sub.add(
      this.farmService.deleteFarm(id, this.motivoEliminacionFinca.trim()).subscribe({
        next: () => {
          this.fincas = this.fincas.filter((f) => f.id !== id);
          if (this.fincaActiva?.id === id) {
            this.contextService.clearFarmContext();
          }
          this.eliminandoFinca = false;
          this.cerrarModalEliminarFinca();
          this.cdr.detectChanges();
          this.mostrarToast('Establecimiento eliminado.', 'success');
        },
        error: (err) => {
          this.eliminandoFinca = false;
          this.cdr.detectChanges();
          console.error('Error eliminando finca:', err);
          this.mostrarToast('No se pudo eliminar la finca.', 'danger');
        },
      })
    );
  }

  // ==================== GESTIÓN DE COLLARES IOT ====================
  cambiarFincaCollares(farmId: string) {
    this.fincaIdCollares = farmId;
    this.cargarCollares(farmId);
  }

  async cargarCollares(farmId: string) {
    if (!farmId) {
      this.collares = [];
      this.cdr.detectChanges();
      return;
    }

    // 1. Mostrar caché inmediatamente si existe
    const cached = await this.collarService.getCachedCollars(farmId);
    if (cached) {
      this.collares = cached;
      this.cargandoCollares = false;
      this.cdr.detectChanges();
    } else {
      this.cargandoCollares = true;
      this.cdr.detectChanges();
    }

    // 2. Actualizar Online-First desde el Backend
    this.sub.add(
      this.collarService.getCollarsByFarm(farmId).subscribe({
        next: (data) => {
          this.collares = data || [];
          this.cargandoCollares = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.cargandoCollares = false;
          this.cdr.detectChanges();
        },
      })
    );
  }

  abrirModalNuevoCollar() {
    this.esEdicionCollar = false;
    this.collarForm = {
      rfid: '',
      modelo: '',
      estado: 'Disponible',
      bateria: 100,
    };
    this.modalCollarAbierto = true;
    this.cdr.detectChanges();
  }

  abrirModalEditarCollar(collar: Collar) {
    this.esEdicionCollar = true;
    this.collarForm = {
      id: collar.id,
      rfid: collar.rfid,
      modelo: collar.modelo,
      estado: collar.estado,
      bateria: collar.bateria,
    };
    this.modalCollarAbierto = true;
    this.cdr.detectChanges();
  }

  cerrarModalCollar() {
    this.modalCollarAbierto = false;
    this.cdr.detectChanges();
  }

  guardarCollar() {
    if (!this.fincaIdCollares) {
      this.mostrarToast('Selecciona una finca primero.', 'warning');
      return;
    }
    if (!this.collarForm.rfid.trim()) {
      this.mostrarToast('El código RFID es obligatorio.', 'warning');
      return;
    }

    this.guardandoCollar = true;
    this.cdr.detectChanges();

    const peticion$ =
      this.esEdicionCollar && this.collarForm.id
        ? this.collarService.updateCollar(this.collarForm.id, this.fincaIdCollares, this.collarForm)
        : this.collarService.createCollar(this.fincaIdCollares, this.collarForm);

    this.sub.add(
      peticion$.subscribe({
        next: () => {
          this.guardandoCollar = false;
          this.cerrarModalCollar();
          this.cargarCollares(this.fincaIdCollares);
          this.cdr.detectChanges();
          this.mostrarToast(
            this.esEdicionCollar ? 'Collar actualizado.' : 'Collar registrado con éxito.',
            'success'
          );
        },
        error: (err) => {
          this.guardandoCollar = false;
          this.cdr.detectChanges();
          console.error('Error guardando collar:', err);
          const msg = err.error?.message || 'Error al guardar el dispositivo IoT.';
          this.mostrarToast(msg, 'danger');
        },
      })
    );
  }

  abrirModalEliminarCollar(collar: Collar) {
    this.collarAEliminar = collar;
    this.confirmacionRfidCollar = '';
    this.motivoEliminacionCollar = '';
    this.modalEliminarCollarAbierto = true;
    this.cdr.detectChanges();
  }

  cerrarModalEliminarCollar() {
    this.modalEliminarCollarAbierto = false;
    this.collarAEliminar = null;
    this.confirmacionRfidCollar = '';
    this.motivoEliminacionCollar = '';
    this.cdr.detectChanges();
  }

  confirmarEliminacionCollar() {
    if (
      !this.collarAEliminar ||
      !this.fincaIdCollares ||
      this.confirmacionRfidCollar !== this.collarAEliminar.rfid ||
      !this.motivoEliminacionCollar.trim()
    ) {
      return;
    }

    const id = this.collarAEliminar.id;
    this.eliminandoCollar = true;
    this.cdr.detectChanges();

    this.sub.add(
      this.collarService
        .deleteCollar(id, this.fincaIdCollares, this.motivoEliminacionCollar.trim())
        .subscribe({
          next: () => {
            this.collares = this.collares.filter((c) => c.id !== id);
            this.eliminandoCollar = false;
            this.cerrarModalEliminarCollar();
            this.cdr.detectChanges();
            this.mostrarToast('Collar dado de baja correctamente.', 'success');
          },
          error: (err) => {
            this.eliminandoCollar = false;
            this.cdr.detectChanges();
            console.error('Error dando de baja collar:', err);
            this.mostrarToast('No se pudo dar de baja el collar.', 'danger');
          },
        })
    );
  }

  // ==================== CIERRE DE SESIÓN SEGURO ====================
  async confirmarLogout() {
    const alert = await this.alertCtrl.create({
      header: 'Cerrar Sesión',
      message: '¿Estás seguro de que deseas salir de AgroTrack? Se limpiará el contexto activo.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Cerrar Sesión',
          role: 'destructive',
          handler: () => {
            this.contextService.clearFarmContext();
            this.authService.logout();
          },
        },
      ],
    });
    await alert.present();
  }

  private async mostrarToast(mensaje: string, color: string) {
    const toast = await this.toastCtrl.create({
      message: mensaje,
      duration: 2400,
      position: 'bottom',
      color,
    });
    await toast.present();
  }
}
