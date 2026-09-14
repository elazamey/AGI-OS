import * as fs from 'fs';
import * as path from 'path';

export interface Transaction {
  id: string;
  timestamp: number;
  files_modified: string[];
  files_created: string[];
  backups: Map<string, string>;
  status: 'pending' | 'committed' | 'rolled_back';
}

export interface HealingResult {
  success: boolean;
  attempts: number;
  final_error?: string;
  transaction_id: string;
}

export class RollbackLedger {
  private transactions: Map<string, Transaction> = new Map();
  private maxRetries: number;

  constructor(maxRetries: number = parseInt(process.env.MAX_SELF_HEALING_RETRIES || '3')) {
    this.maxRetries = maxRetries;
  }

  createTransaction(id: string): Transaction {
    const transaction: Transaction = {
      id,
      timestamp: Date.now(),
      files_modified: [],
      files_created: [],
      backups: new Map(),
      status: 'pending',
    };
    this.transactions.set(id, transaction);
    return transaction;
  }

  async preExecutionBackup(transaction: Transaction, filePath: string): Promise<void> {
    if (fs.existsSync(filePath)) {
      const backupPath = `${filePath}.bak`;
      fs.copyFileSync(filePath, backupPath);
      transaction.backups.set(filePath, backupPath);
      transaction.files_modified.push(filePath);
    } else {
      transaction.files_created.push(filePath);
    }
  }

  async commitTransaction(transactionId: string): Promise<void> {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) throw new Error(`Transaction ${transactionId} not found`);

    for (const [, backupPath] of transaction.backups) {
      if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath);
      }
    }

    transaction.status = 'committed';
  }

  async rollbackTransaction(transactionId: string): Promise<void> {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) throw new Error(`Transaction ${transactionId} not found`);

    for (const [originalPath, backupPath] of transaction.backups) {
      if (fs.existsSync(backupPath)) {
        fs.copyFileSync(backupPath, originalPath);
        fs.unlinkSync(backupPath);
      }
    }

    for (const filePath of transaction.files_created) {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    transaction.status = 'rolled_back';
  }

  async executeWithRollback<T>(
    operation: () => Promise<T>,
    filesToModify: string[]
  ): Promise<{ success: boolean; result?: T; error?: string }> {
    const transactionId = `txn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const transaction = this.createTransaction(transactionId);

    for (const file of filesToModify) {
      await this.preExecutionBackup(transaction, file);
    }

    try {
      const result = await operation();
      await this.commitTransaction(transactionId);
      return { success: true, result };
    } catch (error) {
      await this.rollbackTransaction(transactionId);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async selfHeal<T>(
    operation: () => Promise<T>,
    testCommand: string,
    filesToModify: string[]
  ): Promise<HealingResult & { result?: T }> {
    let lastError = '';
    let result: T | undefined;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      const transactionId = `heal-${Date.now()}-${attempt}`;
      const transaction = this.createTransaction(transactionId);

      for (const file of filesToModify) {
        await this.preExecutionBackup(transaction, file);
      }

      try {
        result = await operation();

        const { spawn } = await import('child_process');
        const testProc = spawn(testCommand.split(' ')[0], testCommand.split(' ').slice(1), {
          shell: false,
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        const testResult = await new Promise<boolean>((resolve) => {
          const timer = setTimeout(() => {
            testProc.kill();
            resolve(false);
          }, 30000);

          testProc.on('close', (code) => {
            clearTimeout(timer);
            resolve(code === 0);
          });

          testProc.on('error', () => {
            clearTimeout(timer);
            resolve(false);
          });
        });

        if (testResult) {
          await this.commitTransaction(transactionId);
          return {
            success: true,
            attempts: attempt,
            transaction_id: transactionId,
            result,
          };
        }

        lastError = `Test failed on attempt ${attempt}`;
        await this.rollbackTransaction(transactionId);
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        await this.rollbackTransaction(transactionId);
      }
    }

    return {
      success: false,
      attempts: this.maxRetries,
      final_error: lastError,
      transaction_id: '',
    };
  }

  getTransaction(id: string): Transaction | undefined {
    return this.transactions.get(id);
  }

  getAllTransactions(): Transaction[] {
    return Array.from(this.transactions.values());
  }
}
