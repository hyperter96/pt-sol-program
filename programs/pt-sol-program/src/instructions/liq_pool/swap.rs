//! Instruction: SwapDia
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};

use crate::error::*;
use crate::state::*;

pub fn swap(ctx: Context<Swap>, amount_to_swap: u64) -> Result<()> {
    // Make sure the amount is not zero
    if amount_to_swap == 0 {
        return Err(SwapProgramError::InvalidSwapZeroAmount.into());
    }

    let pool = &mut ctx.accounts.pool;

    // Receive: 接收swap
    // (Mint, From, To)
    let receive = (
        ctx.accounts.receive_mint.as_ref(),
        ctx.accounts.pool_receive_token_account.as_ref(),
        ctx.accounts.payer_receive_token_account.as_ref(),
    );

    // Pay: 发送swap，内附数额
    // (Mint, From, To, Amount)
    let pay = (
        ctx.accounts.pay_mint.as_ref(),
        ctx.accounts.payer_pay_token_account.as_ref(),
        ctx.accounts.pool_pay_token_account.as_ref(),
        amount_to_swap,
    );

    pool.process_swap(
        receive,
        pay,
        &ctx.accounts.payer,
        &ctx.accounts.token_program,
    )?;

    Ok(())
}

#[derive(Accounts)]
pub struct Swap<'info> {
    /// LP池子的账户
    #[account(
        mut,
        seeds = [LiquidityPool::SEED_PREFIX.as_bytes()],
        bump = pool.bump,
    )]
    pub pool: Account<'info, LiquidityPool>,

    /// 用于接收swap的铸币账户
    #[account(
        constraint = !receive_mint.key().eq(&pay_mint.key()) @ SwapProgramError::InvalidSwapMatchingAssets
    )]
    pub receive_mint: Box<Account<'info, Mint>>,

    /// 用于pool接收swap的Token账户
    #[account(
        mut,
        associated_token::mint = receive_mint,
        associated_token::authority = pool,
    )]
    pub pool_receive_token_account: Box<Account<'info, TokenAccount>>,

    /// 用于payer接收swap的Token用户
    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = receive_mint,
        associated_token::authority = payer,
    )]
    pub payer_receive_token_account: Box<Account<'info, TokenAccount>>,

    /// 用于发送swap的铸币用户
    pub pay_mint: Box<Account<'info, Mint>>,

    /// 用于pool发送swap的Token账户
    #[account(
        mut,
        associated_token::mint = pay_mint,
        associated_token::authority = pool,
    )]
    pub pool_pay_token_account: Box<Account<'info, TokenAccount>>,

    /// 用于payer发送swap的Token账户
    #[account(
        mut,
        associated_token::mint = pay_mint,
        associated_token::authority = payer,
    )]
    pub payer_pay_token_account: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub payer: Signer<'info>,
    /// Token Program: Required for transferring the assets between all token
    /// accounts involved in the swap
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}
