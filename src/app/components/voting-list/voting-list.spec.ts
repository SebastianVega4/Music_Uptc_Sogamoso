import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VotingList } from './voting-list';

describe('VotingList', () => {
  let component: VotingList;
  let fixture: ComponentFixture<VotingList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VotingList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VotingList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
