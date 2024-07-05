use anchor_lang::prelude::*;
use anchor_spl::{associated_token::AssociatedToken, token::{self, Mint, Token, TokenAccount, Transfer, transfer}};
use solana_program::clock::Clock;
use crate::{constants::{TOKEN_SEED, STAKE_INFO_SEED, VAULT_SEED, StakeInfo}, error::*};

pub fn unstake(ctx: Context<UnStake>) -> Result<()> {

    // 先拿到stake信息
    let stake_info = &mut ctx.accounts.stake_info_account;

    if !stake_info.is_staked {
        return Err(StakingError::NotStaked.into())
    }

    let clock = Clock::get()?;
    let slots_passed = clock.slot - stake_info.stake_at_slot;

    let stake_amount = ctx.accounts.stake_account.amount;

    // reward计算
    let reward = (slots_passed as u64)
        .checked_mul(10u64.pow(ctx.accounts.mint.decimals as u32))
        .unwrap();

    let bump = ctx.bumps.token_vault_account;

    let signer: &[&[&[u8]]] = &[&[VAULT_SEED, &[bump]]];

    transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.token_vault_account.to_account_info(),
                to: ctx.accounts.user_token_account.to_account_info(),
                authority: ctx.accounts.token_vault_account.to_account_info(),
            },
            signer,
        ),
         reward,
    )?;

    let staker = ctx.accounts.signer.key();
    let bump = ctx.bumps.stake_account;
    let signer: &[&[&[u8]]] = &[&[TOKEN_SEED, staker.as_ref(), &[bump]]];

    transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.stake_account.to_account_info(),
                to: ctx.accounts.user_token_account.to_account_info(),
                authority: ctx.accounts.stake_account.to_account_info(),
            },
            signer,
        ),
         stake_amount,
    )?;

    // reset stakeInfo
    stake_info.is_staked = false;
    stake_info.stake_at_slot = clock.slot;

    Ok(())
}


#[derive(Accounts)]
pub struct UnStake<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    // stake生成token奖励的账户
    #[account(
        mut,
        seeds = [VAULT_SEED],
        bump,
    )]
    pub token_vault_account: Account<'info, TokenAccount>,


    // stake_info账户，存放stake的信息(不是Token账户，这里是自定义的)
    #[account(
        mut,
        seeds = [STAKE_INFO_SEED, signer.key.as_ref()],
        bump,
    )]
    pub stake_info_account: Account<'info, StakeInfo>,

    // user对应的stake账户
    #[account(
        mut,
        seeds = [TOKEN_SEED, signer.key.as_ref()],
        bump,
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
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}