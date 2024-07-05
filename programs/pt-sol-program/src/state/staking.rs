use anchor_lang::prelude::*;

#[account]
pub struct StakeInfo {
    pub stake_at_slot: u64,
    pub is_staked: bool,
}

impl StakeInfo {
    pub fn get_thread_id(key: Pubkey) -> Vec<u8> {
        key.to_bytes()[..16].to_vec()
    }
}
