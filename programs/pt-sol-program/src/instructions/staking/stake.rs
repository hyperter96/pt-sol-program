use anchor_lang::prelude::*;
use anchor_spl::{associated_token::AssociatedToken, token::{self, Mint, Token, TokenAccount, Transfer, transfer}};
use solana_program::clock::Clock;
use crate::{constants::{TOKEN_SEED, STAKE_INFO_SEED, StakeInfo}, error::*};

pub fn stake(ctx: Context<Stake>, amount: u64) -> Result<()> {

    // 先拿到stake信息
    let stake_info = &mut ctx.accounts.stake_info_account;

    if stake_info.is_staked {
        return Err(StakingError::IsStaked.into())
    }

    if amount <= 0 {
        return Err(StakingError::NoTokens.into())
    }

    let clock = Clock::get()?;

    stake_info.stake_at_slot = clock.slot;
    stake_info.is_staked = true;

    // stake计算
    let stake_amount = (amount)
        .checked_mul(10u64.pow(ctx.accounts.mint.decimals as u32))
        .unwrap();

    // user的token账户 => stake账户
    transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_token_account.to_account_info(),
                to: ctx.accounts.stake_account.to_account_info(),
                authority: ctx.accounts.signer.to_account_info(),
            }
        ),
        stake_amount,
    )?;

    Ok(())
}

#[derive(Accounts)]
pub struct Stake<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    // stake_info账户，存放stake的信息(不是Token账户，这里是自定义的)
    #[account(
        init_if_needed,
        seeds = [STAKE_INFO_SEED, signer.key.as_ref()],
        bump,
        payer = signer,
        space = 8 + std::mem::size_of::<StakeInfo>(),
    )]
    pub stake_info_account: Account<'info, StakeInfo>,

    // user对应的stake账户
    #[account(
        init_if_needed,
        seeds = [TOKEN_SEED, signer.key.as_ref()],
        bump,
        payer = signer,
        token::mint = mint,
        token::authority = stake_account,
    )]
    pub stake_account: Account<'info, TokenAccount>,

    // user的token账户
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = signer,
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    pub mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub assoicated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}