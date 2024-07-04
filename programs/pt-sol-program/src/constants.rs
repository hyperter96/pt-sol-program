use anchor_lang::prelude::*;

#[constant]
pub const METADATA_SEED: &[u8] = b"metadata";

#[constant]
pub const VAULT_SEED: &[u8] = b"vault";

#[constant]
pub const TOKEN_SEED: &[u8] = b"token";

#[constant]
pub const STAKE_INFO_SEED: &[u8] = b"stake_info";

#[account]
pub struct StakeInfo {
    pub stake_at_slot: u64,
    pub is_staked: bool,
}