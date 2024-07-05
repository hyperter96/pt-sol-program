use crate::constants::VAULT_SEED;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

pub fn initialize_staking(ctx: Context<InitializeStaking>) -> Result<()> {
    Ok(())
}

#[derive(Accounts)]
pub struct InitializeStaking<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    // stake生成token奖励的账户
    #[account(
        init_if_needed,
        seeds = [VAULT_SEED],
        bump,
        payer = signer,
        token::mint = mint,
        token::authority = token_vault_account,
    )]
    pub token_vault_account: Account<'info, TokenAccount>,

    pub mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}