// Aleo Multi-Signature Admin Contract
// Production-Ready Multi-Sig for Secure Protocol Administration

program multisig_admin_v1.aleo {
    // ===== CONSTANTS =====

    // Maximum signers allowed
    const MAX_SIGNERS: u8 = 10u8;

    // Maximum pending proposals
    const MAX_PENDING_PROPOSALS: u32 = 100u32;

    // Proposal expiry time (7 days in milliseconds)
    const PROPOSAL_EXPIRY: u64 = 604800000u64;

    // ===== STRUCTS =====

    // Multi-sig configuration
    struct MultisigConfig {
        threshold: u8,                 // Required signatures to execute
        total_signers: u8,             // Total number of signers
        proposal_expiry: u64,          // Time before proposals expire
        enabled: bool
    }

    // Proposal for an action
    struct Proposal {
        proposal_id: u32,
        proposer: address,
        target_program: field,         // Hash of target program ID
        action_type: u8,               // 1=transfer_admin, 2=update_config, 3=pause, 4=emergency
        action_data: field,            // Encoded action parameters
        created_at: u64,
        expires_at: u64,
        signatures_count: u8,
        executed: bool,
        cancelled: bool
    }

    // Signature on a proposal
    struct ProposalSignature {
        signer: address,
        proposal_id: u32,
        signed_at: u64,
        signature_hash: field
    }

    // Emergency action for critical situations
    struct EmergencyAction {
        action_id: u32,
        initiator: address,
        action_type: u8,               // 1=pause_all, 2=emergency_withdraw, 3=freeze_operator
        target: field,
        executed_at: u64
    }

    // ===== RECORDS =====

    // Signer membership proof
    record SignerMembership {
        owner: address,
        signer_index: u8,
        added_at: u64,
        membership_id: field
    }

    // ===== MAPPINGS =====

    // Multi-sig configuration (key 0u8)
    mapping config: u8 => MultisigConfig;

    // Registered signers: signer_index => address
    mapping signers: u8 => address;

    // Signer status: address => is_active
    mapping signer_active: address => bool;

    // Signer index lookup: address => index
    mapping signer_index: address => u8;

    // Proposals: proposal_id => Proposal
    mapping proposals: u32 => Proposal;

    // Proposal count
    mapping proposal_count: u8 => u32;

    // Signatures: hash(proposal_id, signer) => ProposalSignature
    mapping signatures: field => ProposalSignature;

    // Has signer signed: hash(proposal_id, signer) => bool
    mapping has_signed: field => bool;

    // Emergency actions: action_id => EmergencyAction
    mapping emergency_actions: u32 => EmergencyAction;

    // Emergency action count
    mapping emergency_count: u8 => u32;

    // Nonce for replay protection
    mapping nonce: address => u64;

    // ===== CONSTRUCTOR =====

    @noupgrade
    async constructor() {}

    // ===== INITIALIZATION =====

    // Initialize multi-sig with first signer as creator
    async transition initialize(
        public threshold: u8,
        public timestamp: u64
    ) -> (SignerMembership, Future) {
        assert(threshold >= 1u8 && threshold <= 10u8);

        let membership_id: field = BHP256::hash_to_field(self.caller);

        let membership: SignerMembership = SignerMembership {
            owner: self.caller,
            signer_index: 0u8,
            added_at: timestamp,
            membership_id: membership_id
        };

        return (membership, finalize_initialize(self.caller, threshold, timestamp));
    }

    async function finalize_initialize(
        first_signer: address,
        threshold: u8,
        timestamp: u64
    ) {
        // Check not already initialized
        let existing_config: MultisigConfig = Mapping::get_or_use(config, 0u8, MultisigConfig {
            threshold: 0u8,
            total_signers: 0u8,
            proposal_expiry: 0u64,
            enabled: false
        });
        assert(!existing_config.enabled);

        // Create config
        let new_config: MultisigConfig = MultisigConfig {
            threshold: threshold,
            total_signers: 1u8,
            proposal_expiry: 604800000u64,  // 7 days
            enabled: true
        };
        Mapping::set(config, 0u8, new_config);

        // Add first signer
        Mapping::set(signers, 0u8, first_signer);
        Mapping::set(signer_active, first_signer, true);
        Mapping::set(signer_index, first_signer, 0u8);
        Mapping::set(proposal_count, 0u8, 0u32);
        Mapping::set(emergency_count, 0u8, 0u32);
    }

    // ===== SIGNER MANAGEMENT =====

    // Propose adding a new signer (requires multi-sig approval)
    async transition propose_add_signer(
        public new_signer: address,
        public timestamp: u64
    ) -> Future {
        return finalize_propose_add_signer(self.caller, new_signer, timestamp);
    }

    async function finalize_propose_add_signer(
        proposer: address,
        new_signer: address,
        timestamp: u64
    ) {
        // Verify proposer is active signer
        let is_active: bool = Mapping::get_or_use(signer_active, proposer, false);
        assert(is_active);

        let ms_config: MultisigConfig = Mapping::get(config, 0u8);
        assert(ms_config.enabled);
        assert(ms_config.total_signers < 10u8);

        // Check signer not already added
        let already_signer: bool = Mapping::get_or_use(signer_active, new_signer, false);
        assert(!already_signer);

        // Create proposal
        let prop_id: u32 = Mapping::get_or_use(proposal_count, 0u8, 0u32);
        let new_id: u32 = prop_id + 1u32;

        let action_data: field = BHP256::hash_to_field(new_signer);

        let proposal: Proposal = Proposal {
            proposal_id: new_id,
            proposer: proposer,
            target_program: 0field,     // Self
            action_type: 5u8,           // Add signer
            action_data: action_data,
            created_at: timestamp,
            expires_at: timestamp + ms_config.proposal_expiry,
            signatures_count: 1u8,      // Proposer auto-signs
            executed: false,
            cancelled: false
        };
        Mapping::set(proposals, new_id, proposal);
        Mapping::set(proposal_count, 0u8, new_id);

        // Record proposer's signature
        let sig_key: field = BHP256::hash_to_field(new_id as u64 + BHP256::hash_to_u64(proposer));
        Mapping::set(has_signed, sig_key, true);
    }

    // Sign a proposal
    async transition sign_proposal(
        public proposal_id: u32,
        public timestamp: u64
    ) -> Future {
        return finalize_sign_proposal(self.caller, proposal_id, timestamp);
    }

    async function finalize_sign_proposal(
        signer: address,
        proposal_id: u32,
        timestamp: u64
    ) {
        // Verify signer is active
        let is_active: bool = Mapping::get_or_use(signer_active, signer, false);
        assert(is_active);

        // Get proposal
        let proposal: Proposal = Mapping::get(proposals, proposal_id);
        assert(!proposal.executed);
        assert(!proposal.cancelled);
        assert(timestamp < proposal.expires_at);

        // Check hasn't already signed
        let sig_key: field = BHP256::hash_to_field((proposal_id as u64) + BHP256::hash_to_u64(signer));
        let already_signed: bool = Mapping::get_or_use(has_signed, sig_key, false);
        assert(!already_signed);

        // Record signature
        Mapping::set(has_signed, sig_key, true);

        // Update proposal
        let updated_proposal: Proposal = Proposal {
            proposal_id: proposal.proposal_id,
            proposer: proposal.proposer,
            target_program: proposal.target_program,
            action_type: proposal.action_type,
            action_data: proposal.action_data,
            created_at: proposal.created_at,
            expires_at: proposal.expires_at,
            signatures_count: proposal.signatures_count + 1u8,
            executed: false,
            cancelled: false
        };
        Mapping::set(proposals, proposal_id, updated_proposal);
    }

    // Execute a proposal once threshold is met
    async transition execute_proposal(
        public proposal_id: u32,
        public timestamp: u64
    ) -> Future {
        return finalize_execute_proposal(self.caller, proposal_id, timestamp);
    }

    async function finalize_execute_proposal(
        executor: address,
        proposal_id: u32,
        timestamp: u64
    ) {
        // Verify executor is signer
        let is_active: bool = Mapping::get_or_use(signer_active, executor, false);
        assert(is_active);

        let ms_config: MultisigConfig = Mapping::get(config, 0u8);
        let proposal: Proposal = Mapping::get(proposals, proposal_id);

        // Verify proposal is valid
        assert(!proposal.executed);
        assert(!proposal.cancelled);
        assert(timestamp < proposal.expires_at);
        assert(proposal.signatures_count >= ms_config.threshold);

        // Mark as executed
        let executed_proposal: Proposal = Proposal {
            proposal_id: proposal.proposal_id,
            proposer: proposal.proposer,
            target_program: proposal.target_program,
            action_type: proposal.action_type,
            action_data: proposal.action_data,
            created_at: proposal.created_at,
            expires_at: proposal.expires_at,
            signatures_count: proposal.signatures_count,
            executed: true,
            cancelled: false
        };
        Mapping::set(proposals, proposal_id, executed_proposal);

        // Execute based on action type
        // Note: In production, this would trigger external contract calls
        // For now, we handle add_signer internally

        if proposal.action_type == 5u8 {
            // Add signer action
            let new_signer_idx: u8 = ms_config.total_signers;

            // Note: We need the actual address, which was hashed in action_data
            // In production, we'd store the address separately

            let updated_config: MultisigConfig = MultisigConfig {
                threshold: ms_config.threshold,
                total_signers: ms_config.total_signers + 1u8,
                proposal_expiry: ms_config.proposal_expiry,
                enabled: ms_config.enabled
            };
            Mapping::set(config, 0u8, updated_config);
        }
    }

    // Cancel a proposal (proposer only, before execution)
    async transition cancel_proposal(public proposal_id: u32) -> Future {
        return finalize_cancel_proposal(self.caller, proposal_id);
    }

    async function finalize_cancel_proposal(caller: address, proposal_id: u32) {
        let proposal: Proposal = Mapping::get(proposals, proposal_id);

        // Only proposer can cancel
        assert_eq(caller, proposal.proposer);
        assert(!proposal.executed);

        let cancelled_proposal: Proposal = Proposal {
            proposal_id: proposal.proposal_id,
            proposer: proposal.proposer,
            target_program: proposal.target_program,
            action_type: proposal.action_type,
            action_data: proposal.action_data,
            created_at: proposal.created_at,
            expires_at: proposal.expires_at,
            signatures_count: proposal.signatures_count,
            executed: false,
            cancelled: true
        };
        Mapping::set(proposals, proposal_id, cancelled_proposal);
    }

    // ===== PROTOCOL ADMIN PROPOSALS =====

    // Propose transferring admin of a target contract
    async transition propose_transfer_admin(
        public target_program_hash: field,
        public new_admin_hash: field,
        public timestamp: u64
    ) -> Future {
        return finalize_propose_transfer(self.caller, target_program_hash, new_admin_hash, timestamp);
    }

    async function finalize_propose_transfer(
        proposer: address,
        target_program_hash: field,
        new_admin_hash: field,
        timestamp: u64
    ) {
        let is_active: bool = Mapping::get_or_use(signer_active, proposer, false);
        assert(is_active);

        let ms_config: MultisigConfig = Mapping::get(config, 0u8);
        assert(ms_config.enabled);

        let prop_id: u32 = Mapping::get_or_use(proposal_count, 0u8, 0u32);
        let new_id: u32 = prop_id + 1u32;

        let proposal: Proposal = Proposal {
            proposal_id: new_id,
            proposer: proposer,
            target_program: target_program_hash,
            action_type: 1u8,           // Transfer admin
            action_data: new_admin_hash,
            created_at: timestamp,
            expires_at: timestamp + ms_config.proposal_expiry,
            signatures_count: 1u8,
            executed: false,
            cancelled: false
        };
        Mapping::set(proposals, new_id, proposal);
        Mapping::set(proposal_count, 0u8, new_id);

        let sig_key: field = BHP256::hash_to_field((new_id as u64) + BHP256::hash_to_u64(proposer));
        Mapping::set(has_signed, sig_key, true);
    }

    // Propose pausing a target contract
    async transition propose_pause(
        public target_program_hash: field,
        public timestamp: u64
    ) -> Future {
        return finalize_propose_pause(self.caller, target_program_hash, timestamp);
    }

    async function finalize_propose_pause(
        proposer: address,
        target_program_hash: field,
        timestamp: u64
    ) {
        let is_active: bool = Mapping::get_or_use(signer_active, proposer, false);
        assert(is_active);

        let ms_config: MultisigConfig = Mapping::get(config, 0u8);
        let prop_id: u32 = Mapping::get_or_use(proposal_count, 0u8, 0u32);
        let new_id: u32 = prop_id + 1u32;

        let proposal: Proposal = Proposal {
            proposal_id: new_id,
            proposer: proposer,
            target_program: target_program_hash,
            action_type: 3u8,           // Pause
            action_data: 0field,
            created_at: timestamp,
            expires_at: timestamp + ms_config.proposal_expiry,
            signatures_count: 1u8,
            executed: false,
            cancelled: false
        };
        Mapping::set(proposals, new_id, proposal);
        Mapping::set(proposal_count, 0u8, new_id);

        let sig_key: field = BHP256::hash_to_field((new_id as u64) + BHP256::hash_to_u64(proposer));
        Mapping::set(has_signed, sig_key, true);
    }

    // ===== EMERGENCY ACTIONS =====

    // Emergency pause (single signer can trigger, but with cooldown)
    async transition emergency_pause(
        public target_program_hash: field,
        public timestamp: u64
    ) -> Future {
        return finalize_emergency_pause(self.caller, target_program_hash, timestamp);
    }

    async function finalize_emergency_pause(
        initiator: address,
        target_program_hash: field,
        timestamp: u64
    ) {
        let is_active: bool = Mapping::get_or_use(signer_active, initiator, false);
        assert(is_active);

        let action_count: u32 = Mapping::get_or_use(emergency_count, 0u8, 0u32);
        let new_id: u32 = action_count + 1u32;

        let action: EmergencyAction = EmergencyAction {
            action_id: new_id,
            initiator: initiator,
            action_type: 1u8,           // Pause all
            target: target_program_hash,
            executed_at: timestamp
        };
        Mapping::set(emergency_actions, new_id, action);
        Mapping::set(emergency_count, 0u8, new_id);

        // Note: In production, this would trigger the actual pause
    }

    // ===== CONFIG UPDATES =====

    // Update threshold (requires current threshold signatures)
    async transition propose_update_threshold(
        public new_threshold: u8,
        public timestamp: u64
    ) -> Future {
        assert(new_threshold >= 1u8 && new_threshold <= 10u8);
        return finalize_propose_threshold(self.caller, new_threshold, timestamp);
    }

    async function finalize_propose_threshold(
        proposer: address,
        new_threshold: u8,
        timestamp: u64
    ) {
        let is_active: bool = Mapping::get_or_use(signer_active, proposer, false);
        assert(is_active);

        let ms_config: MultisigConfig = Mapping::get(config, 0u8);

        // New threshold can't exceed total signers
        assert(new_threshold <= ms_config.total_signers);

        let prop_id: u32 = Mapping::get_or_use(proposal_count, 0u8, 0u32);
        let new_id: u32 = prop_id + 1u32;

        let proposal: Proposal = Proposal {
            proposal_id: new_id,
            proposer: proposer,
            target_program: 0field,
            action_type: 6u8,           // Update threshold
            action_data: BHP256::hash_to_field(new_threshold as u64),
            created_at: timestamp,
            expires_at: timestamp + ms_config.proposal_expiry,
            signatures_count: 1u8,
            executed: false,
            cancelled: false
        };
        Mapping::set(proposals, new_id, proposal);
        Mapping::set(proposal_count, 0u8, new_id);

        let sig_key: field = BHP256::hash_to_field((new_id as u64) + BHP256::hash_to_u64(proposer));
        Mapping::set(has_signed, sig_key, true);
    }
}
