export interface MCTSNode {
  id: string;
  state: string;
  action: string | null;
  parent: MCTSNode | null;
  children: MCTSNode[];
  visits: number;
  wins: number;
  untriedActions: string[];
  depth: number;
}

export interface MCTSConfig {
  maxIterations: number;
  explorationConstant: number;
  maxDepth: number;
  simulationLimit: number;
}

export interface MCTSResult {
  bestAction: string;
  confidence: number;
  treeSize: number;
  iterations: number;
  simulationResults: { action: string; score: number }[];
}

export type StateEvaluator = (state: string) => number;
export type ActionGenerator = (state: string) => string[];
export type ActionApplier = (state: string, action: string) => string;

export class MCTSPlanner {
  private config: MCTSConfig;
  private root: MCTSNode;
  private evaluator: StateEvaluator;
  private actionGenerator: ActionGenerator;
  private actionApplier: ActionApplier;

  constructor(
    initialState: string,
    evaluator: StateEvaluator,
    actionGenerator: ActionGenerator,
    actionApplier: ActionApplier,
    config: Partial<MCTSConfig> = {},
  ) {
    this.config = {
      maxIterations: config.maxIterations || 100,
      explorationConstant: config.explorationConstant || Math.SQRT2,
      maxDepth: config.maxDepth || 10,
      simulationLimit: config.simulationLimit || 20,
    };
    this.evaluator = evaluator;
    this.actionGenerator = actionGenerator;
    this.actionApplier = actionApplier;
    this.root = this.createNode(initialState, null, null, null);
  }

  private createNode(state: string, action: string | null, parent: MCTSNode | null, untriedActions: string[] | null): MCTSNode {
    return {
      id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      state,
      action,
      parent,
      children: [],
      visits: 0,
      wins: 0,
      untriedActions: untriedActions || this.actionGenerator(state),
      depth: parent ? parent.depth + 1 : 0,
    };
  }

  private ucb1(node: MCTSNode): number {
    if (node.visits === 0) return Infinity;
    const exploitation = node.wins / node.visits;
    const exploration = this.config.explorationConstant * Math.sqrt(Math.log(node.parent!.visits) / node.visits);
    return exploitation + exploration;
  }

  private select(node: MCTSNode): MCTSNode {
    let current = node;
    while (current.untriedActions.length === 0 && current.children.length > 0) {
      current = current.children.reduce((best, child) =>
        this.ucb1(child) > this.ucb1(best) ? child : best
      );
    }
    return current;
  }

  private expand(node: MCTSNode): MCTSNode {
    if (node.untriedActions.length === 0) return node;
    const action = node.untriedActions.pop()!;
    const newState = this.actionApplier(node.state, action);
    const child = this.createNode(newState, action, node, []);
    node.children.push(child);
    return child;
  }

  private simulate(state: string): number {
    let current = state;
    for (let i = 0; i < this.config.simulationLimit; i++) {
      const actions = this.actionGenerator(current);
      if (actions.length === 0) break;
      const action = actions[Math.floor(Math.random() * actions.length)];
      current = this.actionApplier(current, action);
    }
    return this.evaluator(current);
  }

  private backpropagate(node: MCTSNode, result: number): void {
    let current: MCTSNode | null = node;
    while (current) {
      current.visits++;
      current.wins += result;
      current = current.parent;
    }
  }

  run(): MCTSResult {
    for (let i = 0; i < this.config.maxIterations; i++) {
      let node = this.select(this.root);
      if (node.untriedActions.length > 0 && node.depth < this.config.maxDepth) {
        node = this.expand(node);
      }
      const result = this.simulate(node.state);
      this.backpropagate(node, result);
    }

    const bestChild = this.root.children.length > 0
      ? this.root.children.reduce((best, child) => child.visits > best.visits ? child : best)
      : null;

    const simulationResults = this.root.children.map(child => ({
      action: child.action || '',
      score: child.visits > 0 ? child.wins / child.visits : 0,
    }));

    return {
      bestAction: bestChild?.action || '',
      confidence: bestChild ? bestChild.wins / bestChild.visits : 0,
      treeSize: this.countNodes(this.root),
      iterations: this.config.maxIterations,
      simulationResults,
    };
  }

  private countNodes(node: MCTSNode): number {
    return 1 + node.children.reduce((sum, child) => sum + this.countNodes(child), 0);
  }

  getRoot(): MCTSNode { return this.root; }
  getConfig(): MCTSConfig { return { ...this.config }; }
}
