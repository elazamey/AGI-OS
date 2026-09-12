import { describe, it, expect, beforeEach } from 'vitest';
import {
  MissionStateMachine,
  TaskStateMachine,
  isValidMissionTransition,
  isValidTaskTransition,
  isMissionTerminal,
  isMissionActive,
  isMissionExecutable,
  isTaskTerminal,
  isTaskActive,
  isTaskExecutable
} from '../src/state-machine.js';
import { InvalidTransitionError } from '../src/types.js';

describe('State Machine', () => {
  describe('MissionStateMachine', () => {
    let sm: MissionStateMachine;

    beforeEach(() => {
      sm = new MissionStateMachine('created');
    });

    it('should initialize with created state', () => {
      expect(sm.getState()).toBe('created');
    });

    it('should transition from created to planning', () => {
      sm.transition('planning');
      expect(sm.getState()).toBe('planning');
    });

    it('should transition through full lifecycle', () => {
      sm.transition('planning');
      sm.transition('ready');
      sm.transition('running');
      sm.transition('verifying');
      sm.transition('completed');
      expect(sm.getState()).toBe('completed');
    });

    it('should reject invalid transitions', () => {
      expect(() => sm.transition('completed')).toThrow(InvalidTransitionError);
      expect(() => sm.transition('running')).toThrow(InvalidTransitionError);
    });

    it('should try transition and return boolean', () => {
      expect(sm.tryTransition('planning')).toBe(true);
      expect(sm.tryTransition('completed')).toBe(false);
    });

    it('should get allowed transitions', () => {
      expect(sm.getAllowedTransitions()).toEqual(['planning', 'cancelled']);
    });

    it('should check if terminal', () => {
      expect(sm.isTerminal()).toBe(false);
      sm.transition('planning');
      expect(sm.isTerminal()).toBe(false);
      sm.transition('ready');
      sm.transition('running');
      sm.transition('verifying');
      sm.transition('completed');
      expect(sm.isTerminal()).toBe(true);
    });

    it('should check if active', () => {
      expect(sm.isActive()).toBe(true);
      sm.transition('planning');
      expect(sm.isActive()).toBe(true);
      sm.transition('ready');
      sm.transition('running');
      sm.transition('failed');
      expect(sm.isActive()).toBe(false);
    });

    it('should check if executable', () => {
      expect(sm.isExecutable()).toBe(false);
      sm.transition('planning');
      sm.transition('ready');
      sm.transition('running');
      expect(sm.isExecutable()).toBe(true);
    });

    it('should track history', () => {
      sm.transition('planning');
      sm.transition('ready');
      const history = sm.getHistory();
      expect(history).toHaveLength(2);
      expect(history[0].from).toBe('created');
      expect(history[0].to).toBe('planning');
      expect(history[1].from).toBe('planning');
      expect(history[1].to).toBe('ready');
    });

    it('should reset state', () => {
      sm.transition('planning');
      sm.transition('ready');
      sm.transition('running');
      sm.transition('failed');
      sm.reset();
      expect(sm.getState()).toBe('created');
    });

    it('should handle cancellation', () => {
      sm.transition('planning');
      sm.transition('ready');
      sm.transition('cancelled');
      expect(sm.getState()).toBe('cancelled');
      expect(sm.isTerminal()).toBe(true);
    });
  });

  describe('TaskStateMachine', () => {
    let sm: TaskStateMachine;

    beforeEach(() => {
      sm = new TaskStateMachine('pending');
    });

    it('should initialize with pending state', () => {
      expect(sm.getState()).toBe('pending');
    });

    it('should transition from pending to ready', () => {
      sm.transition('ready');
      expect(sm.getState()).toBe('ready');
    });

    it('should transition through full lifecycle', () => {
      sm.transition('ready');
      sm.transition('running');
      sm.transition('completed');
      expect(sm.getState()).toBe('completed');
    });

    it('should reject invalid transitions', () => {
      expect(() => sm.transition('completed')).toThrow(InvalidTransitionError);
      expect(() => sm.transition('running')).toThrow(InvalidTransitionError);
    });

    it('should try transition and return boolean', () => {
      expect(sm.tryTransition('ready')).toBe(true);
      expect(sm.tryTransition('completed')).toBe(false);
    });

    it('should get allowed transitions', () => {
      expect(sm.getAllowedTransitions()).toEqual(['ready', 'cancelled']);
    });

    it('should check if terminal', () => {
      expect(sm.isTerminal()).toBe(false);
      sm.transition('ready');
      sm.transition('running');
      sm.transition('completed');
      expect(sm.isTerminal()).toBe(true);
    });

    it('should check if active', () => {
      expect(sm.isActive()).toBe(true);
      sm.transition('ready');
      sm.transition('running');
      expect(sm.isActive()).toBe(true);
      sm.transition('failed');
      expect(sm.isActive()).toBe(false);
    });

    it('should check if executable', () => {
      expect(sm.isExecutable()).toBe(false);
      sm.transition('ready');
      expect(sm.isExecutable()).toBe(true);
    });

    it('should check if needs retry', () => {
      expect(sm.needsRetry()).toBe(false);
      sm.transition('ready');
      sm.transition('running');
      sm.transition('failed');
      expect(sm.needsRetry()).toBe(true);
    });

    it('should track history', () => {
      sm.transition('ready');
      sm.transition('running');
      const history = sm.getHistory();
      expect(history).toHaveLength(2);
      expect(history[0].from).toBe('pending');
      expect(history[0].to).toBe('ready');
      expect(history[1].from).toBe('ready');
      expect(history[1].to).toBe('running');
    });

    it('should reset state', () => {
      sm.transition('ready');
      sm.transition('running');
      sm.transition('failed');
      sm.reset();
      expect(sm.getState()).toBe('pending');
    });

    it('should handle retrying state', () => {
      sm.transition('ready');
      sm.transition('running');
      sm.transition('failed');
      sm.transition('retrying');
      expect(sm.getState()).toBe('retrying');
      sm.transition('pending');
      expect(sm.getState()).toBe('pending');
    });
  });

  describe('Helper Functions', () => {
    it('isValidMissionTransition', () => {
      expect(isValidMissionTransition('created', 'planning')).toBe(true);
      expect(isValidMissionTransition('created', 'completed')).toBe(false);
      expect(isValidMissionTransition('running', 'completed')).toBe(false);
    });

    it('isValidTaskTransition', () => {
      expect(isValidTaskTransition('pending', 'ready')).toBe(true);
      expect(isValidTaskTransition('pending', 'completed')).toBe(false);
      expect(isValidTaskTransition('running', 'completed')).toBe(true);
    });

    it('isMissionTerminal', () => {
      expect(isMissionTerminal('completed')).toBe(true);
      expect(isMissionTerminal('cancelled')).toBe(true);
      expect(isMissionTerminal('running')).toBe(false);
    });

    it('isMissionActive', () => {
      expect(isMissionActive('running')).toBe(true);
      expect(isMissionActive('completed')).toBe(false);
      expect(isMissionActive('failed')).toBe(false);
    });

    it('isMissionExecutable', () => {
      expect(isMissionExecutable('running')).toBe(true);
      expect(isMissionExecutable('waiting')).toBe(true);
      expect(isMissionExecutable('blocked')).toBe(true);
      expect(isMissionExecutable('created')).toBe(false);
    });

    it('isTaskTerminal', () => {
      expect(isTaskTerminal('completed')).toBe(true);
      expect(isTaskTerminal('cancelled')).toBe(true);
      expect(isTaskTerminal('running')).toBe(false);
    });

    it('isTaskActive', () => {
      expect(isTaskActive('running')).toBe(true);
      expect(isTaskActive('completed')).toBe(false);
      expect(isTaskActive('failed')).toBe(false);
    });

    it('isTaskExecutable', () => {
      expect(isTaskExecutable('ready')).toBe(true);
      expect(isTaskExecutable('running')).toBe(true);
      expect(isTaskExecutable('pending')).toBe(false);
    });
  });
});
