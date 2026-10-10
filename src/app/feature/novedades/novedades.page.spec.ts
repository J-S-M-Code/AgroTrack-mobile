import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NovedadesPage } from './novedades.page';

describe('NovedadesPage', () => {
  let component: NovedadesPage;
  let fixture: ComponentFixture<NovedadesPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(NovedadesPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
