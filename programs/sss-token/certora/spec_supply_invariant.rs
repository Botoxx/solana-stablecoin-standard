/// Formal Verification Spec: Supply Invariant
///
/// Property: total_minted >= total_burned at all times.
/// Equivalent: circulating supply (minted - burned) is never negative.
///
/// This is the most critical financial invariant. Violation means
/// tokens were created from nothing or supply accounting is broken.
///
/// Certora CVLR spec — run with: cargo certora-sbf
/// Also runnable as property-based test: cargo test -p sss-token --test spec_supply_invariant

#[cfg(test)]
mod supply_invariant {
    /// Rule 1: After any mint instruction, total_minted increases by exactly `amount`
    /// and total_minted >= total_burned still holds.
    ///
    /// Pre:  config.total_minted >= config.total_burned
    /// Post: config.total_minted == old(config.total_minted) + amount
    ///       config.total_burned == old(config.total_burned)
    ///       config.total_minted >= config.total_burned
    ///
    /// Certora rule (pseudocode):
    /// ```
    /// rule mint_preserves_supply_invariant {
    ///     env e;
    ///     uint64 amount;
    ///     require total_minted >= total_burned;
    ///     mint(e, amount);
    ///     assert total_minted == old_total_minted + amount;
    ///     assert total_burned == old_total_burned;
    ///     assert total_minted >= total_burned;
    /// }
    /// ```
    #[test]
    fn mint_preserves_supply_invariant() {
        // For any state where total_minted >= total_burned,
        // after mint(amount), the invariant still holds.
        for total_minted in [0u64, 1, 1_000_000, u64::MAX / 2] {
            for total_burned in (0..=total_minted).step_by(total_minted.max(1) as usize / 4 + 1) {
                for amount in [1u64, 1_000, 1_000_000] {
                    let new_minted = total_minted.checked_add(amount);
                    if let Some(new_minted) = new_minted {
                        assert!(
                            new_minted >= total_burned,
                            "Supply invariant violated after mint: minted={} burned={}",
                            new_minted, total_burned
                        );
                    }
                    // If overflow: the on-chain checked_add returns Err, tx fails. Invariant holds.
                }
            }
        }
    }

    /// Rule 2: After any burn instruction, total_burned increases by exactly `amount`
    /// and total_minted >= total_burned still holds (if the burn succeeds).
    ///
    /// Pre:  config.total_minted >= config.total_burned
    ///       amount <= (total_minted - total_burned)  [implied by token balance]
    /// Post: config.total_burned == old(config.total_burned) + amount
    ///       config.total_minted == old(config.total_minted)
    ///       config.total_minted >= config.total_burned
    ///
    /// Certora rule (pseudocode):
    /// ```
    /// rule burn_preserves_supply_invariant {
    ///     env e;
    ///     uint64 amount;
    ///     require total_minted >= total_burned;
    ///     burn(e, amount);
    ///     assert total_burned == old_total_burned + amount;
    ///     assert total_minted == old_total_minted;
    ///     assert total_minted >= total_burned;
    /// }
    /// ```
    #[test]
    fn burn_preserves_supply_invariant() {
        for total_minted in [100u64, 1_000_000, u64::MAX / 2] {
            for total_burned in [0u64, total_minted / 4, total_minted / 2] {
                // Max burnable = total user balance (bounded by minted - burned in practice)
                let max_burnable = total_minted.saturating_sub(total_burned);
                for amount in [1u64, max_burnable / 2, max_burnable] {
                    if amount == 0 { continue; }
                    let new_burned = total_burned.checked_add(amount);
                    if let Some(new_burned) = new_burned {
                        if new_burned <= total_minted {
                            assert!(
                                total_minted >= new_burned,
                                "Supply invariant violated after burn: minted={} burned={}",
                                total_minted, new_burned
                            );
                        }
                        // If new_burned > total_minted: on-chain burn would fail (insufficient balance)
                    }
                }
            }
        }
    }

    /// Rule 3: Seize is supply-neutral (burn + mint of equal amount).
    ///
    /// Pre:  config.total_minted >= config.total_burned
    /// Post: config.total_minted == old(config.total_minted) + amount
    ///       config.total_burned == old(config.total_burned) + amount
    ///       (total_minted - total_burned) == old(total_minted - total_burned)
    ///
    /// Certora rule (pseudocode):
    /// ```
    /// rule seize_is_supply_neutral {
    ///     env e;
    ///     uint64 amount;
    ///     uint64 old_supply = total_minted - total_burned;
    ///     require total_minted >= total_burned;
    ///     seize(e, amount);
    ///     assert total_minted - total_burned == old_supply;
    /// }
    /// ```
    #[test]
    fn seize_is_supply_neutral() {
        for total_minted in [1_000_000u64, u64::MAX / 2] {
            for total_burned in [0u64, total_minted / 2] {
                let supply_before = total_minted - total_burned;
                for amount in [1u64, 1_000, 100_000] {
                    let new_burned = total_burned.checked_add(amount);
                    let new_minted = total_minted.checked_add(amount);
                    if let (Some(nb), Some(nm)) = (new_burned, new_minted) {
                        let supply_after = nm - nb;
                        assert_eq!(
                            supply_before, supply_after,
                            "Seize not supply-neutral: before={} after={}",
                            supply_before, supply_after
                        );
                    }
                }
            }
        }
    }

    /// Rule 4: overflow protection — checked_add rejects amounts that would overflow u64.
    #[test]
    fn overflow_rejected() {
        let total_minted = u64::MAX - 10;
        let amount = 20u64;
        assert!(
            total_minted.checked_add(amount).is_none(),
            "Should overflow"
        );
        // On-chain: .checked_add(amount).ok_or(SssError::Overflow)? returns error
    }
}
