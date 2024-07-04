//! Swap program account state
use anchor_lang::{prelude::*, system_program};
use anchor_spl::token::{transfer, Mint, Token, TokenAccount, Transfer};
use std::ops::{Add, Div, Mul};

use crate::error::SwapProgramError;

/// The `LiquidityPool` state - the inner data of the program-derived address
/// that will be our Liquidity Pool
#[account]
pub struct LiquidityPool {
    pub assets: Vec<Pubkey>,
    pub bump: u8,
}

impl LiquidityPool {

    // LP的seed prefix, 用于derive PDA
    pub const SEED_PREFIX: &'static str = "liquidity_pool";

    // discrimator + Vec(empty) + u8
    pub const SPACE: usize = 8 + 4 + 1;

    // create a new liquidity pool state
    pub fn new(bump: u8) -> Self {
        Self {
            assets: vec![],
            bump,
        }
    }
}

pub trait LiquidityPoolAccount<'info> {
    fn check_asset_key(&self, key: &Pubkey) -> Result<()>;
    fn add_asset(
        &mut self,
        key: Pubkey,
        payer: &Signer<'info>,
        system_program: &Program<'info, System>,
    ) -> Result<()>;
    fn realloc(
        &mut self,
        space_to_add: usize,
        payer: &Signer<'info>,
        system_program: &Program<'info, System>,
    ) -> Result<()>;
    fn fund(
        &mut self,
        deposit: (
            &Account<'info, Mint>,
            &Account<'info, TokenAccount>,
            &Account<'info, TokenAccount>,
            u64,
        ),
        authority: &Signer<'info>,
        system_program: &Program<'info, System>,
        token_program: &Program<'info, Token>,
    ) -> Result<()>;
    fn process_swap(
        &mut self,
        receive: (
            &Account<'info, Mint>,
            &Account<'info, TokenAccount>,
            &Account<'info, TokenAccount>,
        ),
        pay: (
            &Account<'info, Mint>,
            &Account<'info, TokenAccount>,
            &Account<'info, TokenAccount>,
            u64,
        ),
        authority: &Signer<'info>,
        token_program: &Program<'info, Token>,
    ) -> Result<()>;
}

impl<'info> LiquidityPoolAccount<'info> for Account<'info, LiquidityPool> {

    fn check_asset_key(&self, key: &Pubkey) -> Result<()> {
        if self.assets.contains(key) {
            Ok(())
        } else {
            Err(SwapProgramError::InvalidAssetKey.into())
        }
    }

    /// 如果资产不存在于流动性池的铸币地址列表中，则将其添加到该列表中
    /// 如果添加了铸币地址，这将需要重新分配账户的大小，因为向量将增加一个“公钥”，其大小为 32 字节
    fn add_asset(
        &mut self,
        key: Pubkey,
        payer: &Signer<'info>,
        system_program: &Program<'info, System>,
    ) -> Result<()> {
        match self.check_asset_key(&key) {
            Ok(()) => (),
            Err(_) => {
                self.realloc(32, payer, system_program)?;
                self.assets.push(key)
            }
        };

        Ok(())
    }

    /// 重新分配账户的大小以适应数据大小的变化。当流动性池的铸币地址向量（`Vec<Pubkey>`）的大小增加时，
    /// 此函数用于重新分配流动性池的账户，方法是将一个`Pubkey`推入向量
    fn realloc(
        &mut self,
        space_to_add: usize,
        payer: &Signer<'info>,
        system_program: &Program<'info, System>,
    ) -> Result<()> {

        let account_info = self.to_account_info();
        let new_account_size = account_info.data_len() + space_to_add;

        // 需要支付额外租金Rent
        let lamports_required = (Rent::get()?).minimum_balance(new_account_size);
        let additional_rent_to_fund = lamports_required - account_info.lamports();

        // Perform transfer of additional rent
        system_program::transfer(
            CpiContext::new(
                system_program.to_account_info(),
                system_program::Transfer {
                    from: payer.to_account_info(),
                    to: account_info.clone(),
                },
            ),
            additional_rent_to_fund,
        )?;

        // 重新分配account
        account_info.realloc(new_account_size, false)?;

        Ok(())
    }


    /// 通过将资产从付款人或流动性提供者的代币账户转移到流动性池的代币账户来为流动性池提供资金
    /// 
    /// 在这个函数中，程序还会将铸币地址添加到`LiquidityPool` 数据中存储的铸币地址列表中
    /// （如果不存在），并重新分配账户的大小
    fn fund(
        &mut self,
        deposit: (
            &Account<'info, Mint>,
            &Account<'info, TokenAccount>,
            &Account<'info, TokenAccount>,
            u64,
        ),
        authority: &Signer<'info>,
        system_program: &Program<'info, System>,
        token_program: &Program<'info, Token>,
    ) -> Result<()> {
        let (mint, from, to, amount) = deposit;
        self.add_asset(mint.key(), authority, system_program)?;
        // payer's Token Account => pool's Token Account
        process_transfer_to_pool(from, to, amount, authority, token_program)?;

        Ok(())
    }

    fn process_swap(
        &mut self,
        receive: (
            &Account<'info, Mint>,
            &Account<'info, TokenAccount>,
            &Account<'info, TokenAccount>,
        ),
        pay: (
            &Account<'info, Mint>,
            &Account<'info, TokenAccount>,
            &Account<'info, TokenAccount>,
            u64,
        ),
        authority: &Signer<'info>,
        token_program: &Program<'info, Token>,
    ) -> Result<()> {

        // (From, To)
        let (receive_mint, pool_recieve, payer_recieve) = receive;
        self.check_asset_key(&receive_mint.key())?;
        // (From, To)
        let (pay_mint, payer_pay, pool_pay, pay_amount) = pay;
        self.check_asset_key(&pay_mint.key())?;

        // 计算swap接收到的数额
        let receive_amount = determine_swap_receive(
            pool_recieve.amount,
            receive_mint.decimals,
            pool_pay.amount,
            pay_mint.decimals,
            pay_amount,
        )?;

        // Process the swap
        if receive_amount == 0 {
            Err(SwapProgramError::InvalidSwapNotEnoughPay.into())
        } else {
            process_transfer_to_pool(payer_pay, pool_pay, pay_amount, authority, token_program)?;
            process_transfer_from_pool(
                pool_recieve,
                payer_recieve,
                receive_amount,
                self,
                token_program,
            )?;
            Ok(())
        }

    }
}

/// Process a transfer from one the payer's token account to the
/// pool's token account using a CPI
fn process_transfer_to_pool<'info>(
    from: &Account<'info, TokenAccount>,
    to: &Account<'info, TokenAccount>,
    amount: u64,
    authority: &Signer<'info>,
    token_program: &Program<'info, Token>,
) -> Result<()> {
    transfer(
        CpiContext::new(
            token_program.to_account_info(),
            Transfer {
                from: from.to_account_info(),
                to: to.to_account_info(),
                authority: authority.to_account_info(),
            },
        ),
        amount,
    )
}

/// Process a transfer from the pool's token account to the
/// payer's token account using a CPI with signer seeds
fn process_transfer_from_pool<'info>(
    from: &Account<'info, TokenAccount>,
    to: &Account<'info, TokenAccount>,
    amount: u64,
    pool: &Account<'info, LiquidityPool>,
    token_program: &Program<'info, Token>,
) -> Result<()> {
    transfer(
        CpiContext::new_with_signer(
            token_program.to_account_info(),
            Transfer {
                from: from.to_account_info(),
                to: to.to_account_info(),
                authority: pool.to_account_info(),
            },
            &[&[LiquidityPool::SEED_PREFIX.as_bytes(), &[pool.bump]]],
        ),
        amount,
    )
}

fn determine_swap_receive(
    pool_recieve_balance: u64,
    receive_decimals: u8,
    pool_pay_balance: u64,
    pay_decimals: u8,
    pay_amount: u64,
) -> Result<u64> {
    // 交易手续费用 1%
    let t = 0.01;
    let gamma = 1.00 - t;

    // Convert all values to nominal floats using their respective mint decimal
    // places
    let big_r = convert_to_float(pool_recieve_balance, receive_decimals);
    let big_p = convert_to_float(pool_pay_balance, pay_decimals);
    let p = convert_to_float(pay_amount, pay_decimals);
    // Calculate `f(p)` to get `r`
    let numerator = big_r.mul(p).mul(gamma);
    let denomiator = big_p.add(p.mul(gamma));
    let r = numerator.div(denomiator);

    // Make sure `r` does not exceed liquidity
    if r > big_r {
        return Err(SwapProgramError::InvalidSwapNotEnoughLiquidity.into());
    }
    // Return the real value of `r`
    Ok(convert_from_float(r, receive_decimals))
}

/// Converts a `u64` value - in this case the balance of a token account - into
/// an `f32` by using the `decimals` value of its associated mint to get the
/// nominal quantity of a mint stored in that token account
///
/// For example, a token account with a balance of 10,500 for a mint with 3
/// decimals would have a nominal balance of 10.5
fn convert_to_float(value: u64, decimals: u8) -> f32 {
    (value as f32).div(f32::powf(10.0, decimals as f32))
}

/// Converts a nominal value - in this case the calculated value `r` - into a
/// `u64` by using the `decimals` value of its associated mint to get the real
/// quantity of the mint that the user will receive
///
/// For example, if `r` is calculated to be 10.5, the real amount of the asset
/// to be received by the user is 10,500
fn convert_from_float(value: f32, decimals: u8) -> u64 {
    value.mul(f32::powf(10.0, decimals as f32)) as u64
}