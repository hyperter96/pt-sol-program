// 1. Import dependencies
use anchor_lang::prelude::*;

// 2. Declare Program ID (SolPG will automatically update this when you deploy)
pub mod error;
pub mod instructions;
pub mod state;
pub mod constants;
use instructions::*;


declare_id!("8hhtjU7SSNWRwoTsj4t6CRvGrpcBRDoq6Vp4oggZBgm2");

// 3. Define the program and instructions
#[program]
pub mod pt_sol_program {
    use super::*;
    pub fn init_token(ctx: Context<InitToken>, metadata: InitTokenParams) -> Result<()> {
        tokens::init_token(ctx, metadata)
    }

    pub fn mint_tokens(ctx: Context<MintTokens>, quantity: u64) -> Result<()> {
        // TODO Add mint tokens logic
        tokens::mint_tokens(ctx, quantity)
    }

    /// Initialize the program by creating the liquidity pool
    pub fn create_pool(ctx: Context<CreatePool>) -> Result<()> {
        liq_pool::create_pool(ctx)
    }

    /// Provide liquidity to the pool by funding it with some asset
    pub fn fund_pool(ctx: Context<FundPool>, amount: u64) -> Result<()> {
        liq_pool::fund_pool(ctx, amount)
    }

    /// Swap交易
    pub fn swap(ctx: Context<Swap>, amount_to_swap: u64) -> Result<()> {
        liq_pool::swap(ctx, amount_to_swap)
    }

    pub fn initialize_staking(ctx: Context<InitializeStaking>) -> Result<()> {
        staking::initialize_staking(ctx)
    }

    /// stake
    pub fn stake(ctx: Context<Stake>, amount: u64) -> Result<()> {
        staking::stake(ctx, amount)
    }

    /// unstake
    pub fn unstake(ctx: Context<UnStake>) -> Result<()> {
        staking::unstake(ctx)
    }
}

