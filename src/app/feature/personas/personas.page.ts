import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonMenuButton,
  IonContent,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonIcon,
  IonCard,
  IonCardContent,
  IonBadge,
  IonButton,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  IonModal,
  IonItem,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonToggle,
  IonFab,
  IonFabButton,
  AlertController,
  ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  peopleOutline,
  personAddOutline,
  addOutline,
  createOutline,
  trashOutline,
  callOutline,
  mailOutline,
  shieldCheckmarkOutline,
  checkmarkCircleOutline,
  alertCircleOutline,
  searchOutline,
  refreshOutline,
  closeOutline,
  businessOutline,
  personOutline,
  saveOutline,
} from 'ionicons/icons';
import { UserService } from '../../core/services/user.service';
import { ContextService } from '../../core/services/context.service';
import {
  Persona,
  UserRole,
  ROLES_OPTIONS,
  CreatePersonnelDto,
} from '../../core/models/person.model';
import { Finca } from '../../core/models/finca.model';

@Component({
  selector: 'app-personas',
  templateUrl: './personas.page.html',
  styleUrls: ['./personas.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonMenuButton,
    IonContent,
    IonSearchbar,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonIcon,
    IonCard,
    IonCardContent,
    IonBadge,
    IonButton,
    IonSpinner,
    IonRefresher,
    IonRefresherContent,
    IonModal,
    IonItem,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonToggle,
    IonFab,
    IonFabButton,
  ],
})
export class PersonasPage implements OnInit, OnDestroy {
  private userService = inject(UserService);
  public contextService = inject(ContextService);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);
  private cdr = inject(ChangeDetectorRef);

  fincaActiva: Finca | null = null;
  esOwner = false;
  esForemanOOwner = false;

  personas: Persona[] = [];
  cargando = true;
  filtroTexto = '';
  categoriaSeleccionada: 'TODOS' | 'OPERATIVO' | 'TECNICO' | 'GESTION' = 'TODOS';

  rolesDisponibles = ROLES_OPTIONS;

  // --- MODAL: ALTA DE MIEMBRO (DUAL) ---
  modalAltaAbierto = false;
  flujoAlta: 'asignar' | 'crear' = 'asignar';
  guardandoAlta = false;

  asignarForm = {
    email: '',
    role: 'WORKER' as UserRole,
  };

  crearForm: CreatePersonnelDto = {
    name: '',
    lastName: '',
    dni: '',
    phone: '',
    address: '',
    email: '',
    password: '',
    role: 'WORKER' as UserRole,
    sendEmail: false,
  };

  // --- MODAL: EDITAR ROL ---
  modalRolAbierto = false;
  personaEnEdicion: Persona | null = null;
  nuevoRol: UserRole = 'WORKER';
  guardandoRol = false;

  // --- MODAL: REVOCAR ACCESO ---
  modalRevocarAbierto = false;
  personaARevocar: Persona | null = null;
  nombreConfirmacion = '';
  revocando = false;

  private sub = new Subscription();

  constructor() {
    addIcons({
      peopleOutline,
      personAddOutline,
      addOutline,
      createOutline,
      trashOutline,
      callOutline,
      mailOutline,
      shieldCheckmarkOutline,
      checkmarkCircleOutline,
      alertCircleOutline,
      searchOutline,
      refreshOutline,
      closeOutline,
      businessOutline,
      personOutline,
      saveOutline,
    });
  }

  ngOnInit() {
    this.sub.add(
      this.contextService.selectedFarm$.subscribe((finca) => {
        this.fincaActiva = finca;
        this.esOwner = finca?.myRole === 'OWNER';
        this.esForemanOOwner = finca?.myRole === 'OWNER' || finca?.myRole === 'FOREMAN';

        if (finca?.id) {
          this.cargarPersonal(finca.id);
        } else {
          this.personas = [];
          this.cargando = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
  }

  get personasFiltradas(): Persona[] {
    let lista = this.personas;

    // Filtro por categoría de rol
    if (this.categoriaSeleccionada !== 'TODOS') {
      lista = lista.filter((p) => p.categoriaRol === this.categoriaSeleccionada);
    }

    // Filtro por texto de búsqueda
    const q = this.filtroTexto.trim().toLowerCase();
    if (q) {
      lista = lista.filter(
        (p) =>
          p.nombre.toLowerCase().includes(q) ||
          p.email.toLowerCase().includes(q) ||
          p.rolLabel.toLowerCase().includes(q) ||
          (p.telefono && p.telefono.includes(q))
      );
    }

    return lista;
  }

  obtenerIniciales(nombre: string): string {
    if (!nombre) return 'P';
    const partes = nombre.trim().split(' ');
    if (partes.length >= 2) {
      return `${partes[0].charAt(0).toUpperCase()}${partes[1].charAt(0).toUpperCase()}`;
    }
    return nombre.charAt(0).toUpperCase();
  }

  async cargarPersonal(farmId: string, event?: any) {
    // 1. Mostrar caché local de inmediato si existe
    if (!event) {
      const cached = await this.userService.getCachedPersonnel(farmId);
      if (cached && cached.length > 0) {
        this.personas = cached;
        this.cargando = false;
        this.cdr.detectChanges();
      } else {
        this.cargando = true;
        this.cdr.detectChanges();
      }
    }

    // 2. Consulta Online-First al Backend
    this.sub.add(
      this.userService.getPersonnelByFarm(farmId).subscribe({
        next: (res) => {
          this.personas = res || [];
          this.cargando = false;
          this.cdr.detectChanges();
          if (event) event.target.complete();
        },
        error: (err) => {
          this.cargando = false;
          this.cdr.detectChanges();
          if (event) event.target.complete();
          console.warn('Error cargando personal, usando caché si existe:', err);
        },
      })
    );
  }

  // ==================== MODAL ALTA DE MIEMBRO ====================
  abrirModalAlta() {
    this.flujoAlta = 'asignar';
    this.asignarForm = { email: '', role: 'WORKER' };
    this.crearForm = {
      name: '',
      lastName: '',
      dni: '',
      phone: '',
      address: '',
      email: '',
      password: '',
      role: 'WORKER',
      sendEmail: false,
    };
    this.modalAltaAbierto = true;
    this.cdr.detectChanges();
  }

  cerrarModalAlta() {
    this.modalAltaAbierto = false;
    this.guardandoAlta = false;
    this.cdr.detectChanges();
  }

  setFlujoAlta(nuevoFlujo: any) {
    if (nuevoFlujo === 'asignar' || nuevoFlujo === 'crear') {
      this.flujoAlta = nuevoFlujo;
      this.cdr.detectChanges();
    }
  }

  enviarAlta() {
    if (!this.fincaActiva?.id) {
      this.mostrarToast('No hay una finca seleccionada.', 'warning');
      return;
    }

    if (this.flujoAlta === 'asignar') {
      this.ejecutarAsignacionExistente();
    } else {
      this.ejecutarCreacionNueva();
    }
  }

  private ejecutarAsignacionExistente() {
    if (!this.asignarForm.email.trim()) {
      this.mostrarToast('Ingresa el correo electrónico del usuario.', 'warning');
      return;
    }

    this.guardandoAlta = true;
    this.cdr.detectChanges();

    const dto = {
      email: this.asignarForm.email.trim(),
      role: this.asignarForm.role,
      farmIds: [this.fincaActiva!.id],
    };

    this.sub.add(
      this.userService.assignUserToFarm(dto).subscribe({
        next: () => {
          this.guardandoAlta = false;
          this.cerrarModalAlta();
          this.cargarPersonal(this.fincaActiva!.id);
          this.cdr.detectChanges();
          this.mostrarToast('Usuario asignado exitosamente a la finca.', 'success');
        },
        error: (err) => {
          this.guardandoAlta = false;
          this.cdr.detectChanges();
          console.error('Error al asignar usuario:', err);
          const msg =
            err.status === 404
              ? 'Usuario no encontrado. Verifica que esté registrado en AgroTrack.'
              : 'Error al asignar usuario. Revisa los datos ingresados.';
          this.mostrarToast(msg, 'danger');
        },
      })
    );
  }

  private ejecutarCreacionNueva() {
    const f = this.crearForm;
    if (!f.name.trim() || !f.lastName.trim() || !f.dni.trim() || !f.email.trim()) {
      this.mostrarToast('Completa los campos obligatorios (*).', 'warning');
      return;
    }

    this.guardandoAlta = true;
    this.cdr.detectChanges();

    this.sub.add(
      this.userService.inviteUserToFarm(this.fincaActiva!.id, f).subscribe({
        next: () => {
          this.guardandoAlta = false;
          this.cerrarModalAlta();
          this.cargarPersonal(this.fincaActiva!.id);
          this.cdr.detectChanges();
          this.mostrarToast('Colaborador creado e incorporado a la finca.', 'success');
        },
        error: (err) => {
          this.guardandoAlta = false;
          this.cdr.detectChanges();
          console.error('Error al invitar usuario:', err);
          const msg =
            err.status === 409
              ? 'El correo ya se encuentra registrado en el sistema.'
              : err.error?.message || 'Error al dar de alta el colaborador.';
          this.mostrarToast(msg, 'danger');
        },
      })
    );
  }

  // ==================== MODAL CAMBIO DE ROL ====================
  abrirModalEditarRol(persona: Persona) {
    this.personaEnEdicion = persona;
    this.nuevoRol = persona.rol;
    this.modalRolAbierto = true;
    this.cdr.detectChanges();
  }

  cerrarModalEditarRol() {
    this.modalRolAbierto = false;
    this.personaEnEdicion = null;
    this.guardandoRol = false;
    this.cdr.detectChanges();
  }

  guardarCambioRol() {
    if (!this.personaEnEdicion || !this.fincaActiva?.id) return;

    this.guardandoRol = true;
    this.cdr.detectChanges();

    this.sub.add(
      this.userService
        .updateUserAssignment(this.personaEnEdicion.id, this.nuevoRol, [
          this.fincaActiva.id,
        ])
        .subscribe({
          next: () => {
            this.guardandoRol = false;
            this.cerrarModalEditarRol();
            this.cargarPersonal(this.fincaActiva!.id);
            this.cdr.detectChanges();
            this.mostrarToast('Rol actualizado correctamente.', 'success');
          },
          error: (err) => {
            this.guardandoRol = false;
            this.cdr.detectChanges();
            console.error('Error actualizando rol:', err);
            this.mostrarToast('No se pudo actualizar el rol.', 'danger');
          },
        })
    );
  }

  // ==================== MODAL REVOCAR ACCESO ====================
  abrirModalRevocar(persona: Persona) {
    this.personaARevocar = persona;
    this.nombreConfirmacion = '';
    this.modalRevocarAbierto = true;
    this.cdr.detectChanges();
  }

  cerrarModalRevocar() {
    this.modalRevocarAbierto = false;
    this.personaARevocar = null;
    this.nombreConfirmacion = '';
    this.revocando = false;
    this.cdr.detectChanges();
  }

  confirmarRevocacion() {
    if (
      !this.personaARevocar ||
      !this.fincaActiva?.id ||
      this.nombreConfirmacion.trim() !== this.personaARevocar.nombre.trim()
    ) {
      return;
    }

    this.revocando = true;
    this.cdr.detectChanges();

    this.sub.add(
      this.userService
        .removeUserFromFarm(this.fincaActiva.id, this.personaARevocar.id)
        .subscribe({
          next: () => {
            this.revocando = false;
            this.cerrarModalRevocar();
            this.cargarPersonal(this.fincaActiva!.id);
            this.cdr.detectChanges();
            this.mostrarToast('Acceso revocado exitosamente.', 'success');
          },
          error: (err) => {
            this.revocando = false;
            this.cdr.detectChanges();
            console.error('Error revocando acceso:', err);
            this.mostrarToast('No se pudo revocar el acceso.', 'danger');
          },
        })
    );
  }

  private async mostrarToast(mensaje: string, color: string) {
    const toast = await this.toastCtrl.create({
      message: mensaje,
      duration: 2500,
      position: 'bottom',
      color,
    });
    await toast.present();
  }
}
