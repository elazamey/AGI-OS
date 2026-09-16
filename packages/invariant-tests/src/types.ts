export interface InvariantCheck {
  id: string;
  passed: boolean;
}

export interface StateMachineTransition {
  from: string;
  to: string;
  allowed: boolean;
}

export interface ImpossibleState {
  mission: string;
  task: string;
  reason: string;
}

export interface EventOrder {
  id: string;
  timestamp: number;
  type: string;
}

export interface PermissionMatrix {
  actor: string;
  resource: string;
  action: string;
  allowed: boolean;
}

export interface MutationTest {
  testId: string;
  passed: boolean;
}
