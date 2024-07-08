use crate::{
    constants::{STAKE_INFO_SEED, THREAD_AUTHORITY_SEED, TOKEN_SEED},
    error::*,
    state::*,
    ID,
};
use anchor_lang::{prelude::*, InstructionData};
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, transfer, Mint, Token, TokenAccount, Transfer},
};
use clockwork_sdk::{
    state::{Thread, Trigger},
    ThreadProgram,
};
use solana_program::{clock::Clock, instruction::Instruction, native_token::LAMPORTS_PER_SOL};

pub fn stake(ctx: Context<Stake>, amount: u64, thread_id: Vec<u8>) -> Result<()> {
    // 先拿到stake信息
    let stake_info = &mut ctx.accounts.stake_info_account;
    // let thread_id = StakeInfo::get_thread_id(stake_info.key());
    if stake_info.is_staked {
        return Err(StakingError::IsStaked.into());
    }

    if amount <= 0 {
        return Err(StakingError::NoTokens.into());
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
            },
        ),
        stake_amount,
    )?;

    schedule_auto_fund_pool(ctx, amount, thread_id)?;

    Ok(())
}

fn schedule_auto_fund_pool(ctx: Context<Stake>, amount: u64, thread_id: Vec<u8>) -> Result<()> {
    // Get Accounts
    let system_program = &ctx.accounts.system_program;
    let clockwork_thread_program = &ctx.accounts.clockwork_thread_program;
    let token_program = &ctx.accounts.token_program;
    let associated_token_program = &ctx.accounts.associated_token_program;
    let payer = &ctx.accounts.signer;
    let thread = &ctx.accounts.thread;
    let thread_authority = &ctx.accounts.thread_authority;
    let pool = &mut ctx.accounts.pool;
    let mint = &ctx.accounts.mint;
    let pool_token_account = &ctx.accounts.pool_token_account;

    // 1️⃣ Prepare an instruction to automate.
    // stake产出达到供应量的1%自动将产出从stake_account转移到pool_token_account
    let auto_fund_pool_ix = Instruction {
        program_id: ID,
        accounts: crate::accounts::FundPool {
            pool: pool.key(),
            pool_token_account: pool_token_account.key(),
            system_program: system_program.key(),
            payer: payer.key(),
            payer_token_account: ctx.accounts.stake_account.key(),
            thread: thread.key(),
            thread_authority: thread_authority.key(),
            mint: mint.key(),
            token_program: token_program.key(),
            associated_token_program: associated_token_program.key(),
        }
        .to_account_metas(Some(true)),
        data: crate::instruction::FundPool {
            amount: pool_token_account.amount.checked_div(100).unwrap(),
        }
        .data(),
    };

    // 2️⃣ Define a trigger for the thread.
    let trigger = Trigger::Slot {
        slot: pool
            .determine_auto_fund_pool_interval(pool_token_account.amount, amount)
            .unwrap(),
    };

    // 3️⃣ Create a Thread via CPI
    let bump = ctx.bumps.thread_authority;
    clockwork_sdk::cpi::thread_create(
        CpiContext::new_with_signer(
            clockwork_thread_program.to_account_info(),
            clockwork_sdk::cpi::ThreadCreate {
                payer: payer.to_account_info(),
                system_program: system_program.to_account_info(),
                thread: thread.to_account_info(),
                authority: thread_authority.to_account_info(),
            },
            &[&[THREAD_AUTHORITY_SEED, &[bump]]],
        ),
        LAMPORTS_PER_SOL,               // amount
        thread_id,                      // id
        vec![auto_fund_pool_ix.into()], // instructions
        trigger,                        // trigger
    )?;

    Ok(())
}

#[derive(Accounts)]
#[instruction(amount: u64, thread_id: Vec<u8>)]
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

    #[account(
        mut,
        seeds = [LiquidityPool::SEED_PREFIX.as_bytes()],
        bump = pool.bump,
    )]
    pub pool: Account<'info, LiquidityPool>,

    #[account(
        init_if_needed,
        payer = signer,
        associated_token::mint = mint,
        associated_token::authority = pool,
    )]
    pub pool_token_account: Account<'info, TokenAccount>,

    pub mint: Account<'info, Mint>,

    // solana ecosystem program
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,

    // clockwork
    /// Address to assign to the newly created thread.
    #[account(
        mut,
        address = Thread::pubkey(thread_authority.key(), thread_id),
    )]
    pub thread: SystemAccount<'info>,

    /// The pda that will own and manage the thread.
    #[account(seeds = [THREAD_AUTHORITY_SEED], bump)]
    pub thread_authority: SystemAccount<'info>,

    #[account(
        address = clockwork_sdk::ID
    )]
    pub clockwork_thread_program: Program<'info, ThreadProgram>,
}
