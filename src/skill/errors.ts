/**
 * Custom error types for better error handling
 */

/**
 * Thrown when no wallet is found
 */
export class NoWalletError extends Error {
  code = 'NO_WALLET'

  constructor() {
    super('No wallet found. Create a wallet first.')
    this.name = 'NoWalletError'
  }
}

/**
 * Thrown when wallet password is incorrect
 */
export class InvalidPasswordError extends Error {
  code = 'INVALID_PASSWORD'

  constructor() {
    super('Invalid wallet password.')
    this.name = 'InvalidPasswordError'
  }
}

/**
 * Thrown when a wallet already exists
 */
export class WalletExistsError extends Error {
  code = 'WALLET_EXISTS'

  constructor() {
    super('Wallet already exists. Delete it first if you want to create a new one.')
    this.name = 'WalletExistsError'
  }
}

/**
 * Thrown when password is too weak
 */
export class WeakPasswordError extends Error {
  code = 'WEAK_PASSWORD'

  constructor(minLength: number = 8) {
    super(`Password must be at least ${minLength} characters.`)
    this.name = 'WeakPasswordError'
  }
}

/**
 * Thrown when insufficient balance for transaction
 */
export class InsufficientBalanceError extends Error {
  code = 'INSUFFICIENT_BALANCE'
  required: number
  available: number

  constructor(required: number, available: number) {
    super(`Insufficient balance. Required: ${required} SOL, Available: ${available} SOL`)
    this.name = 'InsufficientBalanceError'
    this.required = required
    this.available = available
  }
}
